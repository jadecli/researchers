# claude-dspy-crawl-planning

See root ARCHITECTURE.md § Orchestration Layer. Shannon-thinking crawl planner using Claude Agent SDK v2 canonical objects.
Forked patterns from jadecli/shannon-thinking. Iterative multi-round crawler
covering all platform.claude.com doc categories, plus llms.txt video competitor
crawl planning for 17 AI video generation providers.

## Prerequisites

- Node.js >= 18
- npm

## Install

```bash
cd claude-dspy-crawl-planning
npm install --legacy-peer-deps
```

The `--legacy-peer-deps` flag is required due to a zod peer dependency conflict
with `@anthropic-ai/claude-agent-sdk`.

## Build

```bash
npm run build
```

Runs `tsc`. Outputs compiled JS to the `dist/` directory per tsconfig.json.

## Typecheck (no emit)

```bash
npm run typecheck
```

Runs `tsc --noEmit`. Validates all strict Boris Cherny TypeScript rules:
`noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch`,
`noUnusedLocals`, `noUnusedParameters`.

## Test

Run all tests (79 tests, 2 files):

```bash
npm run test:run
```

Run tests in watch mode:

```bash
npm test
```

### Test Files

| File | Tests | Covers |
|------|-------|--------|
| `__tests__/llms-txt-types.test.ts` | 35 | Branded types, discriminated unions, validation, Kimball schema shapes |
| `__tests__/llms-txt-planner.test.ts` | 44 | Provider registry, Shannon thinking, task generation, completion reports, connector recommendations |

## Run

### llms.txt Video Competitor Planner (DSPy structured)

```bash
npx tsx src/thinking/llms-txt-planner.ts
```

Outputs a Shannon-thinking crawl plan and completion report for 17 AI video
providers. Covers llms.txt discovery via native URLs, Replicate per-model files,
and custom format pages. Reports coverage %, task status, and connector
recommendations.

### General Crawl Planner

```bash
npx tsx src/thinking/planner.ts [round]
```

Generates a Shannon 5-step crawl plan for a given round number (default: 1).

### Iterative Crawl Runner

```bash
npx tsx src/crawl/runner.ts [rounds] [maxPages]
```

Executes multi-round crawl with convergence detection. Requires the Scrapy
project at `../claude-code/` with spiders available.

- `rounds` — number of crawl rounds (default: 1)
- `maxPages` — max pages per round (default: 30)

## Architecture

### Source Files

- **src/types/core.ts** — Branded types, Shannon thought types, Agent SDK v2 session types, `Result<T,E>`
- **src/types/llms-txt.ts** — Video competitor branded types: `ProviderId`, `LlmsTxtUrl`, `LlmsTxtStatus` (4-variant discriminated union), `CrawlTask`, `CrawlTaskState` (5 variants), `VideoProvider`, `ValidationResult`, Kimball `FactLlmsTxtCrawl`/`DimProvider`
- **src/thinking/planner.ts** — Shannon 5-step crawl planner (problem→constraints→model→proof→implementation)
- **src/thinking/llms-txt-planner.ts** — DSPy-structured llms.txt planner with 17-provider registry, task generation, completion reporting, connector recommendations
- **src/crawl/runner.ts** — Iterative crawl runner with convergence detection

### Type Patterns (Boris Cherny)

- Branded types via `Brand<K, T>` — prevents mixing `ProviderId` with `LlmsTxtUrl`
- Discriminated unions with `assertNever()` for exhaustive matching
- `Result<T, E>` — no thrown exceptions, explicit error handling
- All types are `readonly`

### Data Modeling (Ralph Kimball)

- `FactLlmsTxtCrawl` — grain: one row per provider per crawl date per file type
- `DimProvider` — SCD Type 2 with `effective_from`/`effective_to`/`is_current`
- Surrogate keys use `_sk` suffix

### Shannon Thinking Steps

1. **problem_definition** — strip to fundamentals
2. **constraints** — system limitations
3. **model** — structural framework
4. **proof** — validate feasibility
5. **implementation** — practical execution plan

Each step has `confidence` ∈ [0, 1], `uncertainty = 1 - confidence`,
`assumptions` with status tracking, and `dependencies` linking to prior steps.

### Provider Tiers

| Tier | Count | Examples |
|------|-------|---------|
| tier1_realism | 3 | Higgsfield, Kling, Seedance |
| tier2_strong | 6 | Runway, Pika, Minimax, OpenAI, Midjourney, Luma |
| avatar | 3 | HeyGen, D-ID, Synthesia |
| tier3_budget | 2 | Pixverse, Haiper |
| editing | 2 | Descript, Wondershare |
| aggregator | 1 | Wan (open source) |

### Connector Recommendations

The planner recommends 7 connectors for full coverage:

1. **replicate-llms-txt-connector** (MCP server, critical) — Kling, Seedance, Runway, Minimax, Wan
2. **readme-io-docs-connector** (API, high) — D-ID
3. **mintlify-docs-connector** (API, high) — Higgsfield
4. **google-ai-docs-connector** (Scrapy middleware, medium) — Google Veo
5. **openai-docs-connector** (API, medium) — OpenAI
6. **llms-txt-change-webhook** (webhook, medium) — all providers
7. **llmstxt-directory-connector** (Scrapy, low) — llmstxt.org directory
