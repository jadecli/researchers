# @jadecli/devops-review

DevOps PR review engine shared by Claude Code (agent) and Claude Cowork (skill).

## Quick Start

```bash
# Install
cd devops-review && npm install

# Type check
npm run build

# Run 90-assertion test suite
npm run test

# Full CI (build + test)
npm run ci
```

## Architecture

```
devops-review/
├── schemas/pr-review.xsd        # XML schema for PR review input
├── rules/team-decisions.xml     # 12 team decision rules (TD-001..TD-012)
├── context/                     # 14 reference docs (00-index.md entry point)
├── templates/                   # Cowork deliverable templates
│   ├── cowork-scheduled-task.md
│   ├── daily-briefing.md
│   └── pr-review-report.md
└── src/
    ├── types.ts                 # Branded types, typed interfaces
    ├── xml-generator.ts         # XML generation from GitHub PR data
    ├── review-engine.ts         # Pure review logic (no I/O)
    ├── orchestrator.ts          # Multi-PR fan-out/fan-in
    ├── bloom-dedup.ts           # BloomFilter check deduplication (mnemonist)
    ├── programmatic-review.ts   # DSPy-style enum classification + context deltas
    ├── connectors.ts            # MCP connector configs (5 services)
    ├── run.ts                   # CLI entry point
    └── test.ts                  # 90-assertion test suite
```

## How to USE

### Claude Code (agent)

```bash
# Direct CLI review
npx tsx devops-review/src/run.ts

# Via the devops-reviewer agent
claude --agent devops-reviewer
```

The agent uses GitHub MCP tools to fetch open PRs, generates typed XML per PR,
runs each through the review engine, and posts results as PR comments.

### Claude Cowork (skill)

From Cowork, use natural language:

> "Review all open PRs and tell me what needs attention"
> "Every morning at 9am, review open PRs and send me a briefing"

The skill wraps the same engine but adds an approval gate before posting comments.

## How to BUILD

Deterministic build — zero config beyond `npm install`:

```bash
# 1. Install (lockfile-pinned)
npm install

# 2. Type check (strict mode, no any, noUncheckedIndexedAccess)
npm run build
# Equivalent: tsc --noEmit

# 3. Lint (same as build — TypeScript IS the linter)
npm run lint
```

**Build prerequisites**: Node.js 20+, npm 10+.

**No transpilation step**. Source runs directly via `tsx`. The `tsc --noEmit` build
step validates types without producing artifacts. This is deliberate: the review
engine runs as a subprocess or is imported directly by the agent/skill.

## How to TEST

```bash
# Run the full suite
npm run test
# Equivalent: npx tsx src/test.ts

# Full CI pipeline
npm run ci
# Equivalent: npm run build && npm run test
```

### Test coverage (90 assertions across 21 groups)

| # | Group | Assertions | What it validates |
|---|-------|------------|-------------------|
| 1 | Team Decision Loading | 5 | Parses 12 decisions from XML |
| 2 | Check Inference — TS | 6 | Branded types, Result, strict, deps, tests, security |
| 3 | Check Inference — Python | 3 | Naming conventions, no false TS checks |
| 4 | Check Inference — SQL | 1 | Kimball layer compliance |
| 5 | Check Inference — Agents | 1 | Agent definition format |
| 6 | XML Generation | 9 | Full XML structure, escaping, attributes |
| 7 | Review — All Pass | 4 | Approve verdict, zero blockers |
| 8 | Review — Blocker | 3 | Request-changes verdict |
| 9 | Review — Warning | 2 | Comment verdict |
| 10 | Multi-PR Cross Analysis | 5 | Cross-PR findings, executive summary |
| 11 | Cowork Deliverable | 5 | Format, approval gate, action items |
| 12 | Cowork — No Blockers | 2 | No approval when clean |
| 13 | Connector Config | 5 | 5 connectors, surface filtering |
| 14 | BloomFilter Dedup | 6 | Seen/unseen, array dedup, stats |
| 15 | Multi-PR Dedup | 3 | Cross-PR dedup, stats |
| 16 | Risk Classification | 4 | TRIVIAL/LOW/HIGH/CRITICAL enum mapping |
| 17 | Scope Classification | 3 | TESTS_ONLY/DATA_MODEL/DOCUMENTATION |
| 18 | Urgency Classification | 4 | IMMEDIATE/SAME_DAY/INFORMATIONAL/NEXT_SPRINT |
| 19 | Context Delta | 8 | New/recurring/resolved patterns, trajectory |
| 20 | Improvement Chain | 6 | Convergence, chain state, JSONL output |
| 21 | Typed Review Summary | 5 | BAML-style structured output |

## Dogfooded Patterns

This module reuses patterns from elsewhere in the monorepo:

### 1. mnemonist BloomFilter (from `crawlee-crawler.ts`)

```
Source:  claude-code-agents-typescript/src/crawlers/crawlee-crawler.ts
Usage:   bloom-dedup.ts — CheckDeduplicator class
Pattern: probabilistic membership testing for deduplication
```

In crawlee-crawler.ts, BloomFilter deduplicates URLs across crawl rounds.
Here, it deduplicates check findings across multi-PR reviews so the same
violation isn't reported twice when PRs overlap.

### 2. BAML-style Enum Classification (from `baml-extractor.ts`)

```
Source:  claude-code-agents-typescript/src/crawlers/baml-extractor.ts
Usage:   programmatic-review.ts — classifyRisk, classifyScope, classifyUrgency
Pattern: deterministic enum mapping from unstructured input
```

baml-extractor.ts uses `classifyIndustry()` and `classifyTier()` to map raw
text to typed enums. programmatic-review.ts uses the same pattern:
`classifyRisk()` maps findings to `PRRiskLevel` enum,
`classifyScope()` maps diffs to `ChangeScope` enum.

### 3. DSPy-style Context Deltas (from `campaign.py`)

```
Source:  claude-code-agents-python/src/orchestrator/campaign.py
Usage:   programmatic-review.ts — ReviewContextDelta, ReviewImprovementChain
Pattern: steering payload between iterative rounds
```

campaign.py's `ContextDelta` steers the next crawl round based on the previous
round's quality scores. `ReviewContextDelta` steers the next review round based
on which violations are new, recurring, or resolved.

### 4. Boris Cherny Branded Types (from `claude-multi-agent-sdk`)

```
Source:  claude-multi-agent-sdk/src/types.ts
Usage:   types.ts — PRNumber, CheckId, DecisionId
Pattern: compile-time ID safety via phantom branding
```

## Team Decision Rules

The engine validates PRs against 12 team decisions from `ARCHITECTURE.md`:

| ID | Category | Rule |
|----|----------|------|
| TD-001 | branded-types | Boris Cherny Brand<K,T> for all IDs |
| TD-002 | result-pattern | Result<T,E> — no thrown exceptions |
| TD-003 | kimball-compliance | Runtime/Reporting/Semantic separation |
| TD-004 | type-safety | Strict TS, no any, readonly everywhere |
| TD-005 | architectural-consistency | JSONL logging for all events |
| TD-006 | test-coverage | All new code must include tests |
| TD-007 | security | No hardcoded credentials or PII |
| TD-008 | naming-conventions | snake_case (Python), camelCase (TS) |
| TD-009 | architectural-consistency | MCP servers use @mcp/sdk + Zod |
| TD-010 | architectural-consistency | Agent defs: YAML frontmatter |
| TD-011 | dependency-hygiene | No floating versions |
| TD-012 | architectural-consistency | Context delta steering |

## MCP Connectors

| Connector | Required | Role |
|-----------|----------|------|
| GitHub | Yes | Read PRs, diffs, post comments |
| Slack | No | Post summaries to team channel |
| Linear | No | Create issues for blockers |
| Vercel | No | Check deployment preview status |
| Supabase | No | Validate migration SQL |
