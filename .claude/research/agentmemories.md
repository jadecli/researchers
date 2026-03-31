# Agentmemories: Cross-Session Knowledge Persistence

> Research note from Claude Code session: 2026-03-29
> Status: **P1** — Depends on agentdata (P0) and agentstreams (P0)
> Existing state: `.claude/memory/` flat files (9 documents, ~15KB total)
> Target state: Structured persistence in Neon PG18 via agentdata Tier 4

## Summary

Every Claude Code session starts cold. Agents re-discover codebase patterns,
re-read the same feedback, re-learn the same preferences, re-make the same
mistakes. Agentmemories defines how knowledge is retained, consolidated,
decayed, and served across sessions — turning ephemeral session context into
durable organizational knowledge.

**The core problem:** `.claude/memory/` flat files are session-scoped, not
queryable, not versioned, and not token-efficient. An agent reading `MEMORY.md`
(~2,000 tokens) gets everything — relevant or not. An agent querying
agentmemories would get the 5 most relevant memories in ~200 tokens.

**The solution:** Three memory types with different decay rates, consolidated
via pgvector similarity, served via agentdata Tier 4 views, and refreshed by
agentstreams event capture.

## Why Memories Are Different From Data

| Concept | Agentdata | Agentmemories |
|---------|-----------|---------------|
| Source | External: crawled pages, changelogs | Internal: agent decisions, feedback, patterns |
| Lifespan | Indefinite (versioned via SCD Type 2) | Decaying (exponential half-life) |
| Updates | ETL batch (every 15 min) | Real-time (per session event) |
| Query pattern | "What docs exist about MCP?" | "What worked last time I debugged this?" |
| Token cost | ~200/query (pre-aggregated) | ~40/memory (single fact) |

Agentdata is the **knowledge base**. Agentmemories is the **experience base**.

## Current State: Flat Files

The `.claude/memory/` directory contains 9 flat files:

```
memory/
├── MEMORY.md                          # Central index (~200 tokens)
├── next-session.md                    # Carryover context (~2,000 tokens)
├── feedback_autonomous.md             # User preference: be opinionated
├── feedback_mcp_auth_patterns.md      # Debug MCP via .mcp.json, not OAuth
├── feedback_v2185_optimizations.md    # Top 5 latency/codegen ROI actions
├── reference_mcp_architecture.md      # 5 local servers, 5 plugins
├── reference_mcp_v2_neon_pg18.md      # Neon PG18 features
├── project_channel_dispatch.md        # Channel dispatch routing plan
├── extractions/                       # Parsed content from crawls
└── streams/                           # Agentstreams event buffer
    ├── buffer.jsonl
    └── <branch>.json
```

### Limitations

1. **Not queryable**: Must read entire file to find one fact
2. **Not versioned**: Overwrites lose history (no SCD, no diff)
3. **Not concurrent**: Single session at a time (no file locks)
4. **Not token-efficient**: Read everything or nothing (no partial queries)
5. **Not decaying**: Stale memories persist indefinitely until manually cleaned
6. **Not typed**: No schema validation, no structured metadata
7. **Session-scoped**: Lost on session end unless manually written to next-session.md

## Three Memory Types

### 1. Episodic Memory — What Happened

Session events: commits made, tools used, errors hit, decisions taken.

- **Source**: agentstreams `buffer.jsonl` events (types: prompt, commit, decision, dispatch)
- **Decay**: Fast — 7-day half-life (λ = 0.099)
- **Example**: "In session X, debugging the pre-commit hook failure was resolved by
  fixing line 40 syntax error in `.git/hooks/pre-commit`"
- **Value**: Prevents repeating the same debugging sequence across sessions

```sql
-- Episodic: recent session decisions
INSERT INTO runtime.memory_events (memory_type, content, source, decay_lambda, tags)
VALUES ('episodic',
  'Pre-commit hook line 40 syntax error: "0 0: syntax error in expression". Fixed by removing arithmetic eval.',
  'agentstreams:session:abc123',
  0.099,
  ARRAY['debugging', 'pre-commit', 'hooks']);
```

### 2. Semantic Memory — What Is True

Factual knowledge: API behaviors, codebase patterns, domain facts, architecture decisions.

- **Source**: agentcrawls (crawled docs), agentdata (doc_pins), manual annotations
- **Decay**: Slow — 90-day half-life (λ = 0.0077)
- **Example**: "The `next/font/google` import causes HTTP 403 in Vercel build
  environments. Use `next/font/local` with bundled woff2 files instead."
- **Value**: Prevents re-discovering known facts via expensive web fetches

```sql
-- Semantic: architectural knowledge
INSERT INTO runtime.memory_events (memory_type, content, source, decay_lambda, tags)
VALUES ('semantic',
  'next/font/google fails with HTTP 403 in Vercel builds. Use next/font/local with woff2 in agenttasks/public/.',
  'agentcrawls:vercel-docs',
  0.0077,
  ARRAY['nextjs', 'fonts', 'vercel', 'build']);
```

### 3. Procedural Memory — What Works

How-to patterns: preferred approaches, successful tool sequences, error resolution steps.

- **Source**: feedback files, successful tool call sequences from agentstreams,
  repeated patterns (episodic → procedural promotion)
- **Decay**: Medium — 30-day half-life (λ = 0.023)
- **Example**: "When the user asks to create a PR, always run `npm run build`
  in agenttasks first, check for uncommitted changes, then use conventional
  commit format."
- **Value**: Encodes "how we do things here" without re-learning each session

```sql
-- Procedural: workflow pattern
INSERT INTO runtime.memory_events (memory_type, content, source, decay_lambda, tags)
VALUES ('procedural',
  'PR workflow: 1) npm run build in agenttasks, 2) check uncommitted changes, 3) conventional commit, 4) push, 5) create PR with gh.',
  'feedback:autonomous',
  0.023,
  ARRAY['workflow', 'pr', 'git', 'conventions']);
```

## Decay Model

Memories decay exponentially over time, but access refreshes them:

```
relevance(t) = initial_relevance × e^(-λ × days_since_last_access)
```

| Memory Type | λ (decay rate) | Half-life | 90% decay |
|-------------|---------------|-----------|-----------|
| Episodic | 0.099 | 7 days | 23 days |
| Semantic | 0.0077 | 90 days | 300 days |
| Procedural | 0.023 | 30 days | 100 days |

### Access-Based Refresh

Each time a memory is retrieved (queried by an agent), the `last_accessed`
timestamp resets, effectively restarting the decay clock. Frequently accessed
memories never decay. Unused memories naturally expire.

```sql
-- On retrieval, refresh the memory
UPDATE runtime.memory_events
SET last_accessed = now(),
    access_count = access_count + 1
WHERE id = $1;
```

### Thresholds

- **Consolidation eligible**: relevance < 0.3 (memory is fading, merge with similar)
- **Deletion eligible**: relevance < 0.1 (memory is nearly forgotten, safe to purge)
- **Active**: relevance >= 0.3 (memory is fresh enough to serve)

## Consolidation

When multiple memories are similar and fading, consolidation merges them:

### Similarity Detection

Using pgvector cosine similarity on embedded memory content:

```sql
-- Find similar memories eligible for consolidation
SELECT a.id AS memory_a, b.id AS memory_b,
       1 - (a.embedding <=> b.embedding) AS cosine_similarity
FROM runtime.memory_events a
JOIN runtime.memory_events b ON a.id < b.id
WHERE a.memory_type = b.memory_type
  AND 1 - (a.embedding <=> b.embedding) > 0.85
  AND a.relevance < 0.3 AND b.relevance < 0.3;
```

### Conflict Resolution

When similar memories disagree (e.g., contradictory facts), resolve by:

1. **Recency**: More recent memory wins (newer observations supersede older)
2. **Frequency**: Higher access_count wins (more frequently used = more validated)
3. **Source authority**: Crawled docs > feedback > episodic events

### Promotion Rules

Memories can be promoted across types when patterns emerge:

1. **Episodic → Semantic**: When the same fact appears in 3+ sessions
   (e.g., "the pre-commit hook has a syntax error" → "pre-commit hook line 40 is fragile")
2. **Semantic → Procedural**: When knowledge becomes actionable
   (e.g., "next/font/google fails" → "always use next/font/local with woff2")
3. **Procedural → Feedback**: When a workflow is validated by user feedback
   (e.g., user says "good approach" after following the PR workflow)

## Schema

```sql
-- New table in runtime schema (migration 011, future)
CREATE TABLE runtime.memory_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_type     text NOT NULL CHECK (memory_type IN ('episodic', 'semantic', 'procedural')),
    session_id      text,                   -- originating Claude Code session
    content         text NOT NULL,          -- the memory itself (natural language)
    content_hash    text NOT NULL,          -- SHA-256 for dedup
    relevance       real NOT NULL DEFAULT 1.0 CHECK (relevance >= 0 AND relevance <= 1),
    access_count    integer NOT NULL DEFAULT 0,
    last_accessed   timestamptz DEFAULT now(),
    source          text NOT NULL,          -- agentstreams:event_id, agentcrawls:url, feedback:file
    tags            text[] NOT NULL DEFAULT '{}',
    embedding       vector(1536),           -- pgvector for similarity search
    decay_lambda    real NOT NULL,          -- per-type decay rate
    consolidated_from uuid[],              -- IDs of memories merged into this one
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_memory_type ON runtime.memory_events (memory_type);
CREATE INDEX idx_memory_relevance ON runtime.memory_events (relevance) WHERE relevance > 0.1;
CREATE INDEX idx_memory_tags ON runtime.memory_events USING gin (tags);
CREATE INDEX idx_memory_created ON runtime.memory_events USING brin (created_at);

-- pgvector index for similarity search (IVFFlat, 100 lists)
CREATE INDEX idx_memory_embedding ON runtime.memory_events
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Dedup index
CREATE UNIQUE INDEX idx_memory_content_hash ON runtime.memory_events (content_hash)
    WHERE relevance > 0.1;
```

### Reporting Layer

```sql
-- Dimension: memory type
CREATE TABLE reporting.dim_memory_type (
    memory_type_sk  serial PRIMARY KEY,
    memory_type     text NOT NULL UNIQUE,
    decay_lambda    real NOT NULL,
    half_life_days  real NOT NULL,
    description     text
);

INSERT INTO reporting.dim_memory_type (memory_type, decay_lambda, half_life_days, description)
VALUES
    ('episodic',   0.099, 7,  'Session events: what happened'),
    ('semantic',   0.0077, 90, 'Factual knowledge: what is true'),
    ('procedural', 0.023, 30, 'How-to patterns: what works');

-- Fact: memory access
-- GRAIN: one row per memory access event
CREATE TABLE reporting.fact_memory_access (
    access_sk       bigserial PRIMARY KEY,
    memory_id       uuid NOT NULL,
    memory_type_sk  integer NOT NULL REFERENCES reporting.dim_memory_type(memory_type_sk),
    date_sk         integer NOT NULL REFERENCES reporting.dim_date(date_sk),
    relevance_at_access real NOT NULL,
    access_count_at  integer NOT NULL,
    was_consolidated boolean NOT NULL DEFAULT false
);
```

### Semantic Layer

```sql
-- Business metric: memory health
CREATE VIEW semantic.memory_coverage AS
SELECT
    mt.memory_type,
    count(*) AS total_memories,
    count(*) FILTER (WHERE me.relevance >= 0.3) AS active_memories,
    count(*) FILTER (WHERE me.relevance < 0.3 AND me.relevance >= 0.1) AS fading_memories,
    count(*) FILTER (WHERE me.relevance < 0.1) AS expired_memories,
    round(avg(me.relevance)::numeric, 3) AS avg_relevance,
    round(avg(me.access_count)::numeric, 1) AS avg_access_count
FROM runtime.memory_events me
JOIN reporting.dim_memory_type mt ON mt.memory_type = me.memory_type
GROUP BY mt.memory_type
ORDER BY mt.memory_type;

-- Business metric: consolidation effectiveness
CREATE VIEW semantic.memory_consolidation_rate AS
SELECT
    memory_type,
    count(*) FILTER (WHERE consolidated_from IS NOT NULL) AS consolidated,
    count(*) AS total,
    round(
        count(*) FILTER (WHERE consolidated_from IS NOT NULL)::numeric /
        NULLIF(count(*), 0), 3
    ) AS consolidation_rate
FROM runtime.memory_events
GROUP BY memory_type;
```

## Migration Path

### Phase 1: Structured Metadata (Current PR scope)

Continue using flat files. Add YAML frontmatter to each memory file:

```yaml
---
memory_type: procedural
tags: [workflow, pr, git]
created: 2026-03-28
last_accessed: 2026-03-29
access_count: 5
relevance: 0.85
---
When creating a PR, always run `npm run build` first...
```

### Phase 2: Dual-Write

Write to both flat files and `runtime.memory_events` via the SessionStart hook:

```bash
# In session-setup.sh (when DATABASE_URL is set)
# Parse memory files, INSERT into Neon, query back for session context
```

### Phase 3: Primary Neon

SessionStart queries Neon for top-k relevant memories. Flat files become
backup/offline fallback only.

### Phase 4: Full Neon

Flat files deprecated. All memory operations through agentdata Tier 4 views.
`.claude/memory/` directory becomes a thin cache with auto-expiry.

## Integration With Agent Concepts

```
agentcrawls → new knowledge discovered → SEMANTIC memory created
    ↓
agentstreams → session events captured → EPISODIC memory created
    ↓
agentdata → Tier 4 views serve memories → token-efficient retrieval
    ↓
agentevals → validates memory quality → prevents stale/conflicting memories
    ↓
agentprompts → uses memories as few-shot examples → PROCEDURAL memory consumed
    ↓
agentcommits → commit metadata enriches EPISODIC memories
```

## Token Efficiency Model

| Access Pattern | Flat Files | Agentmemories |
|---------------|-----------|---------------|
| Read all memory | ~2,000 tokens | N/A (never reads all) |
| Query relevant memories | ~2,000 tokens (read everything) | ~200 tokens (top-5 query) |
| Queries per session | ~20 | ~20 |
| Sessions per day | ~5 | ~5 |
| Daily token cost (memory) | 200K tokens ($0.24) | 20K tokens ($0.024) |
| Monthly savings | — | **~$6.48 (90%)** |

The savings compound with agentdata: together, agentdata + agentmemories
eliminate ~95% of redundant token usage from cold-start context loading.

## Next Steps

1. **Phase 1**: Add YAML frontmatter to existing flat files (this session)
2. **Migration 011**: Create `runtime.memory_events` table with pgvector
3. **Memory writer**: Build in claude-multi-agent-dispatch (captures findings as memories)
4. **SessionStart integration**: Query top-k relevant memories when `DATABASE_URL` set
5. **Decay cron**: pg_cron job to update relevance scores daily
6. **Consolidation worker**: Weekly merge of similar fading memories
7. **Promotion detector**: Identify episodic→semantic and semantic→procedural patterns
