"""Base spider class with improvement loop integration."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Generator

import scrapy
from scrapy.http import Response

from scrapy_researchers.extractors.markdown_extractor import MarkdownExtractor
from scrapy_researchers.extractors.metadata_extractor import MetadataExtractor
from scrapy_researchers.feedback.quality_scorer import QualityScorer


class BaseResearchSpider(scrapy.Spider):
    """Base spider that integrates with the improvement feedback loop.

    All research spiders should inherit from this class to get:
    - Automatic quality scoring on each crawled page
    - Context delta loading from previous improvement rounds
    - Improvement log writing for the feedback loop
    """

    improvement_log: list[dict[str, Any]] = []

    custom_settings: dict[str, Any] = {
        "LOG_LEVEL": "INFO",
    }

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.markdown_extractor = MarkdownExtractor()
        self.metadata_extractor = MetadataExtractor()
        self.quality_scorer = QualityScorer()
        self.improvement_log = []
        self._context_delta = self.load_context_delta()

    def on_page_crawled(self, item: dict[str, Any], response: Response) -> dict[str, Any]:
        """Score a crawled page and write context delta information.

        Called by subclass parse methods after building the initial item dict.
        """
        score = self.quality_scorer.score(item)
        item["quality_score"] = round(score, 4)

        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "spider": self.name,
            "url": item.get("url", response.url),
            "quality_score": score,
            "status": response.status,
            "content_length": len(item.get("content_markdown", "")),
        }

        if score < 0.7:
            log_entry["needs_improvement"] = True
            log_entry["selectors_used"] = item.get("_selectors_used", [])

        self.improvement_log.append(log_entry)
        return item

    def load_context_delta(self) -> dict[str, Any]:
        """Read the latest context delta from improvements/ directory.

        Returns the most recent delta for this spider, or an empty dict
        if no previous improvements exist.
        """
        improvements_dir = Path("improvements")
        if not improvements_dir.exists():
            return {}

        delta_files = sorted(
            improvements_dir.glob(f"{self.name}_*.jsonl"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )

        if not delta_files:
            return {}

        latest_file = delta_files[0]
        entries: list[dict[str, Any]] = []

        try:
            with open(latest_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        entries.append(json.loads(line))
        except (json.JSONDecodeError, OSError) as e:
            self.logger.warning(f"Failed to read context delta from {latest_file}: {e}")
            return {}

        if not entries:
            return {}

        failing_urls = [e["url"] for e in entries if e.get("needs_improvement")]
        avg_score = sum(e.get("quality_score", 0) for e in entries) / len(entries)

        return {
            "previous_avg_score": avg_score,
            "failing_urls": failing_urls,
            "entry_count": len(entries),
            "source_file": str(latest_file),
        }

    def parse(self, response: Response) -> Generator[dict[str, Any], None, None]:
        """Default parse implementation. Subclasses should override this.

        Extracts markdown content, metadata, and scores the page.
        """
        html = response.text
        content_markdown = self.markdown_extractor.html_to_markdown(html, response.url)
        metadata = self.metadata_extractor.extract(html, response.url)

        item = {
            "url": response.url,
            "title": metadata.get("title", ""),
            "content_markdown": content_markdown,
            "content_html": html,
            "metadata": metadata,
            "extraction_timestamp": datetime.utcnow().isoformat(),
        }

        item = self.on_page_crawled(item, response)
        yield item

    def closed(self, reason: str) -> None:
        """Write improvement log when spider closes."""
        if not self.improvement_log:
            return

        improvements_dir = Path("improvements")
        improvements_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = improvements_dir / f"{self.name}_{timestamp}.jsonl"

        with open(filename, "w", encoding="utf-8") as f:
            for entry in self.improvement_log:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")

        self.logger.info(f"Wrote {len(self.improvement_log)} log entries to {filename}")
