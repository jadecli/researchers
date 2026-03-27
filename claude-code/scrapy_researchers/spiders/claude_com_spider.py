"""Spider for crawling claude.com documentation."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Generator
from urllib.parse import urljoin

import scrapy
from scrapy.http import Response

from scrapy_researchers.spiders.base_spider import BaseResearchSpider


class ClaudeComSpider(BaseResearchSpider):
    """Crawls claude.com/docs starting from llms.txt.

    Extracts Cowork, connector, and plugin documentation.
    """

    name = "claude_com_spider"
    allowed_domains = ["claude.com", "www.claude.com"]
    start_urls = ["https://claude.com/docs/llms.txt"]

    custom_settings = {
        "DEPTH_LIMIT": 4,
    }

    PAGE_TYPE_PATTERNS = {
        "cowork": ["/cowork", "/collaborate", "/workspace"],
        "connector": ["/connector", "/integration", "/connect"],
        "plugin": ["/plugin", "/extension", "/addon"],
        "guide": ["/guide", "/tutorial", "/getting-started"],
        "reference": ["/reference", "/api", "/spec"],
    }

    def parse(self, response: Response) -> Generator[scrapy.Request | dict[str, Any], None, None]:
        """Parse llms.txt index or documentation page."""
        if response.url.endswith("llms.txt"):
            yield from self._parse_index(response)
        else:
            yield from self._parse_doc_page(response)

    def _parse_index(self, response: Response) -> Generator[scrapy.Request, None, None]:
        """Parse the llms.txt index."""
        for line in response.text.split("\n"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            url = self._extract_url(line, response.url)
            if url:
                yield scrapy.Request(
                    url,
                    callback=self._parse_doc_page_callback,
                    meta={"index_line": line},
                )

    def _extract_url(self, line: str, base_url: str) -> str | None:
        """Extract URL from an index line."""
        if "](" in line:
            try:
                start = line.index("](") + 2
                end = line.index(")", start)
                return urljoin(base_url, line[start:end].strip())
            except ValueError:
                return None

        if line.startswith("http"):
            return line.split()[0]

        if line.startswith("/"):
            return urljoin(base_url, line.split()[0])

        return None

    def _parse_doc_page_callback(
        self, response: Response
    ) -> Generator[scrapy.Request | dict[str, Any], None, None]:
        """Parse doc page and follow internal links."""
        yield from self._parse_doc_page(response)

        for href in response.css("a[href]::attr(href)").getall():
            absolute = urljoin(response.url, href)
            from urllib.parse import urlparse

            if urlparse(absolute).netloc in self.allowed_domains:
                yield scrapy.Request(
                    absolute,
                    callback=self._parse_doc_page_callback,
                    errback=self._handle_error,
                )

    def _parse_doc_page(
        self, response: Response
    ) -> Generator[dict[str, Any], None, None]:
        """Extract a claude.com documentation page."""
        html = response.text
        content_md = self.markdown_extractor.html_to_markdown(html, response.url)
        metadata = self.metadata_extractor.extract(html, response.url)

        page_type = self._classify_page_type(response.url, content_md)
        metadata["page_type"] = page_type

        item = {
            "url": response.url,
            "title": metadata.get("title", ""),
            "content_markdown": content_md,
            "content_html": html,
            "metadata": metadata,
            "extraction_timestamp": datetime.utcnow().isoformat(),
            "_selectors_used": [
                "main",
                "article",
                ".docs-content",
                ".markdown-body",
            ],
        }

        item = self.on_page_crawled(item, response)
        yield item

    def _classify_page_type(self, url: str, content: str) -> str:
        """Classify the page type based on URL and content patterns."""
        url_lower = url.lower()

        for page_type, patterns in self.PAGE_TYPE_PATTERNS.items():
            if any(pattern in url_lower for pattern in patterns):
                return page_type

        content_lower = content[:1500].lower()
        if "connector" in content_lower or "integration" in content_lower:
            return "connector"
        if "plugin" in content_lower or "extension" in content_lower:
            return "plugin"
        if "cowork" in content_lower or "collaborate" in content_lower:
            return "cowork"

        return "documentation"

    def _handle_error(self, failure: Any) -> None:
        """Log request failures."""
        self.logger.warning(f"Request failed: {failure.request.url} - {failure.value}")
