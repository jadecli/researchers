# researchers

Multi-repo system for iterative documentation crawling, multi-agent dispatch, and knowledge-work plugin generation. Built with Claude Code skills, Scrapy spiders, Neon Postgres 18, and the Agent Skills open standard.

## Repos

| Repo | Purpose | Files | Tests |
|------|---------|-------|-------|
| [claude-code](./claude-code) | Scrapy spiders + 12 language extractors | 378 | — |
| [claude-code-agents-python](./claude-code-agents-python) | DSPy pipeline + plugin generation | 77 | — |
| [claude-code-actions](./claude-code-actions) | GitHub Actions + Chrome + Slack | 43 | — |
| [claude-code-security-review](./claude-code-security-review) | SSRF/PII/injection scanners | 51 | 31 |
| [claude-multi-agent-sdk](./claude-multi-agent-sdk) | Branded types + agent loop + MCP | 28 | 54 |
| [claude-multi-agent-dispatch](./claude-multi-agent-dispatch) | 10-round dispatch + Shannon thinking | 94 | 252 |
| [claude-channel-dispatch-routing](./claude-channel-dispatch-routing) | Channels + Neon PG18 + routing | 29 | 49 |
| [claude-dspy-crawl-planning](./claude-dspy-crawl-planning) | Shannon planner + crawl runner | 8 | — |
| [agenttasks](./agenttasks) | Next.js webapp (agenttasks.io) | — | — |

## Crawl Results

| Round | Target | Pages | Avg Quality |
|-------|--------|-------|-------------|
| 1 | code.claude.com/docs | 4 | 0.75 |
| 2 | code + platform llms.txt | 17 | 0.76 |
| 3 | platform.claude.com full | 38 | 0.73 |
| 4 | llms-full.txt (code + platform) | 271 | 0.74 |
| 5 | All 4 llms-full.txt | 2,477 | 0.77 |
| **Total** | | **2,807** | **0.74** |

## Data Sources

- **code.claude.com** (71 pages) — Skills, agents, hooks, plugins, MCP, channels
- **platform.claude.com** (768 pages) — API, SDKs, tools, Agent SDK v2, structured output
- **neon.com** (414 pages) — Branching, PG18 extensions, serverless driver
- **vercel.com** (1,224 pages) — Deployment, Edge, ISR, frameworks

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full orchestration trace.

## Quick Start

```bash
# Run the webapp
cd agenttasks && npm run dev

# Run a crawl
cd claude-code && PYTHONPATH=. python3 -m scrapy crawl docs_spider -s CLOSESPIDER_PAGECOUNT=5

# Run tests
cd claude-multi-agent-sdk && npx vitest run      # 54 tests
cd claude-multi-agent-dispatch && npx vitest run  # 252 tests
cd claude-code-security-review && PYTHONPATH=. python3 -m pytest tests/python/  # 31 tests
```

## Tech Stack

- **Crawl**: Scrapy + scrapy-deltafetch + spidermon
- **Types**: TypeScript (Boris Cherny strict) + Python (Pydantic v2)
- **Data**: Neon Postgres 18 (Kimball 3-layer: runtime → reporting → semantic)
- **Web**: Next.js 15 + Tailwind + Vercel
- **SDK**: Claude Agent SDK v2 (`unstable_v2_createSession`, `send()`, `stream()`)
- **Planning**: Shannon thinking (problem → constraints → model → proof → implementation)
- **LSP**: Python, TypeScript, Go, C/C++, Swift (5 installed)
