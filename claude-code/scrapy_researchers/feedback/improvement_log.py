"""Improvement log management for tracking extraction quality over time."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


class ImprovementLog:
    """Manages improvement log entries in the improvements/ directory.

    Each log file is a JSONL file named {spider}_{timestamp}.jsonl.
    """

    def __init__(self, improvements_dir: str = "improvements") -> None:
        self.dir = Path(improvements_dir)
        self.dir.mkdir(parents=True, exist_ok=True)

    def append(self, entry: dict[str, Any], spider_name: str = "unknown") -> Path:
        """Append a single entry to the current log file for a spider.

        Creates a new file per session (timestamp-based).
        """
        entry.setdefault("timestamp", datetime.utcnow().isoformat())
        entry.setdefault("spider", spider_name)

        # Find or create today's log file
        today = datetime.utcnow().strftime("%Y%m%d")
        existing = list(self.dir.glob(f"{spider_name}_{today}*.jsonl"))

        if existing:
            filepath = sorted(existing)[-1]
        else:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filepath = self.dir / f"{spider_name}_{timestamp}.jsonl"

        with open(filepath, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

        return filepath

    def read_latest(self, n: int = 10, spider_name: str | None = None) -> list[dict[str, Any]]:
        """Read the latest n entries across all log files.

        Args:
            n: Maximum number of entries to return.
            spider_name: Filter by spider name (None = all spiders).

        Returns:
            List of log entries, most recent first.
        """
        pattern = f"{spider_name}_*.jsonl" if spider_name else "*.jsonl"
        log_files = sorted(
            self.dir.glob(pattern),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )

        entries: list[dict[str, Any]] = []

        for filepath in log_files:
            if len(entries) >= n:
                break

            file_entries: list[dict[str, Any]] = []
            with open(filepath, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            file_entries.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue

            # Entries within a file are in chronological order; reverse for most-recent-first
            file_entries.reverse()
            entries.extend(file_entries)

        return entries[:n]

    def summarize(self, spider_name: str | None = None) -> dict[str, Any]:
        """Generate a summary of all improvement entries.

        Returns:
            Dict with summary statistics.
        """
        pattern = f"{spider_name}_*.jsonl" if spider_name else "*.jsonl"
        log_files = list(self.dir.glob(pattern))

        all_entries: list[dict[str, Any]] = []
        for filepath in log_files:
            with open(filepath, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            all_entries.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue

        if not all_entries:
            return {
                "total_entries": 0,
                "spiders": [],
                "avg_quality_score": 0.0,
                "needs_improvement_count": 0,
                "message": "No improvement entries found",
            }

        # Compute statistics
        spiders: dict[str, list[dict[str, Any]]] = {}
        for entry in all_entries:
            spider = entry.get("spider", "unknown")
            spiders.setdefault(spider, []).append(entry)

        scores = [e.get("quality_score", 0.0) for e in all_entries if "quality_score" in e]
        avg_score = sum(scores) / len(scores) if scores else 0.0

        needs_improvement = sum(1 for e in all_entries if e.get("needs_improvement"))

        spider_summaries: list[dict[str, Any]] = []
        for spider, entries in sorted(spiders.items()):
            spider_scores = [
                e.get("quality_score", 0.0) for e in entries if "quality_score" in e
            ]
            spider_avg = sum(spider_scores) / len(spider_scores) if spider_scores else 0.0
            spider_needs_improvement = sum(1 for e in entries if e.get("needs_improvement"))

            spider_summaries.append({
                "spider": spider,
                "entry_count": len(entries),
                "avg_quality_score": round(spider_avg, 4),
                "needs_improvement": spider_needs_improvement,
                "min_score": round(min(spider_scores), 4) if spider_scores else 0.0,
                "max_score": round(max(spider_scores), 4) if spider_scores else 0.0,
            })

        # Find common improvement hints
        all_hints: dict[str, int] = {}
        for entry in all_entries:
            for hint in entry.get("improvement_hints", []):
                all_hints[hint] = all_hints.get(hint, 0) + 1

        top_hints = sorted(all_hints.items(), key=lambda x: x[1], reverse=True)[:10]

        return {
            "total_entries": len(all_entries),
            "total_files": len(log_files),
            "spiders": spider_summaries,
            "avg_quality_score": round(avg_score, 4),
            "needs_improvement_count": needs_improvement,
            "needs_improvement_pct": round(
                100 * needs_improvement / len(all_entries), 1
            ) if all_entries else 0.0,
            "top_improvement_hints": [{"hint": h, "count": c} for h, c in top_hints],
            "date_range": {
                "earliest": min(
                    (e.get("timestamp", "") for e in all_entries if e.get("timestamp")),
                    default="",
                ),
                "latest": max(
                    (e.get("timestamp", "") for e in all_entries if e.get("timestamp")),
                    default="",
                ),
            },
        }


def main() -> None:
    """CLI entrypoint."""
    parser = argparse.ArgumentParser(description="Improvement log management")
    parser.add_argument(
        "--summarize",
        action="store_true",
        help="Print summary of all improvement entries",
    )
    parser.add_argument(
        "--latest",
        type=int,
        default=0,
        help="Print latest N entries",
    )
    parser.add_argument(
        "--spider",
        default=None,
        help="Filter by spider name",
    )
    parser.add_argument(
        "--dir",
        default="improvements",
        help="Improvements directory path",
    )
    args = parser.parse_args()

    log = ImprovementLog(args.dir)

    if args.summarize:
        summary = log.summarize(spider_name=args.spider)
        print(json.dumps(summary, indent=2))
    elif args.latest > 0:
        entries = log.read_latest(n=args.latest, spider_name=args.spider)
        for entry in entries:
            print(json.dumps(entry, ensure_ascii=False))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
