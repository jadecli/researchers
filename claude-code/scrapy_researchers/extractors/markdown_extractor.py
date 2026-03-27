"""HTML to Markdown extractor with structure preservation."""

from __future__ import annotations

import re
from typing import Any

from bs4 import BeautifulSoup, Comment, NavigableString, Tag
from markdownify import MarkdownConverter, markdownify


class ResearchMarkdownConverter(MarkdownConverter):
    """Custom MarkdownConverter with improved handling for code blocks, tables, and links."""

    def convert_pre(self, el: Tag, text: str, convert_as_inline: bool = False) -> str:
        """Convert <pre> blocks preserving language hints."""
        code_el = el.find("code")
        language = ""

        if code_el and isinstance(code_el, Tag):
            classes = code_el.get("class", [])
            if isinstance(classes, list):
                for cls in classes:
                    if cls.startswith("language-"):
                        language = cls[9:]
                        break
                    if cls.startswith("lang-"):
                        language = cls[5:]
                        break
                    if cls.startswith("highlight-"):
                        language = cls[10:]
                        break

            if not language:
                data_lang = code_el.get("data-lang") or code_el.get("data-language")
                if data_lang:
                    language = str(data_lang)

        code_text = el.get_text()
        if code_text and not code_text.endswith("\n"):
            code_text += "\n"

        return f"\n\n```{language}\n{code_text}```\n\n"

    def convert_table(self, el: Tag, text: str, convert_as_inline: bool = False) -> str:
        """Convert HTML tables to markdown tables."""
        rows: list[list[str]] = []

        for tr in el.find_all("tr"):
            cells: list[str] = []
            for td in tr.find_all(["td", "th"]):
                cell_text = td.get_text(strip=True).replace("|", "\\|")
                cells.append(cell_text)
            if cells:
                rows.append(cells)

        if not rows:
            return text

        max_cols = max(len(row) for row in rows)
        for row in rows:
            while len(row) < max_cols:
                row.append("")

        lines: list[str] = []
        lines.append("| " + " | ".join(rows[0]) + " |")
        lines.append("| " + " | ".join("---" for _ in rows[0]) + " |")

        for row in rows[1:]:
            lines.append("| " + " | ".join(row) + " |")

        return "\n\n" + "\n".join(lines) + "\n\n"


class MarkdownExtractor:
    """Extracts and converts HTML to clean markdown with structure preservation."""

    STRIP_TAGS = ["script", "style", "noscript", "iframe", "svg"]
    NAV_TAGS = ["nav", "header", "footer"]
    NAV_CLASSES = [
        "navigation", "nav-", "sidebar", "menu", "breadcrumb",
        "header", "footer", "cookie", "banner", "popup",
    ]
    NAV_IDS = ["nav", "header", "footer", "sidebar", "menu", "breadcrumb"]

    def html_to_markdown(self, html: str, url: str = "") -> str:
        """Convert HTML to markdown with custom options for code, tables, links."""
        soup = BeautifulSoup(html, "lxml")

        self._remove_unwanted(soup)
        soup = self.clean_navigation(soup)
        main_content = self._find_main_content(soup)

        html_str = str(main_content)

        markdown = ResearchMarkdownConverter(
            heading_style="atx",
            bullets="-",
            strong_em_symbol="*",
            strip=self.STRIP_TAGS,
        ).convert(html_str)

        markdown = self._clean_markdown(markdown)
        return markdown

    def preserve_structure(self, html: str) -> str:
        """Maintain heading hierarchy in the HTML before conversion."""
        soup = BeautifulSoup(html, "lxml")

        headings = soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])
        if not headings:
            return html

        # Ensure heading levels are sequential (no jumps like h1 -> h4)
        prev_level = 0
        for heading in headings:
            current_level = int(heading.name[1])
            if current_level > prev_level + 1 and prev_level > 0:
                new_level = min(prev_level + 1, 6)
                heading.name = f"h{new_level}"
            prev_level = int(heading.name[1])

        return str(soup)

    def clean_navigation(self, soup: BeautifulSoup) -> BeautifulSoup:
        """Remove nav, header, footer, and other navigation elements."""
        # Remove nav-related tags
        for tag_name in self.NAV_TAGS:
            for el in soup.find_all(tag_name):
                el.decompose()

        # Remove elements with nav-related classes
        for el in soup.find_all(True):
            if not isinstance(el, Tag):
                continue
            classes = el.get("class", [])
            if isinstance(classes, list):
                class_str = " ".join(classes).lower()
            else:
                class_str = str(classes).lower()

            el_id = str(el.get("id", "")).lower()

            if any(nav_cls in class_str for nav_cls in self.NAV_CLASSES):
                el.decompose()
                continue
            if any(nav_id in el_id for nav_id in self.NAV_IDS):
                el.decompose()

        return soup

    def _remove_unwanted(self, soup: BeautifulSoup) -> None:
        """Remove script, style, and other non-content elements."""
        for tag_name in self.STRIP_TAGS:
            for el in soup.find_all(tag_name):
                el.decompose()

        for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
            comment.extract()

    def _find_main_content(self, soup: BeautifulSoup) -> Tag | BeautifulSoup:
        """Find the main content area of the page."""
        # Try standard content selectors in priority order
        selectors = [
            "main",
            "article",
            '[role="main"]',
            "#content",
            "#main-content",
            ".content",
            ".main-content",
            ".post-content",
            ".article-content",
            ".markdown-body",
            ".docs-content",
        ]

        for selector in selectors:
            result = soup.select_one(selector)
            if result and len(result.get_text(strip=True)) > 100:
                return result

        body = soup.find("body")
        if body and isinstance(body, Tag):
            return body

        return soup

    def _clean_markdown(self, markdown: str) -> str:
        """Clean up markdown output."""
        # Remove excessive blank lines
        markdown = re.sub(r"\n{4,}", "\n\n\n", markdown)
        # Remove trailing whitespace from lines
        markdown = "\n".join(line.rstrip() for line in markdown.split("\n"))
        # Remove leading/trailing whitespace
        markdown = markdown.strip()
        return markdown
