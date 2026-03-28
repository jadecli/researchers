"""Pydantic-based Scrapy items for the researchers crawler system."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, HttpUrl


class DocPage(BaseModel):
    """A documentation page extracted from a website."""

    url: str = Field(description="Source URL of the page")
    title: str = Field(default="", description="Page title")
    content_markdown: str = Field(default="", description="Page content converted to markdown")
    content_html: str = Field(default="", description="Raw HTML content of the main body")
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Extracted metadata (author, description, tags, etc.)",
    )
    quality_score: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Extraction quality score"
    )
    extraction_timestamp: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat(),
        description="ISO timestamp of extraction",
    )

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class ResearchPaper(DocPage):
    """A research paper or technical report."""

    authors: list[str] = Field(default_factory=list, description="Paper authors")
    abstract: str = Field(default="", description="Paper abstract")
    publication_date: str = Field(default="", description="Publication date string")


class NewsArticle(DocPage):
    """A news article or blog post."""

    publish_date: str = Field(default="", description="Article publish date")
    author: str = Field(default="", description="Article author")
    category: str = Field(default="", description="Article category or section")


class APIEndpoint(BaseModel):
    """An API endpoint extracted from documentation."""

    url: str = Field(description="Documentation URL where this endpoint was found")
    method: str = Field(default="GET", description="HTTP method (GET, POST, PUT, DELETE, etc.)")
    path: str = Field(default="", description="API path (e.g., /v1/messages)")
    description: str = Field(default="", description="Endpoint description")
    parameters: list[dict[str, Any]] = Field(
        default_factory=list,
        description="List of parameter definitions",
    )
    response_schema: dict[str, Any] = Field(
        default_factory=dict,
        description="Response schema or example",
    )


class SkillSpec(BaseModel):
    """A skill specification extracted from documentation."""

    name: str = Field(description="Skill name")
    description: str = Field(default="", description="Skill description")
    frontmatter: dict[str, Any] = Field(
        default_factory=dict, description="YAML frontmatter fields"
    )
    content: str = Field(default="", description="Skill body content in markdown")
    source_url: str = Field(default="", description="URL where this skill was found")


class OfficialSkill(DocPage):
    """An official vendor skill from skills.sh/official registry.

    Only official (creator-owned) skills are crawled to avoid security risk
    from community/non-official skills.
    """

    skill_name: str = Field(description="Skill name from SKILL.md frontmatter")
    skill_description: str = Field(default="", description="Skill description from frontmatter")
    creator_org: str = Field(description="GitHub org that owns the skill")
    repo: str = Field(default="", description="GitHub repo containing the skill")
    skill_dir: str = Field(default="", description="Directory path within repo")
    license: str = Field(default="unknown", description="SPDX license identifier")
    frontmatter: dict[str, Any] = Field(
        default_factory=dict, description="Full YAML frontmatter from SKILL.md"
    )
    body: str = Field(default="", description="Skill body content (below frontmatter)")
    has_examples: bool = Field(default=False, description="Whether skill includes examples")
    has_scripts: bool = Field(default=False, description="Whether skill bundles scripts")
    stars: int = Field(default=0, description="GitHub repo star count")
