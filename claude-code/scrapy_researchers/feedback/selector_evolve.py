"""Selector evolution tracking and improvement proposals."""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

from bs4 import BeautifulSoup, Tag


class SelectorEvolver:
    """Tracks CSS/XPath selector performance and proposes improvements.

    Maintains a history of selector success rates and generates alternative
    selectors when existing ones start failing.
    """

    def __init__(self) -> None:
        self.selector_stats: dict[str, dict[str, Any]] = defaultdict(
            lambda: {"attempts": 0, "successes": 0, "failures": 0, "urls": []}
        )

    def track(self, selector: str, success: bool, url: str = "") -> None:
        """Record a selector usage attempt.

        Args:
            selector: CSS selector string.
            success: Whether the selector found content.
            url: URL where the selector was used.
        """
        stats = self.selector_stats[selector]
        stats["attempts"] += 1

        if success:
            stats["successes"] += 1
        else:
            stats["failures"] += 1

        if url and url not in stats["urls"]:
            stats["urls"].append(url)
            # Keep only last 50 URLs
            if len(stats["urls"]) > 50:
                stats["urls"] = stats["urls"][-50:]

    def get_success_rate(self, selector: str) -> float:
        """Get the success rate for a selector."""
        stats = self.selector_stats.get(selector)
        if not stats or stats["attempts"] == 0:
            return 0.0
        return stats["successes"] / stats["attempts"]

    def propose_alternatives(
        self, failing_selector: str, html_sample: str
    ) -> list[str]:
        """Propose alternative CSS selectors for a failing one.

        Analyzes the HTML sample to find likely content containers
        and generates selectors that might work better.

        Args:
            failing_selector: The CSS selector that is failing.
            html_sample: Sample HTML to analyze.

        Returns:
            List of proposed alternative selectors, ordered by confidence.
        """
        soup = BeautifulSoup(html_sample, "lxml")
        proposals: list[tuple[str, float]] = []

        # Strategy 1: Find elements with substantial text content
        content_candidates = self._find_content_elements(soup)
        for selector, confidence in content_candidates:
            if selector != failing_selector:
                proposals.append((selector, confidence))

        # Strategy 2: Try semantic HTML5 elements
        semantic_selectors = self._try_semantic_selectors(soup)
        for selector, confidence in semantic_selectors:
            if selector != failing_selector:
                proposals.append((selector, confidence))

        # Strategy 3: Try role attributes
        role_selectors = self._try_role_selectors(soup)
        for selector, confidence in role_selectors:
            if selector != failing_selector:
                proposals.append((selector, confidence))

        # Strategy 4: Try data attributes
        data_selectors = self._try_data_attribute_selectors(soup)
        for selector, confidence in data_selectors:
            if selector != failing_selector:
                proposals.append((selector, confidence))

        # Deduplicate and sort by confidence
        seen: set[str] = set()
        unique: list[tuple[str, float]] = []
        for selector, confidence in proposals:
            if selector not in seen:
                seen.add(selector)
                unique.append((selector, confidence))

        unique.sort(key=lambda x: x[1], reverse=True)
        return [selector for selector, _ in unique[:10]]

    def get_stats(self) -> dict[str, Any]:
        """Get full statistics for all tracked selectors."""
        result: dict[str, Any] = {}

        for selector, stats in self.selector_stats.items():
            attempts = stats["attempts"]
            success_rate = stats["successes"] / attempts if attempts > 0 else 0.0

            result[selector] = {
                "attempts": attempts,
                "successes": stats["successes"],
                "failures": stats["failures"],
                "success_rate": round(success_rate, 4),
                "url_count": len(stats["urls"]),
                "status": (
                    "healthy" if success_rate >= 0.8
                    else "degraded" if success_rate >= 0.5
                    else "failing"
                ),
            }

        return result

    def _find_content_elements(
        self, soup: BeautifulSoup
    ) -> list[tuple[str, float]]:
        """Find elements that likely contain main content."""
        results: list[tuple[str, float]] = []

        for el in soup.find_all(["div", "section", "article", "main"]):
            if not isinstance(el, Tag):
                continue

            text = el.get_text(strip=True)
            text_len = len(text)

            if text_len < 200:
                continue

            # Check for content indicators
            child_headings = len(el.find_all(["h1", "h2", "h3"]))
            child_paragraphs = len(el.find_all("p"))

            if child_headings == 0 and child_paragraphs < 2:
                continue

            confidence = min(text_len / 5000.0, 1.0)
            confidence += min(child_headings / 5.0, 0.3)
            confidence += min(child_paragraphs / 10.0, 0.2)
            confidence = min(confidence, 1.0)

            # Build selector
            selector = self._build_selector(el)
            if selector:
                results.append((selector, confidence))

        return results

    def _try_semantic_selectors(
        self, soup: BeautifulSoup
    ) -> list[tuple[str, float]]:
        """Try semantic HTML5 element selectors."""
        results: list[tuple[str, float]] = []

        semantic_tags = [
            ("main", 0.9),
            ("article", 0.85),
            ("section.content", 0.7),
            ("section.main", 0.7),
            (".content", 0.6),
            (".main-content", 0.65),
            ("#content", 0.65),
            ("#main", 0.6),
            (".post-content", 0.6),
            (".article-body", 0.6),
            (".markdown-body", 0.7),
            (".docs-content", 0.7),
        ]

        for selector, base_confidence in semantic_tags:
            try:
                elements = soup.select(selector)
                if elements:
                    text_len = sum(len(el.get_text(strip=True)) for el in elements)
                    if text_len > 100:
                        results.append((selector, base_confidence))
            except Exception:
                continue

        return results

    def _try_role_selectors(
        self, soup: BeautifulSoup
    ) -> list[tuple[str, float]]:
        """Try ARIA role-based selectors."""
        results: list[tuple[str, float]] = []

        roles = [
            ('[role="main"]', 0.85),
            ('[role="article"]', 0.75),
            ('[role="document"]', 0.65),
        ]

        for selector, confidence in roles:
            try:
                elements = soup.select(selector)
                if elements and len(elements[0].get_text(strip=True)) > 100:
                    results.append((selector, confidence))
            except Exception:
                continue

        return results

    def _try_data_attribute_selectors(
        self, soup: BeautifulSoup
    ) -> list[tuple[str, float]]:
        """Try data-attribute based selectors."""
        results: list[tuple[str, float]] = []

        for el in soup.find_all(True):
            if not isinstance(el, Tag):
                continue

            for attr_name in el.attrs:
                if not attr_name.startswith("data-"):
                    continue

                attr_value = el.get(attr_name, "")
                if not isinstance(attr_value, str):
                    continue

                value_lower = attr_value.lower()
                if any(
                    kw in value_lower
                    for kw in ["content", "main", "article", "body", "text"]
                ):
                    text_len = len(el.get_text(strip=True))
                    if text_len > 200:
                        selector = f'[{attr_name}="{attr_value}"]'
                        confidence = min(text_len / 5000.0 + 0.3, 0.8)
                        results.append((selector, confidence))

        return results

    def _build_selector(self, el: Tag) -> str:
        """Build a CSS selector for an element."""
        tag = el.name

        el_id = el.get("id")
        if el_id and isinstance(el_id, str):
            return f"#{el_id}"

        classes = el.get("class", [])
        if isinstance(classes, list) and classes:
            # Pick the most specific class
            best_class = max(classes, key=len)
            return f"{tag}.{best_class}"

        # Fall back to tag name with nth-child if needed
        parent = el.parent
        if parent and isinstance(parent, Tag):
            siblings = parent.find_all(tag, recursive=False)
            if len(siblings) == 1:
                parent_selector = self._build_selector(parent)
                if parent_selector:
                    return f"{parent_selector} > {tag}"

        return tag
