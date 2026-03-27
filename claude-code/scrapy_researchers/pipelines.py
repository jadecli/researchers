"""Scrapy pipelines for quality scoring, deduplication, and improvement feedback."""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from scrapy import Spider
from scrapy.exceptions import DropItem


class QualityScoringPipeline:
    """Scores items on a 0-1 scale based on field completeness, content length, and structure."""

    REQUIRED_FIELDS = {"url", "title", "content_markdown"}
    DESIRED_FIELDS = {"metadata", "content_html"}

    MINIMUM_CONTENT_LENGTH = 50
    GOOD_CONTENT_LENGTH = 500
    EXCELLENT_CONTENT_LENGTH = 2000

    def process_item(self, item: dict[str, Any], spider: Spider) -> dict[str, Any]:
        score = self._compute_score(item)
        item["quality_score"] = round(score, 4)
        spider.logger.debug(f"Quality score for {item.get('url', 'unknown')}: {score:.4f}")
        return item

    def _compute_score(self, item: dict[str, Any]) -> float:
        scores: list[float] = []

        # Field completeness (weight: 0.3)
        filled_required = sum(
            1 for f in self.REQUIRED_FIELDS if item.get(f) and str(item[f]).strip()
        )
        required_ratio = filled_required / len(self.REQUIRED_FIELDS) if self.REQUIRED_FIELDS else 1
        filled_desired = sum(
            1 for f in self.DESIRED_FIELDS if item.get(f) and str(item[f]).strip()
        )
        all_fields = self.REQUIRED_FIELDS | self.DESIRED_FIELDS
        total_ratio = (filled_required + filled_desired) / len(all_fields) if all_fields else 1
        scores.append(0.3 * (0.7 * required_ratio + 0.3 * total_ratio))

        # Content length (weight: 0.3)
        content = item.get("content_markdown", "")
        content_len = len(content)
        if content_len >= self.EXCELLENT_CONTENT_LENGTH:
            length_score = 1.0
        elif content_len >= self.GOOD_CONTENT_LENGTH:
            length_score = 0.7 + 0.3 * (
                (content_len - self.GOOD_CONTENT_LENGTH)
                / (self.EXCELLENT_CONTENT_LENGTH - self.GOOD_CONTENT_LENGTH)
            )
        elif content_len >= self.MINIMUM_CONTENT_LENGTH:
            length_score = 0.3 + 0.4 * (
                (content_len - self.MINIMUM_CONTENT_LENGTH)
                / (self.GOOD_CONTENT_LENGTH - self.MINIMUM_CONTENT_LENGTH)
            )
        else:
            length_score = 0.3 * (content_len / self.MINIMUM_CONTENT_LENGTH) if content_len > 0 else 0
        scores.append(0.3 * length_score)

        # Structure quality (weight: 0.25)
        structure_score = self._score_structure(content)
        scores.append(0.25 * structure_score)

        # Metadata richness (weight: 0.15)
        metadata = item.get("metadata", {})
        meta_fields = ["title", "description", "author", "date", "tags", "canonical_url"]
        meta_filled = sum(1 for f in meta_fields if metadata.get(f))
        meta_score = min(meta_filled / 3.0, 1.0)
        scores.append(0.15 * meta_score)

        return min(sum(scores), 1.0)

    def _score_structure(self, content: str) -> float:
        if not content:
            return 0.0

        lines = content.split("\n")
        has_headings = any(line.strip().startswith("#") for line in lines)
        heading_count = sum(1 for line in lines if line.strip().startswith("#"))
        has_code_blocks = "```" in content
        has_lists = any(
            line.strip().startswith(("- ", "* ", "1. ", "2. ")) for line in lines
        )
        has_links = "](" in content

        structure_points = 0.0
        if has_headings:
            structure_points += 0.3
        if heading_count >= 3:
            structure_points += 0.1
        if has_code_blocks:
            structure_points += 0.2
        if has_lists:
            structure_points += 0.2
        if has_links:
            structure_points += 0.2

        return min(structure_points, 1.0)


class DedupPipeline:
    """Fingerprint-based deduplication pipeline."""

    def __init__(self) -> None:
        self.seen_fingerprints: set[str] = set()

    def process_item(self, item: dict[str, Any], spider: Spider) -> dict[str, Any]:
        fingerprint = self._compute_fingerprint(item)
        if fingerprint in self.seen_fingerprints:
            raise DropItem(f"Duplicate item: {item.get('url', 'unknown')}")
        self.seen_fingerprints.add(fingerprint)
        return item

    def _compute_fingerprint(self, item: dict[str, Any]) -> str:
        url = item.get("url", "")
        content = item.get("content_markdown", "")
        raw = f"{url}:{content[:500]}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class ImprovementFeedbackPipeline:
    """Writes improvement entries to improvements/ directory as JSONL."""

    def __init__(self) -> None:
        self.entries: list[dict[str, Any]] = []
        self.improvements_dir = Path("improvements")

    def open_spider(self, spider: Spider) -> None:
        self.improvements_dir.mkdir(parents=True, exist_ok=True)
        self.entries = []

    def process_item(self, item: dict[str, Any], spider: Spider) -> dict[str, Any]:
        quality = item.get("quality_score", 0.0)
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "spider": spider.name,
            "url": item.get("url", ""),
            "quality_score": quality,
            "title": item.get("title", ""),
            "content_length": len(item.get("content_markdown", "")),
            "metadata_fields": list(item.get("metadata", {}).keys()),
            "needs_improvement": quality < 0.7,
        }

        if quality < 0.7:
            entry["improvement_hints"] = self._generate_hints(item)

        self.entries.append(entry)
        return item

    def close_spider(self, spider: Spider) -> None:
        if not self.entries:
            return

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = self.improvements_dir / f"{spider.name}_{timestamp}.jsonl"

        with open(filename, "w", encoding="utf-8") as f:
            for entry in self.entries:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")

        spider.logger.info(
            f"Wrote {len(self.entries)} improvement entries to {filename}"
        )

    def _generate_hints(self, item: dict[str, Any]) -> list[str]:
        hints: list[str] = []

        if not item.get("title"):
            hints.append("Missing title - check title selector")
        if len(item.get("content_markdown", "")) < 100:
            hints.append("Very short content - main content selector may be wrong")
        if not item.get("metadata", {}).get("description"):
            hints.append("Missing meta description")
        if "```" not in item.get("content_markdown", ""):
            hints.append("No code blocks found - check code extraction")
        if not any(
            line.startswith("#")
            for line in item.get("content_markdown", "").split("\n")
        ):
            hints.append("No headings found - check heading extraction")

        return hints
