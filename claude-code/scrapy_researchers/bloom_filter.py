"""Pure-Python Bloom filter for memory-efficient duplicate detection.

No Redis dependency — designed for single-node iterative crawling where
the full SHA256 fingerprint set grows too large across rounds.

Key properties:
- No false negatives: if it says "not seen", it truly hasn't been seen
- Rare false positives: configurable via expected_items and fp_rate
- Persistent: save/load to disk for cross-run deduplication

Spider-specific profiles:
- platform/claude_com: conservative FP rate, smaller capacity (doc sites)
- anthropic: large capacity (sitemap discovers many URLs)
- github: item-level only (API-driven, no HTTP dedup needed)
- llms_full: minimal (single-file parse, no link following)
- docs: moderate defaults (generic doc sites)
"""

from __future__ import annotations

import hashlib
import math
import struct
from dataclasses import dataclass
from pathlib import Path
from typing import Any


class BloomFilter:
    """Space-efficient probabilistic set membership test.

    Args:
        expected_items: Expected number of unique items to insert.
        fp_rate: Desired false positive rate (default 0.001 = 0.1%).
    """

    def __init__(self, expected_items: int = 100_000, fp_rate: float = 0.001) -> None:
        self.expected_items = expected_items
        self.fp_rate = fp_rate
        self.num_bits = self._optimal_num_bits(expected_items, fp_rate)
        self.num_hashes = self._optimal_num_hashes(self.num_bits, expected_items)
        self._bit_array = bytearray(math.ceil(self.num_bits / 8))
        self._count = 0

    @staticmethod
    def _optimal_num_bits(n: int, p: float) -> int:
        """Calculate optimal bit array size: m = -(n * ln(p)) / (ln(2)^2)."""
        if n <= 0:
            return 64
        m = -(n * math.log(p)) / (math.log(2) ** 2)
        return max(int(math.ceil(m)), 64)

    @staticmethod
    def _optimal_num_hashes(m: int, n: int) -> int:
        """Calculate optimal hash count: k = (m/n) * ln(2)."""
        if n <= 0:
            return 1
        k = (m / n) * math.log(2)
        return max(int(math.ceil(k)), 1)

    def _get_bit_positions(self, item: str) -> list[int]:
        """Generate k bit positions using double hashing (Kirsch-Mitzenmacker).

        Two independent hashes h1, h2 from SHA256 produce k positions:
            position_i = (h1 + i * h2) % num_bits
        """
        digest = hashlib.sha256(item.encode("utf-8")).digest()
        h1 = struct.unpack_from("<Q", digest, 0)[0]
        h2 = struct.unpack_from("<Q", digest, 8)[0]

        return [(h1 + i * h2) % self.num_bits for i in range(self.num_hashes)]

    def add(self, item: str) -> bool:
        """Add item to the filter. Returns True if item was already possibly present."""
        positions = self._get_bit_positions(item)
        was_present = all(self._get_bit(pos) for pos in positions)

        for pos in positions:
            self._set_bit(pos)

        if not was_present:
            self._count += 1

        return was_present

    def __contains__(self, item: str) -> bool:
        """Check if item is possibly in the filter (no false negatives)."""
        positions = self._get_bit_positions(item)
        return all(self._get_bit(pos) for pos in positions)

    def _set_bit(self, position: int) -> None:
        byte_idx = position >> 3  # position // 8
        bit_idx = position & 7    # position % 8
        self._bit_array[byte_idx] |= (1 << bit_idx)

    def _get_bit(self, position: int) -> bool:
        byte_idx = position >> 3
        bit_idx = position & 7
        return bool(self._bit_array[byte_idx] & (1 << bit_idx))

    @property
    def count(self) -> int:
        """Approximate number of unique items added."""
        return self._count

    @property
    def memory_bytes(self) -> int:
        """Current memory usage of the bit array in bytes."""
        return len(self._bit_array)

    @property
    def estimated_fp_rate(self) -> float:
        """Estimated current false positive rate given items inserted."""
        if self._count == 0:
            return 0.0
        # (1 - e^(-kn/m))^k
        exponent = -self.num_hashes * self._count / self.num_bits
        return (1 - math.exp(exponent)) ** self.num_hashes

    def save(self, path: str | Path) -> None:
        """Persist bloom filter to disk for cross-run deduplication."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            # Header: expected_items(4), fp_rate(8), num_bits(4), num_hashes(4), count(4)
            f.write(struct.pack("<I", self.expected_items))
            f.write(struct.pack("<d", self.fp_rate))
            f.write(struct.pack("<I", self.num_bits))
            f.write(struct.pack("<I", self.num_hashes))
            f.write(struct.pack("<I", self._count))
            f.write(self._bit_array)

    @classmethod
    def load(cls, path: str | Path) -> BloomFilter:
        """Load a persisted bloom filter from disk."""
        path = Path(path)
        with open(path, "rb") as f:
            expected_items = struct.unpack("<I", f.read(4))[0]
            fp_rate = struct.unpack("<d", f.read(8))[0]
            num_bits = struct.unpack("<I", f.read(4))[0]
            num_hashes = struct.unpack("<I", f.read(4))[0]
            count = struct.unpack("<I", f.read(4))[0]
            bit_array = bytearray(f.read())

        bf = cls.__new__(cls)
        bf.expected_items = expected_items
        bf.fp_rate = fp_rate
        bf.num_bits = num_bits
        bf.num_hashes = num_hashes
        bf._bit_array = bit_array
        bf._count = count
        return bf

    def merge(self, other: BloomFilter) -> None:
        """Merge another bloom filter into this one (OR of bit arrays).

        Both filters must have the same size and hash count.
        """
        if self.num_bits != other.num_bits or self.num_hashes != other.num_hashes:
            raise ValueError(
                f"Cannot merge filters with different parameters: "
                f"({self.num_bits}, {self.num_hashes}) vs ({other.num_bits}, {other.num_hashes})"
            )
        for i in range(len(self._bit_array)):
            self._bit_array[i] |= other._bit_array[i]
        # Count is approximate after merge
        self._count = max(self._count, other._count)

    def __repr__(self) -> str:
        return (
            f"BloomFilter(items={self._count}, bits={self.num_bits}, "
            f"hashes={self.num_hashes}, memory={self.memory_bytes}B, "
            f"est_fp={self.estimated_fp_rate:.6f})"
        )


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
    # ~500 doc pages, iterative re-crawls need cross-run persistence.
    "platform_spider": BloomProfile(
        expected_urls=5_000,
        fp_rate=0.0005,     # stricter — missing a changed page is costly
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

    # anthropic.com sitemap: high volume. Sitemap can expose 1000+ URLs.
    # Slightly relaxed FP rate acceptable — pages are public/stable.
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
    # Request-level bloom unnecessary (DEPTH_LIMIT=0). Item dedup only.
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

    # GitHub API spider: no HTTP-level dedup needed (uses gh CLI, not Scrapy downloader).
    # Item-level bloom catches duplicate file content across re-crawls.
    "github_spider": BloomProfile(
        expected_urls=10_000,
        fp_rate=0.001,
        persist_dir="scrapy_researchers/.bloomstate",
        request_dedup=False,
        item_dedup=True,
        download_delay=0.0,   # API has its own rate limiter
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
