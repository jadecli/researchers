# Agentdata: Token-Efficient Persisted Knowledge for Agent Sessions

> Research note from Claude Code session: 2026-03-27
> Status: **P0 — Highest priority** (paired with agentcrawls)
> Existing implementation: Neon PG18 warehouse in claude-channel-dispatch-routing/
> Database: neondb on Neon Postgres 18

## Summary

Agentdata is the persistence and retrieval layer that makes crawled knowledge
reusable across agent sessions without redundant web fetching or re-reasoning.
Where agentcrawls defines how knowledge enters the system, agentdata defines how
it's stored, queried, updated, and served to agents in a token-efficient format.

**The core problem:** Every Claude Code session starts cold. Agents re-fetch the
same documentation, re-read the same files, re-discover the same patterns. This
wastes tokens (money), time (latency), and context window (the scarcest resource).

**The solution:** Persist crawled and computed knowledge in Neon Postgres 18.
Serve it to agents via direct SQL queries or MCP tools. Update it incrementally
via ETL. Expire it based on staleness, not session boundaries.

## Why Postgres, Not Files

| Storage | Queryable | Versioned | Concurrent | Token-efficient | Shareable |
|---------|-----------|-----------|------------|-----------------|-----------|
| `.claude/memory/*.md` | No (full file read) | No | No (single session) | No (read everything) | No |
| `todos.jsonl` | Grep only | Git only | No | Partial | Git only |
| Neon PG18 | SQL + pgvector | SCD Type 2 | Yes (connection pool) | Yes (query what you need) | Yes (any agent, any session) |

The `.claude/memory/` pattern works for small, session-scoped context. Agentdata
is for the knowledge base that grows over months, is queried by multiple agents,
and needs structured updates without full rewrites.

## Architecture: Four Data Tiers

### Tier 1 — Raw Crawl Store (runtime layer, already exists)

```sql
-- runtime.crawl_events: append-only, write-optimized
-- One row per page per crawl. ~100 bytes overhead per row.
SELECT url, content_hash, quality_score, body_size, created_at
FROM runtime.crawl_events
WHERE url LIKE '%platform.claude.com%'
  AND created_at > now() - interval '24 hours';
```

**Token cost to query:** ~150 tokens (SQL) + ~200 tokens per result row
**Compared to web fetch:** ~4,000 tokens per page re-fetch

### Tier 2 — Warehouse Dimensions & Facts (reporting layer, already exists)

```sql
-- Star schema: query aggregated knowledge, not raw events
-- "What's the average quality of Anthropic docs we've crawled?"
SELECT dp.url, dp.domain, fcq.avg_quality_score, fcq.pages_crawled
FROM reporting.fact_crawl_quality fcq
JOIN reporting.dim_page dp ON dp.page_sk = fcq.page_sk
WHERE dp.is_current = true  -- SCD Type 2: current version only
  AND dp.domain = 'platform.claude.com';
```

**Token cost:** ~200 tokens query + ~100 tokens per row
**What you get:** Pre-aggregated, deduplicated, historically versioned knowledge

### Tier 3 — Semantic Metrics (semantic layer, already exists)

```sql
-- Business-meaningful questions, not data plumbing
-- "Is our crawl coverage improving?"
SELECT * FROM semantic.quality_improvement_rate;
SELECT * FROM semantic.cost_per_quality_point;
```

**Token cost:** ~50 tokens query + ~50 tokens result
**What you get:** Single-number answers to business questions

### Tier 4 — Agent-Ready Context (NEW — the agentdata contribution)

This tier doesn't exist yet. It sits between the semantic layer and agent sessions:

```sql
-- Proposed: agent-ready context views
-- Pre-formatted for injection into Claude's context window

CREATE VIEW agentdata.claude_code_context AS
SELECT
    domain,
    json_build_object(
        'summary', page_summary,           -- 1-2 sentence summary
        'key_facts', key_facts_jsonb,       -- structured facts array
        'last_crawled', last_crawl_date,
        'quality', quality_score,
        'token_estimate', char_length(page_summary) / 4
    ) AS context_payload
FROM reporting.dim_page
WHERE is_current = true
  AND quality_score >= 0.7;

-- Query: "Give me everything relevant about MCP v2 in <500 tokens"
SELECT context_payload
FROM agentdata.claude_code_context
WHERE domain = 'platform.claude.com'
  AND context_payload->>'summary' ILIKE '%mcp%'
ORDER BY (context_payload->>'quality')::float DESC
LIMIT 5;
```

**Token cost:** ~100 tokens query + exact token budget of results
**What you get:** Pre-summarized, quality-filtered, token-budgeted context

## Token Efficiency Model

The fundamental equation:

```
Cost(web_fetch) = pages × tokens_per_page × sessions_per_day × price_per_token
Cost(agentdata) = queries × tokens_per_query × sessions_per_day × price_per_token
                  + etl_cost_per_day (fixed, ~$0.01)

Savings = Cost(web_fetch) - Cost(agentdata)
```

For the researchers repo knowledge base (estimated):

| Metric | Web Fetch | Agentdata |
|--------|-----------|-----------|
| Pages in knowledge base | ~500 | ~500 |
| Tokens per access | ~4,000/page | ~200/query |
| Accesses per session | ~20 pages | ~20 queries |
| Sessions per day | ~5 | ~5 |
| Daily token cost | 400K tokens ($0.48) | 20K tokens ($0.024) |
| Monthly cost | ~$14.40 | ~$0.72 + $0.30 Neon |
| **Monthly savings** | — | **~$13.38 (93%)** |

At scale (1,000+ pages, 20+ sessions/day), savings grow superlinearly because
Neon cost is nearly fixed (scale-to-zero) while fetch cost scales linearly.

## Neon Postgres 18 Connection

```
Host:     ep-polished-queen-ameorm9q-pooler.c-5.us-east-1.aws.neon.tech
Database: neondb
User:     neondb_owner
SSL:      sslmode=require&channel_binding=require
```

**Password handling:** Set `DATABASE_URL` as an environment variable in the shell
session, not in repo secrets or cloud env config. This allows portability across
Claude Code on desktop, iOS, and web without coupling to any single secrets manager.

```bash
# Set per-session (never committed, never in .env files in git)
export DATABASE_URL="postgresql://neondb_owner:<PASSWORD>@ep-polished-queen-ameorm9q-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

For Claude Code iOS/mobile: pass via session context or MCP server configuration
where the MCP server reads from the device keychain.

## The Agentdata Contract

```yaml
# What an agentdata source declaration looks like
data_source: researchers-knowledge-base
connection: neon-pg18  # references DATABASE_URL
schema: agentdata      # Postgres schema for agent-ready views

tiers:
  raw:
    schema: runtime
    tables: [crawl_events, dispatch_events, channel_events, style_events]
    retention: 90 days
    access: write-heavy, append-only

  warehouse:
    schema: reporting
    tables: [dim_page, dim_agent, dim_round, fact_crawl_quality, fact_dispatch]
    etl_schedule: "*/15 * * * *"  # every 15 minutes
    access: read-heavy, etl-write

  semantic:
    schema: semantic
    views: [avg_crawl_quality, quality_improvement_rate, cost_per_quality_point]
    access: read-only, agent-consumable

  context:  # NEW tier
    schema: agentdata
    views: [claude_code_context, session_briefing, domain_summary]
    token_budget: configurable per query
    access: read-only, session-injectable

refresh_policy:
  raw_to_warehouse: pg_cron every 15 minutes
  warehouse_to_semantic: materialized view refresh (CONCURRENTLY)
  semantic_to_context: on-demand (view, not materialized)
```

## Integration Patterns

### Pattern 1: Session Start Briefing

The SessionStart hook already reads `next-session.md`. Agentdata extends this:

```bash
# .claude/hooks/session-setup.sh (proposed addition)
# Query Neon for session briefing instead of reading flat files
if [ -n "$DATABASE_URL" ]; then
  psql "$DATABASE_URL" -t -c "
    SELECT json_build_object(
      'stale_pages', (SELECT count(*) FROM reporting.dim_page
                      WHERE is_current AND last_crawl < now() - interval '7 days'),
      'recent_quality', (SELECT round(avg(quality_score)::numeric, 2)
                         FROM reporting.fact_crawl_quality
                         WHERE crawl_date_sk = (SELECT max(date_sk) FROM reporting.dim_date
                                                WHERE calendar_date <= current_date)),
      'pending_improvements', (SELECT count(*) FROM runtime.audit_logs
                               WHERE created_at > now() - interval '24 hours'
                               AND finding_type = 'improvement')
    );"
fi
```

### Pattern 2: MCP Server for Agent Queries

Instead of agents running SQL directly, expose agentdata via MCP:

```typescript
// Proposed: MCP tool that queries the agentdata tier
{
  name: "query_knowledge_base",
  description: "Query persisted crawl knowledge from Neon Postgres",
  input_schema: {
    domain: "string",       // e.g. "platform.claude.com"
    topic: "string",        // e.g. "MCP v2 transport"
    max_tokens: "number",   // token budget for response
  }
}
```

This is the bridge between agentdata (Postgres) and agentmemories (session context).

### Pattern 3: Incremental Knowledge Updates

When a crawl finds changed content, agentdata updates surgically:

```
1. Spider detects content_hash changed (NeonDeltaFetchMiddleware)
2. New row inserted into runtime.crawl_events
3. ETL runs: dim_page gets new SCD Type 2 row (old row: is_current=false)
4. fact_crawl_quality captures quality delta
5. semantic views auto-refresh
6. Next agent session sees updated context (no cache invalidation needed)
```

No full re-crawl. No context window wasted on unchanged content.
The SCD Type 2 pattern preserves history — you can always query what the
knowledge base looked like at any point in time.

## How Agentdata Differs From Existing Concepts

| Concept | What It Is | Agentdata Relationship |
|---------|-----------|----------------------|
| RAG (Retrieval Augmented Generation) | Embed → vector search → inject | Agentdata is the structured persistence layer RAG queries against |
| Knowledge graphs | Entity-relationship networks | Could be a Tier 4 view on top of agentdata |
| Vector databases (Pinecone, etc.) | Embedding-only storage | Neon pgvector provides this as one capability, not the whole solution |
| Data warehouses (Snowflake, etc.) | Enterprise analytics | Agentdata IS a warehouse, but purpose-built for agent token efficiency |
| `.claude/memory/` | Flat file session context | Agentdata replaces this for structured, queryable knowledge |

The key distinction: agentdata is **not just storage** — it's storage designed
around the constraint that matters most for agents: **context window tokens.**
Every design decision optimizes for minimum tokens to convey maximum knowledge.

## Relationship to Other Agent Concepts

```
agentcrawls → raw data acquisition (spiders, web, APIs)
    ↓
agentdata → structured persistence (Neon PG18, 4-tier, token-efficient)  ← THIS
    ↓
agentmemories → session-level retention (what to remember, what to forget)
    ↓
agentprompts → instruction optimization (uses persisted data for few-shot examples)
    ↓
agentevals → quality validation (evaluates both code AND data quality)
```

Agentdata is the **persistence backbone**. Agentcrawls feed it. Agentmemories
consume it. Agentprompts reference it. Agentevals validate it.

## Next Steps

1. **Create `agentdata` Postgres schema** — new migration (008) with Tier 4 views
2. **Build MCP server** for knowledge base queries (token-budgeted)
3. **Add token cost tracking** to crawl events and dispatch events
4. **Connect SessionStart hook** to Neon for dynamic session briefings
5. **Implement pgvector embeddings** on dim_page for semantic search over crawled content
