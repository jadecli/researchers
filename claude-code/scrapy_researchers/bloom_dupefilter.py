"""Bloom filter-based Scrapy duplicate request filter.

Replaces Scrapy's default RFPDupeFilter (which uses an in-memory Python set)
with a Bloom filter. This provides:
- O(1) membership test with k hash lookups
- ~120KB memory for 100K URLs at 0.1% false positive rate
  vs ~6.4MB for SHA256 set of 100K fingerprints
- Persistence across crawl runs via disk save/load

Configure in settings.py:
    DUPEFILTER_CLASS = "scrapy_researchers.bloom_dupefilter.BloomDupeFilter"
    BLOOM_EXPECTED_URLS = 100_000
    BLOOM_FP_RATE = 0.001
    BLOOM_PERSIST_PATH = "scrapy_researchers/.bloomstate/dupefilter.bloom"
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from scrapy import Request
from scrapy.dupefilters import BaseDupeFilter
from scrapy.settings import BaseSettings

from scrapy_researchers.bloom_filter import BloomFilter

logger = logging.getLogger(__name__)


class BloomDupeFilter(BaseDupeFilter):
    """Bloom filter-based request duplicate filter for Scrapy."""

    def __init__(
        self,
        expected_urls: int = 100_000,
        fp_rate: float = 0.001,
        persist_path: str | None = None,
        debug: bool = False,
    ) -> None:
        self.expected_urls = expected_urls
        self.fp_rate = fp_rate
        self.persist_path = persist_path
        self.debug = debug
        self.bloom: BloomFilter | None = None
        self._dupes_found = 0
        self._requests_seen = 0

    @classmethod
    def from_settings(cls, settings: BaseSettings) -> BloomDupeFilter:
        expected_urls = settings.getint("BLOOM_EXPECTED_URLS", 100_000)
        fp_rate = settings.getfloat("BLOOM_FP_RATE", 0.001)
        persist_path = settings.get("BLOOM_PERSIST_PATH", None)
        debug = settings.getbool("DUPEFILTER_DEBUG", False)
        return cls(
            expected_urls=expected_urls,
            fp_rate=fp_rate,
            persist_path=persist_path,
            debug=debug,
        )

    def open(self) -> None:
        """Load existing bloom state or create fresh filter."""
        if self.persist_path and Path(self.persist_path).exists():
            try:
                self.bloom = BloomFilter.load(self.persist_path)
                logger.info(
                    f"Loaded bloom filter from {self.persist_path}: "
                    f"{self.bloom.count} URLs, {self.bloom.memory_bytes}B"
                )
            except Exception as e:
                logger.warning(f"Failed to load bloom state, creating fresh: {e}")
                self.bloom = BloomFilter(self.expected_urls, self.fp_rate)
        else:
            self.bloom = BloomFilter(self.expected_urls, self.fp_rate)
            logger.info(
                f"Created bloom filter: {self.bloom.num_bits} bits, "
                f"{self.bloom.num_hashes} hashes, {self.bloom.memory_bytes}B"
            )

    def close(self, reason: str = "") -> None:
        """Persist bloom state to disk on spider close."""
        if self.bloom and self.persist_path:
            self.bloom.save(self.persist_path)
            logger.info(
                f"Saved bloom filter to {self.persist_path}: "
                f"{self.bloom.count} URLs, {self.bloom.memory_bytes}B"
            )
        logger.info(
            f"BloomDupeFilter stats: {self._requests_seen} requests seen, "
            f"{self._dupes_found} duplicates filtered, "
            f"est FP rate: {self.bloom.estimated_fp_rate:.6f}" if self.bloom else ""
        )

    def request_seen(self, request: Request) -> bool:
        """Check if request is a duplicate using bloom filter."""
        if self.bloom is None:
            self.open()
        assert self.bloom is not None

        fp = self.request_fingerprint(request)
        self._requests_seen += 1

        if fp in self.bloom:
            self._dupes_found += 1
            if self.debug:
                logger.debug(f"Filtered duplicate request: {request.url}")
            return True

        self.bloom.add(fp)
        return False

    def request_fingerprint(self, request: Request) -> str:
        """Generate a fingerprint for the request.

        Uses URL + method as the fingerprint base. Query parameters are
        included but fragments are stripped.
        """
        from w3lib.url import canonicalize_url

        url = canonicalize_url(request.url, keep_fragments=False)
        return f"{request.method}:{url}"

    def log(self, request: Request, spider: Any) -> None:
        if self.debug:
            logger.debug(f"Filtered duplicate: {request.url}")
