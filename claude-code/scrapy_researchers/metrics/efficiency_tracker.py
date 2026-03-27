"""Efficiency metrics: tool calls per agent loop vs pages crawled.

Tracks a time series of the ratio (agent_tool_calls / pages_crawled) per
configurable time window. Identifies the largest gaps where agent overhead
is disproportionate to crawl throughput.

Integrates as a Scrapy extension — hooks into spider_opened, item_scraped,
spider_closed signals to count pages. Agent tool call counts are loaded from
the SDK telemetry JSONL logs emitted by the agent loop.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from scrapy import Spider, signals
from scrapy.crawler import Crawler


@dataclass
class TimeWindow:
    """A single time window sample in the efficiency time series."""

    window_start: float
    window_end: float
    pages_crawled: int = 0
    tool_calls: int = 0
    agent_turns: int = 0
    spider_name: str = ""

    @property
    def ratio(self) -> float:
        """Tool calls per page crawled. Lower is better."""
        if self.pages_crawled == 0:
            return float("inf") if self.tool_calls > 0 else 0.0
        return self.tool_calls / self.pages_crawled

    @property
    def duration_s(self) -> float:
        return self.window_end - self.window_start

    @property
    def pages_per_second(self) -> float:
        d = self.duration_s
        return self.pages_crawled / d if d > 0 else 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "window_start": datetime.fromtimestamp(self.window_start, tz=timezone.utc).isoformat(),
            "window_end": datetime.fromtimestamp(self.window_end, tz=timezone.utc).isoformat(),
            "duration_s": round(self.duration_s, 2),
            "pages_crawled": self.pages_crawled,
            "tool_calls": self.tool_calls,
            "agent_turns": self.agent_turns,
            "ratio_tool_calls_per_page": round(self.ratio, 4) if self.ratio != float("inf") else "inf",
            "pages_per_second": round(self.pages_per_second, 4),
            "spider_name": self.spider_name,
        }


@dataclass
class GapEntry:
    """A gap where tool_calls/pages ratio is anomalously high."""

    window: TimeWindow
    gap_score: float  # how far above median this window's ratio is
    rank: int = 0

    def to_dict(self) -> dict[str, Any]:
        d = self.window.to_dict()
        d["gap_score"] = round(self.gap_score, 4)
        d["rank"] = self.rank
        return d


class EfficiencyTracker:
    """Tracks tool-calls-to-pages-crawled ratio across time windows.

    Usage as Scrapy extension:
        EXTENSIONS = {"scrapy_researchers.metrics.efficiency_tracker.EfficiencyTracker": 400}
        EFFICIENCY_WINDOW_SECONDS = 60  # 1-minute buckets
    """

    def __init__(
        self,
        window_seconds: float = 60.0,
        metrics_dir: str = "metrics",
        agent_events_dir: str = "../claude-multi-agent-sdk",
    ) -> None:
        self.window_seconds = window_seconds
        self.metrics_dir = Path(metrics_dir)
        self.agent_events_dir = Path(agent_events_dir)

        self.windows: list[TimeWindow] = []
        self._current_window: TimeWindow | None = None
        self._spider_start: float = 0.0

    @classmethod
    def from_crawler(cls, crawler: Crawler) -> "EfficiencyTracker":
        window = crawler.settings.getfloat("EFFICIENCY_WINDOW_SECONDS", 60.0)
        metrics_dir = crawler.settings.get("EFFICIENCY_METRICS_DIR", "metrics")
        agent_dir = crawler.settings.get(
            "AGENT_EVENTS_DIR", "../claude-multi-agent-sdk"
        )
        ext = cls(
            window_seconds=window,
            metrics_dir=metrics_dir,
            agent_events_dir=agent_dir,
        )
        crawler.signals.connect(ext.spider_opened, signal=signals.spider_opened)
        crawler.signals.connect(ext.item_scraped, signal=signals.item_scraped)
        crawler.signals.connect(ext.spider_closed, signal=signals.spider_closed)
        return ext

    def spider_opened(self, spider: Spider) -> None:
        self._spider_start = time.monotonic()
        self._current_window = TimeWindow(
            window_start=time.time(),
            window_end=0.0,
            spider_name=spider.name,
        )
        self.windows = []
        spider.logger.info(
            f"EfficiencyTracker: tracking {self.window_seconds}s windows"
        )

    def item_scraped(self, item: dict[str, Any], spider: Spider) -> None:
        now = time.time()
        w = self._current_window
        if w is None:
            return

        # Roll to new window if needed
        if now - w.window_start >= self.window_seconds:
            w.window_end = now
            self.windows.append(w)
            self._current_window = TimeWindow(
                window_start=now,
                window_end=0.0,
                spider_name=spider.name,
            )
            w = self._current_window

        w.pages_crawled += 1

    def spider_closed(self, spider: Spider, reason: str) -> None:
        now = time.time()

        # Finalize current window
        if self._current_window and self._current_window.pages_crawled > 0:
            self._current_window.window_end = now
            self.windows.append(self._current_window)
        self._current_window = None

        # Load agent tool call counts from telemetry logs
        self._load_agent_tool_calls(spider)

        # Compute gaps
        gaps = self.find_largest_gaps()

        # Persist time series + gaps
        self._persist(spider, gaps)

        total_pages = sum(w.pages_crawled for w in self.windows)
        total_tools = sum(w.tool_calls for w in self.windows)
        overall_ratio = total_tools / total_pages if total_pages > 0 else 0
        spider.logger.info(
            f"EfficiencyTracker: {len(self.windows)} windows, "
            f"{total_pages} pages, {total_tools} tool calls, "
            f"overall ratio={overall_ratio:.2f}"
        )
        if gaps:
            spider.logger.info(
                f"EfficiencyTracker: top gap at window starting "
                f"{gaps[0].window.to_dict()['window_start']} "
                f"(ratio={gaps[0].window.ratio:.2f}, gap_score={gaps[0].gap_score:.2f})"
            )

    def _load_agent_tool_calls(self, spider: Spider) -> None:
        """Load tool call counts from agent SDK telemetry logs.

        Scans for JSONL files containing session_end events with totalToolCalls
        and distributes tool calls proportionally across time windows.
        """
        events_dir = self.agent_events_dir
        if not events_dir.exists():
            # Try relative to the spider's working directory
            events_dir = Path.cwd() / self.agent_events_dir
        if not events_dir.exists():
            spider.logger.debug(
                f"EfficiencyTracker: no agent events dir at {events_dir}"
            )
            return

        total_agent_tool_calls = 0
        total_agent_turns = 0

        # Read all JSONL event files from agent runs
        for jsonl_file in sorted(events_dir.rglob("events.jsonl")):
            try:
                with open(jsonl_file, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        event = json.loads(line)
                        if event.get("type") == "session_end":
                            total_agent_tool_calls += event.get("totalToolCalls", 0)
                            total_agent_turns += event.get("totalTurns", 0)
                        elif event.get("type") == "tool_call":
                            total_agent_tool_calls += 1
            except (json.JSONDecodeError, OSError) as e:
                spider.logger.debug(f"EfficiencyTracker: skipping {jsonl_file}: {e}")

        # Also check round event logs from dispatch
        dispatch_dir = Path.cwd().parent / "claude-multi-agent-dispatch" / "rounds"
        if dispatch_dir.exists():
            for jsonl_file in sorted(dispatch_dir.rglob("events.jsonl")):
                try:
                    with open(jsonl_file, "r", encoding="utf-8") as f:
                        for line in f:
                            line = line.strip()
                            if not line:
                                continue
                            event = json.loads(line)
                            if event.get("type") == "tool_call":
                                total_agent_tool_calls += 1
                except (json.JSONDecodeError, OSError):
                    pass

        if not self.windows:
            return

        # Distribute tool calls proportionally across windows by page count
        total_pages = sum(w.pages_crawled for w in self.windows)
        if total_pages == 0:
            # Assign all tool calls to first window
            self.windows[0].tool_calls = total_agent_tool_calls
            self.windows[0].agent_turns = total_agent_turns
            return

        for w in self.windows:
            proportion = w.pages_crawled / total_pages
            w.tool_calls = round(total_agent_tool_calls * proportion)
            w.agent_turns = round(total_agent_turns * proportion)

    def find_largest_gaps(self, top_n: int = 5) -> list[GapEntry]:
        """Find windows where tool_calls/pages ratio is largest.

        Gap score = how many standard deviations above the median ratio.
        """
        if not self.windows:
            return []

        ratios = [w.ratio for w in self.windows if w.ratio != float("inf")]
        if not ratios:
            return []

        sorted_ratios = sorted(ratios)
        median = sorted_ratios[len(sorted_ratios) // 2]

        # MAD-based deviation (robust to outliers)
        deviations = [abs(r - median) for r in sorted_ratios]
        mad = sorted(deviations)[len(deviations) // 2] or 1.0

        gaps: list[GapEntry] = []
        for w in self.windows:
            if w.ratio == float("inf"):
                gap_score = 100.0  # infinite ratio — always a gap
            else:
                gap_score = (w.ratio - median) / mad if mad > 0 else 0.0
            gaps.append(GapEntry(window=w, gap_score=gap_score))

        gaps.sort(key=lambda g: g.gap_score, reverse=True)

        for i, g in enumerate(gaps[:top_n]):
            g.rank = i + 1

        return gaps[:top_n]

    def _persist(self, spider: Spider, gaps: list[GapEntry]) -> None:
        """Write time series and gap analysis to metrics/ directory."""
        self.metrics_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        base = f"{spider.name}_{timestamp}"

        # Time series
        ts_path = self.metrics_dir / f"{base}_timeseries.jsonl"
        with open(ts_path, "w", encoding="utf-8") as f:
            for w in self.windows:
                f.write(json.dumps(w.to_dict(), ensure_ascii=False) + "\n")

        # Gap analysis
        gap_path = self.metrics_dir / f"{base}_gaps.json"
        gap_data = {
            "spider": spider.name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "total_windows": len(self.windows),
            "total_pages": sum(w.pages_crawled for w in self.windows),
            "total_tool_calls": sum(w.tool_calls for w in self.windows),
            "overall_ratio": round(
                sum(w.tool_calls for w in self.windows)
                / max(sum(w.pages_crawled for w in self.windows), 1),
                4,
            ),
            "window_seconds": self.window_seconds,
            "top_gaps": [g.to_dict() for g in gaps],
        }
        with open(gap_path, "w", encoding="utf-8") as f:
            json.dump(gap_data, f, indent=2, ensure_ascii=False)

        # Summary for quick reading
        summary_path = self.metrics_dir / f"{base}_summary.json"
        summary = {
            "spider": spider.name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "windows": len(self.windows),
            "total_pages": gap_data["total_pages"],
            "total_tool_calls": gap_data["total_tool_calls"],
            "overall_ratio": gap_data["overall_ratio"],
            "per_window": [w.to_dict() for w in self.windows],
        }
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)

        spider.logger.info(
            f"EfficiencyTracker: wrote {ts_path}, {gap_path}, {summary_path}"
        )

    def get_time_series(self) -> list[dict[str, Any]]:
        """Return the full time series as dicts (for programmatic use)."""
        return [w.to_dict() for w in self.windows]
