"""Quality scoring for extracted items with CLI support."""

from __future__ import annotations

import json
import re
import sys
from typing import Any


class QualityScorer:
    """Scores extraction quality on a 0-1 scale.

    Metrics:
    - field_completeness: All required fields filled
    - content_depth: Word count, heading count, code block count
    - structure_quality: Proper markdown hierarchy
    - link_validity: Internal links resolve
    """

    REQUIRED_FIELDS = ["url", "title", "content_markdown"]
    IMPORTANT_FIELDS = ["metadata", "content_html", "extraction_timestamp"]

    def score(self, item: dict[str, Any]) -> float:
        """Score an item from 0.0 to 1.0."""
        completeness = self._field_completeness(item)
        depth = self._content_depth(item)
        structure = self._structure_quality(item)
        links = self._link_validity(item)

        weighted = (
            0.25 * completeness
            + 0.30 * depth
            + 0.30 * structure
            + 0.15 * links
        )

        return round(min(max(weighted, 0.0), 1.0), 4)

    def score_detailed(self, item: dict[str, Any]) -> dict[str, float]:
        """Return detailed breakdown of quality metrics."""
        return {
            "field_completeness": round(self._field_completeness(item), 4),
            "content_depth": round(self._content_depth(item), 4),
            "structure_quality": round(self._structure_quality(item), 4),
            "link_validity": round(self._link_validity(item), 4),
            "overall": self.score(item),
        }

    def _field_completeness(self, item: dict[str, Any]) -> float:
        """Score based on how many required and important fields are filled."""
        required_filled = sum(
            1
            for f in self.REQUIRED_FIELDS
            if item.get(f) and str(item[f]).strip()
        )
        important_filled = sum(
            1
            for f in self.IMPORTANT_FIELDS
            if item.get(f) and str(item[f]).strip()
        )

        total = len(self.REQUIRED_FIELDS) + len(self.IMPORTANT_FIELDS)
        if total == 0:
            return 1.0

        # Required fields weighted more heavily
        required_weight = 0.7
        important_weight = 0.3

        req_score = required_filled / len(self.REQUIRED_FIELDS) if self.REQUIRED_FIELDS else 1.0
        imp_score = (
            important_filled / len(self.IMPORTANT_FIELDS) if self.IMPORTANT_FIELDS else 1.0
        )

        return required_weight * req_score + important_weight * imp_score

    def _content_depth(self, item: dict[str, Any]) -> float:
        """Score based on content richness."""
        content = item.get("content_markdown", "")
        if not content:
            return 0.0

        words = len(content.split())
        lines = content.split("\n")

        heading_count = sum(1 for line in lines if line.strip().startswith("#"))
        code_block_count = content.count("```") // 2
        list_count = sum(
            1
            for line in lines
            if line.strip().startswith(("- ", "* ", "1. ", "2. ", "3. "))
        )

        # Word count score (0-1): 0 at 0, 0.5 at 200, 1.0 at 1000+
        word_score = min(words / 1000.0, 1.0)

        # Heading score: bonus for good heading coverage
        heading_score = min(heading_count / 5.0, 1.0)

        # Code block score: bonus for including code examples
        code_score = min(code_block_count / 3.0, 1.0)

        # List score
        list_score = min(list_count / 5.0, 1.0)

        return 0.4 * word_score + 0.25 * heading_score + 0.2 * code_score + 0.15 * list_score

    def _structure_quality(self, item: dict[str, Any]) -> float:
        """Score markdown structure quality."""
        content = item.get("content_markdown", "")
        if not content:
            return 0.0

        lines = content.split("\n")
        score = 0.0

        # Check heading hierarchy
        headings = [line for line in lines if line.strip().startswith("#")]
        if headings:
            score += 0.2

            # Check for proper hierarchy (no jumping from h1 to h4)
            levels = []
            for h in headings:
                stripped = h.strip()
                level = 0
                for ch in stripped:
                    if ch == "#":
                        level += 1
                    else:
                        break
                levels.append(level)

            hierarchy_ok = True
            for i in range(1, len(levels)):
                if levels[i] > levels[i - 1] + 1:
                    hierarchy_ok = False
                    break

            if hierarchy_ok:
                score += 0.2

        # Check for paragraphs (non-empty, non-heading lines separated by blanks)
        paragraph_count = 0
        in_paragraph = False
        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and not stripped.startswith("```"):
                if not in_paragraph:
                    paragraph_count += 1
                    in_paragraph = True
            else:
                in_paragraph = False

        if paragraph_count >= 3:
            score += 0.2

        # Check for code blocks with language hints
        code_blocks = re.findall(r"```(\w+)?", content)
        if code_blocks:
            score += 0.1
            if any(lang for lang in code_blocks if lang):
                score += 0.1

        # Check for links
        link_count = len(re.findall(r"\[([^\]]+)\]\(([^)]+)\)", content))
        if link_count > 0:
            score += 0.1
        if link_count >= 3:
            score += 0.1

        return min(score, 1.0)

    def _link_validity(self, item: dict[str, Any]) -> float:
        """Score based on link quality (heuristic without actual HTTP checks)."""
        content = item.get("content_markdown", "")
        if not content:
            return 0.5  # Neutral score when no content

        links = re.findall(r"\[([^\]]+)\]\(([^)]+)\)", content)
        if not links:
            return 0.5  # Neutral when no links

        valid = 0
        total = len(links)

        for text, href in links:
            # Check link has text
            if not text.strip():
                continue

            # Check href is reasonable
            if href.startswith(("http://", "https://", "/", "#", "./")):
                valid += 1
            elif href.startswith("mailto:"):
                valid += 1

        return valid / total if total > 0 else 0.5


def main() -> None:
    """CLI mode: read JSON items from stdin and print quality scores."""
    scorer = QualityScorer()

    input_data = sys.stdin.read().strip()
    if not input_data:
        print(json.dumps({"error": "No input provided"}))
        sys.exit(1)

    items: list[dict[str, Any]] = []

    # Try parsing as JSON array or JSONL
    try:
        parsed = json.loads(input_data)
        if isinstance(parsed, list):
            items = parsed
        elif isinstance(parsed, dict):
            items = [parsed]
    except json.JSONDecodeError:
        for line in input_data.split("\n"):
            line = line.strip()
            if line:
                try:
                    items.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

    if not items:
        print(json.dumps({"error": "No valid JSON items found"}))
        sys.exit(1)

    results = []
    for item in items:
        detailed = scorer.score_detailed(item)
        detailed["url"] = item.get("url", "unknown")
        results.append(detailed)

    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
