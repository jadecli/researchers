"""Synthesize crawled knowledge into structured summaries."""

from __future__ import annotations

import logging
from typing import Any

from ..models.crawl_target import PageType
from ..models.extraction_result import ExtractionResult

logger = logging.getLogger(__name__)


class KnowledgeSynthesizer:
    """Synthesizes crawled extraction results into structured knowledge.

    Takes a collection of ExtractionResults from a crawl campaign and
    produces organized summaries grouped by page type, domain patterns,
    and quality tiers.

    Usage:
        synthesizer = KnowledgeSynthesizer()
        summary = synthesizer.synthesize(results)
        print(summary["by_type"]["api"])
    """

    def __init__(self, min_quality: float = 0.3) -> None:
        """Initialize with a minimum quality threshold for inclusion.

        Args:
            min_quality: Minimum overall quality score to include a result.
        """
        self.min_quality = min_quality

    def synthesize(self, results: list[ExtractionResult]) -> dict[str, Any]:
        """Produce a structured knowledge summary from crawl results.

        Args:
            results: List of extraction results from a campaign.

        Returns:
            Dict with by_type, by_quality_tier, patterns, and statistics.
        """
        filtered = [r for r in results if r.quality.overall >= self.min_quality]
        logger.info(
            "Synthesizing %d results (%d filtered out by quality threshold %.2f)",
            len(filtered),
            len(results) - len(filtered),
            self.min_quality,
        )

        by_type = self._group_by_type(filtered)
        by_quality = self._group_by_quality_tier(filtered)
        patterns = self._extract_patterns(filtered)
        stats = self._compute_statistics(results, filtered)

        return {
            "by_type": by_type,
            "by_quality_tier": by_quality,
            "patterns": patterns,
            "statistics": stats,
        }

    def summarize_for_plugin_design(
        self, results: list[ExtractionResult]
    ) -> list[str]:
        """Create concise summaries suitable for plugin design input.

        Args:
            results: Extraction results to summarize.

        Returns:
            List of summary strings, one per high-quality result.
        """
        summaries: list[str] = []
        sorted_results = sorted(
            results, key=lambda r: r.quality.overall, reverse=True
        )

        for result in sorted_results[:20]:
            if result.quality.overall < self.min_quality:
                continue

            title_part = f"'{result.title}'" if result.title else result.url
            content_preview = result.content[:200].replace("\n", " ").strip()
            summary = (
                f"[{result.page_type.value}] {title_part}: "
                f"{content_preview}"
            )
            summaries.append(summary)

        return summaries

    def extract_api_endpoints(
        self, results: list[ExtractionResult]
    ) -> list[dict[str, Any]]:
        """Extract API endpoint information from API-type results.

        Args:
            results: Extraction results (filters to API type).

        Returns:
            List of endpoint dicts with url, method hints, and descriptions.
        """
        endpoints: list[dict[str, Any]] = []
        api_results = [r for r in results if r.page_type == PageType.API]

        for result in api_results:
            sd = result.structured_data
            if "endpoints" in sd:
                for ep in sd["endpoints"]:
                    endpoints.append(ep)
            elif "paths" in sd:
                for path, methods in sd["paths"].items():
                    if isinstance(methods, dict):
                        for method, details in methods.items():
                            endpoints.append({
                                "path": path,
                                "method": method.upper(),
                                "description": details.get("summary", ""),
                                "source_url": result.url,
                            })

        return endpoints

    def _group_by_type(
        self, results: list[ExtractionResult]
    ) -> dict[str, list[dict[str, Any]]]:
        """Group results by page type with summaries."""
        grouped: dict[str, list[dict[str, Any]]] = {}

        for result in results:
            type_key = result.page_type.value
            if type_key not in grouped:
                grouped[type_key] = []
            grouped[type_key].append({
                "url": result.url,
                "title": result.title,
                "quality": result.quality.overall,
                "content_length": result.content_length,
                "link_count": result.link_count,
            })

        return grouped

    def _group_by_quality_tier(
        self, results: list[ExtractionResult]
    ) -> dict[str, list[str]]:
        """Group result URLs by quality tier."""
        tiers: dict[str, list[str]] = {"high": [], "medium": [], "low": []}

        for result in results:
            q = result.quality.overall
            if q >= 0.8:
                tiers["high"].append(result.url)
            elif q >= 0.5:
                tiers["medium"].append(result.url)
            else:
                tiers["low"].append(result.url)

        return tiers

    def _extract_patterns(
        self, results: list[ExtractionResult]
    ) -> dict[str, Any]:
        """Extract common patterns across results."""
        all_selectors: list[str] = []
        all_types: set[str] = set()
        all_domains: set[str] = set()

        for result in results:
            all_selectors.extend(result.selectors_used)
            all_types.add(result.page_type.value)
            from urllib.parse import urlparse
            parsed = urlparse(result.url)
            if parsed.hostname:
                all_domains.add(parsed.hostname)

        # Count selector frequency
        selector_freq: dict[str, int] = {}
        for sel in all_selectors:
            selector_freq[sel] = selector_freq.get(sel, 0) + 1

        top_selectors = sorted(
            selector_freq.items(), key=lambda x: x[1], reverse=True
        )[:10]

        return {
            "common_selectors": [{"selector": s, "count": c} for s, c in top_selectors],
            "page_types": sorted(all_types),
            "domains": sorted(all_domains),
        }

    def _compute_statistics(
        self, all_results: list[ExtractionResult],
        filtered_results: list[ExtractionResult],
    ) -> dict[str, Any]:
        """Compute summary statistics."""
        if not all_results:
            return {"total": 0}

        qualities = [r.quality.overall for r in all_results]
        return {
            "total": len(all_results),
            "included": len(filtered_results),
            "excluded": len(all_results) - len(filtered_results),
            "avg_quality": round(sum(qualities) / len(qualities), 3),
            "min_quality": round(min(qualities), 3),
            "max_quality": round(max(qualities), 3),
            "total_content_length": sum(r.content_length for r in filtered_results),
            "total_links": sum(r.link_count for r in filtered_results),
            "unique_page_types": len(set(r.page_type.value for r in all_results)),
        }
