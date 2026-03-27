"""Pure-Python Bloom filter for memory-efficient duplicate detection.

No Redis dependency — designed for single-node iterative crawling where
the full SHA256 fingerprint set grows too large across rounds.

Key properties:
- No false negatives: if it says "not seen", it truly hasn't been seen
- Rare false positives: configurable via expected_items and fp_rate
- Persistent: save/load to disk for cross-run deduplication
"""

from __future__ import annotations

import hashlib
import math
import os
import struct
from pathlib import Path


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
