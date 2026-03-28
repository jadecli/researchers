# agentcrawls-ts

TypeScript changelog crawler for upstream Anthropic repo monitoring. See root ARCHITECTURE.md § Crawl Engine.

## Role in Monorepo
Ground-truth ingestion pipeline. Crawls CHANGELOG.md from claude-code, claude-code-sdk-python, claude-code-sdk-node. Bloom filter deduplicates across runs. Feeds agentdata schema in Neon PG18.

## Architecture
- **src/crawlers/changelog.ts** — CheerioCrawler for 3 upstream repos
- **src/extractors/bullets.ts** — Regex + @ax-llm/ax AI bullet extraction
- **src/filters/change-detect.ts** — SHA-256 bloom filter (10K items, 1% FP)
- **src/storage/neon.ts** — Neon PG18 upsert to agentdata.changelog_bullets
- **src/index.ts** — CLI entry: crawl → detect → extract → persist

## Commands
- `npm run crawl` — Run changelog crawler
- `npm test` — 23 vitest tests
- `npx vitest run --coverage` — Coverage report (baseline ~48%)

## Test Status
- 23/23 vitest tests pass (bullets, change-detect, changelog)
