"""Spider for parsing llms-full.txt files into per-page items.

These files are 2-25MB — too large for context windows. This spider:
1. Downloads the file to disk (streaming, never into memory fully)
2. Splits on page boundaries (Source: or # markers)
3. Yields individual page items with quality scoring
4. Processes in chunks to avoid memory pressure

Safe for: platform.claude.com/llms-full.txt (25MB, 534 pages)
Safe for: code.claude.com/docs/llms-full.txt (1.8MB, 71 pages)
"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from typing import Any, Generator

import scrapy
from scrapy.http import Response, TextResponse

from scrapy_researchers.spiders.base_spider import BaseResearchSpider


class LlmsFullSpider(BaseResearchSpider):
    """Parses llms-full.txt files by splitting on page boundaries."""

    name = "llms_full_spider"

    custom_settings = {
        "DOWNLOAD_MAXSIZE": 50_000_000,  # 50MB — these files are big
        "DOWNLOAD_TIMEOUT": 120,
        "DEPTH_LIMIT": 0,  # No following links — single file parse
    }

    def __init__(
        self,
        url: str = "",
        source: str = "code",  # "code", "platform", "neon", "vercel"
        max_pages: int = 0,  # 0 = all pages
        *args: Any,
        **kwargs: Any,
    ) -> None:
        super().__init__(*args, **kwargs)
        SOURCE_URLS = {
            "code": "https://code.claude.com/docs/llms-full.txt",
            "platform": "https://platform.claude.com/llms-full.txt",
            "neon": "https://neon.com/llms-full.txt",
            "vercel": "https://vercel.com/docs/llms-full.txt",
        }
        if url:
            self.start_urls = [url]
        else:
            self.start_urls = [SOURCE_URLS.get(source, SOURCE_URLS["code"])]
        self.max_pages = int(max_pages)
        self.source = source

    def parse(self, response: Response) -> Generator[dict[str, Any], None, None]:
        """Split the full text file into individual page items."""
        if not isinstance(response, TextResponse):
            self.logger.error("Response is not text — cannot parse")
            return

        text = response.text
        self.logger.info(
            f"Parsing llms-full.txt: {len(text):,} chars, "
            f"source={self.source}"
        )

        # Detect format and split accordingly
        if self.source == "neon":
            yield from self._split_neon_format(text)
        elif self.source == "vercel":
            yield from self._split_vercel_format(text)
        elif self.source == "code":
            yield from self._split_code_format(text)
        else:
            yield from self._split_platform_format(text)

    def _split_code_format(self, text: str) -> Generator[dict[str, Any], None, None]:
        """Split code.claude.com format: pages start with '# Title\nSource: URL'."""
        # Split on "# " at start of line (page boundaries)
        pages = re.split(r'\n(?=# [^\n]+\nSource: https://)', text)
        count = 0

        for page_text in pages:
            page_text = page_text.strip()
            if not page_text or len(page_text) < 50:
                continue

            # Extract source URL
            source_match = re.search(r'^Source: (https://[^\n]+)', page_text, re.MULTILINE)
            if not source_match:
                continue

            url = source_match.group(1)

            # Extract title (first # heading)
            title_match = re.match(r'^# (.+)', page_text)
            title = title_match.group(1) if title_match else ""

            # Remove the Source: line from content
            content = re.sub(r'^Source: https://[^\n]+\n?', '', page_text, count=1, flags=re.MULTILINE)

            count += 1
            if self.max_pages and count > self.max_pages:
                self.logger.info(f"Reached max_pages={self.max_pages}, stopping")
                return

            yield self._build_item(url, title, content)

    def _split_platform_format(self, text: str) -> Generator[dict[str, Any], None, None]:
        """Split platform.claude.com format: sections with # headings."""
        # Platform format uses --- separators between major sections
        # and # headings for page titles
        sections = re.split(r'\n---\n', text)
        count = 0

        for section in sections:
            section = section.strip()
            if not section or len(section) < 100:
                continue

            # Skip the header/metadata section
            if section.startswith("# Anthropic Developer Documentation"):
                continue
            if "Available Languages" in section[:200]:
                continue

            # Extract title from first heading
            title_match = re.match(r'^#+ (.+)', section)
            title = title_match.group(1) if title_match else "Untitled"

            # Try to find a URL reference
            url_match = re.search(r'https://platform\.claude\.com/docs/[^\s)]+', section)
            url = url_match.group(0) if url_match else f"https://platform.claude.com/docs/en/{self._slugify(title)}"

            count += 1
            if self.max_pages and count > self.max_pages:
                self.logger.info(f"Reached max_pages={self.max_pages}, stopping")
                return

            yield self._build_item(url, title, section)

    def _split_neon_format(self, text: str) -> Generator[dict[str, Any], None, None]:
        """Split neon.com format: pages start with '--- DOCUMENT SOURCE: <url> ---'."""
        pages = re.split(r'\n--- DOCUMENT SOURCE: ', text)
        count = 0

        for page_text in pages:
            page_text = page_text.strip()
            if not page_text or len(page_text) < 50:
                continue

            # Extract URL from first line: "https://neon.com/docs/... ---"
            url_match = re.match(r'(https://[^\s]+)\s*---', page_text)
            if not url_match:
                continue

            url = url_match.group(1)

            # Content is everything after the URL --- line
            content = re.sub(r'^https://[^\n]+---\n?', '', page_text, count=1).strip()

            # Extract title
            title_match = re.match(r'^# (.+)', content)
            title = title_match.group(1) if title_match else ""

            count += 1
            if self.max_pages and count > self.max_pages:
                self.logger.info(f"Reached max_pages={self.max_pages}, stopping")
                return

            yield self._build_item(url, title, content)

    def _split_vercel_format(self, text: str) -> Generator[dict[str, Any], None, None]:
        """Split vercel.com format: pages separated by '---...---' blocks with metadata."""
        # Vercel uses blocks like:
        # ----------------
        # title: "..."
        # source: "https://..."
        # ----------------
        pages = re.split(r'\n-{10,}\n', text)
        count = 0
        pending_meta: dict[str, str] = {}

        for chunk in pages:
            chunk = chunk.strip()
            if not chunk:
                continue

            # Check if this is a metadata block (title:, source:, etc.)
            if chunk.startswith('title:') or chunk.startswith('description:'):
                pending_meta = {}
                for line in chunk.split('\n'):
                    line = line.strip()
                    if ':' in line:
                        key, _, val = line.partition(':')
                        pending_meta[key.strip()] = val.strip().strip('"')
                continue

            # This is a content block — pair with pending metadata
            url = pending_meta.get('source', '')
            title = pending_meta.get('title', '')

            if not url and not title:
                # Try to extract from content
                title_match = re.match(r'^# (.+)', chunk)
                title = title_match.group(1) if title_match else ""
                url = f"https://vercel.com/docs/{self._slugify(title)}"

            if len(chunk) < 50:
                continue

            count += 1
            if self.max_pages and count > self.max_pages:
                self.logger.info(f"Reached max_pages={self.max_pages}, stopping")
                return

            yield self._build_item(url, title, chunk)
            pending_meta = {}

    def _build_item(self, url: str, title: str, content: str) -> dict[str, Any]:
        """Build a standardized item from parsed page content."""
        # Quality scoring
        quality = self._score_quality(content)

        # Content hash for change detection
        content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]

        return {
            "url": url,
            "title": title,
            "content_markdown": content,
            "content_html": "",  # Already markdown
            "quality_score": quality,
            "metadata": {
                "source": f"llms-full-{self.source}",
                "content_hash": content_hash,
                "word_count": len(content.split()),
                "heading_count": content.count("\n#"),
                "code_block_count": content.count("```"),
                "link_count": content.count("]("),
            },
            "extraction_timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def _score_quality(self, content: str) -> float:
        """Score content quality 0.0-1.0."""
        if not content:
            return 0.0

        words = len(content.split())
        headings = content.count("\n#")
        code_blocks = content.count("```") // 2
        links = content.count("](")

        # Length score
        if words >= 1000:
            length_score = 1.0
        elif words >= 500:
            length_score = 0.9
        elif words >= 100:
            length_score = 0.7
        elif words >= 50:
            length_score = 0.5
        else:
            length_score = 0.3

        # Structure score
        has_headings = headings >= 2
        has_code = code_blocks >= 1
        has_links = links >= 1
        structure_score = sum([has_headings, has_code, has_links]) / 3.0

        return round(length_score * 0.6 + structure_score * 0.4, 2)

    @staticmethod
    def _slugify(title: str) -> str:
        """Convert title to URL slug."""
        slug = re.sub(r'[^a-zA-Z0-9\s-]', '', title.lower())
        slug = re.sub(r'[\s]+', '-', slug)
        return slug[:60]
