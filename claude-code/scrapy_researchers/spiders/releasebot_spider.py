"""Spider for crawling releasebot.io via sitemap-products.xml."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Generator

import scrapy
from scrapy.http import Response

from scrapy_researchers.spiders.base_spider import BaseResearchSpider


class ReleasebotSpider(BaseResearchSpider):
    """Crawls releasebot.io product pages from sitemap-products.xml.

    Parses the XML sitemap, follows product URLs, and extracts
    structured product data with markdown content.
    """

    name = "releasebot_spider"
    allowed_domains = ["releasebot.io", "www.releasebot.io", "127.0.0.1", "localhost"]
    start_urls = ["https://releasebot.io/sitemap-products.xml"]

    custom_settings = {
        "DEPTH_LIMIT": 3,
        "DOWNLOAD_DELAY": 2.0,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 1,
    }

    def __init__(self, *args: Any, start_url: str | None = None, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        if start_url:
            self.start_urls = [start_url]

    def parse(self, response: Response) -> Generator[scrapy.Request | dict[str, Any], None, None]:
        """Parse sitemap XML or product page."""
        content_type = response.headers.get("Content-Type", b"").decode("utf-8", errors="ignore")

        if "xml" in content_type or response.url.endswith(".xml"):
            yield from self._parse_sitemap(response)
        else:
            yield from self._parse_product_page(response)

    def _parse_sitemap(self, response: Response) -> Generator[scrapy.Request, None, None]:
        """Parse sitemap-products.xml and follow all product URLs."""
        # Try with namespace first, then without
        locs = response.xpath(
            "//sitemap:loc/text()",
            namespaces={"sitemap": "http://www.sitemaps.org/schemas/sitemap/0.9"},
        ).getall()

        if not locs:
            locs = response.xpath("//loc/text()").getall()

        urls_found = 0
        for loc in locs:
            loc = loc.strip()
            if not loc:
                continue

            if loc.endswith(".xml"):
                yield scrapy.Request(loc, callback=self._parse_sitemap)
            else:
                urls_found += 1
                yield scrapy.Request(loc, callback=self._parse_product_page)

        self.logger.info(f"Found {urls_found} product URLs in sitemap {response.url}")

    def _parse_product_page(self, response: Response) -> Generator[dict[str, Any], None, None]:
        """Extract structured product data from a releasebot.io page."""
        html = response.text
        content_md = self.markdown_extractor.html_to_markdown(html, response.url)
        metadata = self.metadata_extractor.extract(html, response.url)

        # Extract product-specific fields
        title = (
            response.css("h1::text").get("")
            or metadata.get("title", "")
        ).strip()

        description = (
            response.css('meta[name="description"]::attr(content)').get("")
            or response.css('meta[property="og:description"]::attr(content)').get("")
        ).strip()

        # Collect any pricing or feature data
        features = response.css(".feature::text, .features li::text, [class*=feature] li::text").getall()
        pricing = response.css(".pricing::text, .price::text, [class*=price]::text").getall()

        item = {
            "url": response.url,
            "title": title,
            "description": description,
            "content_markdown": content_md,
            "content_html": html,
            "metadata": metadata,
            "features": [f.strip() for f in features if f.strip()],
            "pricing": [p.strip() for p in pricing if p.strip()],
            "extraction_timestamp": datetime.utcnow().isoformat(),
            "source": "releasebot.io",
            "page_type": "product",
        }

        item = self.on_page_crawled(item, response)
        yield item
