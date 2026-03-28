# Project Conventions — claude-code-agents-typescript

## Overview

TypeScript port of `claude-code-agents-python`. Implements iterative crawl campaigns,
DSPy-style pipeline modules, plugin generation, multi-language codegen, and cowork task
routing — all with Boris Cherny strict typing discipline.

## Architecture

```
src/
├── types.ts              # Branded types, Result<T,E>, assertNever
├── models/               # Domain objects (Zod-validated)
│   ├── crawl-target.ts   # CrawlTarget, CrawlPlan, PageType
│   ├── extraction-result.ts  # QualityScore (40/35/25 weighting), ExtractionResult
│   ├── improvement.ts    # SelectorPatch, ImprovementSuggestion
│   ├── language.ts       # 12 supported languages, LSP binaries, SDK packages
│   └── plugin-spec.ts    # SkillSpec, AgentSpec, ConnectorSpec, PluginSpec
├── pipeline/             # DSPy-equivalent modules
│   ├── signatures.ts     # 5 Zod schemas (PageClassifier, QualityScorer, etc.)
│   ├── modules.ts        # Chain-of-thought wrappers returning Result<O, ModuleError>
│   ├── pipeline.ts       # ResearchPipeline facade
│   └── crawl-adapter.ts  # Spider routing, VIDEO_AI_CRAWL_CAMPAIGN
├── orchestrator/         # Campaign execution loop
│   ├── campaign.ts       # CrawlCampaign (plan → execute → improve → converge)
│   ├── headless-runner.ts  # Wraps `claude -p` subprocess
│   ├── improvement-chain.ts  # Tracks ContextDelta convergence
│   └── context-injector.ts   # Builds markdown context for HeadlessRunner prompts
├── codegen/              # Multi-language scaffold generation
│   ├── language-router.ts    # 30+ keyword→language mappings
│   ├── template-engine.ts    # 12 language templates with assertNever exhaustive switch
│   └── multi-lang-scaffold.ts  # Combines router + engine, writes .project.json
├── cowork/               # Knowledge-work-plugins routing
│   ├── task-router.ts        # 10 domains, keyword confidence scoring
│   ├── plugin-recommender.ts # 14-entry catalog, 3-factor relevance scoring
│   └── knowledge-synthesizer.ts  # Aggregates ExtractionResults by type/quality
├── plugin_gen/           # Plugin scaffolding (mirrors anthropics/knowledge-work-plugins)
│   ├── scaffold.ts       # generatePlugin() orchestrator
│   ├── manifest.ts       # plugin.json writer
│   ├── skill-writer.ts   # YAML frontmatter markdown skills
│   ├── agent-writer.ts   # Agent markdown with config
│   ├── connectors-writer.ts  # Connector stubs with ~~ placeholders
│   ├── hooks-writer.ts   # 5 lifecycle events (PreToolUse, PostToolUse, etc.)
│   ├── lsp-config.ts     # 12 LSP server defaults
│   └── mcp-config.ts     # stdio/sse/streamable-http with assertNever
├── cli.ts                # Commander CLI (campaign, generate-plugin, codegen, cowork-task)
└── index.ts              # Barrel exports
```

## Key Patterns (Boris Cherny Strict Typing)

1. **Branded types** — `type Brand<K, T> = K & { readonly __brand: T }` prevents ID confusion.
   10 brands: `CampaignId`, `SpiderName`, `Url`, `QualityValue`, `USD`, `Iteration`,
   `PluginName`, `LanguageId`, `DomainId`, `Confidence`.

2. **Result<T, E>** — All fallible operations return `Result` instead of throwing.
   Includes `Ok()`, `Err()`, `map()`, `flatMap()`, `unwrap()`, `unwrapOr()`.

3. **Discriminated unions** — `CampaignState`, `SpiderType`, `CrawlPriority`, `TransportType`
   use literal discriminant fields for compile-time exhaustive matching.

4. **assertNever()** — Exhaustive switches in `describePageType`, `connectorToMcpEntry`,
   `TemplateEngine`, and `writeMcpConfig`.

## Build

```bash
npm install          # Install dependencies
npm run build        # TypeScript → dist/ (tsc)
npm run lint         # Type-check without emit (tsc --noEmit)
```

## Test

```bash
npm test             # vitest run (139 tests across 7 files)
npm run test:watch   # vitest in watch mode
```

## Run

```bash
# Crawl campaign
npx tsx src/cli.ts campaign -t https://example.com/llms.txt -m 50 -i 3

# Generate a plugin
npx tsx src/cli.ts generate-plugin -n my-plugin -d engineering

# Multi-language codegen
npx tsx src/cli.ts codegen -t "build a REST API" -e web -l typescript go

# Cowork task routing
npx tsx src/cli.ts cowork-task -t "analyze sales pipeline data"
```

## Code Style

- TypeScript 5.7+, strict mode with `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`.
- Zod schemas mirror Python Pydantic v2 models. Factory functions create validated objects.
- No thrown exceptions crossing module boundaries — use `Result<T, E>`.
- Tests use vitest with direct module imports (no subprocess mocking needed for unit tests).
- Quality formula: `overall = 0.4 * completeness + 0.35 * structure + 0.25 * links`.
