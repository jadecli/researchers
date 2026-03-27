"""Context delta generation for the improvement feedback loop."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any


@dataclass
class ContextDelta:
    """Represents a change in extraction quality between iterations."""

    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    spider_name: str = ""
    avg_score_current: float = 0.0
    avg_score_previous: float = 0.0
    score_delta: float = 0.0
    improved_urls: list[str] = field(default_factory=list)
    degraded_urls: list[str] = field(default_factory=list)
    new_urls: list[str] = field(default_factory=list)
    failed_selectors: list[dict[str, Any]] = field(default_factory=list)
    total_pages: int = 0
    pages_above_threshold: int = 0
    quality_threshold: float = 0.7

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, ensure_ascii=False)

    @classmethod
    def from_json(cls, data: str | dict[str, Any]) -> "ContextDelta":
        if isinstance(data, str):
            data = json.loads(data)
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


def generate_delta(
    current_scores: dict[str, float],
    previous_scores: dict[str, float],
    failed_selectors: list[dict[str, Any]] | None = None,
    spider_name: str = "",
    quality_threshold: float = 0.7,
) -> ContextDelta:
    """Generate a context delta comparing current vs previous quality scores.

    Args:
        current_scores: Dict of url -> quality_score for current run.
        previous_scores: Dict of url -> quality_score for previous run.
        failed_selectors: List of dicts with selector, url, error info.
        spider_name: Name of the spider.
        quality_threshold: Score threshold for "good quality".

    Returns:
        ContextDelta with comparison data.
    """
    all_urls = set(current_scores.keys()) | set(previous_scores.keys())

    improved_urls: list[str] = []
    degraded_urls: list[str] = []
    new_urls: list[str] = []

    for url in all_urls:
        curr = current_scores.get(url)
        prev = previous_scores.get(url)

        if curr is not None and prev is None:
            new_urls.append(url)
        elif curr is not None and prev is not None:
            if curr > prev + 0.05:
                improved_urls.append(url)
            elif curr < prev - 0.05:
                degraded_urls.append(url)

    avg_current = (
        sum(current_scores.values()) / len(current_scores) if current_scores else 0.0
    )
    avg_previous = (
        sum(previous_scores.values()) / len(previous_scores) if previous_scores else 0.0
    )

    pages_above = sum(1 for s in current_scores.values() if s >= quality_threshold)

    return ContextDelta(
        spider_name=spider_name,
        avg_score_current=round(avg_current, 4),
        avg_score_previous=round(avg_previous, 4),
        score_delta=round(avg_current - avg_previous, 4),
        improved_urls=sorted(improved_urls),
        degraded_urls=sorted(degraded_urls),
        new_urls=sorted(new_urls),
        failed_selectors=failed_selectors or [],
        total_pages=len(current_scores),
        pages_above_threshold=pages_above,
        quality_threshold=quality_threshold,
    )


def _read_latest_improvement_log(improvements_dir: Path) -> list[dict[str, Any]]:
    """Read the most recent improvement log file."""
    if not improvements_dir.exists():
        return []

    log_files = sorted(
        improvements_dir.glob("*.jsonl"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )

    if not log_files:
        return []

    entries: list[dict[str, Any]] = []
    with open(log_files[0], "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

    return entries


def _check_last(improvements_dir: Path) -> None:
    """Read latest improvement log and print delta summary."""
    entries = _read_latest_improvement_log(improvements_dir)

    if not entries:
        print(json.dumps({"status": "no_data", "message": "No improvement logs found"}))
        return

    current_scores = {
        e["url"]: e.get("quality_score", 0.0) for e in entries if "url" in e
    }

    # Look for the second most recent file for comparison
    log_files = sorted(
        improvements_dir.glob("*.jsonl"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )

    previous_scores: dict[str, float] = {}
    if len(log_files) >= 2:
        with open(log_files[1], "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entry = json.loads(line)
                        if "url" in entry:
                            previous_scores[entry["url"]] = entry.get("quality_score", 0.0)
                    except json.JSONDecodeError:
                        continue

    spider_name = entries[0].get("spider", "unknown") if entries else "unknown"
    failed = [e for e in entries if e.get("needs_improvement")]
    failed_selectors = [
        {"url": e["url"], "selectors": e.get("selectors_used", [])}
        for e in failed
        if "url" in e
    ]

    delta = generate_delta(
        current_scores=current_scores,
        previous_scores=previous_scores,
        failed_selectors=failed_selectors,
        spider_name=spider_name,
    )

    print(delta.to_json())


def main() -> None:
    """CLI entrypoint."""
    parser = argparse.ArgumentParser(description="Context delta tool")
    parser.add_argument(
        "--check-last",
        action="store_true",
        help="Read latest improvement log and print delta summary",
    )
    parser.add_argument(
        "--dir",
        default="improvements",
        help="Improvements directory path",
    )
    args = parser.parse_args()

    if args.check_last:
        _check_last(Path(args.dir))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
