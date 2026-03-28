"""Bloom filter for Scrapy URL deduplication using rbloom.

rbloom is a Rust-backed bloom filter — the fastest Python implementation
(2x faster than pybloomfiltermmap3, 10x faster than pybloom-live).

No Redis dependency — designed for single-node iterative crawling where
the full SHA256 fingerprint set grows too large across rounds.

Key properties:
- No false negatives: if it says "not seen", it truly hasn't been seen
- Rare false positives: configurable via expected_items and fp_rate
- Persistent: save/load to disk for cross-run deduplication
- Scrapy integration: BloomDupeFilter replaces RFPDupeFilter with optional Neon Postgres persistence

Spider-specific profiles:
- platform/claude_com: conservative FP rate, smaller capacity (doc sites)
- anthropic: large capacity (sitemap discovers many URLs)
- github: item-level only (API-driven, no HTTP dedup needed)
- llms_full: minimal (single-file parse, no link following)
- docs: moderate defaults (generic doc sites)
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any

from rbloom import Bloom
from scrapy.dupefilters import BaseDupeFilter
from scrapy.http import Request
from scrapy.utils.request import fingerprint


def _stable_hash(item: object) -> int:
    """Deterministic hash function for rbloom serialization.

    rbloom requires a custom hash function (not Python's built-in hash())
    to support save_bytes/load_bytes persistence across processes.
    """
    return int.from_bytes(hashlib.sha256(str(item).encode()).digest()[:8], "big")


# ── Scrapy DupeFilter integration ─────────────────────────────────


class BloomDupeFilter(BaseDupeFilter):
    """Scrapy DupeFilter backed by rbloom with optional Neon Postgres persistence.

    Settings:
        BLOOM_EXPECTED_ITEMS (int): Expected number of unique URLs. Default: 10000.
        BLOOM_FALSE_POSITIVE_RATE (float): Target FP rate. Default: 0.001.
        BLOOM_DB_URL (str | None): Neon Postgres connection string for persistence.
        BLOOM_CRAWLER_ID (str): Identifier for this crawler instance. Default: 'scrapy-docs'.
        BLOOM_DOMAIN (str): Domain being crawled. Default: 'docs.anthropic.com'.
    """

    def __init__(
        self,
        expected_items: int = 10000,
        false_positive_rate: float = 0.001,
        db_url: str | None = None,
        crawler_id: str = "scrapy-docs",
        domain: str = "docs.anthropic.com",
    ) -> None:
        self.bloom = Bloom(expected_items, false_positive_rate, _stable_hash)
        self.db_url = db_url
        self.crawler_id = crawler_id
        self.domain = domain
        self._expected_items = expected_items
        self._false_positive_rate = false_positive_rate

    @classmethod
    def from_settings(cls, settings: Any) -> BloomDupeFilter:
        return cls(
            expected_items=settings.getint("BLOOM_EXPECTED_ITEMS", 10000),
            false_positive_rate=settings.getfloat("BLOOM_FALSE_POSITIVE_RATE", 0.001),
            db_url=settings.get("BLOOM_DB_URL"),
            crawler_id=settings.get("BLOOM_CRAWLER_ID", "scrapy-docs"),
            domain=settings.get("BLOOM_DOMAIN", "docs.anthropic.com"),
        )

    def request_seen(self, request: Request) -> bool:
        """Return True if request URL has been seen (bloom filter check)."""
        fp = fingerprint(request).hex()
        if fp in self.bloom:
            return True
        self.bloom.add(fp)
        return False

    def open(self) -> None:
        """Load bloom filter state from Neon Postgres on spider open."""
        if self.db_url:
            self._load_from_db()

    def close(self, reason: str = "") -> None:
        """Save bloom filter state to Neon Postgres on spider close."""
        if self.db_url:
            self._save_to_db()

    def _load_from_db(self) -> None:
        """Load persisted bloom filter from Neon Postgres."""
        try:
            import psycopg2  # type: ignore[import-untyped]

            conn = psycopg2.connect(self.db_url)
            cur = conn.cursor()
            cur.execute(
                "SELECT filter_bytes FROM bloom_filter_state WHERE crawler_id = %s AND domain = %s",
                (self.crawler_id, self.domain),
            )
            row = cur.fetchone()
            if row:
                self.bloom = Bloom.load_bytes(bytes(row[0]), _stable_hash)
            cur.close()
            conn.close()
        except Exception:
            pass  # Fall back to empty filter

    def _save_to_db(self) -> None:
        """Persist bloom filter to Neon Postgres."""
        try:
            import psycopg2  # type: ignore[import-untyped]

            filter_data = self.bloom.save_bytes()
            conn = psycopg2.connect(self.db_url)
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO bloom_filter_state
                     (crawler_id, domain, expected_items, false_positive_rate,
                      hash_functions, bit_array_size, items_inserted, filter_bytes)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (crawler_id, domain) DO UPDATE SET
                     items_inserted = EXCLUDED.items_inserted,
                     filter_bytes = EXCLUDED.filter_bytes,
                     updated_at = NOW()""",
                (
                    self.crawler_id,
                    self.domain,
                    self._expected_items,
                    self._false_positive_rate,
                    0,  # rbloom manages hash count internally
                    0,  # rbloom manages bit size internally
                    0,
                    filter_data,
                ),
            )
            conn.commit()
            cur.close()
            conn.close()
        except Exception:
            pass


# ── Spider-specific profiles ────────────────────────────────────


@dataclass(frozen=True)
class BloomProfile:
    """Spider-specific bloom filter configuration.

    Each profile tunes expected_urls, fp_rate, and persist paths based on
    the crawl pattern of the spider:
    - High-volume sitemaps need large capacity, tolerate higher FP
    - Doc sites need strict FP to avoid missing updated pages
    - Single-file parsers need minimal bloom overhead
    """

    expected_urls: int
    fp_rate: float
    persist_dir: str
    request_dedup: bool = True   # whether to use BloomDupeFilter for requests
    item_dedup: bool = True      # whether to use bloom-backed DedupPipeline
    download_delay: float = 2.0
    autothrottle_start: float = 2.0
    autothrottle_max: float = 60.0
    retry_times: int = 5

    def dupefilter_path(self, spider_name: str) -> str:
        return f"{self.persist_dir}/{spider_name}_dupefilter.bloom"

    def dedup_path(self, spider_name: str) -> str:
        return f"{self.persist_dir}/{spider_name}_dedup.bloom"

    def to_scrapy_settings(self, spider_name: str) -> dict[str, Any]:
        """Convert profile to Scrapy settings dict for spider custom_settings."""
        settings: dict[str, Any] = {
            "BLOOM_EXPECTED_URLS": self.expected_urls,
            "BLOOM_FP_RATE": self.fp_rate,
            "BLOOM_PERSIST_PATH": self.dupefilter_path(spider_name),
            "BLOOM_DEDUP_EXPECTED_ITEMS": self.expected_urls,
            "BLOOM_DEDUP_FP_RATE": self.fp_rate,
            "BLOOM_DEDUP_PERSIST_PATH": self.dedup_path(spider_name),
            "DOWNLOAD_DELAY": self.download_delay,
            "AUTOTHROTTLE_START_DELAY": self.autothrottle_start,
            "AUTOTHROTTLE_MAX_DELAY": self.autothrottle_max,
            "RETRY_TIMES": self.retry_times,
        }
        if not self.request_dedup:
            settings["DUPEFILTER_CLASS"] = "scrapy.dupefilters.RFPDupeFilter"
        return settings


# ── Spider-specific profiles ────────────────────────────────────
# Tuned based on each spider's crawl pattern and target site behavior.

BLOOM_PROFILES: dict[str, BloomProfile] = {
    # platform.claude.com: strict dedup, conservative politeness to avoid blocks.
    "platform_spider": BloomProfile(
        expected_urls=5_000,
        fp_rate=0.0005,
        persist_dir="scrapy_researchers/.bloomstate",
        download_delay=3.0,
        autothrottle_start=3.0,
        autothrottle_max=120.0,
        retry_times=7,
    ),

    # code.claude.com: moderate. Generic docs spider, ~100 pages per llms.txt.
    "docs_spider": BloomProfile(
        expected_urls=10_000,
        fp_rate=0.001,
        persist_dir="scrapy_researchers/.bloomstate",
        download_delay=2.0,
        autothrottle_start=2.0,
        autothrottle_max=60.0,
    ),

    # anthropic.com sitemap: high volume.
    "anthropic_spider": BloomProfile(
        expected_urls=50_000,
        fp_rate=0.002,
        persist_dir="scrapy_researchers/.bloomstate",
        download_delay=2.0,
        autothrottle_start=2.0,
        autothrottle_max=60.0,
    ),

    # claude.com: similar to platform — doc site, avoid blocks.
    "claude_com_spider": BloomProfile(
        expected_urls=5_000,
        fp_rate=0.0005,
        persist_dir="scrapy_researchers/.bloomstate",
        download_delay=3.0,
        autothrottle_start=3.0,
        autothrottle_max=120.0,
        retry_times=7,
    ),

    # llms-full.txt: single file download, no link following.
    "llms_full_spider": BloomProfile(
        expected_urls=1_000,
        fp_rate=0.001,
        persist_dir="scrapy_researchers/.bloomstate",
        request_dedup=False,
        item_dedup=True,
        download_delay=2.0,
        autothrottle_start=2.0,
        autothrottle_max=60.0,
    ),

    # GitHub API spider: no HTTP-level dedup needed.
    "github_spider": BloomProfile(
        expected_urls=10_000,
        fp_rate=0.001,
        persist_dir="scrapy_researchers/.bloomstate",
        request_dedup=False,
        item_dedup=True,
        download_delay=0.0,
        autothrottle_start=0.0,
        autothrottle_max=0.0,
    ),
}

# Fallback for any spider not explicitly profiled
DEFAULT_BLOOM_PROFILE = BloomProfile(
    expected_urls=100_000,
    fp_rate=0.001,
    persist_dir="scrapy_researchers/.bloomstate",
)


def get_bloom_profile(spider_name: str) -> BloomProfile:
    """Look up the bloom profile for a spider, falling back to defaults."""
    return BLOOM_PROFILES.get(spider_name, DEFAULT_BLOOM_PROFILE)
