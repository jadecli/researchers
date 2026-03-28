"""Bloom filter-based Scrapy duplicate request filter.

Replaces Scrapy's default RFPDupeFilter (which uses an in-memory Python set)
with a Bloom filter. This provides:
- O(1) membership test with k hash lookups
- ~120KB memory for 100K URLs at 0.1% false positive rate
  vs ~6.4MB for SHA256 set of 100K fingerprints
- Persistence across crawl runs via disk save/load

Settings are automatically injected by BaseResearchSpider.update_settings()
from the spider's BloomProfile. Manual override via settings.py:
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
    """Bloom filter-based request duplicate filter for Scrapy.

    Reads BLOOM_EXPECTED_URLS, BLOOM_FP_RATE, and BLOOM_PERSIST_PATH
    from Scrapy settings. These are set per-spider by BloomProfile via
    BaseResearchSpider.update_settings().
    """

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
                    "BloomDupeFilter: loaded %s (%d URLs, %dB, est FP %.6f)",
                    self.persist_path,
                    self.bloom.count,
                    self.bloom.memory_bytes,
                    self.bloom.estimated_fp_rate,
                )
            except Exception as e:
                logger.warning("BloomDupeFilter: failed to load %s: %s", self.persist_path, e)
                self.bloom = BloomFilter(self.expected_urls, self.fp_rate)
        else:
            self.bloom = BloomFilter(self.expected_urls, self.fp_rate)
            logger.info(
                "BloomDupeFilter: new filter (%d bits, %d hashes, %dB, capacity %d, FP %.4f)",
                self.bloom.num_bits,
                self.bloom.num_hashes,
                self.bloom.memory_bytes,
                self.expected_urls,
                self.fp_rate,
            )

    def close(self, reason: str = "") -> None:
        """Persist bloom state to disk on spider close."""
        if not self.bloom:
            return
        if self.persist_path:
            self.bloom.save(self.persist_path)
            logger.info(
                "BloomDupeFilter: saved %s (%d URLs, %dB)",
                self.persist_path,
                self.bloom.count,
                self.bloom.memory_bytes,
            )
        logger.info(
            "BloomDupeFilter: %d requests seen, %d duplicates filtered, est FP %.6f",
            self._requests_seen,
            self._dupes_found,
            self.bloom.estimated_fp_rate,
        )

    def request_seen(self, request: Request) -> bool:
        """Check if request is a duplicate using bloom filter."""
        if self.bloom is None:
            self.open()
        assert self.bloom is not None

        fp = self.request_fingerprint(request)
        self._requests_seen += 1

        # add() returns True if item was already possibly present,
        # so we use it directly instead of a separate __contains__ + add
        was_seen = self.bloom.add(fp)
        if was_seen:
            self._dupes_found += 1
            if self.debug:
                logger.debug("Filtered duplicate request: %s", request.url)

        return was_seen

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
            logger.debug("Filtered duplicate: %s", request.url)
