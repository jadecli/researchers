"""Spider for crawling platform.claude.com documentation.

Anti-blocking strategy for iterative crawling:
- Bloom filter dedup prevents re-requesting known URLs across runs
  (BloomProfile: 5K capacity, 0.05% FP rate — strict to catch page updates)
- Exponential backoff on 429/503 with prioritized fresh requests
- llms.txt as entry point (designed for bot consumption, not blocked)
- Conditional requests via HTTP cache (304 Not Modified = no bandwidth)
- URL shuffling + jitter to avoid sequential crawling patterns
"""

from __future__ import annotations

import random
from datetime import datetime
from typing import Any, Generator
from urllib.parse import urljoin, urlparse

import scrapy
from scrapy.http import Response

from scrapy_researchers.spiders.base_spider import BaseResearchSpider


class PlatformSpider(BaseResearchSpider):
    """Crawls platform.claude.com starting from its llms.txt.

    Extracts API documentation, SDK guides, and platform feature pages.
    Bloom profile auto-applied: conservative politeness, strict FP rate,
    per-spider persist path for cross-run dedup.
    """

    name = "platform_spider"
    allowed_domains = ["platform.claude.com"]
    start_urls = ["https://platform.claude.com/llms.txt"]

    custom_settings = {
        "DEPTH_LIMIT": 4,
        "RETRY_HTTP_CODES": [429, 500, 502, 503, 504, 522, 524, 408],
    }

    # Priority tiers: lower number = higher priority in scheduler
    PRIORITY_INDEX = 10      # llms.txt index page
    PRIORITY_FRESH = 5       # URLs from llms.txt (never-seen)
    PRIORITY_INTERNAL = 0    # followed internal links (lower priority)

    def parse(self, response: Response) -> Generator[scrapy.Request | dict[str, Any], None, None]:
        """Parse llms.txt or documentation page."""
        if response.url.endswith("llms.txt"):
            yield from self._parse_index(response)
        else:
            yield from self._parse_platform_page(response)

    def _parse_index(self, response: Response) -> Generator[scrapy.Request, None, None]:
        """Parse the platform llms.txt index for doc URLs.

        llms.txt is specifically designed for LLM/bot consumption —
        it's the safest entry point that won't trigger anti-bot measures.
        """
        urls = []
        for line in response.text.split("\n"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            url = self._extract_url(line, response.url)
            if url:
                urls.append(url)

        # Shuffle to avoid sequential crawling patterns that trigger rate limits
        random.shuffle(urls)

        for url in urls:
            yield scrapy.Request(
                url,
                callback=self._parse_platform_page_callback,
                priority=self.PRIORITY_FRESH,
                meta={"crawl_source": "llms_txt"},
            )

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

        # Follow internal links at lower priority — bloom filter will
        # efficiently skip URLs already seen in this or previous runs
        seen_on_page: set[str] = set()
        for href in response.css("a[href]::attr(href)").getall():
            absolute = urljoin(response.url, href)
            if urlparse(absolute).netloc not in self.allowed_domains:
                continue
            # Strip fragments to reduce duplicate requests
            absolute = absolute.split("#")[0]
            if absolute and absolute not in seen_on_page:
                seen_on_page.add(absolute)
                yield scrapy.Request(
                    absolute,
                    callback=self._parse_platform_page_callback,
                    priority=self.PRIORITY_INTERNAL,
                    meta={"crawl_source": "internal_link"},
                )

    def _parse_platform_page(
        self, response: Response
    ) -> Generator[dict[str, Any], None, None]:
        """Extract platform documentation page content."""
        html = response.text
        content_md = self.markdown_extractor.html_to_markdown(html, response.url)
        metadata = self.metadata_extractor.extract(html, response.url)

        page_type = self._classify_page(response.url, content_md)
        metadata["page_type"] = page_type
        metadata["crawl_source"] = response.meta.get("crawl_source", "unknown")

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
