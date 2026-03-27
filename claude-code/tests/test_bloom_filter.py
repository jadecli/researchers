"""Tests for Bloom filter implementation and Scrapy integration."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from scrapy_researchers.bloom_filter import BloomFilter


class TestBloomFilter:
    """Core bloom filter data structure tests."""

    def test_basic_membership(self) -> None:
        bf = BloomFilter(1000, 0.01)
        bf.add("hello")
        bf.add("world")
        assert "hello" in bf
        assert "world" in bf
        assert "missing" not in bf

    def test_no_false_negatives(self) -> None:
        """Bloom filters guarantee zero false negatives."""
        bf = BloomFilter(10_000, 0.001)
        items = [f"url_{i}" for i in range(5000)]
        for item in items:
            bf.add(item)
        for item in items:
            assert item in bf, f"False negative for {item}"

    def test_count_tracking(self) -> None:
        bf = BloomFilter(1000, 0.01)
        assert bf.count == 0
        bf.add("a")
        assert bf.count == 1
        bf.add("b")
        assert bf.count == 2
        # Re-adding existing item shouldn't increment
        bf.add("a")
        assert bf.count == 2

    def test_add_returns_was_present(self) -> None:
        bf = BloomFilter(1000, 0.01)
        assert bf.add("new") is False
        assert bf.add("new") is True

    def test_false_positive_rate_within_bounds(self) -> None:
        """Actual FP rate should be close to target at expected capacity."""
        n = 10_000
        target_fp = 0.01
        bf = BloomFilter(n, target_fp)

        for i in range(n):
            bf.add(f"inserted_{i}")

        false_positives = 0
        test_count = 10_000
        for i in range(test_count):
            if f"never_inserted_{i}" in bf:
                false_positives += 1

        actual_fp = false_positives / test_count
        # Allow 3x target — bloom filters are probabilistic
        assert actual_fp < target_fp * 3, f"FP rate {actual_fp} too high (target {target_fp})"

    def test_optimal_parameters(self) -> None:
        bf = BloomFilter(100_000, 0.001)
        assert bf.num_bits > 0
        assert bf.num_hashes > 0
        assert bf.memory_bytes > 0
        # At 100K items, 0.1% FP rate: ~1.44M bits = ~175KB
        assert 100_000 < bf.num_bits < 2_000_000

    def test_memory_efficiency(self) -> None:
        """Bloom filter should use far less memory than a set of SHA256 strings."""
        bf = BloomFilter(100_000, 0.001)
        # 100K SHA256 hex strings ≈ 17MB in a Python set
        # Bloom filter should be < 200KB
        assert bf.memory_bytes < 200 * 1024

    def test_persistence_roundtrip(self) -> None:
        bf = BloomFilter(1000, 0.01)
        bf.add("persist_me")
        bf.add("and_me")

        with tempfile.NamedTemporaryFile(suffix=".bloom", delete=False) as f:
            path = f.name

        bf.save(path)
        loaded = BloomFilter.load(path)
        Path(path).unlink()

        assert "persist_me" in loaded
        assert "and_me" in loaded
        assert "not_added" not in loaded
        assert loaded.count == 2
        assert loaded.num_bits == bf.num_bits
        assert loaded.num_hashes == bf.num_hashes

    def test_merge(self) -> None:
        bf1 = BloomFilter(1000, 0.01)
        bf2 = BloomFilter(1000, 0.01)
        bf1.add("only_in_1")
        bf2.add("only_in_2")

        bf1.merge(bf2)
        assert "only_in_1" in bf1
        assert "only_in_2" in bf1

    def test_merge_incompatible_raises(self) -> None:
        bf1 = BloomFilter(1000, 0.01)
        bf2 = BloomFilter(5000, 0.01)  # different size
        with pytest.raises(ValueError, match="Cannot merge"):
            bf1.merge(bf2)

    def test_empty_filter(self) -> None:
        bf = BloomFilter(100, 0.01)
        assert bf.count == 0
        assert bf.estimated_fp_rate == 0.0
        assert "anything" not in bf

    def test_repr(self) -> None:
        bf = BloomFilter(1000, 0.01)
        r = repr(bf)
        assert "BloomFilter" in r
        assert "items=0" in r

    def test_small_expected_items(self) -> None:
        """Edge case: very small filter still works."""
        bf = BloomFilter(1, 0.5)
        bf.add("one")
        assert "one" in bf

    def test_zero_expected_items(self) -> None:
        """Edge case: zero expected items doesn't crash."""
        bf = BloomFilter(0, 0.01)
        bf.add("item")
        assert "item" in bf


class TestBloomDupeFilter:
    """Tests for Scrapy request-level duplicate filter."""

    def test_import(self) -> None:
        from scrapy_researchers.bloom_dupefilter import BloomDupeFilter
        filt = BloomDupeFilter(expected_urls=100, fp_rate=0.01)
        filt.open()
        assert filt.bloom is not None
        assert filt.bloom.count == 0

    def test_persistence_path(self) -> None:
        from scrapy_researchers.bloom_dupefilter import BloomDupeFilter

        with tempfile.NamedTemporaryFile(suffix=".bloom", delete=False) as f:
            path = f.name

        filt = BloomDupeFilter(expected_urls=100, fp_rate=0.01, persist_path=path)
        filt.open()
        filt.bloom.add("test_fp")
        filt.close("finished")

        # Reload
        filt2 = BloomDupeFilter(expected_urls=100, fp_rate=0.01, persist_path=path)
        filt2.open()
        assert "test_fp" in filt2.bloom
        Path(path).unlink()


class TestDedupPipeline:
    """Tests for the bloom filter-backed item dedup pipeline."""

    def test_import(self) -> None:
        from scrapy_researchers.pipelines import DedupPipeline
        pipeline = DedupPipeline()
        assert pipeline.bloom is None  # Not initialized until open_spider
