"""Spider for crawling platform.claude.com documentation."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Generator
from urllib.parse import urljoin

import scrapy
from scrapy.http import Response

from scrapy_researchers.spiders.base_spider import BaseResearchSpider


class PlatformSpider(BaseResearchSpider):
    """Crawls platform.claude.com starting from its llms.txt.

    Extracts API documentation, SDK guides, and platform feature pages.
    """

    name = "platform_spider"
    allowed_domains = ["platform.claude.com"]
    start_urls = ["https://platform.claude.com/llms.txt"]

    custom_settings = {
        "DEPTH_LIMIT": 4,
    }

    def parse(self, response: Response) -> Generator[scrapy.Request | dict[str, Any], None, None]:
        """Parse llms.txt or documentation page."""
        if response.url.endswith("llms.txt"):
            yield from self._parse_index(response)
        else:
            yield from self._parse_platform_page(response)

    def _parse_index(self, response: Response) -> Generator[scrapy.Request, None, None]:
        """Parse the platform llms.txt index for doc URLs."""
        for line in response.text.split("\n"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            url = self._extract_url(line, response.url)
            if url:
                yield scrapy.Request(url, callback=self._parse_platform_page_callback)

    def _extract_url(self, line: str, base_url: str) -> str | None:
        """Extract URL from an index line."""
        if "](" in line:
            start = line.index("](") + 2
            end = line.index(")", start)
            return urljoin(base_url, line[start:end].strip())

        if line.startswith("http"):
            return line.split()[0]

        if line.startswith("/"):
            return urljoin(base_url, line.split()[0])

        return None

    def _parse_platform_page_callback(
        self, response: Response
    ) -> Generator[scrapy.Request | dict[str, Any], None, None]:
        """Parse a platform page and follow internal links."""
        yield from self._parse_platform_page(response)

        for href in response.css("a[href]::attr(href)").getall():
            absolute = urljoin(response.url, href)
            from urllib.parse import urlparse

            if urlparse(absolute).netloc in self.allowed_domains:
                yield scrapy.Request(absolute, callback=self._parse_platform_page_callback)

    def _parse_platform_page(
        self, response: Response
    ) -> Generator[dict[str, Any], None, None]:
        """Extract platform documentation page content."""
        html = response.text
        content_md = self.markdown_extractor.html_to_markdown(html, response.url)
        metadata = self.metadata_extractor.extract(html, response.url)

        page_type = self._classify_page(response.url, content_md)
        metadata["page_type"] = page_type

        item = {
            "url": response.url,
            "title": metadata.get("title", ""),
            "content_markdown": content_md,
            "content_html": html,
            "metadata": metadata,
            "extraction_timestamp": datetime.utcnow().isoformat(),
            "_selectors_used": ["main", "article", ".docs-content", ".api-content"],
        }

        item = self.on_page_crawled(item, response)
        yield item

    def _classify_page(self, url: str, content: str) -> str:
        """Classify page type based on URL patterns and content."""
        url_lower = url.lower()
        content_lower = content.lower()

        if "/api" in url_lower or "endpoint" in content_lower:
            return "api_reference"
        if "/sdk" in url_lower or "import " in content:
            return "sdk_guide"
        if "/guide" in url_lower or "/tutorial" in url_lower:
            return "guide"
        if "/changelog" in url_lower or "/release" in url_lower:
            return "changelog"

        return "documentation"
