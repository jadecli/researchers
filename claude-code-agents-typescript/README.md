# claude-code-agents-typescript

TypeScript port of [`claude-code-agents-python`](../claude-code-agents-python/) — iterative crawl campaigns, DSPy-style pipelines, plugin generation, multi-language codegen, and cowork task routing with **Boris Cherny strict typing discipline**.

## Quick Start

```bash
# Prerequisites: Node.js >= 20
node --version  # v20.x or higher

# Install
npm install

# Build
npm run build

# Test (139 tests, 7 suites)
npm test

# Type-check only
npm run lint
```

## CLI Commands

### `campaign` — Run an iterative crawl campaign

```bash
npx tsx src/cli.ts campaign \
  --target https://app.klingai.com/llms.txt \
  --spider generic \
  --max-pages 50 \
  --iterations 3 \
  --budget 5.0 \
  --threshold 0.8 \
  --output results.json
```

| Flag | Default | Description |
|------|---------|-------------|
| `-t, --target <url>` | required | URL to crawl (llms.txt or sitemap) |
| `-s, --spider <name>` | `generic` | Spider name |
| `-m, --max-pages <n>` | `50` | Max pages per target |
| `-i, --iterations <n>` | `3` | Max improvement iterations |
| `-b, --budget <usd>` | `5.0` | Budget cap in USD |
| `--threshold <n>` | `0.8` | Minimum quality score |
| `-o, --output <file>` | — | Write results JSON to file |

### `generate-plugin` — Scaffold a Claude Code plugin

```bash
npx tsx src/cli.ts generate-plugin \
  --name my-plugin \
  --domain engineering \
  --output-dir ./generated_plugins
```

Generates: `plugin.json`, skills (YAML frontmatter), agents, connectors, hooks, LSP config, MCP config.

### `codegen` — Multi-language project scaffold

```bash
npx tsx src/cli.ts codegen \
  --task "build a REST API with authentication" \
  --project-name my-api \
  --environment web \
  --language typescript go \
  --output-dir ./generated_code
```

Supports 12 languages: Python, TypeScript, Go, Rust, Java, Kotlin, Swift, C#, PHP, Ruby, Elixir, Scala.

### `cowork-task` — Route tasks to knowledge-work domains

```bash
npx tsx src/cli.ts cowork-task \
  --task "analyze quarterly sales pipeline data" \
  --top-k 3
```

Routes to 10 domains: engineering, data, sales, marketing, legal, product, design, support, finance, hr.

## Type System

This package enforces Boris Cherny's strict typing discipline:

### Branded Types

```typescript
type Brand<K, T> = K & { readonly __brand: T };
type CampaignId = Brand<string, 'CampaignId'>;
type Url        = Brand<string, 'Url'>;
type USD        = Brand<number, 'USD'>;
```

Prevents accidental mixing of `CampaignId` with `SpiderName` at compile time.

### Result\<T, E\>

```typescript
type Result<T, E extends Error = Error> =
  | { readonly ok: true;  readonly value: T }
  | { readonly ok: false; readonly error: E };

const result = campaign.run();
if (result.ok) {
  console.log(result.value);  // T
} else {
  console.error(result.error); // E
}
```

No thrown exceptions crossing module boundaries.

### Discriminated Unions + assertNever

```typescript
type CampaignState =
  | { readonly status: 'planning' }
  | { readonly status: 'executing'; readonly iteration: Iteration }
  | { readonly status: 'improving'; readonly delta: ContextDelta }
  | { readonly status: 'complete';  readonly results: ExtractionResult[] }
  | { readonly status: 'failed';    readonly error: Error };

function handle(state: CampaignState): void {
  switch (state.status) {
    case 'planning':  /* ... */ break;
    case 'executing': /* ... */ break;
    case 'improving': /* ... */ break;
    case 'complete':  /* ... */ break;
    case 'failed':    /* ... */ break;
    default: assertNever(state); // compile error if a case is missing
  }
}
```

## Quality Scoring

```
overall = 0.4 * completeness + 0.35 * structure + 0.25 * links
```

Each component is a branded `QualityValue` in range `[0.0, 1.0]`.

## Test Suites

| Suite | Tests | Covers |
|-------|-------|--------|
| `types.test.ts` | 21 | Branded types, Result\<T,E\>, assertNever |
| `models.test.ts` | 30 | CrawlTarget, CrawlPlan, QualityScore, SelectorPatch, Language, PluginSpec |
| `pipeline.test.ts` | 19 | Zod signatures, ResearchPipeline methods |
| `orchestrator.test.ts` | 13 | ImprovementChain, injectContext, CampaignState, CrawlCampaign |
| `codegen.test.ts` | 25 | LanguageRouter, TemplateEngine (12 langs), MultiLangScaffold |
| `cowork.test.ts` | 21 | CoworkTaskRouter, PluginRecommender, KnowledgeSynthesizer |
| `plugin-gen.test.ts` | 10 | E2E plugin generation with filesystem verification |
| **Total** | **139** | |

## Project Structure

```
claude-code-agents-typescript/
├── src/
│   ├── types.ts              # Foundation: Brand, Result, assertNever
│   ├── models/               # Domain objects (5 files)
│   ├── pipeline/             # DSPy-equivalent modules (4 files)
│   ├── orchestrator/         # Campaign execution loop (4 files)
│   ├── codegen/              # Multi-language scaffolding (3 files)
│   ├── cowork/               # Knowledge-work routing (3 files)
│   ├── plugin_gen/           # Plugin scaffolding (8 files)
│   ├── cli.ts                # Commander CLI entry point
│   └── index.ts              # Barrel exports
├── tests/                    # 7 test files, 139 tests
├── package.json
├── tsconfig.json             # strict + noUncheckedIndexedAccess
└── vitest.config.ts
```

## Relationship to Python Package

| Python (`claude-code-agents-python`) | TypeScript (this package) |
|--------------------------------------|---------------------------|
| `src/models/*.py` (Pydantic v2) | `src/models/*.ts` (Zod) |
| `src/dspy_pipeline/signatures.py` | `src/pipeline/signatures.ts` |
| `src/dspy_pipeline/modules.py` | `src/pipeline/modules.ts` |
| `src/orchestrator/campaign.py` | `src/orchestrator/campaign.ts` |
| `src/orchestrator/headless_runner.py` | `src/orchestrator/headless-runner.ts` |
| `src/codegen/` | `src/codegen/` |
| `src/cowork/` | `src/cowork/` |
| `src/plugin_gen/` | `src/plugin_gen/` |
| `src/cli.py` (click) | `src/cli.ts` (commander) |
| pytest | vitest |
| mypy strict | tsc strict + noUncheckedIndexedAccess |
