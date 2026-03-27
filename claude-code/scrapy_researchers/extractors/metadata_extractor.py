"""Metadata extractor for HTML pages using meta tags, Open Graph, and JSON-LD."""

from __future__ import annotations

import json
import re
from typing import Any

from bs4 import BeautifulSoup, Tag


class MetadataExtractor:
    """Extracts structured metadata from HTML pages.

    Combines data from:
    - Standard HTML meta tags
    - Open Graph (og:) meta properties
    - Twitter Card meta tags
    - JSON-LD structured data
    - Semantic HTML elements
    """

    def extract(self, html: str, url: str = "") -> dict[str, Any]:
        """Extract metadata from HTML returning a dict with standard fields."""
        soup = BeautifulSoup(html, "lxml")

        metadata: dict[str, Any] = {
            "url": url,
            "title": self._extract_title(soup),
            "description": self._extract_description(soup),
            "author": self._extract_author(soup),
            "date": self._extract_date(soup),
            "tags": self._extract_tags(soup),
            "og_image": self._extract_og_image(soup),
            "canonical_url": self._extract_canonical(soup, url),
        }

        # Merge JSON-LD data
        jsonld = self._extract_jsonld(soup)
        if jsonld:
            metadata["jsonld"] = jsonld
            if not metadata["author"] and jsonld.get("author"):
                author_data = jsonld["author"]
                if isinstance(author_data, dict):
                    metadata["author"] = author_data.get("name", "")
                elif isinstance(author_data, str):
                    metadata["author"] = author_data
            if not metadata["date"]:
                metadata["date"] = jsonld.get("datePublished", "") or jsonld.get(
                    "dateModified", ""
                )
            if not metadata["description"]:
                metadata["description"] = jsonld.get("description", "")

        # Merge Open Graph extras
        og_data = self._extract_open_graph(soup)
        if og_data:
            metadata["open_graph"] = og_data

        return metadata

    def _extract_title(self, soup: BeautifulSoup) -> str:
        """Extract page title from multiple sources."""
        # og:title
        og_title = soup.find("meta", property="og:title")
        if og_title and isinstance(og_title, Tag):
            content = og_title.get("content", "")
            if content:
                return str(content).strip()

        # <title> tag
        title_tag = soup.find("title")
        if title_tag:
            return title_tag.get_text(strip=True)

        # First h1
        h1 = soup.find("h1")
        if h1:
            return h1.get_text(strip=True)

        return ""

    def _extract_description(self, soup: BeautifulSoup) -> str:
        """Extract page description."""
        # meta description
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and isinstance(meta_desc, Tag):
            content = meta_desc.get("content", "")
            if content:
                return str(content).strip()

        # og:description
        og_desc = soup.find("meta", property="og:description")
        if og_desc and isinstance(og_desc, Tag):
            content = og_desc.get("content", "")
            if content:
                return str(content).strip()

        return ""

    def _extract_author(self, soup: BeautifulSoup) -> str:
        """Extract author from meta tags or semantic markup."""
        # meta author
        meta_author = soup.find("meta", attrs={"name": "author"})
        if meta_author and isinstance(meta_author, Tag):
            content = meta_author.get("content", "")
            if content:
                return str(content).strip()

        # article:author
        article_author = soup.find("meta", property="article:author")
        if article_author and isinstance(article_author, Tag):
            content = article_author.get("content", "")
            if content:
                return str(content).strip()

        # Schema.org author
        author_el = soup.find(attrs={"itemprop": "author"})
        if author_el:
            return author_el.get_text(strip=True)

        # Rel author link
        author_link = soup.find("a", rel="author")
        if author_link:
            return author_link.get_text(strip=True)

        return ""

    def _extract_date(self, soup: BeautifulSoup) -> str:
        """Extract publication/modification date."""
        # article:published_time
        pub_time = soup.find("meta", property="article:published_time")
        if pub_time and isinstance(pub_time, Tag):
            content = pub_time.get("content", "")
            if content:
                return str(content).strip()

        # article:modified_time
        mod_time = soup.find("meta", property="article:modified_time")
        if mod_time and isinstance(mod_time, Tag):
            content = mod_time.get("content", "")
            if content:
                return str(content).strip()

        # <time> element
        time_el = soup.find("time")
        if time_el and isinstance(time_el, Tag):
            datetime_attr = time_el.get("datetime")
            if datetime_attr:
                return str(datetime_attr).strip()
            return time_el.get_text(strip=True)

        # meta date
        meta_date = soup.find("meta", attrs={"name": "date"})
        if meta_date and isinstance(meta_date, Tag):
            content = meta_date.get("content", "")
            if content:
                return str(content).strip()

        return ""

    def _extract_tags(self, soup: BeautifulSoup) -> list[str]:
        """Extract keywords/tags."""
        tags: list[str] = []

        # meta keywords
        meta_kw = soup.find("meta", attrs={"name": "keywords"})
        if meta_kw and isinstance(meta_kw, Tag):
            content = meta_kw.get("content", "")
            if content:
                tags.extend(
                    t.strip() for t in str(content).split(",") if t.strip()
                )

        # article:tag
        for tag_meta in soup.find_all("meta", property="article:tag"):
            if isinstance(tag_meta, Tag):
                content = tag_meta.get("content", "")
                if content:
                    tags.append(str(content).strip())

        return list(dict.fromkeys(tags))  # deduplicate preserving order

    def _extract_og_image(self, soup: BeautifulSoup) -> str:
        """Extract Open Graph image URL."""
        og_image = soup.find("meta", property="og:image")
        if og_image and isinstance(og_image, Tag):
            content = og_image.get("content", "")
            if content:
                return str(content).strip()
        return ""

    def _extract_canonical(self, soup: BeautifulSoup, fallback_url: str) -> str:
        """Extract canonical URL."""
        canonical = soup.find("link", rel="canonical")
        if canonical and isinstance(canonical, Tag):
            href = canonical.get("href", "")
            if href:
                return str(href).strip()
        return fallback_url

    def _extract_jsonld(self, soup: BeautifulSoup) -> dict[str, Any]:
        """Extract JSON-LD structured data."""
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string or "")
                if isinstance(data, dict):
                    return data
                if isinstance(data, list) and data:
                    return data[0] if isinstance(data[0], dict) else {}
            except (json.JSONDecodeError, TypeError):
                continue
        return {}

    def _extract_open_graph(self, soup: BeautifulSoup) -> dict[str, str]:
        """Extract all Open Graph properties."""
        og_data: dict[str, str] = {}

        for meta in soup.find_all("meta"):
            if not isinstance(meta, Tag):
                continue
            prop = meta.get("property", "")
            if isinstance(prop, str) and prop.startswith("og:"):
                key = prop[3:]
                content = meta.get("content", "")
                if content:
                    og_data[key] = str(content).strip()

        return og_data
