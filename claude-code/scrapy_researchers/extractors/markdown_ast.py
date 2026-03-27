"""Markdown AST extraction and quality analysis using tree-sitter."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

import tree_sitter as ts
import tree_sitter_markdown as tsmd

logger = logging.getLogger(__name__)


@dataclass
class Heading:
    """A markdown heading."""

    level: int
    text: str
    line: int


@dataclass
class CodeBlock:
    """A fenced code block in markdown."""

    language: str
    content: str
    line_start: int
    line_end: int
    line_count: int


@dataclass
class Link:
    """A markdown link."""

    text: str
    url: str
    line: int
    is_internal: bool


@dataclass
class Section:
    """A heading-bounded section of markdown."""

    heading: str
    level: int
    content: str
    line_start: int
    line_end: int


# Regex for YAML frontmatter
_FRONTMATTER_RE = re.compile(
    r"\A---[ \t]*\r?\n(.*?\r?\n)---[ \t]*\r?\n", re.DOTALL
)


class MarkdownASTExtractor:
    """Extract structure from Markdown documents using tree-sitter."""

    def __init__(self) -> None:
        self._block_lang = ts.Language(tsmd.language())
        self._inline_lang = ts.Language(tsmd.inline_language())
        self._block_parser = ts.Parser(self._block_lang)
        self._inline_parser = ts.Parser(self._inline_lang)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def parse_markdown(self, content: str | bytes) -> ts.Node:
        """Parse markdown and return the block-level root node."""
        if isinstance(content, str):
            content = content.encode("utf-8")
        tree = self._block_parser.parse(content)
        return tree.root_node

    def extract_headings(self, root: ts.Node) -> list[Heading]:
        """Extract all headings from the AST."""
        headings: list[Heading] = []
        self._walk(root, "atx_heading", lambda n: headings.append(self._parse_heading(n)))
        return headings

    def extract_code_blocks(self, root: ts.Node, source: bytes) -> list[CodeBlock]:
        """Extract fenced code blocks with language and content."""
        blocks: list[CodeBlock] = []
        self._walk(
            root,
            "fenced_code_block",
            lambda n: blocks.append(self._parse_code_block(n, source)),
        )
        return blocks

    def extract_links(self, root: ts.Node, source: bytes) -> list[Link]:
        """Extract links by parsing inline content of paragraphs."""
        links: list[Link] = []

        # Collect inline nodes from the block tree
        inline_nodes: list[ts.Node] = []
        self._collect_nodes(root, "inline", inline_nodes)

        for inline_node in inline_nodes:
            inline_text = source[inline_node.start_byte : inline_node.end_byte]
            if b"[" not in inline_text:
                continue

            # Parse with inline grammar
            inline_tree = self._inline_parser.parse(inline_text)
            inline_root = inline_tree.root_node
            line_offset = inline_node.start_point[0]

            self._extract_inline_links(
                inline_root, inline_text, line_offset, links
            )

        return links

    def extract_frontmatter(self, content: str) -> dict | None:
        """Extract and parse YAML frontmatter from markdown content."""
        match = _FRONTMATTER_RE.match(content)
        if match is None:
            return None

        yaml_text = match.group(1)
        try:
            import yaml

            data = yaml.safe_load(yaml_text)
            return data if isinstance(data, dict) else None
        except Exception:
            logger.warning("Failed to parse YAML frontmatter", exc_info=True)
            return None

    def extract_sections(self, root: ts.Node, source: bytes) -> list[Section]:
        """Split content into heading-bounded sections."""
        headings = self.extract_headings(root)
        if not headings:
            text = source.decode("utf-8", errors="replace")
            return [
                Section(
                    heading="",
                    level=0,
                    content=text,
                    line_start=1,
                    line_end=text.count("\n") + 1,
                )
            ]

        lines = source.decode("utf-8", errors="replace").split("\n")
        sections: list[Section] = []

        for i, h in enumerate(headings):
            start_line = h.line  # 1-based
            if i + 1 < len(headings):
                end_line = headings[i + 1].line - 1
            else:
                end_line = len(lines)

            # Content: lines after the heading up to (but not including) the next heading
            # h.line is 1-based, so index h.line-1 is the heading line itself
            content_start_idx = start_line  # line after heading (0-based index = start_line)
            content_end_idx = end_line  # exclusive upper bound (0-based)
            content_lines = lines[content_start_idx:content_end_idx]
            content = "\n".join(content_lines).strip()

            sections.append(
                Section(
                    heading=h.text,
                    level=h.level,
                    content=content,
                    line_start=start_line,
                    line_end=end_line,
                )
            )

        return sections

    def compute_quality(self, content: str) -> float:
        """Score markdown quality from 0.0 to 1.0 based on AST metrics."""
        source = content.encode("utf-8")
        root = self.parse_markdown(source)

        scores: list[float] = []

        # 1. Heading hierarchy validity
        headings = self.extract_headings(root)
        scores.append(self._heading_hierarchy_score(headings))

        # 2. Code blocks tagged with language
        code_blocks = self.extract_code_blocks(root, source)
        scores.append(self._code_blocks_tagged_score(code_blocks))

        # 3. Link density (moderate is good)
        links = self.extract_links(root, source)
        scores.append(self._link_density_score(content, links))

        # 4. Section balance
        sections = self.extract_sections(root, source)
        scores.append(self._section_balance_score(sections))

        # 5. Overall structure bonus: has headings, paragraphs, etc.
        scores.append(self._structure_bonus(headings, code_blocks, len(content)))

        return max(0.0, min(1.0, sum(scores) / len(scores)))

    # ------------------------------------------------------------------
    # Internal: heading parsing
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_heading(node: ts.Node) -> Heading:
        """Parse an atx_heading node into a Heading."""
        level = 0
        text = ""
        for child in node.children:
            if child.type.startswith("atx_h") and child.type.endswith("_marker"):
                # Count '#' characters for the level
                marker = child.text.decode("utf-8", errors="replace") if child.text else ""
                level = marker.count("#")
            elif child.type == "inline":
                text = (
                    child.text.decode("utf-8", errors="replace")
                    if child.text
                    else ""
                )
        return Heading(level=level, text=text.strip(), line=node.start_point[0] + 1)

    # ------------------------------------------------------------------
    # Internal: code block parsing
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_code_block(node: ts.Node, source: bytes) -> CodeBlock:
        """Parse a fenced_code_block node into a CodeBlock."""
        language = ""
        content = ""

        for child in node.children:
            if child.type == "info_string":
                # The language child inside info_string
                for sub in child.children:
                    if sub.type == "language":
                        language = source[sub.start_byte : sub.end_byte].decode(
                            "utf-8", errors="replace"
                        )
                        break
                if not language:
                    language = source[child.start_byte : child.end_byte].decode(
                        "utf-8", errors="replace"
                    ).strip()
            elif child.type == "code_fence_content":
                content = source[child.start_byte : child.end_byte].decode(
                    "utf-8", errors="replace"
                )

        line_start = node.start_point[0] + 1
        line_end = node.end_point[0] + 1
        line_count = content.count("\n") + (1 if content and not content.endswith("\n") else 0)
        if content.endswith("\n"):
            line_count = content.count("\n")
        if line_count == 0 and content:
            line_count = 1

        return CodeBlock(
            language=language.strip(),
            content=content,
            line_start=line_start,
            line_end=line_end,
            line_count=line_count,
        )

    # ------------------------------------------------------------------
    # Internal: inline link extraction
    # ------------------------------------------------------------------

    def _extract_inline_links(
        self,
        node: ts.Node,
        source: bytes,
        line_offset: int,
        out: list[Link],
    ) -> None:
        """Recursively extract links from inline-parsed nodes."""
        if node.type == "inline_link":
            text = ""
            url = ""
            for child in node.children:
                if child.type == "link_text":
                    text = source[child.start_byte : child.end_byte].decode(
                        "utf-8", errors="replace"
                    )
                elif child.type == "link_destination":
                    url = source[child.start_byte : child.end_byte].decode(
                        "utf-8", errors="replace"
                    )
            is_internal = not url.startswith(("http://", "https://", "//"))
            out.append(
                Link(
                    text=text,
                    url=url,
                    line=line_offset + node.start_point[0] + 1,
                    is_internal=is_internal,
                )
            )
            return  # Don't recurse into children of the link

        if node.type == "shortcut_link":
            text = source[node.start_byte : node.end_byte].decode(
                "utf-8", errors="replace"
            ).strip("[]")
            out.append(
                Link(
                    text=text,
                    url=text,
                    line=line_offset + node.start_point[0] + 1,
                    is_internal=True,
                )
            )
            return

        for child in node.children:
            self._extract_inline_links(child, source, line_offset, out)

    # ------------------------------------------------------------------
    # Internal: tree walking
    # ------------------------------------------------------------------

    @staticmethod
    def _walk(node: ts.Node, target_type: str, callback) -> None:
        """Walk AST in document order and invoke callback on every node of target_type."""
        from collections import deque

        queue: deque[ts.Node] = deque([node])
        while queue:
            n = queue.popleft()
            if n.type == target_type:
                callback(n)
            for child in n.children:
                queue.append(child)

    @staticmethod
    def _collect_nodes(node: ts.Node, target_type: str, out: list[ts.Node]) -> None:
        """Collect all nodes of a given type in document order."""
        from collections import deque

        queue: deque[ts.Node] = deque([node])
        while queue:
            n = queue.popleft()
            if n.type == target_type:
                out.append(n)
            for child in n.children:
                queue.append(child)

    # ------------------------------------------------------------------
    # Quality scoring helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _heading_hierarchy_score(headings: list[Heading]) -> float:
        """Score heading hierarchy: proper nesting h1 -> h2 -> h3."""
        if not headings:
            return 0.3  # No headings is not great

        violations = 0
        for i in range(1, len(headings)):
            curr = headings[i].level
            prev = headings[i - 1].level
            # A jump of more than 1 level (e.g., h1 -> h3) is a violation
            if curr > prev + 1:
                violations += 1

        if len(headings) == 1:
            return 1.0

        return max(0.0, 1.0 - violations / (len(headings) - 1))

    @staticmethod
    def _code_blocks_tagged_score(blocks: list[CodeBlock]) -> float:
        """Percentage of code blocks with a language tag."""
        if not blocks:
            return 0.8  # No code blocks is neutral-positive
        tagged = sum(1 for b in blocks if b.language)
        return tagged / len(blocks)

    @staticmethod
    def _link_density_score(content: str, links: list[Link]) -> float:
        """Score link density: some links are good, too many or none is bad."""
        words = len(content.split())
        if words == 0:
            return 0.0
        density = len(links) / max(words / 100, 1)
        # Ideal: 1-5 links per 100 words
        if 0.5 <= density <= 5:
            return 1.0
        if density == 0:
            return 0.5
        if density > 5:
            return max(0.3, 1.0 - (density - 5) / 20)
        return max(0.3, density / 0.5)

    @staticmethod
    def _section_balance_score(sections: list[Section]) -> float:
        """Score how balanced sections are in length."""
        if len(sections) <= 1:
            return 0.7
        lengths = [len(s.content) for s in sections]
        avg = sum(lengths) / len(lengths)
        if avg == 0:
            return 0.5
        variance = sum((l - avg) ** 2 for l in lengths) / len(lengths)
        cv = (variance**0.5) / avg  # coefficient of variation
        # Lower CV = more balanced
        return max(0.2, min(1.0, 1.0 - cv / 3))

    @staticmethod
    def _structure_bonus(
        headings: list[Heading], code_blocks: list[CodeBlock], content_len: int
    ) -> float:
        """Bonus for having good overall structure."""
        score = 0.0
        if headings:
            score += 0.4
        if len(headings) >= 2:
            score += 0.2
        if code_blocks:
            score += 0.2
        if content_len > 100:
            score += 0.2
        return min(1.0, score)
