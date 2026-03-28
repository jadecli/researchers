# Agentcrawls: Agent-Directed Crawling Into Neon Postgres 18

> Research note from Claude Code session: 2026-03-27
> Status: **P0 — Highest priority**. Infrastructure exists, formalization needed.
> Existing implementation: claude-code/scrapy_researchers/, claude-channel-dispatch-routing/

## Summary

Agentcrawls formalizes the pattern of agent-directed web crawling that feeds
structured, token-efficient data into a Neon Postgres 18 knowledge base. Unlike
conventional crawlers that follow static rulesets, agentcrawls make intelligent
decisions about what to crawl, when to stop, and how to persist extracted knowledge
for reuse across agent sessions.

**This is not hypothetical.** The researchers repo already implements the core
pipeline. Agentcrawls names the pattern and defines the contract.

## Existing Infrastructure

### Spiders (claude-code/scrapy_researchers/spiders/)

| Spider | Target | Purpose |
|--------|--------|---------|
| `docs_spider.py` | code.claude.com | Claude Code documentation |
| `platform_spider.py` | platform.claude.com | Anthropic API/SDK docs |
| `anthropic_spider.py` | anthropic.com | Research and product pages |
| `claude_com_spider.py` | claude.com / claude.ai | Product pages |
| `github_spider.py` | GitHub repos | Repository documentation |
| `spotify_spider.py` | Audio/media | Specialized media content |
| `llms_full_spider.py` | Any site with llms.txt | Comprehensive sitemap-based crawl |
| `base_spider.py` | (base class) | Quality scoring, improvement loop, delta loading |

All spiders inherit from `BaseResearchSpider` with:
- DeltaFetch (change detection via content hashing in `runtime.crawl_events`)
- RFC2616 conditional requests (If-Modified-Since / If-None-Match)
- 3-stage pipeline: Dedup → Quality Scoring → Improvement Feedback
- Spidermon monitoring for validation

### Neon Postgres Integration (claude-channel-dispatch-routing/src/persistence/)

- **neon_client.py** — Thread-safe connection pool (psycopg2, RealDictCursor)
- **neon_middleware.py** — Two Scrapy middlewares:
  - `NeonDeltaFetchMiddleware` — SHA-256 content hashing, TTL-based skip, ETag/Last-Modified
  - `NeonPostgresCacheStorage` — gzip-compressed HTTP cache in Postgres
- **scrapy_settings.py** — Drop-in settings dict for Scrapy integration

### Campaign Orchestration (claude-code-agents-python/src/dspy_pipeline/)

- **crawl_adapter.py** — Routes URLs to spiders, assigns CrawlPriority (CRITICAL→LOW)
- **pipeline.py** — DSPy modules: PageClassifier, QualityScorer, SelectorProposer
- **improvement_chain.py** — Stagnation/regression detection, convergence velocity

## Neon Postgres 18 Connection

```
Host:     ep-polished-queen-ameorm9q-pooler.c-5.us-east-1.aws.neon.tech
Database: neondb
User:     neondb_owner
SSL:      sslmode=require&channel_binding=require
Password: via DATABASE_URL environment variable (NEVER committed to repo)
```

Connection string format:
```
DATABASE_URL=postgresql://neondb_owner:<PASSWORD>@ep-polished-queen-ameorm9q-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

**Security:** Password must be set via environment variable, Claude Code session
context, or secure secrets manager. Never hardcoded in source, .env files checked
into git, or repo secrets (per user requirement for portability).

## The Three-Layer Warehouse (Already Implemented)

```
Source Systems (8 Spiders + Channels + Dispatch)
        ↓
[RUNTIME LAYER] — 3NF append-only, write-optimized (OLTP)
  runtime.crawl_events    (content_hash, etag, body_size, quality_score)
  runtime.dispatch_events (input/output tokens, cost_usd, duration_ms)
  runtime.channel_events  (permission verdicts)
  runtime.audit_logs      (relevance, completeness, accuracy, safety)
  runtime.http_cache      (gzip body, headers JSON, expiry)
  runtime.style_events    (uuid PK, BRIN on created_at, hstore metadata)
        ↓
[ETL] — pg_cron every 15 minutes
  etl_crawl_events_to_warehouse()   (SCD Type 2 for dim_page)
  etl_dispatch_events_to_warehouse()
  etl_style_events_to_warehouse()
        ↓
[REPORTING LAYER] — Star schema, read-optimized (OLAP)
  dim_date, dim_page (SCD2), dim_round, dim_agent, dim_session, dim_style (SCD2)
  fact_crawl_quality (grain: page per round)
  fact_dispatch      (grain: task execution)
  fact_style_usage   (grain: style selection per session)
  mv_round_summary   (materialized view)
        ↓
[SEMANTIC LAYER] — Business metrics, agent-consumable
  avg_crawl_quality, quality_improvement_rate, total_crawl_cost,
  pages_changed, cost_per_quality_point, dispatch_success_rate,
  style_adoption_rate, popular_styles, style_switch_frequency
```

Migrations: `claude-channel-dispatch-routing/migrations/001-007`
ETL staging: `claude-channel-dispatch-routing/migrations/etl/010-060`

## What Agentcrawls Formalizes

### 1. Crawl-as-Knowledge-Acquisition (not just data extraction)

Traditional crawling: fetch page → extract fields → store rows.

Agentcrawl: fetch page → classify content → score quality → detect changes →
persist to knowledge base → update agent memory → inform next crawl decision.

The difference: every crawl iteration makes the knowledge base smarter, not just
bigger. The improvement_chain.py already implements convergence detection — crawls
stop when quality plateaus, not when pages run out.

### 2. Token-Efficient Persistence

The critical insight: **crawled data persisted in Postgres is dramatically cheaper
than re-fetching or re-reasoning about the same content.**

| Approach | Token Cost | Latency | Freshness |
|----------|-----------|---------|-----------|
| Web fetch every session | ~4K tokens per page per session | 2-10s per page | Always current |
| Re-crawl with delta detection | ~100 tokens (hash check) if unchanged | <50ms | Current within TTL |
| Read from semantic layer | ~200 tokens (SQL query + result) | <100ms | Current within ETL window |
| Agent memory reference | ~50 tokens (pointer to persisted fact) | <10ms | Depends on decay policy |

For a knowledge base of 1,000 pages queried 10 times/day:
- Web fetch: 40M tokens/day ($4.80 at Sonnet pricing)
- Postgres semantic layer: 2M tokens/day ($0.24)
- **20x cost reduction** while maintaining freshness within 15-minute ETL windows

### 3. The Agentcrawl Contract

```yaml
# What an agentcrawl declaration looks like
crawl: anthropic-docs-daily
spiders:
  - docs_spider (priority: CRITICAL, quality_threshold: 0.8)
  - platform_spider (priority: HIGH, quality_threshold: 0.7)

persistence:
  target: neon-pg18
  runtime_table: runtime.crawl_events
  warehouse_etl: etl_crawl_events_to_warehouse
  semantic_queries:
    - semantic.avg_crawl_quality
    - semantic.pages_changed

convergence:
  max_iterations: 5
  stagnation_threshold: 0.01  # stop if quality improves <1%
  regression_tolerance: 1     # max 1 consecutive regression

token_budget:
  max_per_crawl: 500000
  max_per_page: 10000

schedule: "0 6 * * *"  # daily at 6am UTC
memory_integration: agentmemories://crawl-findings
```

### 4. Neon PG18-Specific Advantages

Why Neon Postgres 18 is the right persistence target:

- **Scale-to-zero compute** — pg_cron pauses when compute suspends, resumes on wake
- **pgx_ulid** — Time-ordered UUIDs for crawl events (natural ordering without timestamp index)
- **pgvector** — Embedding storage for semantic search over crawled content
- **pg_trgm** — Fuzzy URL matching for deduplication across redirects
- **Branching** — Database branches for testing ETL changes without affecting production
- **Connection pooling** — Built-in pgbouncer-compatible pooler at the connection string level

## Integration With Other Agent Concepts

```
agentcrawls → discovers knowledge from web
    ↓
agentdata → persists in Neon PG18 (token-efficient, queryable)
    ↓
agentmemories → cross-session retention of learned facts
    ↓
agentprompts → uses persisted knowledge to optimize instructions
    ↓
agentevals → validates crawled data quality and coverage
```

Agentcrawls is the **input boundary** of the system. Everything downstream depends
on the quality and efficiency of what gets crawled and how it's persisted.

## Next Steps

1. **Formalize crawl campaign specs** as YAML declarations (the DSPy crawl_adapter
   already has `MCP_V2_NEON_CAMPAIGN` as a prototype)
2. **Add token cost tracking** to crawl events (input_tokens, output_tokens per page)
3. **Connect semantic layer to Claude Code sessions** via MCP server that queries
   Neon directly — agents get warehouse data without web fetching
4. **Implement crawl scheduling** via pg_cron or GitHub Actions with DATABASE_URL
