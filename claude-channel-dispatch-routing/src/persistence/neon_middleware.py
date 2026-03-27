"""
Scrapy middleware and cache storage backed by Neon Postgres.

* NeonDeltaFetchMiddleware  -- downloader middleware for content-hash based dedup
* NeonPostgresCacheStorage  -- HttpCacheStorage implementation stored in Postgres
"""

import gzip
import hashlib
import json
import logging
import os
import time
from email.utils import formatdate
from typing import Optional

from scrapy import Request, signals
from scrapy.exceptions import IgnoreRequest
from scrapy.http import HtmlResponse, Response
from scrapy.settings import Settings

logger = logging.getLogger(__name__)

# Default time-to-live in seconds (24 h).  Override via NEON_DELTA_FETCH_TTL.
_DEFAULT_TTL = 86400


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _get_client():
    """Lazy import to avoid hard-coupling at module level."""
    from src.persistence.neon_client import NeonClient
    return NeonClient()


# ===================================================================
# NeonDeltaFetchMiddleware
# ===================================================================

class NeonDeltaFetchMiddleware:
    """Scrapy downloader middleware that skips requests whose content has
    not changed since the last crawl, using SHA-256 hashes stored in
    ``runtime.crawl_events``.

    Settings
    --------
    NEON_DELTA_FETCH_ENABLED : bool (default True)
    NEON_DELTA_FETCH_TTL     : int  seconds (default 86400)
    """

    def __init__(self, ttl: int, enabled: bool):
        self._ttl = ttl
        self._enabled = enabled
        self._client = None

    # ------------------------------------------------------------------
    # Scrapy interface
    # ------------------------------------------------------------------

    @classmethod
    def from_crawler(cls, crawler):
        settings: Settings = crawler.settings
        enabled = settings.getbool("NEON_DELTA_FETCH_ENABLED", True)
        ttl = settings.getint("NEON_DELTA_FETCH_TTL", _DEFAULT_TTL)
        mw = cls(ttl=ttl, enabled=enabled)

        if not enabled:
            logger.info("NeonDeltaFetchMiddleware: disabled via settings")
            return mw

        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            logger.warning(
                "NeonDeltaFetchMiddleware: DATABASE_URL not set -- middleware disabled"
            )
            mw._enabled = False
            return mw

        try:
            mw._client = _get_client()
        except Exception as exc:
            logger.warning(
                "NeonDeltaFetchMiddleware: could not connect to DB (%s) -- middleware disabled",
                exc,
            )
            mw._enabled = False

        return mw

    # ------------------------------------------------------------------
    # process_request
    # ------------------------------------------------------------------

    def process_request(self, request: Request, spider):
        if not self._enabled or self._client is None:
            return None  # let Scrapy continue normally

        url = request.url
        row = self._client.execute_one(
            """
            SELECT content_hash, etag, last_modified, crawled_at
            FROM runtime.crawl_events
            WHERE url = %s
            ORDER BY crawled_at DESC
            LIMIT 1
            """,
            (url,),
        )

        if row is None:
            return None  # first time seeing this URL

        stored_hash: Optional[str] = row.get("content_hash")
        etag: Optional[str] = row.get("etag")
        last_modified: Optional[str] = row.get("last_modified")
        crawled_at = row.get("crawled_at")

        # Attach conditional headers so the origin server can return 304
        if etag:
            request.headers.setdefault(b"If-None-Match", etag.encode())
        if last_modified:
            request.headers.setdefault(b"If-Modified-Since", last_modified.encode())

        # If within TTL and we have a hash, skip entirely
        if stored_hash and crawled_at is not None:
            try:
                age = time.time() - crawled_at.timestamp()
            except (AttributeError, TypeError):
                age = 0
            if age < self._ttl:
                logger.info(
                    "NeonDeltaFetchMiddleware: skipping %s (unchanged, age=%ds, ttl=%ds)",
                    url,
                    int(age),
                    self._ttl,
                )
                raise IgnoreRequest(
                    f"Skipped (content unchanged within TTL): {url}"
                )

        return None

    # ------------------------------------------------------------------
    # process_response
    # ------------------------------------------------------------------

    def process_response(self, request: Request, response: Response, spider):
        if not self._enabled or self._client is None:
            return response

        url = request.url

        # 304 Not Modified ------------------------------------------------
        if response.status == 304:
            logger.info("NeonDeltaFetchMiddleware: %s unchanged (304)", url)
            return response

        # 200 OK ----------------------------------------------------------
        if response.status == 200:
            new_hash = _sha256(response.body)

            row = self._client.execute_one(
                """
                SELECT content_hash
                FROM runtime.crawl_events
                WHERE url = %s
                ORDER BY crawled_at DESC
                LIMIT 1
                """,
                (url,),
            )

            old_hash = row.get("content_hash") if row else None

            if old_hash and old_hash == new_hash:
                logger.info(
                    "NeonDeltaFetchMiddleware: %s content identical (hash=%s)",
                    url,
                    new_hash[:12],
                )
                request.meta["delta_fetch_skip_pipeline"] = True
                return response

            # Content changed -- store the new event
            etag = (
                response.headers.get(b"ETag", b"").decode("utf-8", errors="replace")
                or None
            )
            last_modified = (
                response.headers.get(b"Last-Modified", b"").decode(
                    "utf-8", errors="replace"
                )
                or None
            )
            self._client.execute(
                """
                INSERT INTO runtime.crawl_events (url, content_hash, etag, last_modified, crawled_at)
                VALUES (%s, %s, %s, %s, NOW())
                """,
                (url, new_hash, etag, last_modified),
            )

        return response


# ===================================================================
# NeonPostgresCacheStorage
# ===================================================================

class NeonPostgresCacheStorage:
    """Scrapy ``HttpCacheStorage`` that persists cached responses in a
    Neon Postgres table ``runtime.http_cache``.

    Falls back to ``scrapy.extensions.httpcache.FilesystemCacheStorage`` when
    ``DATABASE_URL`` is not available.
    """

    def __init__(self, settings: Settings):
        self._settings = settings
        self._client = None
        self._fallback = None
        self._expiration_secs: int = settings.getint("HTTPCACHE_EXPIRATION_SECS", 0)

    # ------------------------------------------------------------------
    # Scrapy cache storage interface
    # ------------------------------------------------------------------

    def open_spider(self, spider):
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            logger.warning(
                "NeonPostgresCacheStorage: DATABASE_URL not set -- falling back to filesystem"
            )
            self._init_fallback(spider)
            return

        try:
            self._client = _get_client()
            # Ensure the cache table exists
            self._client.execute(
                """
                CREATE SCHEMA IF NOT EXISTS runtime;
                """
            )
            self._client.execute(
                """
                CREATE TABLE IF NOT EXISTS runtime.http_cache (
                    fingerprint TEXT PRIMARY KEY,
                    url         TEXT NOT NULL,
                    status      INTEGER NOT NULL,
                    headers_json TEXT NOT NULL,
                    body_gzip   BYTEA NOT NULL,
                    cached_at   DOUBLE PRECISION NOT NULL
                );
                """
            )
            logger.info("NeonPostgresCacheStorage: opened for spider %s", spider.name)
        except Exception as exc:
            logger.warning(
                "NeonPostgresCacheStorage: DB error (%s) -- falling back to filesystem",
                exc,
            )
            self._client = None
            self._init_fallback(spider)

    def close_spider(self, spider):
        if self._fallback is not None:
            self._fallback.close_spider(spider)
            return
        if self._client is not None:
            self._client.close()
            logger.info("NeonPostgresCacheStorage: closed for spider %s", spider.name)

    def retrieve_response(self, spider, request: Request):
        if self._fallback is not None:
            return self._fallback.retrieve_response(spider, request)
        if self._client is None:
            return None

        fingerprint = self._fingerprint(request)
        row = self._client.execute_one(
            """
            SELECT url, status, headers_json, body_gzip, cached_at
            FROM runtime.http_cache
            WHERE fingerprint = %s
            """,
            (fingerprint,),
        )

        if row is None:
            return None

        # Expiration check
        if self._expiration_secs > 0:
            age = time.time() - row["cached_at"]
            if age > self._expiration_secs:
                logger.debug(
                    "NeonPostgresCacheStorage: expired entry for %s (age=%.0fs)",
                    request.url,
                    age,
                )
                # Remove stale entry
                self._client.execute(
                    "DELETE FROM runtime.http_cache WHERE fingerprint = %s",
                    (fingerprint,),
                )
                return None

        headers = json.loads(row["headers_json"])
        body = gzip.decompress(bytes(row["body_gzip"]))

        return HtmlResponse(
            url=row["url"],
            status=row["status"],
            headers=headers,
            body=body,
            request=request,
        )

    def store_response(self, spider, request: Request, response: Response):
        if self._fallback is not None:
            self._fallback.store_response(spider, request, response)
            return
        if self._client is None:
            return

        fingerprint = self._fingerprint(request)
        headers_json = json.dumps(
            {
                k.decode("utf-8", errors="replace"): [
                    v.decode("utf-8", errors="replace") for v in vs
                ]
                for k, vs in response.headers.items()
            }
        )
        body_gzip = gzip.compress(response.body)

        self._client.execute(
            """
            INSERT INTO runtime.http_cache (fingerprint, url, status, headers_json, body_gzip, cached_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (fingerprint) DO UPDATE
                SET url          = EXCLUDED.url,
                    status       = EXCLUDED.status,
                    headers_json = EXCLUDED.headers_json,
                    body_gzip    = EXCLUDED.body_gzip,
                    cached_at    = EXCLUDED.cached_at
            """,
            (fingerprint, request.url, response.status, headers_json, body_gzip, time.time()),
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _fingerprint(request: Request) -> str:
        return hashlib.sha1(request.url.encode("utf-8")).hexdigest()

    def _init_fallback(self, spider):
        from scrapy.extensions.httpcache import FilesystemCacheStorage

        self._fallback = FilesystemCacheStorage(self._settings)
        self._fallback.open_spider(spider)
