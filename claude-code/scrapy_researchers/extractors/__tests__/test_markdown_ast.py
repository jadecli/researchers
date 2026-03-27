"""Tests for the Markdown AST extractor module."""

import pytest

from scrapy_researchers.extractors.markdown_ast import (
    CodeBlock,
    Heading,
    Link,
    MarkdownASTExtractor,
    Section,
)


@pytest.fixture
def extractor() -> MarkdownASTExtractor:
    return MarkdownASTExtractor()


# ------------------------------------------------------------------
# extract_headings
# ------------------------------------------------------------------


class TestExtractHeadings:
    def test_two_headings(self, extractor: MarkdownASTExtractor) -> None:
        source = b"# Title\n\n## Section\n"
        root = extractor.parse_markdown(source)
        headings = extractor.extract_headings(root)

        assert len(headings) == 2
        assert headings[0].level == 1
        assert headings[0].text == "Title"
        assert headings[1].level == 2
        assert headings[1].text == "Section"

    def test_heading_levels(self, extractor: MarkdownASTExtractor) -> None:
        source = b"# H1\n## H2\n### H3\n#### H4\n"
        root = extractor.parse_markdown(source)
        headings = extractor.extract_headings(root)

        assert len(headings) == 4
        assert [h.level for h in headings] == [1, 2, 3, 4]

    def test_heading_line_numbers(self, extractor: MarkdownASTExtractor) -> None:
        source = b"# First\n\nSome text\n\n## Second\n"
        root = extractor.parse_markdown(source)
        headings = extractor.extract_headings(root)

        assert len(headings) == 2
        assert headings[0].line == 1
        assert headings[1].line == 5

    def test_no_headings(self, extractor: MarkdownASTExtractor) -> None:
        source = b"Just some plain text.\n"
        root = extractor.parse_markdown(source)
        headings = extractor.extract_headings(root)
        assert len(headings) == 0


# ------------------------------------------------------------------
# extract_code_blocks
# ------------------------------------------------------------------


class TestExtractCodeBlocks:
    def test_python_code_block(self, extractor: MarkdownASTExtractor) -> None:
        source = b"# Demo\n\n```python\nprint('hello')\n```\n"
        root = extractor.parse_markdown(source)
        blocks = extractor.extract_code_blocks(root, source)

        assert len(blocks) == 1
        assert blocks[0].language == "python"
        assert "print" in blocks[0].content

    def test_multiple_code_blocks(self, extractor: MarkdownASTExtractor) -> None:
        source = b"```js\nconsole.log('hi');\n```\n\n```rust\nprintln!(\"hi\");\n```\n"
        root = extractor.parse_markdown(source)
        blocks = extractor.extract_code_blocks(root, source)

        assert len(blocks) == 2
        assert blocks[0].language == "js"
        assert blocks[1].language == "rust"

    def test_untagged_code_block(self, extractor: MarkdownASTExtractor) -> None:
        source = b"```\nno language\n```\n"
        root = extractor.parse_markdown(source)
        blocks = extractor.extract_code_blocks(root, source)

        assert len(blocks) == 1
        assert blocks[0].language == ""

    def test_code_block_line_count(self, extractor: MarkdownASTExtractor) -> None:
        source = b"```python\nline1\nline2\nline3\n```\n"
        root = extractor.parse_markdown(source)
        blocks = extractor.extract_code_blocks(root, source)

        assert len(blocks) == 1
        assert blocks[0].line_count >= 3


# ------------------------------------------------------------------
# extract_links
# ------------------------------------------------------------------


class TestExtractLinks:
    def test_inline_link(self, extractor: MarkdownASTExtractor) -> None:
        source = b"Check [this link](https://example.com) here.\n"
        root = extractor.parse_markdown(source)
        links = extractor.extract_links(root, source)

        assert len(links) == 1
        assert links[0].text == "this link"
        assert links[0].url == "https://example.com"
        assert links[0].is_internal is False

    def test_internal_link(self, extractor: MarkdownASTExtractor) -> None:
        source = b"See [section](#heading) for details.\n"
        root = extractor.parse_markdown(source)
        links = extractor.extract_links(root, source)

        assert len(links) == 1
        assert links[0].is_internal is True

    def test_multiple_links(self, extractor: MarkdownASTExtractor) -> None:
        source = b"[A](https://a.com) and [B](https://b.com)\n"
        root = extractor.parse_markdown(source)
        links = extractor.extract_links(root, source)

        assert len(links) == 2

    def test_no_links(self, extractor: MarkdownASTExtractor) -> None:
        source = b"No links here.\n"
        root = extractor.parse_markdown(source)
        links = extractor.extract_links(root, source)
        assert len(links) == 0


# ------------------------------------------------------------------
# extract_frontmatter
# ------------------------------------------------------------------


class TestExtractFrontmatter:
    def test_yaml_frontmatter(self, extractor: MarkdownASTExtractor) -> None:
        content = "---\ntitle: My Doc\nauthor: Test\ntags:\n  - python\n  - ast\n---\n\n# Content\n"
        result = extractor.extract_frontmatter(content)

        assert result is not None
        assert result["title"] == "My Doc"
        assert result["author"] == "Test"
        assert "python" in result["tags"]

    def test_no_frontmatter(self, extractor: MarkdownASTExtractor) -> None:
        content = "# Just a heading\n\nSome text.\n"
        result = extractor.extract_frontmatter(content)
        assert result is None

    def test_frontmatter_must_be_at_start(self, extractor: MarkdownASTExtractor) -> None:
        content = "# Heading\n\n---\ntitle: Not frontmatter\n---\n"
        result = extractor.extract_frontmatter(content)
        assert result is None


# ------------------------------------------------------------------
# extract_sections
# ------------------------------------------------------------------


class TestExtractSections:
    def test_multiple_sections(self, extractor: MarkdownASTExtractor) -> None:
        source = b"# Intro\n\nSome intro text.\n\n## Details\n\nDetail content here.\n"
        root = extractor.parse_markdown(source)
        sections = extractor.extract_sections(root, source)

        assert len(sections) == 2
        assert sections[0].heading == "Intro"
        assert sections[0].level == 1
        assert sections[1].heading == "Details"
        assert sections[1].level == 2

    def test_section_content(self, extractor: MarkdownASTExtractor) -> None:
        source = b"# Title\n\nParagraph one.\n\n## Next\n\nParagraph two.\n"
        root = extractor.parse_markdown(source)
        sections = extractor.extract_sections(root, source)

        assert "Paragraph one" in sections[0].content
        assert "Paragraph two" in sections[1].content


# ------------------------------------------------------------------
# compute_quality
# ------------------------------------------------------------------


class TestComputeQuality:
    def test_well_structured_markdown(self, extractor: MarkdownASTExtractor) -> None:
        content = (
            "# Main Title\n\n"
            "Introduction paragraph with enough text to be substantial. "
            "This document covers several topics in detail.\n\n"
            "## Section One\n\n"
            "Content for section one with [a link](https://example.com) "
            "and more details.\n\n"
            "```python\nprint('hello world')\n```\n\n"
            "## Section Two\n\n"
            "Content for section two with [another link](https://example2.com).\n\n"
            "### Subsection\n\n"
            "More detailed content in a subsection.\n"
        )
        score = extractor.compute_quality(content)
        assert score > 0.7, f"Well-structured markdown scored only {score}"

    def test_plain_text_scores_low(self, extractor: MarkdownASTExtractor) -> None:
        content = "Just some plain text with no structure at all."
        score = extractor.compute_quality(content)
        assert score < 0.5, f"Plain text scored {score}"

    def test_score_range(self, extractor: MarkdownASTExtractor) -> None:
        content = "# Title\n\nSome content.\n"
        score = extractor.compute_quality(content)
        assert 0.0 <= score <= 1.0

    def test_empty_content(self, extractor: MarkdownASTExtractor) -> None:
        score = extractor.compute_quality("")
        assert 0.0 <= score <= 1.0
