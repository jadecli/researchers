# Project Conventions — claude-code-agents-python

See root ARCHITECTURE.md § Support Layer.

## Overview

This project implements Agent SDK orchestration for iterative crawl campaigns. It combines
DSPy pipelines for page classification and quality scoring with Scrapy-based crawling and
Anthropic Agent SDK headless execution via `claude -p`.

## Architecture

- **Orchestrator**: CrawlCampaign drives iterative crawl-improve loops. HeadlessRunner wraps
  `claude -p` subprocess calls. ImprovementChain tracks quality deltas across iterations.
- **DSPy Pipeline**: Signatures for PageClassifier, QualityScorer, SelectorProposer,
  PluginDesigner, and CodegenRouter. ChainOfThought modules wrap each signature.
- **Plugin Generation**: Follows anthropics/knowledge-work-plugins patterns. Generates
  .claude-plugin/plugin.json, skills, agents, connectors, hooks, and LSP configs.
- **Multi-language Codegen**: Supports Python, TypeScript, Go, Rust, Java, Kotlin, Swift,
  C#, PHP, Ruby, Elixir, and Scala. Each language has SDK mappings and build tool templates.
- **Cowork Module**: Routes tasks to knowledge-work-plugins domains (engineering, data,
  sales, marketing, legal, product, design, support, finance, hr).

## Key Patterns

- All domain objects are Pydantic v2 models in `src/models/`.
- DSPy signatures live in `src/dspy_pipeline/signatures.py`; modules in `modules.py`.
- Plugin scaffolding mirrors the structure from anthropics/knowledge-work-plugins.
- HeadlessRunner uses `claude -p` with `--output-format stream-json` for streaming.
- ImprovementChain accumulates ContextDelta objects and checks convergence.

## Running

```bash
# Install
pip install -e ".[dev]"

# Run a crawl campaign
python -m src.cli campaign --target https://example.com --iterations 3

# Generate a plugin
python -m src.cli generate-plugin --domain engineering --output-dir ./output

# Run tests
pytest
```

## Code Style

- Python 3.11+, Pydantic v2, strict typing.
- Use ruff for linting, mypy for type checking.
- All public functions have docstrings.
- Tests use pytest with mocked subprocess calls for HeadlessRunner.

## Crawl Target Interface
To start a campaign, provide:
- `target_url`: The sitemap.xml or llms.txt URL to crawl
- `spider`: Which spider to use (docs_spider, platform_spider, anthropic_spider, claude_com_spider)
- `max_pages`: Maximum pages to crawl per run
- `iterations`: Number of improvement iterations
- `quality_threshold`: Minimum acceptable quality (default 0.60)

Example: `python -m src.cli campaign --target https://code.claude.com/docs/llms.txt --iterations 3`
