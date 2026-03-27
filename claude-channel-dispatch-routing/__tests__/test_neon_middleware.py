"""
Tests for the Neon Postgres persistence middleware and cache storage.

All database interactions are mocked -- no real Postgres connection needed.
"""

import gzip
import hashlib
import json
import time
from datetime import datetime, timezone
from unittest import mock
from unittest.mock import MagicMock, patch

import pytest
from scrapy.exceptions import IgnoreRequest
from scrapy.http import HtmlResponse, Request, Response
from scrapy.settings import Settings


# ---------------------------------------------------------------------------
# Fixtures & helpers
# ---------------------------------------------------------------------------

def _make_settings(**overrides):
    base = {
        "NEON_DELTA_FETCH_ENABLED": True,
        "NEON_DELTA_FETCH_TTL": 86400,
        "HTTPCACHE_EXPIRATION_SECS": 3600,
    }
    base.update(overrides)
    return Settings(base)


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _mock_crawler(settings=None):
    crawler = MagicMock()
    crawler.settings = settings or _make_settings()
    return crawler


def _fake_client(execute_one_rv=None, execute_rv=None):
    client = MagicMock()
    client.execute_one.return_value = execute_one_rv
    client.execute.return_value = execute_rv or []
    client.is_connected.return_value = True
    return client


# ===================================================================
# NeonDeltaFetchMiddleware tests
# ===================================================================

class TestNeonDeltaFetchMiddleware:

    @patch.dict("os.environ", {"DATABASE_URL": "postgres://fake/db"})
    @patch("src.persistence.neon_middleware._get_client")
    def test_middleware_skips_unchanged(self, mock_get_client):
        """When stored hash matches and within TTL the request is skipped."""
        from src.persistence.neon_middleware import NeonDeltaFetchMiddleware

        recent = datetime.now(timezone.utc)
        client = _fake_client(
            execute_one_rv={
                "content_hash": "abc123",
                "etag": '"etag-1"',
                "last_modified": "Mon, 01 Jan 2024 00:00:00 GMT",
                "crawled_at": recent,
            }
        )
        mock_get_client.return_value = client

        crawler = _mock_crawler()
        mw = NeonDeltaFetchMiddleware.from_crawler(crawler)

        request = Request("https://example.com/page")
        spider = MagicMock()

        with pytest.raises(IgnoreRequest, match="Skipped"):
            mw.process_request(request, spider)

    @patch.dict("os.environ", {"DATABASE_URL": "postgres://fake/db"})
    @patch("src.persistence.neon_middleware._get_client")
    def test_middleware_processes_changed(self, mock_get_client):
        """When stored hash differs from new content the response proceeds."""
        from src.persistence.neon_middleware import NeonDeltaFetchMiddleware

        old_hash = _sha256(b"old content")
        new_body = b"new content"

        client = _fake_client(
            execute_one_rv={
                "content_hash": old_hash,
                "etag": None,
                "last_modified": None,
                "crawled_at": datetime.now(timezone.utc),
            }
        )
        mock_get_client.return_value = client

        crawler = _mock_crawler()
        mw = NeonDeltaFetchMiddleware.from_crawler(crawler)

        request = Request("https://example.com/page")
        response = HtmlResponse(
            url="https://example.com/page",
            body=new_body,
            request=request,
        )
        spider = MagicMock()

        # process_request: the hash exists but we need to re-download anyway
        # because TTL logic will skip; use a stale crawled_at to avoid skip
        client.execute_one.return_value = {
            "content_hash": old_hash,
            "etag": None,
            "last_modified": None,
            "crawled_at": datetime(2000, 1, 1, tzinfo=timezone.utc),  # very old
        }
        result = mw.process_request(request, spider)
        assert result is None  # should not skip

        # Reset for process_response lookup
        client.execute_one.return_value = {"content_hash": old_hash}

        result = mw.process_response(request, response, spider)
        assert result is response
        # The middleware should have written a new crawl_event row
        client.execute.assert_called()
        insert_call = client.execute.call_args
        assert "INSERT INTO runtime.crawl_events" in insert_call[0][0]

    @patch.dict("os.environ", {}, clear=True)
    def test_middleware_graceful_fallback(self):
        """When DATABASE_URL is not set the middleware disables itself."""
        from src.persistence.neon_middleware import NeonDeltaFetchMiddleware

        # Ensure DATABASE_URL is absent
        import os
        os.environ.pop("DATABASE_URL", None)

        crawler = _mock_crawler()
        mw = NeonDeltaFetchMiddleware.from_crawler(crawler)

        assert mw._enabled is False
        assert mw._client is None

        # Calls should be no-ops
        request = Request("https://example.com/page")
        response = HtmlResponse(url="https://example.com/page", body=b"hi", request=request)
        spider = MagicMock()

        assert mw.process_request(request, spider) is None
        assert mw.process_response(request, response, spider) is response


# ===================================================================
# NeonPostgresCacheStorage tests
# ===================================================================

class TestNeonPostgresCacheStorage:

    @patch.dict("os.environ", {"DATABASE_URL": "postgres://fake/db"})
    @patch("src.persistence.neon_middleware._get_client")
    def test_cache_storage_store_retrieve(self, mock_get_client):
        """Round-trip: store a response then retrieve it."""
        from src.persistence.neon_middleware import NeonPostgresCacheStorage

        client = _fake_client()
        mock_get_client.return_value = client

        settings = _make_settings(HTTPCACHE_EXPIRATION_SECS=3600)
        storage = NeonPostgresCacheStorage(settings)

        spider = MagicMock()
        spider.name = "test_spider"
        storage.open_spider(spider)

        # -- store --
        request = Request("https://example.com/page")
        body = b"<html>hello</html>"
        response = HtmlResponse(
            url="https://example.com/page",
            status=200,
            body=body,
            headers={"Content-Type": "text/html"},
            request=request,
        )
        storage.store_response(spider, request, response)

        # Verify INSERT was called
        insert_call = client.execute.call_args_list[-1]
        sql = insert_call[0][0]
        assert "INSERT INTO runtime.http_cache" in sql

        params = insert_call[0][1]
        stored_fingerprint = params[0]
        stored_body_gzip = params[4]
        assert gzip.decompress(stored_body_gzip) == body

        # -- retrieve --
        # Simulate DB returning what was stored
        headers_dict = {"Content-Type": ["text/html"]}
        client.execute_one.return_value = {
            "url": "https://example.com/page",
            "status": 200,
            "headers_json": json.dumps(headers_dict),
            "body_gzip": gzip.compress(body),
            "cached_at": time.time(),
        }

        cached = storage.retrieve_response(spider, request)
        assert cached is not None
        assert cached.status == 200
        assert cached.body == body
        assert cached.url == "https://example.com/page"

        storage.close_spider(spider)

    @patch.dict("os.environ", {"DATABASE_URL": "postgres://fake/db"})
    @patch("src.persistence.neon_middleware._get_client")
    def test_cache_storage_expiration(self, mock_get_client):
        """Expired entries should return None and be deleted."""
        from src.persistence.neon_middleware import NeonPostgresCacheStorage

        client = _fake_client()
        mock_get_client.return_value = client

        settings = _make_settings(HTTPCACHE_EXPIRATION_SECS=60)
        storage = NeonPostgresCacheStorage(settings)

        spider = MagicMock()
        spider.name = "test_spider"
        storage.open_spider(spider)

        request = Request("https://example.com/old")

        # Cached 2 hours ago -- definitely expired with 60s TTL
        client.execute_one.return_value = {
            "url": "https://example.com/old",
            "status": 200,
            "headers_json": json.dumps({}),
            "body_gzip": gzip.compress(b"stale"),
            "cached_at": time.time() - 7200,
        }

        result = storage.retrieve_response(spider, request)
        assert result is None

        # Should have issued a DELETE for the expired row
        delete_call = client.execute.call_args_list[-1]
        assert "DELETE FROM runtime.http_cache" in delete_call[0][0]

        storage.close_spider(spider)

    @patch.dict("os.environ", {}, clear=True)
    def test_cache_storage_fallback_to_filesystem(self):
        """When DATABASE_URL is missing, falls back to FilesystemCacheStorage."""
        from src.persistence.neon_middleware import NeonPostgresCacheStorage

        import os
        os.environ.pop("DATABASE_URL", None)

        settings = _make_settings()
        storage = NeonPostgresCacheStorage(settings)

        spider = MagicMock()
        spider.name = "test_spider"

        with patch(
            "src.persistence.neon_middleware.FilesystemCacheStorage",
            create=True,
        ) as mock_fs_cls:
            mock_fs = MagicMock()
            mock_fs_cls.return_value = mock_fs

            # Patch the import inside _init_fallback
            with patch(
                "scrapy.extensions.httpcache.FilesystemCacheStorage",
                mock_fs_cls,
            ):
                storage.open_spider(spider)

            assert storage._fallback is not None
