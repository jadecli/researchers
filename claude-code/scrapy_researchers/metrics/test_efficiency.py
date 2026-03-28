"""Tests for the efficiency metrics tracker and gap analyzer."""

from __future__ import annotations

import json
import time
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from scrapy_researchers.metrics.efficiency_tracker import (
    EfficiencyTracker,
    GapEntry,
    TimeWindow,
)
from scrapy_researchers.metrics.gap_analyzer import GapAnalyzer, SpiderEfficiency


# ── TimeWindow Tests ─────────────────────────────────────────────


class TestTimeWindow:
    def test_ratio_with_pages(self) -> None:
        w = TimeWindow(
            window_start=0, window_end=60, pages_crawled=10, tool_calls=30
        )
        assert w.ratio == 3.0

    def test_ratio_zero_pages_with_tools(self) -> None:
        w = TimeWindow(
            window_start=0, window_end=60, pages_crawled=0, tool_calls=5
        )
        assert w.ratio == float("inf")

    def test_ratio_zero_pages_zero_tools(self) -> None:
        w = TimeWindow(
            window_start=0, window_end=60, pages_crawled=0, tool_calls=0
        )
        assert w.ratio == 0.0

    def test_duration(self) -> None:
        w = TimeWindow(window_start=100.0, window_end=160.0)
        assert w.duration_s == 60.0

    def test_pages_per_second(self) -> None:
        w = TimeWindow(
            window_start=0, window_end=10, pages_crawled=20
        )
        assert w.pages_per_second == 2.0

    def test_to_dict(self) -> None:
        w = TimeWindow(
            window_start=1711500000,
            window_end=1711500060,
            pages_crawled=5,
            tool_calls=15,
            spider_name="test_spider",
        )
        d = w.to_dict()
        assert d["pages_crawled"] == 5
        assert d["tool_calls"] == 15
        assert d["spider_name"] == "test_spider"
        assert d["ratio_tool_calls_per_page"] == 3.0


# ── EfficiencyTracker Tests ──────────────────────────────────────


class TestEfficiencyTracker:
    def test_find_gaps_empty(self) -> None:
        tracker = EfficiencyTracker()
        assert tracker.find_largest_gaps() == []

    def test_find_gaps_single_window(self) -> None:
        tracker = EfficiencyTracker()
        tracker.windows = [
            TimeWindow(window_start=0, window_end=60, pages_crawled=10, tool_calls=30),
        ]
        gaps = tracker.find_largest_gaps()
        assert len(gaps) == 1
        assert gaps[0].rank == 1

    def test_find_gaps_identifies_outlier(self) -> None:
        tracker = EfficiencyTracker()
        tracker.windows = [
            TimeWindow(window_start=0, window_end=60, pages_crawled=10, tool_calls=20),
            TimeWindow(window_start=60, window_end=120, pages_crawled=10, tool_calls=22),
            TimeWindow(window_start=120, window_end=180, pages_crawled=10, tool_calls=18),
            TimeWindow(window_start=180, window_end=240, pages_crawled=2, tool_calls=50),  # outlier
            TimeWindow(window_start=240, window_end=300, pages_crawled=10, tool_calls=21),
        ]
        gaps = tracker.find_largest_gaps(top_n=3)
        assert len(gaps) == 3
        # The outlier window (ratio=25.0) should be ranked #1
        assert gaps[0].window.pages_crawled == 2
        assert gaps[0].window.tool_calls == 50
        assert gaps[0].rank == 1

    def test_find_gaps_respects_top_n(self) -> None:
        tracker = EfficiencyTracker()
        tracker.windows = [
            TimeWindow(window_start=i * 60, window_end=(i + 1) * 60, pages_crawled=5, tool_calls=10 + i)
            for i in range(10)
        ]
        gaps = tracker.find_largest_gaps(top_n=3)
        assert len(gaps) == 3

    def test_get_time_series(self) -> None:
        tracker = EfficiencyTracker()
        tracker.windows = [
            TimeWindow(window_start=0, window_end=60, pages_crawled=5, tool_calls=10, spider_name="test"),
        ]
        ts = tracker.get_time_series()
        assert len(ts) == 1
        assert ts[0]["pages_crawled"] == 5


# ── GapAnalyzer Tests ────────────────────────────────────────────


class TestSpiderEfficiency:
    def test_grade_a(self) -> None:
        e = SpiderEfficiency(
            spider_name="fast", total_pages=100, total_tool_calls=80,
            total_windows=10, run_count=2, worst_ratio=1.0, best_ratio=0.5,
            avg_ratio=0.8, trend=[0.9, 0.7],
        )
        assert e.efficiency_grade == "A"

    def test_grade_b(self) -> None:
        e = SpiderEfficiency(
            spider_name="ok", total_pages=50, total_tool_calls=100,
            total_windows=5, run_count=1, worst_ratio=2.5, best_ratio=1.5,
            avg_ratio=2.0, trend=[2.0],
        )
        assert e.efficiency_grade == "B"

    def test_grade_d(self) -> None:
        e = SpiderEfficiency(
            spider_name="slow", total_pages=10, total_tool_calls=80,
            total_windows=3, run_count=1, worst_ratio=9.0, best_ratio=7.0,
            avg_ratio=8.0, trend=[8.0],
        )
        assert e.efficiency_grade == "D"

    def test_grade_f(self) -> None:
        e = SpiderEfficiency(
            spider_name="terrible", total_pages=5, total_tool_calls=100,
            total_windows=2, run_count=1, worst_ratio=25.0, best_ratio=15.0,
            avg_ratio=20.0, trend=[20.0],
        )
        assert e.efficiency_grade == "F"

    def test_to_dict(self) -> None:
        e = SpiderEfficiency(
            spider_name="test", total_pages=10, total_tool_calls=30,
            total_windows=3, run_count=1, worst_ratio=4.0, best_ratio=2.0,
            avg_ratio=3.0, trend=[3.0],
        )
        d = e.to_dict()
        assert d["spider_name"] == "test"
        assert d["efficiency_grade"] == "B"


class TestGapAnalyzer:
    def test_analyze_empty_dir(self, tmp_path: Path) -> None:
        analyzer = GapAnalyzer(metrics_dir=str(tmp_path))
        result = analyzer.analyze_all()
        assert "error" in result

    def test_analyze_with_data(self, tmp_path: Path) -> None:
        # Write a summary file
        summary = {
            "spider": "test_spider",
            "total_pages": 50,
            "total_tool_calls": 100,
            "windows": 5,
            "overall_ratio": 2.0,
            "per_window": [],
        }
        summary_path = tmp_path / "test_spider_20260327_summary.json"
        summary_path.write_text(json.dumps(summary))

        # Write a gaps file
        gaps = {
            "spider": "test_spider",
            "total_windows": 5,
            "top_gaps": [
                {"gap_score": 3.5, "pages_crawled": 2, "tool_calls": 20},
            ],
        }
        gaps_path = tmp_path / "test_spider_20260327_gaps.json"
        gaps_path.write_text(json.dumps(gaps))

        analyzer = GapAnalyzer(metrics_dir=str(tmp_path))
        result = analyzer.analyze_all()

        assert "spider_efficiencies" in result
        assert len(result["spider_efficiencies"]) == 1
        assert result["spider_efficiencies"][0]["spider_name"] == "test_spider"
        assert result["total_runs_analyzed"] == 1

    def test_compare_experiments_missing(self, tmp_path: Path) -> None:
        analyzer = GapAnalyzer(metrics_dir=str(tmp_path))
        result = analyzer.compare_experiments("control", "ptc")
        assert "error" in result
