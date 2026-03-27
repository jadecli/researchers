"""Extraction results and quality scoring models."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field, computed_field

from .crawl_target import PageType

__all__ = ["ExtractionResult", "QualityScore", "ContextDelta"]


class QualityScore(BaseModel):
    """Quality metrics for an extraction result."""

    completeness: float = Field(
        default=0.0, ge=0.0, le=1.0, description="How complete the extraction is"
    )
    structure: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Structural quality of extracted data"
    )
    links: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Quality of link extraction and resolution"
    )
    overall: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Overall quality score"
    )

    @classmethod
    def compute(cls, completeness: float, structure: float, links: float) -> QualityScore:
        """Compute quality score with weighted overall."""
        overall = 0.4 * completeness + 0.35 * structure + 0.25 * links
        return cls(
            completeness=completeness,
            structure=structure,
            links=links,
            overall=round(overall, 4),
        )

    def meets_threshold(self, threshold: float) -> bool:
        """Check if overall score meets the given threshold."""
        return self.overall >= threshold


class ExtractionResult(BaseModel):
    """Result of extracting data from a crawled page."""

    url: str = Field(..., description="Source URL")
    spider_name: str = Field(default="generic", description="Spider that crawled the page")
    page_type: PageType = Field(default=PageType.DOC, description="Classified page type")
    title: Optional[str] = Field(default=None, description="Page title")
    content: str = Field(default="", description="Extracted text content")
    structured_data: dict[str, Any] = Field(
        default_factory=dict, description="Structured data extracted from the page"
    )
    links: list[str] = Field(default_factory=list, description="Extracted links")
    selectors_used: list[str] = Field(
        default_factory=list, description="CSS/XPath selectors used for extraction"
    )
    quality: QualityScore = Field(
        default_factory=QualityScore, description="Quality scores for this extraction"
    )
    raw_html_snippet: Optional[str] = Field(
        default=None, description="First 2000 chars of raw HTML for debugging"
    )
    extracted_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of extraction",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )

    @computed_field  # type: ignore[misc]
    @property
    def content_length(self) -> int:
        """Length of the extracted content."""
        return len(self.content)

    @computed_field  # type: ignore[misc]
    @property
    def link_count(self) -> int:
        """Number of extracted links."""
        return len(self.links)

    def is_empty(self) -> bool:
        """Check if extraction yielded no meaningful content."""
        return len(self.content.strip()) == 0 and not self.structured_data


class ContextDelta(BaseModel):
    """Tracks changes between improvement iterations."""

    iteration: int = Field(..., ge=0, description="Iteration number")
    new_patterns: list[str] = Field(
        default_factory=list, description="Newly discovered extraction patterns"
    )
    failing_selectors: list[str] = Field(
        default_factory=list, description="Selectors that stopped working"
    )
    quality_before: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Quality score before this iteration"
    )
    quality_after: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Quality score after this iteration"
    )
    steer_direction: str = Field(
        default="", description="Guidance for the next iteration"
    )
    discovered_page_types: list[str] = Field(
        default_factory=list, description="New page types discovered in this iteration"
    )

    @computed_field  # type: ignore[misc]
    @property
    def quality_improvement(self) -> float:
        """Net quality change from this iteration."""
        return round(self.quality_after - self.quality_before, 4)

    @property
    def is_regression(self) -> bool:
        """True if quality decreased in this iteration."""
        return self.quality_after < self.quality_before

    @property
    def is_stagnant(self) -> bool:
        """True if quality did not change."""
        return abs(self.quality_after - self.quality_before) < 0.001
