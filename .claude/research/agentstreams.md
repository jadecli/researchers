# Agentstreams: Unified Event Stream for Agent Activity (P0 Priority)

> Research doc: `.claude/research/agentstreams.md`
> Status: DESIGN
> Dependencies: agentdata (Tier 4), agentcrawls (runtime layer), agentcommits (trailers)
> Bus matrix: extends existing Kimball star schema with 6 new stream types

## Problem Statement

Every agent action produces data — prompts, commits, crawls, decisions, taxonomy
changes, eval findings — but they flow into isolated tables with no unified event
backbone. We cannot answer: "What happened in this session?" or "What led to this
commit?" because events are scattered across `runtime.crawl_events`,
`runtime.dispatch_events`, `runtime.audit_logs`, and ephemeral session state.

**The Gap**: 128 inputs, 30 outputs, 26 agents, 0 unified event streams.

## Solution: agentstreams

A single append-only event backbone in the `streams` schema that captures every
agent action as a typed event. Each event has a consistent envelope (who, when,
where, what) with a polymorphic payload. Consumers subscribe to event types via
semantic views — they never see the physical stream table directly.

### Design Principles

1. **Append-only**: Events are immutable facts. No UPDATE, no DELETE.
2. **Typed envelope + polymorphic payload**: Consistent header, flexible body.
3. **Causal ordering**: Events carry `session_id`, `parent_event_id`, and `sequence_number` for DAG reconstruction.
4. **Token-budgeted reads**: Semantic views pre-filter and truncate for agent consumption.
5. **Branch-aware**: Every event is tagged with `git_branch` and `git_sha` for PR-scoped queries.

## Stream Event Types

| Type | Source | Payload | Volume |
|------|--------|---------|--------|
| `prompt` | UserPromptSubmit hook | Full user prompt text, token count | ~50/session |
| `commit` | Stop hook / git post-commit | Conventional commit + trailers | ~10/session |
| `crawl` | Scrapy pipeline | URL, spider, quality score, delta | ~500/campaign |
| `decision` | Shannon thinking engine | Problem → model → proof chain | ~20/session |
| `taxonomy` | Taxonomy CRUD | Node create/update/delete events | ~10/session |
| `eval` | Eval loop (future) | Finding type, severity, score | ~50/eval run |
| `session` | SessionStart/Stop hooks | Metadata, duration, agent config | 2/session |
| `dispatch` | Multi-agent dispatch | Agent routing, token cost, result | ~30/campaign |

## Architecture

```
Source Hooks/Pipelines
        │
        ▼
┌─ RUNTIME: streams.events ───────────────────────────┐
│  Append-only. BRIN on created_at. GIN on payload.   │
│  Partitioned by month (pg_partman or native).       │
│  ~1K events/session × ~10 sessions/day = ~10K/day   │
└───────────────────────┬─────────────────────────────┘
                        │ ETL (pg_cron every 5 min)
                        ▼
┌─ REPORTING: dim_stream_type, dim_session,            │
│             fact_stream_event ───────────────────────┐
│  Star schema. Pre-joined with existing dims.        │
│  Bloom index on (stream_type, session_sk, branch).  │
└───────────────────────┬─────────────────────────────┘
                        │ Semantic views
                        ▼
┌─ SEMANTIC: session_timeline, prompt_history,         │
│            decision_trail, branch_activity ──────────┐
│  Token-budgeted. Business names only.               │
│  These are the ONLY interface for agent consumption. │
└─────────────────────────────────────────────────────┘
```

## Event Envelope Schema

Every event shares this envelope — the minimum viable event:

```sql
CREATE TABLE streams.events (
    event_id        BIGSERIAL PRIMARY KEY,      -- monotonic, ordered
    event_type      text NOT NULL,              -- prompt, commit, crawl, decision, ...
    session_id      text NOT NULL,              -- Claude Code session ID
    parent_event_id bigint,                     -- causal parent (nullable for roots)
    sequence_number integer NOT NULL DEFAULT 0, -- ordering within session
    git_branch      text,                       -- branch at time of event
    git_sha         text,                       -- HEAD sha at time of event
    agent_model     text,                       -- opus, sonnet, haiku
    agent_id        text,                       -- named agent or 'orchestrator'
    user_id         text,                       -- GitHub username or machine ID
    surface         text,                       -- cli, web, ios, vscode, jetbrains
    payload         jsonb NOT NULL,             -- typed per event_type
    token_count     integer,                    -- estimated tokens in payload
    created_at      timestamptz NOT NULL DEFAULT now()
);
```

## Payload Schemas (per event_type)

### prompt
```json
{
  "prompt_text": "full user prompt verbatim",
  "prompt_index": 1,
  "char_count": 1234,
  "word_count": 200,
  "intent_signals": ["codegen", "research", "pr"],
  "mentions_files": ["src/foo.ts", "migrations/008.sql"],
  "mentions_urls": ["https://..."]
}
```

### commit
```json
{
  "sha": "abc123",
  "message": "feat: add bloom filter module",
  "type": "feat",
  "scope": "bloom",
  "files_changed": 3,
  "insertions": 150,
  "deletions": 10,
  "trailers": {
    "agent": "claude-opus-4-6",
    "confidence": "high"
  }
}
```

### crawl
```json
{
  "url": "https://docs.anthropic.com/...",
  "spider_name": "docs_spider",
  "round_number": 3,
  "quality_score": 0.87,
  "content_changed": true,
  "content_hash": "sha256:..."
}
```

### decision
```json
{
  "step": "model",
  "problem": "Which spider to route URL to",
  "constraints": ["latency < 5s", "respect robots.txt"],
  "model": "bloom_filter_precheck → spider_selector",
  "confidence": 0.92,
  "assumptions": ["URL is reachable", "robots.txt allows"]
}
```

### taxonomy
```json
{
  "action": "CREATE",
  "node_sk": 42,
  "category": "PRODUCT",
  "subcategory": "API_TYPE",
  "label": "Claude API",
  "parent_sk": 7
}
```

### session
```json
{
  "phase": "start",
  "surface": "cli",
  "os": "linux",
  "node_version": "v22.22.0",
  "claude_code_version": "2.1.85",
  "model": "claude-opus-4-6",
  "branch": "claude/setup-multi-agent-routing-6iYl3",
  "cwd": "/home/user/researchers",
  "hook_results": {"session-setup": "ok", "tsc": "clean"}
}
```

## Lookup Hierarchy for Event Capture

Events are captured at the hook boundary — the cheapest, most deterministic point:

```
1. Claude hooks (SessionStart, Stop, UserPromptSubmit) → session, prompt events
2. Git hooks (post-commit) → commit events
3. Scrapy pipeline signals → crawl events
4. Shannon ThinkingEngine callbacks → decision events
5. Taxonomy CRUD functions → taxonomy events
6. Eval loop callbacks (future) → eval events
```

**Key**: Hooks write to a local JSONL buffer first (`~/.claude/streams/buffer.jsonl`),
then flush to Neon in batch. If Neon is unreachable, buffer accumulates and flushes
on next successful connection. No data loss.

## Integration with Existing Research Docs

| Research Doc | agentstreams Role |
|---|---|
| **agentcrawls** | `crawl` events replace direct `runtime.crawl_events` writes — events go through streams first, ETL routes to existing tables |
| **agentdata** | Tier 4 views consume `streams.events` instead of querying runtime tables directly — single source of truth |
| **agentevals** | `eval` events feed `reporting.fact_eval_finding` via ETL — evals become stream consumers |
| **agentcommits** | `commit` events capture trailers natively — no git log parsing needed |
| **agentprompts** | `prompt` events are the raw data DSPy optimizes against — prompt-result pairs from streams |
| **agentmemories** | Cross-session memory is built from stream replay — episodic memory = session event subsequences |

## Relationship to .jade/taxonomy

The taxonomy data model (`.jade/taxonomy/`) defines the classification hierarchy.
agentstreams captures taxonomy CRUD events as they happen. The bridge:

```
taxonomy DDL (static structure) ←→ streams.events WHERE event_type='taxonomy' (dynamic changes)
```

Taxonomy nodes are the nouns. Stream events are the verbs.

## Branch Memory Contract

Each session writes a branch-scoped manifest to `.claude/memory/streams/<branch>.json`:

```json
{
  "branch": "claude/setup-multi-agent-routing-6iYl3",
  "session_id": "af837890-...",
  "last_event_id": 1042,
  "event_counts": {
    "prompt": 26,
    "commit": 6,
    "session": 2
  },
  "last_flushed_at": "2026-03-28T14:00:00Z",
  "neon_synced": true
}
```

This manifest is read at SessionStart to resume event numbering and detect gaps.

## Token Budget Analysis

| Query | Tokens (streams) | Tokens (raw) | Savings |
|-------|------------------|---------------|---------|
| "What happened this session?" | ~500 (timeline view) | ~15,000 (grep logs) | 97% |
| "What prompts led to this commit?" | ~200 (causal chain) | ~5,000 (file reads) | 96% |
| "Quality trend across branches" | ~100 (semantic metric) | ~3,000 (SQL joins) | 97% |

## Implementation Phases

### Phase 1 (this PR): Foundation
- [x] Research doc (this file)
- [ ] `streams.events` DDL (migration 008)
- [ ] Prompt capture hook (UserPromptSubmit → buffer → Neon)
- [ ] Session metadata hook (SessionStart → streams)
- [ ] Branch memory manifest (`.claude/memory/streams/`)
- [ ] Local JSONL buffer for offline resilience

### Phase 2 (next PR): Reporting + Semantic
- [ ] `dim_stream_type`, `dim_session` dimensions
- [ ] `fact_stream_event` fact table
- [ ] ETL from `streams.events` → reporting star schema
- [ ] Semantic views: `session_timeline`, `prompt_history`
- [ ] Connect to agentdata Tier 4

### Phase 3 (future): Full Integration
- [ ] Crawl pipeline → streams (replace direct runtime writes)
- [ ] Shannon decision callbacks → streams
- [ ] Taxonomy CRUD → streams
- [ ] Eval loop → streams
- [ ] DSPy optimization from prompt event pairs
- [ ] Real-time subscriptions via Neon logical replication

## Anti-Patterns

1. **Never query streams.events directly from agent code** — use semantic views
2. **Never UPDATE or DELETE stream events** — append-only, immutable facts
3. **Never block on Neon writes** — buffer locally, flush async
4. **Never store full response bodies in payload** — store references, not content
5. **Never skip the envelope** — every event must have session_id, event_type, created_at
