"""Improvement suggestion and selector patch models."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

__all__ = ["ImprovementSuggestion", "SelectorPatch"]


class ImprovementSuggestion(BaseModel):
    """A suggested improvement for a spider's extraction logic."""

    spider: str = Field(..., description="Name of the spider to improve")
    selector: str = Field(..., description="The CSS/XPath selector to change")
    issue: str = Field(..., description="Description of what is wrong")
    proposed_fix: str = Field(..., description="Proposed new selector or logic change")
    confidence: float = Field(
        default=0.5, ge=0.0, le=1.0, description="Confidence in this suggestion"
    )
    page_type: Optional[str] = Field(
        default=None, description="Page type this applies to"
    )
    impact: str = Field(
        default="medium",
        description="Expected impact level: low, medium, high",
    )

    @property
    def is_high_confidence(self) -> bool:
        """True if confidence >= 0.8."""
        return self.confidence >= 0.8

    def to_patch(self) -> SelectorPatch:
        """Convert to a SelectorPatch."""
        return SelectorPatch(
            spider=self.spider,
            old_selector=self.selector,
            new_selector=self.proposed_fix,
            rationale=self.issue,
        )


class SelectorPatch(BaseModel):
    """A concrete patch replacing one selector with another."""

    spider: str = Field(..., description="Name of the spider to patch")
    old_selector: str = Field(..., description="The current selector to replace")
    new_selector: str = Field(..., description="The replacement selector")
    rationale: str = Field(default="", description="Why this change is being made")
    validated: bool = Field(
        default=False, description="Whether this patch has been validated against live pages"
    )

    def apply_to_source(self, source: str) -> str:
        """Apply this patch to spider source code by replacing the old selector."""
        if self.old_selector not in source:
            raise ValueError(
                f"Old selector '{self.old_selector}' not found in source for spider '{self.spider}'"
            )
        return source.replace(self.old_selector, self.new_selector)

    def as_diff_line(self) -> str:
        """Format as a diff-style line for logging."""
        return f"- {self.old_selector}\n+ {self.new_selector}"
