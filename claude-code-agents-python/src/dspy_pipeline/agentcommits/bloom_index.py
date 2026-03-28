"""Bloom filter for fast agent commit detection.

Provides O(1) probabilistic pre-check to determine if a commit likely contains
agent trailers, avoiding expensive parsing for human-only commits.

Uses the same bloom filter pattern as the dispatch system but specialized for
commit trailer routing.
"""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class BloomFilterConfig:
    """Configuration for the bloom filter."""

    expected_items: int = 10000  # Expected number of agent commits
    false_positive_rate: float = 0.01  # 1% FP rate
    num_hash_functions: int = 0  # Auto-calculated if 0
    bit_array_size: int = 0  # Auto-calculated if 0

    def __post_init__(self) -> None:
        if self.bit_array_size == 0:
            # Optimal bit array size: m = -(n * ln(p)) / (ln(2)^2)
            self.bit_array_size = int(
                -(self.expected_items * math.log(self.false_positive_rate))
                / (math.log(2) ** 2)
            )
        if self.num_hash_functions == 0:
            # Optimal hash count: k = (m/n) * ln(2)
            self.num_hash_functions = max(
                1,
                int((self.bit_array_size / self.expected_items) * math.log(2)),
            )


class AgentCommitBloomFilter:
    """Bloom filter specialized for agent commit trailer detection.

    Indexes commit hashes that contain Agent-* trailers. Used as a pre-check
    before running the full trailer extraction pipeline.

    Usage:
        bloom = AgentCommitBloomFilter()

        # Index commits with agent trailers
        bloom.add("abc123")
        bloom.add("def456")

        # Fast check before parsing
        if bloom.might_contain("abc123"):
            trailers = parse_agent_trailers(commit_message)
    """

    def __init__(self, config: Optional[BloomFilterConfig] = None) -> None:
        self.config = config or BloomFilterConfig()
        self._bit_array = bytearray(self.config.bit_array_size // 8 + 1)
        self._count = 0

    def _hash_positions(self, item: str) -> list[int]:
        """Generate k hash positions for an item using double hashing."""
        h1 = int(hashlib.md5(item.encode()).hexdigest(), 16)
        h2 = int(hashlib.sha256(item.encode()).hexdigest(), 16)
        positions = []
        for i in range(self.config.num_hash_functions):
            pos = (h1 + i * h2) % self.config.bit_array_size
            positions.append(pos)
        return positions

    def add(self, commit_hash: str) -> None:
        """Add a commit hash to the bloom filter."""
        for pos in self._hash_positions(commit_hash):
            byte_idx = pos // 8
            bit_idx = pos % 8
            self._bit_array[byte_idx] |= (1 << bit_idx)
        self._count += 1

    def might_contain(self, commit_hash: str) -> bool:
        """Check if a commit hash might be in the filter.

        Returns True if the commit might contain agent trailers (may be false positive).
        Returns False if the commit definitely does NOT contain agent trailers.
        """
        for pos in self._hash_positions(commit_hash):
            byte_idx = pos // 8
            bit_idx = pos % 8
            if not (self._bit_array[byte_idx] & (1 << bit_idx)):
                return False
        return True

    @property
    def count(self) -> int:
        """Number of items added."""
        return self._count

    @property
    def estimated_false_positive_rate(self) -> float:
        """Estimate current false positive rate based on fill ratio."""
        if self._count == 0:
            return 0.0
        # FP rate = (1 - e^(-kn/m))^k
        k = self.config.num_hash_functions
        n = self._count
        m = self.config.bit_array_size
        return (1 - math.exp(-k * n / m)) ** k

    def to_bytes(self) -> bytes:
        """Serialize bloom filter to bytes for persistence."""
        return bytes(self._bit_array)

    @classmethod
    def from_bytes(
        cls,
        data: bytes,
        config: Optional[BloomFilterConfig] = None,
    ) -> "AgentCommitBloomFilter":
        """Deserialize bloom filter from bytes."""
        bloom = cls(config=config)
        bloom._bit_array = bytearray(data)
        return bloom


def build_bloom_from_commits(
    commits: list[dict],
    commit_hash_key: str = "sha",
    message_key: str = "message",
) -> AgentCommitBloomFilter:
    """Build a bloom filter from a list of commits.

    Adds commits that contain Agent-* trailers to the filter.

    Args:
        commits: List of commit dicts with hash and message fields.
        commit_hash_key: Key for the commit hash in each dict.
        message_key: Key for the commit message in each dict.

    Returns:
        Bloom filter indexed with agent commit hashes.
    """
    config = BloomFilterConfig(expected_items=max(len(commits), 100))
    bloom = AgentCommitBloomFilter(config=config)

    for commit in commits:
        message = commit.get(message_key, "")
        if "Agent-Id:" in message or "Agent-Authorship:" in message:
            commit_hash = commit.get(commit_hash_key, "")
            if commit_hash:
                bloom.add(commit_hash)

    return bloom
