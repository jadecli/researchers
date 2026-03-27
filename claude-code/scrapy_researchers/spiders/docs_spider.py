"""Spider for crawling documentation sites starting from llms.txt."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Generator
from urllib.parse import urljoin

import scrapy
from scrapy.http import Response

from scrapy_researchers.spiders.base_spider import BaseResearchSpider


class DocsSpider(BaseResearchSpider):
    """Crawls documentation sites starting from an llms.txt index URL.

    Parses the llms.txt index to discover all documentation page URLs,
    then follows each link to extract full page content as markdown.
    """

    name = "docs_spider"
    allowed_domains: list[str] = []

    custom_settings = {
        "DEPTH_LIMIT": 5,
    }

    def __init__(self, llms_txt_url: str = "", *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.llms_txt_url = llms_txt_url or "https://code.claude.com/docs/llms.txt"
        self.start_urls = [self.llms_txt_url]

    def parse(self, response: Response) -> Generator[scrapy.Request | dict[str, Any], None, None]:
        """Parse the llms.txt index and follow all discovered URLs."""
        content_type = response.headers.get("Content-Type", b"").decode("utf-8", errors="ignore")

        if response.url.endswith("llms.txt") or "text/plain" in content_type:
            yield from self._parse_llms_txt(response)
        else:
            yield from self._parse_doc_page(response)

    def _parse_llms_txt(self, response: Response) -> Generator[scrapy.Request, None, None]:
        """Parse llms.txt format: lines with URLs, titles, and descriptions."""
        text = response.text
        urls_found = 0

        for line in text.split("\n"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            # llms.txt format: URL or markdown link [title](url) or "- url: description"
            url = self._extract_url_from_line(line, response.url)
            if url:
                urls_found += 1
                yield scrapy.Request(
                    url,
                    callback=self._parse_doc_page_callback,
                    meta={"llms_txt_line": line},
                )

        self.logger.info(f"Found {urls_found} URLs in llms.txt at {response.url}")

    def _extract_url_from_line(self, line: str, base_url: str) -> str | None:
        """Extract a URL from an llms.txt line."""
        # Markdown link format: [title](url)
        if "](" in line:
            start = line.index("](") + 2
            end = line.index(")", start)
            url = line[start:end].strip()
            return urljoin(base_url, url)

        # Direct URL
        if line.startswith("http://") or line.startswith("https://"):
            url = line.split()[0]
            return url

        # "- url: description" format
        if line.startswith("- "):
            parts = line[2:].split(":", 1)
            candidate = parts[0].strip()
            if candidate.startswith("http://") or candidate.startswith("https://"):
                return candidate

        # Relative path
        if line.startswith("/"):
            path = line.split()[0]
            return urljoin(base_url, path)

        return None

    def _parse_doc_page_callback(
        self, response: Response
    ) -> Generator[scrapy.Request | dict[str, Any], None, None]:
        """Callback wrapper for doc page parsing that also follows links."""
        yield from self._parse_doc_page(response)

        # Follow internal links
        for link in response.css("a[href]::attr(href)").getall():
            absolute_url = urljoin(response.url, link)
            if self._is_same_domain(absolute_url, response.url):
                yield scrapy.Request(
                    absolute_url,
                    callback=self._parse_doc_page_callback,
                )

    def _parse_doc_page(
        self, response: Response
    ) -> Generator[dict[str, Any], None, None]:
        """Extract a documentation page as a structured item."""
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
            "_selectors_used": ["main", "article", ".content", "#content"],
        }

        item = self.on_page_crawled(item, response)
        yield item

    def _is_same_domain(self, url1: str, url2: str) -> bool:
        """Check if two URLs share the same domain."""
        from urllib.parse import urlparse

        return urlparse(url1).netloc == urlparse(url2).netloc
