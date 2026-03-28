"""Gap analyzer: finds the largest efficiency gaps across crawl runs.

Reads time series JSONL files from metrics/ and identifies:
1. Windows with highest tool_calls/pages ratio (agent overhead)
2. Spiders with worst overall efficiency
3. Trends across rounds (improving or degrading?)
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class SpiderEfficiency:
    """Aggregated efficiency for a single spider across all runs."""

    spider_name: str
    total_pages: int
    total_tool_calls: int
    total_windows: int
    run_count: int
    worst_ratio: float
    best_ratio: float
    avg_ratio: float
    trend: list[float]  # ratio per run, chronological

    @property
    def efficiency_grade(self) -> str:
        """A-F grade based on tool_calls/page ratio."""
        r = self.avg_ratio
        if r <= 1.0:
            return "A"
        elif r <= 3.0:
            return "B"
        elif r <= 5.0:
            return "C"
        elif r <= 10.0:
            return "D"
        else:
            return "F"

    def to_dict(self) -> dict[str, Any]:
        return {
            "spider_name": self.spider_name,
            "total_pages": self.total_pages,
            "total_tool_calls": self.total_tool_calls,
            "total_windows": self.total_windows,
            "run_count": self.run_count,
            "worst_ratio": round(self.worst_ratio, 4),
            "best_ratio": round(self.best_ratio, 4),
            "avg_ratio": round(self.avg_ratio, 4),
            "efficiency_grade": self.efficiency_grade,
            "trend": [round(t, 4) for t in self.trend],
        }


class GapAnalyzer:
    """Analyze efficiency gaps across all spider runs."""

    def __init__(self, metrics_dir: str = "metrics") -> None:
        self.metrics_dir = Path(metrics_dir)

    def analyze_all(self) -> dict[str, Any]:
        """Analyze all available metrics and return comprehensive report."""
        gap_files = sorted(self.metrics_dir.glob("*_gaps.json"))
        summary_files = sorted(self.metrics_dir.glob("*_summary.json"))

        if not gap_files and not summary_files:
            return {"error": "No metrics files found", "path": str(self.metrics_dir)}

        # Aggregate by spider
        spider_data: dict[str, list[dict[str, Any]]] = {}

        for sf in summary_files:
            try:
                with open(sf, "r", encoding="utf-8") as f:
                    data = json.load(f)
                spider = data.get("spider", "unknown")
                spider_data.setdefault(spider, []).append(data)
            except (json.JSONDecodeError, OSError):
                continue

        # Build per-spider efficiency
        efficiencies: list[SpiderEfficiency] = []
        for spider_name, runs in spider_data.items():
            total_pages = sum(r.get("total_pages", 0) for r in runs)
            total_tools = sum(r.get("total_tool_calls", 0) for r in runs)
            total_windows = sum(r.get("windows", 0) for r in runs)

            ratios = [r.get("overall_ratio", 0) for r in runs]
            ratios = [r for r in ratios if r > 0]

            efficiencies.append(
                SpiderEfficiency(
                    spider_name=spider_name,
                    total_pages=total_pages,
                    total_tool_calls=total_tools,
                    total_windows=total_windows,
                    run_count=len(runs),
                    worst_ratio=max(ratios) if ratios else 0.0,
                    best_ratio=min(ratios) if ratios else 0.0,
                    avg_ratio=sum(ratios) / len(ratios) if ratios else 0.0,
                    trend=ratios,
                )
            )

        efficiencies.sort(key=lambda e: e.avg_ratio, reverse=True)

        # Collect all gaps
        all_gaps: list[dict[str, Any]] = []
        for gf in gap_files:
            try:
                with open(gf, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for gap in data.get("top_gaps", []):
                    gap["source_file"] = str(gf)
                    all_gaps.append(gap)
            except (json.JSONDecodeError, OSError):
                continue

        # Sort gaps by gap_score descending
        all_gaps.sort(key=lambda g: g.get("gap_score", 0), reverse=True)

        return {
            "spider_efficiencies": [e.to_dict() for e in efficiencies],
            "worst_spider": efficiencies[0].to_dict() if efficiencies else None,
            "best_spider": efficiencies[-1].to_dict() if efficiencies else None,
            "global_top_gaps": all_gaps[:10],
            "total_runs_analyzed": sum(e.run_count for e in efficiencies),
            "total_pages_all_spiders": sum(e.total_pages for e in efficiencies),
        }

    def compare_experiments(
        self, variant_a: str, variant_b: str
    ) -> dict[str, Any]:
        """Compare two A/B experiment variants by their efficiency metrics."""
        report = self.analyze_all()
        efficiencies = report.get("spider_efficiencies", [])

        a_data = [e for e in efficiencies if variant_a in e.get("spider_name", "")]
        b_data = [e for e in efficiencies if variant_b in e.get("spider_name", "")]

        if not a_data or not b_data:
            return {
                "error": f"Missing data for variants: "
                f"{'found' if a_data else 'missing'} {variant_a}, "
                f"{'found' if b_data else 'missing'} {variant_b}",
            }

        a_ratio = sum(e["avg_ratio"] for e in a_data) / len(a_data)
        b_ratio = sum(e["avg_ratio"] for e in b_data) / len(b_data)
        winner = variant_a if a_ratio < b_ratio else variant_b
        improvement_pct = abs(a_ratio - b_ratio) / max(a_ratio, b_ratio) * 100

        return {
            "variant_a": {"name": variant_a, "avg_ratio": round(a_ratio, 4), "runs": a_data},
            "variant_b": {"name": variant_b, "avg_ratio": round(b_ratio, 4), "runs": b_data},
            "winner": winner,
            "improvement_pct": round(improvement_pct, 2),
        }
