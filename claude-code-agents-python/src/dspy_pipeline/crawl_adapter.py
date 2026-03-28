"""DSPy structured adapter for converting research prompts into crawl campaigns.

This module takes a rich research prompt (like the MCP v2 + Neon PG18 report)
and produces structured crawl targets, spider assignments, and quality thresholds.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class SpiderType(str, Enum):
    DOCS = "docs_spider"
    PLATFORM = "platform_spider"
    ANTHROPIC = "anthropic_spider"
    CLAUDE_COM = "claude_com_spider"
    GITHUB = "github_spider"
    SPOTIFY = "spotify_spider"
    LLMS_FULL = "llms_full_spider"


class CrawlPriority(str, Enum):
    CRITICAL = "critical"  # Must crawl — core architecture docs
    HIGH = "high"          # Should crawl — reference material
    MEDIUM = "medium"      # Nice to have — supplementary
    LOW = "low"            # Background — if time permits


@dataclass(frozen=True)
class CrawlTarget:
    """A single URL target for crawling."""
    url: str
    spider: SpiderType
    priority: CrawlPriority
    max_pages: int
    description: str
    expected_content: str  # What we expect to extract
    quality_threshold: float = 0.65


@dataclass(frozen=True)
class CrawlCampaign:
    """A structured crawl campaign derived from a research prompt."""
    name: str
    description: str
    targets: list[CrawlTarget]
    total_max_pages: int
    overall_quality_threshold: float
    improvement_iterations: int
    context_steering: str  # What to focus on across iterations


@dataclass
class CrawlResult:
    """Result from executing a crawl target."""
    target: CrawlTarget
    pages_crawled: int
    avg_quality: float
    items: list[dict]
    errors: list[str] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return self.avg_quality >= self.target.quality_threshold and self.pages_crawled > 0


def convert_prompt_to_campaign(
    prompt_title: str,
    key_topics: list[str],
    source_urls: list[dict[str, str]],
    focus_areas: list[str],
    max_pages_per_target: int = 10,
    quality_threshold: float = 0.65,
    iterations: int = 3,
) -> CrawlCampaign:
    """Convert structured prompt inputs into a CrawlCampaign.

    This is the DSPy-style adapter: structured input → structured output.
    Each topic maps to crawl targets with appropriate spiders.
    """
    targets: list[CrawlTarget] = []

    for source in source_urls:
        url = source["url"]
        desc = source.get("description", url)
        priority_str = source.get("priority", "high")
        priority = CrawlPriority(priority_str)

        # Route to appropriate spider based on URL domain
        spider = _route_spider(url)

        targets.append(CrawlTarget(
            url=url,
            spider=spider,
            priority=priority,
            max_pages=max_pages_per_target,
            description=desc,
            expected_content=", ".join(key_topics[:3]),
            quality_threshold=quality_threshold,
        ))

    # Sort by priority
    priority_order = {
        CrawlPriority.CRITICAL: 0,
        CrawlPriority.HIGH: 1,
        CrawlPriority.MEDIUM: 2,
        CrawlPriority.LOW: 3,
    }
    targets.sort(key=lambda t: priority_order[t.priority])

    return CrawlCampaign(
        name=prompt_title.lower().replace(" ", "-")[:50],
        description=prompt_title,
        targets=targets,
        total_max_pages=sum(t.max_pages for t in targets),
        overall_quality_threshold=quality_threshold,
        improvement_iterations=iterations,
        context_steering="; ".join(focus_areas[:5]),
    )


def _route_spider(url: str) -> SpiderType:
    """Route a URL to the appropriate spider."""
    if "code.claude.com" in url:
        return SpiderType.DOCS
    elif "platform.claude.com" in url:
        return SpiderType.PLATFORM
    elif "anthropic.com" in url:
        return SpiderType.ANTHROPIC
    elif "claude.com" in url or "claude.ai" in url:
        return SpiderType.CLAUDE_COM
    elif "github.com/modelcontextprotocol" in url:
        return SpiderType.DOCS  # Use docs spider for MCP SDK docs
    elif "github.com" in url:
        return SpiderType.GITHUB  # GitHub repos → github spider
    elif "neon.tech" in url:
        return SpiderType.PLATFORM  # Neon docs → platform spider
    else:
        return SpiderType.DOCS  # Default


def campaign_to_json(campaign: CrawlCampaign) -> str:
    """Serialize campaign to JSON for logging and persistence."""
    return json.dumps({
        "name": campaign.name,
        "description": campaign.description,
        "total_max_pages": campaign.total_max_pages,
        "overall_quality_threshold": campaign.overall_quality_threshold,
        "improvement_iterations": campaign.improvement_iterations,
        "context_steering": campaign.context_steering,
        "targets": [
            {
                "url": t.url,
                "spider": t.spider.value,
                "priority": t.priority.value,
                "max_pages": t.max_pages,
                "description": t.description,
                "expected_content": t.expected_content,
                "quality_threshold": t.quality_threshold,
            }
            for t in campaign.targets
        ],
    }, indent=2)


# ── Pre-built campaign from the MCP v2 + Neon PG18 research prompt ──────

MCP_V2_NEON_CAMPAIGN = convert_prompt_to_campaign(
    prompt_title="MCP TypeScript SDK v2 + Neon Postgres 18 Plugin Data Platform",
    key_topics=[
        "MCP TypeScript SDK v2 registerTool API",
        "Neon Postgres 18 UUIDv7 branching",
        "Knowledge-work plugin architecture",
        "Claude Code hooks lifecycle",
        "Drizzle ORM Neon HTTP client",
        "Structured tool output with Zod v4",
        "Tasks API long-running operations",
        "Plugin marketplace distribution",
        "Streamable HTTP transport",
        "Monorepo pnpm Turborepo pattern",
    ],
    source_urls=[
        # Tier 1: Critical — core architecture
        {"url": "https://code.claude.com/docs/llms.txt", "description": "Claude Code full docs index — skills, agents, hooks, plugins, MCP", "priority": "critical"},
        {"url": "https://platform.claude.com/llms.txt", "description": "Anthropic API/SDK/Agent SDK — tool_use, structured output, streaming", "priority": "critical"},
        # Tier 2: High — MCP and plugin ecosystem
        {"url": "https://code.claude.com/docs/en/plugins-reference", "description": "Plugin manifest schema, component specs, hooks, MCP bundling", "priority": "high"},
        {"url": "https://code.claude.com/docs/en/channels-reference", "description": "Channel MCP servers — notifications, reply tools, permission relay", "priority": "high"},
        {"url": "https://code.claude.com/docs/en/mcp", "description": "MCP server configuration in Claude Code", "priority": "high"},
        {"url": "https://code.claude.com/docs/en/hooks", "description": "Hook events, configuration, JSON I/O, exit codes", "priority": "high"},
        # Tier 3: Medium — SDK and database
        {"url": "https://code.claude.com/docs/en/skills", "description": "Skills creation, frontmatter, context:fork, allowed-tools", "priority": "medium"},
        {"url": "https://code.claude.com/docs/en/sub-agents", "description": "Subagent configuration, tools, model, permissionMode", "priority": "medium"},
        {"url": "https://code.claude.com/docs/en/headless", "description": "Agent SDK headless mode — claude -p, structured output, streaming", "priority": "medium"},
        {"url": "https://www.anthropic.com/sitemap.xml", "description": "Anthropic research, engineering posts, product pages", "priority": "medium"},
        # Tier 4: Low — supplementary
        {"url": "https://claude.com/docs/llms.txt", "description": "Cowork docs, connectors, skills overview", "priority": "low"},
    ],
    focus_areas=[
        "Extract MCP v2 registerTool patterns and outputSchema usage",
        "Map Neon PG18 extensions to Kimball layer requirements",
        "Identify plugin hook lifecycle events for dispatch automation",
        "Catalog community plugin patterns for routing knowledge base",
        "Extract structured output schemas for quality scoring",
    ],
    max_pages_per_target=10,
    quality_threshold=0.65,
    iterations=3,
)


if __name__ == "__main__":
    print(campaign_to_json(MCP_V2_NEON_CAMPAIGN))
