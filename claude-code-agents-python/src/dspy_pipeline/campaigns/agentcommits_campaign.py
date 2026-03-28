"""Crawl campaign for agentcommits ecosystem research.

Targets: stainless-api/*, googleapis/release-please, conventional-commits/*
Purpose: Gather commit convention patterns, parser implementations, and release
         automation approaches to inform the agentcommits trailer specification.
"""

from __future__ import annotations

from ..crawl_adapter import (
    CrawlCampaign,
    CrawlPriority,
    CrawlTarget,
    SpiderType,
    convert_prompt_to_campaign,
)


# GitHub org spider targets (use github_spider directly)
GITHUB_CRAWL_TARGETS = [
    {
        "org": "conventional-commits",
        "repos": ["conventionalcommits.org", "parser"],
        "priority": CrawlPriority.CRITICAL,
        "description": "Conventional commits spec and reference parser",
        "expected_files": [
            "README.md", "package.json", "src/", "content/v1.0.0/index.md",
        ],
    },
    {
        "org": "googleapis",
        "repos": ["release-please"],
        "priority": CrawlPriority.CRITICAL,
        "description": "Release Please: commit parsing, changelog generation, monorepo strategies",
        "expected_files": [
            "README.md", "package.json", "src/strategies/", "src/plugins/",
            "src/changelog-notes/", "src/updaters/", "docs/customizing.md",
        ],
    },
    {
        "org": "stainless-api",
        "repos": [
            "stl-api", "upload-openapi-spec-action", "mcp-front",
            "mcp-evals-harness", "rerereric",
        ],
        "priority": CrawlPriority.HIGH,
        "description": "Stainless SDK generation with conventional commits + Release Please",
        "expected_files": [
            "README.md", "CONTRIBUTING.md", "package.json", "CLAUDE.md",
            "release-please-config.json", ".release-please-manifest.json",
        ],
    },
]


AGENTCOMMITS_CAMPAIGN = convert_prompt_to_campaign(
    prompt_title="Agentcommits Ecosystem: Conventional Commits + Agent Trailers",
    key_topics=[
        "Conventional commits v1.0.0 footer/trailer specification",
        "Git trailer format and parsing",
        "Release Please commit type to version bump mapping",
        "Release Please plugin and strategy extension points",
        "Stainless-API SDK generation from OpenAPI specs",
        "Changelog generation from structured commit metadata",
        "Monorepo commit scope conventions",
        "Agent metadata in commit messages",
        "Bloom filter indexing for commit classification",
        "DSPy pipeline for commit type prediction",
    ],
    source_urls=[
        # Tier 1: Critical — spec and parser
        {
            "url": "https://github.com/conventional-commits/conventionalcommits.org",
            "description": "Conventional commits spec website source — v1.0.0 spec text",
            "priority": "critical",
        },
        {
            "url": "https://github.com/conventional-commits/parser",
            "description": "Reference parser — recursive descent, unist AST, footer handling",
            "priority": "critical",
        },
        {
            "url": "https://github.com/googleapis/release-please",
            "description": "Release automation — commit parsing, 26+ strategies, 8 plugins",
            "priority": "critical",
        },
        # Tier 2: High — production patterns
        {
            "url": "https://github.com/stainless-api/stl-api",
            "description": "Stainless API framework — conventional commits + Release Please monorepo",
            "priority": "high",
        },
        {
            "url": "https://github.com/stainless-api/upload-openapi-spec-action",
            "description": "SDK build action — file-change driven release automation",
            "priority": "high",
        },
        {
            "url": "https://github.com/stainless-api/mcp-evals-harness",
            "description": "MCP evals — Braintrust tagging, LLM-as-judge scoring",
            "priority": "high",
        },
        # Tier 3: Medium — supplementary
        {
            "url": "https://github.com/stainless-api/mcp-front",
            "description": "MCP auth proxy — CLAUDE.md integration patterns",
            "priority": "medium",
        },
        {
            "url": "https://github.com/stainless-api/rerereric",
            "description": "Fuzzy git rerere — merge conflict automation for agents",
            "priority": "medium",
        },
        {
            "url": "https://conventionalcommits.org",
            "description": "Live spec website — canonical reference",
            "priority": "medium",
        },
    ],
    focus_areas=[
        "Extract footer/trailer parsing patterns from conventional commits parser",
        "Map Release Please extension points for agent metadata processing",
        "Catalog Stainless-API commit conventions and Release Please configuration",
        "Identify bloom filter opportunities for commit trailer routing",
        "Design DSPy signatures for commit classification and trailer extraction",
    ],
    max_pages_per_target=15,
    quality_threshold=0.70,
    iterations=3,
)


if __name__ == "__main__":
    from ..crawl_adapter import campaign_to_json
    print(campaign_to_json(AGENTCOMMITS_CAMPAIGN))
