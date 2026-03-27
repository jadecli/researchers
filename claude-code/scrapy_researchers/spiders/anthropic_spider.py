"""Spider for crawling anthropic.com via sitemap."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Generator
from urllib.parse import urljoin

import scrapy
from scrapy.http import Response

from scrapy_researchers.spiders.base_spider import BaseResearchSpider


class AnthropicSpider(BaseResearchSpider):
    """Crawls anthropic.com by parsing sitemap.xml.

    Follows all URLs from the sitemap and classifies pages as
    research, news, or engineering content.
    """

    name = "anthropic_spider"
    allowed_domains = ["anthropic.com", "www.anthropic.com"]
    start_urls = ["https://www.anthropic.com/sitemap.xml"]

    custom_settings = {
        "DEPTH_LIMIT": 3,
    }

    def parse(self, response: Response) -> Generator[scrapy.Request | dict[str, Any], None, None]:
        """Parse sitemap.xml or an individual page."""
        content_type = response.headers.get("Content-Type", b"").decode("utf-8", errors="ignore")

        if "xml" in content_type or response.url.endswith(".xml"):
            yield from self._parse_sitemap(response)
        else:
            yield from self._parse_page(response)

    def _parse_sitemap(self, response: Response) -> Generator[scrapy.Request, None, None]:
        """Parse XML sitemap and follow all URLs."""
        # Handle sitemap index files
        sitemap_refs = response.xpath(
            "//sitemap:loc/text()",
            namespaces={"sitemap": "http://www.sitemaps.org/schemas/sitemap/0.9"},
        ).getall()

        if not sitemap_refs:
            sitemap_refs = response.xpath("//loc/text()").getall()

        urls_found = 0
        for loc in sitemap_refs:
            loc = loc.strip()
            if not loc:
                continue

            if loc.endswith(".xml"):
                yield scrapy.Request(loc, callback=self._parse_sitemap_callback)
            else:
                urls_found += 1
                yield scrapy.Request(loc, callback=self._parse_page_callback)

        self.logger.info(f"Found {urls_found} page URLs in sitemap {response.url}")

    def _parse_sitemap_callback(
        self, response: Response
    ) -> Generator[scrapy.Request, None, None]:
        """Handle nested sitemaps."""
        yield from self._parse_sitemap(response)

    def _parse_page_callback(
        self, response: Response
    ) -> Generator[dict[str, Any], None, None]:
        """Callback wrapper for page parsing."""
        yield from self._parse_page(response)

    def _parse_page(self, response: Response) -> Generator[dict[str, Any], None, None]:
        """Extract and classify an Anthropic page."""
        html = response.text
        content_md = self.markdown_extractor.html_to_markdown(html, response.url)
        metadata = self.metadata_extractor.extract(html, response.url)

        page_category = self._classify_page(response.url, content_md, metadata)
        metadata["category"] = page_category

        if page_category == "research":
            item = self._build_research_item(response, content_md, metadata)
        elif page_category == "news":
            item = self._build_news_item(response, content_md, metadata)
        else:
            item = self._build_doc_item(response, content_md, metadata)

        item = self.on_page_crawled(item, response)
        yield item

    def _classify_page(
        self, url: str, content: str, metadata: dict[str, Any]
    ) -> str:
        """Classify a page as research, news, or engineering."""
        url_lower = url.lower()

        if "/research" in url_lower or "/papers" in url_lower:
            return "research"
        if "/news" in url_lower or "/blog" in url_lower or "/press" in url_lower:
            return "news"
        if "/engineering" in url_lower or "/careers" in url_lower:
            return "engineering"

        content_lower = content[:2000].lower()
        if any(kw in content_lower for kw in ["abstract", "arxiv", "paper", "authors"]):
            return "research"
        if any(kw in content_lower for kw in ["published", "posted", "announcement"]):
            return "news"

        return "general"

    def _build_research_item(
        self, response: Response, content_md: str, metadata: dict[str, Any]
    ) -> dict[str, Any]:
        """Build a research paper item."""
        authors = self._extract_authors(response, content_md)
        abstract = self._extract_abstract(content_md)

        return {
            "url": response.url,
            "title": metadata.get("title", ""),
            "content_markdown": content_md,
            "content_html": response.text,
            "metadata": metadata,
            "extraction_timestamp": datetime.utcnow().isoformat(),
            "authors": authors,
            "abstract": abstract,
            "publication_date": metadata.get("date", ""),
        }

    def _build_news_item(
        self, response: Response, content_md: str, metadata: dict[str, Any]
    ) -> dict[str, Any]:
        """Build a news article item."""
        return {
            "url": response.url,
            "title": metadata.get("title", ""),
            "content_markdown": content_md,
            "content_html": response.text,
            "metadata": metadata,
            "extraction_timestamp": datetime.utcnow().isoformat(),
            "publish_date": metadata.get("date", ""),
            "author": metadata.get("author", ""),
            "category": "news",
        }

    def _build_doc_item(
        self, response: Response, content_md: str, metadata: dict[str, Any]
    ) -> dict[str, Any]:
        """Build a generic documentation item."""
        return {
            "url": response.url,
            "title": metadata.get("title", ""),
            "content_markdown": content_md,
            "content_html": response.text,
            "metadata": metadata,
            "extraction_timestamp": datetime.utcnow().isoformat(),
        }

    def _extract_authors(self, response: Response, content: str) -> list[str]:
        """Extract author names from page content."""
        authors: list[str] = []

        # Try meta tags
        for selector in [
            'meta[name="author"]::attr(content)',
            'meta[name="citation_author"]::attr(content)',
            ".author::text",
            ".authors::text",
            '[rel="author"]::text',
        ]:
            found = response.css(selector).getall()
            if found:
                authors.extend(a.strip() for a in found if a.strip())

        # Try content patterns
        if not authors:
            author_pattern = re.compile(
                r"(?:Authors?|By)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+(?:,\s*[A-Z][a-z]+ [A-Z][a-z]+)*)",
                re.IGNORECASE,
            )
            match = author_pattern.search(content[:3000])
            if match:
                raw = match.group(1)
                authors = [a.strip() for a in raw.split(",") if a.strip()]

        return authors

    def _extract_abstract(self, content: str) -> str:
        """Extract the abstract section from content."""
        lines = content.split("\n")
        in_abstract = False
        abstract_lines: list[str] = []

        for line in lines:
            stripped = line.strip().lower()
            if stripped in ("## abstract", "# abstract", "**abstract**", "abstract"):
                in_abstract = True
                continue
            if in_abstract:
                if line.strip().startswith("#") or (
                    not line.strip() and abstract_lines and not abstract_lines[-1].strip()
                ):
                    break
                abstract_lines.append(line)

        return "\n".join(abstract_lines).strip()
