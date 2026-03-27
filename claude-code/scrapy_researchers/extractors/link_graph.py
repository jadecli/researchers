"""Link graph builder for topic clustering and page importance scoring."""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Any
from urllib.parse import urlparse


class LinkGraph:
    """Builds and analyzes a link graph from crawled pages.

    Provides:
    - Graph construction from page data
    - Topic clustering via connected components
    - PageRank-style importance scoring
    """

    def __init__(self) -> None:
        self.graph: dict[str, list[str]] = {}
        self.reverse_graph: dict[str, list[str]] = defaultdict(list)
        self.page_metadata: dict[str, dict[str, Any]] = {}

    def build_graph(self, pages: list[dict[str, Any]]) -> dict[str, list[str]]:
        """Build a directed link graph from page data.

        Args:
            pages: List of page dicts with 'url' and 'content_markdown' or 'content_html' fields.

        Returns:
            Dict mapping url -> list of outgoing URLs.
        """
        self.graph = {}
        self.reverse_graph = defaultdict(list)
        self.page_metadata = {}

        all_urls = {p["url"] for p in pages if "url" in p}

        for page in pages:
            url = page.get("url", "")
            if not url:
                continue

            self.page_metadata[url] = {
                "title": page.get("title", ""),
                "quality_score": page.get("quality_score", 0.0),
            }

            outgoing = self._extract_links(page, all_urls)
            self.graph[url] = outgoing

            for target in outgoing:
                self.reverse_graph[target].append(url)

        return self.graph

    def find_clusters(self) -> list[list[str]]:
        """Find topic clusters using connected components.

        Returns:
            List of clusters, where each cluster is a list of URLs.
        """
        if not self.graph:
            return []

        # Build undirected adjacency
        adjacency: dict[str, set[str]] = defaultdict(set)
        for source, targets in self.graph.items():
            for target in targets:
                adjacency[source].add(target)
                adjacency[target].add(source)

        visited: set[str] = set()
        clusters: list[list[str]] = []

        for node in self.graph:
            if node in visited:
                continue

            cluster: list[str] = []
            stack = [node]

            while stack:
                current = stack.pop()
                if current in visited:
                    continue
                visited.add(current)
                cluster.append(current)

                for neighbor in adjacency.get(current, set()):
                    if neighbor not in visited:
                        stack.append(neighbor)

            if cluster:
                clusters.append(sorted(cluster))

        # Sort clusters by size descending
        clusters.sort(key=len, reverse=True)
        return clusters

    def get_page_rank(self, damping: float = 0.85, iterations: int = 50) -> dict[str, float]:
        """Compute PageRank scores for all pages in the graph.

        Args:
            damping: Damping factor (probability of following a link).
            iterations: Number of power iterations.

        Returns:
            Dict mapping url -> PageRank score (0-1 normalized).
        """
        if not self.graph:
            return {}

        all_nodes = set(self.graph.keys())
        for targets in self.graph.values():
            all_nodes.update(targets)

        n = len(all_nodes)
        if n == 0:
            return {}

        nodes = sorted(all_nodes)
        node_index = {node: i for i, node in enumerate(nodes)}

        scores = [1.0 / n] * n

        for _ in range(iterations):
            new_scores = [(1.0 - damping) / n] * n

            for source, targets in self.graph.items():
                if not targets:
                    # Distribute rank evenly when no outgoing links (dangling node)
                    share = damping * scores[node_index[source]] / n
                    for j in range(n):
                        new_scores[j] += share
                else:
                    share = damping * scores[node_index[source]] / len(targets)
                    for target in targets:
                        if target in node_index:
                            new_scores[node_index[target]] += share

            scores = new_scores

        # Normalize
        max_score = max(scores) if scores else 1.0
        if max_score > 0:
            scores = [s / max_score for s in scores]

        return {nodes[i]: scores[i] for i in range(n)}

    def _extract_links(
        self, page: dict[str, Any], known_urls: set[str]
    ) -> list[str]:
        """Extract outgoing links from page content."""
        content = page.get("content_markdown", "")
        source_url = page.get("url", "")

        import re

        link_pattern = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")
        links: list[str] = []
        seen: set[str] = set()

        for _text, href in link_pattern.findall(content):
            absolute = self._resolve_url(href, source_url)
            if absolute and absolute != source_url and absolute not in seen:
                seen.add(absolute)
                # Only include links to known pages
                if absolute in known_urls:
                    links.append(absolute)

        return links

    def _resolve_url(self, href: str, base_url: str) -> str:
        """Resolve a potentially relative URL against a base URL."""
        if href.startswith(("http://", "https://")):
            return href.split("#")[0].rstrip("/")

        if href.startswith("/"):
            parsed = urlparse(base_url)
            return f"{parsed.scheme}://{parsed.netloc}{href}".split("#")[0].rstrip("/")

        if href.startswith("#") or href.startswith("mailto:") or href.startswith("javascript:"):
            return ""

        # Relative path
        from urllib.parse import urljoin

        return urljoin(base_url, href).split("#")[0].rstrip("/")
