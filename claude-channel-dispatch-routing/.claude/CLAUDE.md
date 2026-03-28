# claude-channel-dispatch-routing

See root ARCHITECTURE.md § Kimball Data Architecture. Production deployment repo. Channels push external events, dispatch router assigns agents,
Neon PG18 stores crawl state, iterative loop only re-crawls changed pages.

## Architecture
- **src/channel/** — MCP channel server (webhook, reply tool, permission relay, sender gating)
- **src/dispatch/** — Routing engine (8 task types, 20-plugin community index)
- **src/persistence/** — Neon middleware (DeltaFetch + PostgresCacheStorage)
- **src/types/** — Kimball layer types (RuntimeRecord, ReportingRecord, SemanticRecord)
- **migrations/** — 5 SQL files (extensions, runtime 3NF, reporting star schema, semantic views, ETL)
- **.claude/rules/** — Boris Cherny standards, Kimball data architecture, test standards

## Test Status
- Channel server: 22 vitest tests pass
- Dispatch router: 22 vitest tests pass
- Neon middleware: 5 pytest tests
- Layer types: test file ready

## Ready for Crawl
Provide crawl targets as:
- `url`: The page/sitemap/llms.txt to crawl
- `spider`: docs_spider | platform_spider | anthropic_spider | claude_com_spider
- `round`: Which round number (1-10)
- `max_pages`: Page limit per run
