"""Crawl target and plan models for campaign orchestration."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, HttpUrl

__all__ = ["CrawlTarget", "CrawlPlan", "PageType"]


class PageType(str, Enum):
    """Classification of crawled page types."""

    DOC = "doc"
    RESEARCH = "research"
    NEWS = "news"
    API = "api"
    LEGAL = "legal"
    PRODUCT = "product"
    PLUGIN_SPEC = "plugin_spec"
    SDK_REF = "sdk_ref"


class CrawlTarget(BaseModel):
    """A single URL target for crawling."""

    url: str = Field(..., description="The URL to crawl")
    spider_name: str = Field(
        default="generic", description="Name of the Scrapy spider to use"
    )
    max_pages: int = Field(default=50, ge=1, le=10000, description="Maximum pages to crawl")
    priority: int = Field(
        default=0, ge=0, le=10, description="Priority level (0=lowest, 10=highest)"
    )
    allowed_domains: list[str] = Field(default_factory=list, description="Restrict crawl to these domains")
    page_type_hint: Optional[PageType] = Field(
        default=None, description="Hint for expected page type"
    )

    def effective_domains(self) -> list[str]:
        """Return allowed domains, falling back to domain extracted from URL."""
        if self.allowed_domains:
            return self.allowed_domains
        from urllib.parse import urlparse

        parsed = urlparse(self.url)
        if parsed.hostname:
            return [parsed.hostname]
        return []


class CrawlPlan(BaseModel):
    """A plan describing a full crawl campaign."""

    targets: list[CrawlTarget] = Field(
        default_factory=list, description="List of crawl targets"
    )
    total_budget_usd: float = Field(
        default=5.0, gt=0, le=1000, description="Total budget in USD for API calls"
    )
    max_iterations: int = Field(
        default=3, ge=1, le=20, description="Maximum improvement iterations"
    )
    concurrency: int = Field(default=2, ge=1, le=10, description="Parallel crawl tasks")
    quality_threshold: float = Field(
        default=0.8, ge=0.0, le=1.0, description="Minimum quality score to stop iterating"
    )

    @property
    def total_max_pages(self) -> int:
        """Sum of max_pages across all targets."""
        return sum(t.max_pages for t in self.targets)

    def sorted_targets(self) -> list[CrawlTarget]:
        """Return targets sorted by priority descending."""
        return sorted(self.targets, key=lambda t: t.priority, reverse=True)
