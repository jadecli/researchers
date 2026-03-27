---
paths: ["**/*.ts", "**/*.py", "**/*.sql", "**/*.rs", "**/*.go"]
---

# Ralph Kimball Data Architecture Layer

All code in this repo operates across three strictly separated runtime layers.
Every type, function, and module must declare which layer it belongs to.
Cross-layer access follows the bus architecture — never skip a layer.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SEMANTIC LAYER (Consumption)                     │
│  Business-meaningful names. No physical schema leaks.              │
│  Consumers see: metrics, dimensions, facts, grain declarations.    │
│  This layer is the CONTRACT — it never changes for physical        │
│  reasons, only for business reasons.                               │
├─────────────────────────────────────────────────────────────────────┤
│                    REPORTING LAYER (Presentation)                   │
│  Star schemas. Conformed dimensions. Pre-aggregated fact tables.   │
│  Optimized for read — denormalized, wide, indexed for scan.        │
│  Materialized views, summary tables, OLAP cubes.                   │
│  Changes here do NOT propagate up to the semantic layer.           │
├─────────────────────────────────────────────────────────────────────┤
│                    RUNTIME LAYER (Operational)                      │
│  Normalized 3NF. Event streams. OLTP writes. Append-only logs.     │
│  Optimized for write — narrow, highly normalized, constraint-rich. │
│  This is where crawlers, dispatchers, and agents write data.       │
│  Changes here flow DOWN from source systems, never UP.             │
└─────────────────────────────────────────────────────────────────────┘
```

## Layer Definitions

### Runtime Layer (`src/**/runtime/` or `_raw` / `_staging` schemas)

The operational write path. This is where Scrapy pipelines, dispatch agents,
channel servers, and audit loggers write data as events happen.

**Kimball mapping**: Staging area + Operational Data Store (ODS)

**Rules**:
- Tables are **append-only** or **slowly-changing** (SCD Type 2)
- Every row has: `_id` (pg_uuidv7), `_created_at` (timestamptz), `_source` (text)
- Normalized to 3NF minimum — no redundant data
- Foreign keys enforced, constraints tight
- Indexes optimized for point lookups and range scans on `_created_at`
- **No business logic** in this layer — it records what happened, not what it means

```sql
-- Runtime: crawl events as they happen
CREATE TABLE runtime.crawl_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url             text NOT NULL,
    spider_name     text NOT NULL,
    response_status smallint,
    content_hash    bytea,          -- SHA-256 for change detection
    headers_etag    text,           -- For If-None-Match
    headers_lmod    timestamptz,    -- For If-Modified-Since
    body_size       integer,
    quality_score   real,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crawl_events_url_hash ON runtime.crawl_events (url, content_hash);
CREATE INDEX idx_crawl_events_created ON runtime.crawl_events USING brin (created_at);
```

**TypeScript type** (branded):
```typescript
// src/types/runtime.ts
type RuntimeRecord = {
    readonly _id: RecordId;
    readonly _created_at: Date;
    readonly _source: string;
};

type CrawlEvent = RuntimeRecord & {
    readonly url: string;
    readonly spiderName: string;
    readonly responseStatus: number;
    readonly contentHash: string;
    readonly qualityScore: number;
};
```

### Reporting Layer (`src/**/reporting/` or `reporting` / `warehouse` schemas)

The analytical read path. Star schema design — dimension tables + fact tables.
ETL/ELT transforms runtime data into reporting structures.

**Kimball mapping**: Dimensional model (star schema / snowflake)

**Rules**:
- **Fact tables** contain measures (counts, sums, averages) at a declared grain
- **Dimension tables** contain descriptive attributes for filtering/grouping
- Every fact table has a **grain declaration** comment: what one row represents
- Conformed dimensions shared across fact tables via **bus matrix**
- Surrogate keys (`_sk` suffix) — never expose natural keys to consumers
- Pre-aggregated summary tables for common query patterns
- **No writes from application code** — only ETL pipelines write here

```sql
-- Dimension: pages we've crawled (SCD Type 2)
CREATE TABLE reporting.dim_page (
    page_sk         serial PRIMARY KEY,     -- surrogate key
    url             text NOT NULL,
    domain          text NOT NULL,
    page_type       text,                   -- doc, research, news, api, plugin
    first_seen      timestamptz,
    last_seen       timestamptz,
    is_current      boolean DEFAULT true,
    valid_from      timestamptz NOT NULL DEFAULT now(),
    valid_to        timestamptz DEFAULT '9999-12-31'::timestamptz
);

-- Dimension: crawl rounds
CREATE TABLE reporting.dim_round (
    round_sk        serial PRIMARY KEY,
    round_number    smallint NOT NULL,
    round_name      text NOT NULL,
    goal            text,
    quality_threshold real,
    started_at      timestamptz,
    completed_at    timestamptz
);

-- Dimension: agents
CREATE TABLE reporting.dim_agent (
    agent_sk        serial PRIMARY KEY,
    agent_id        text NOT NULL,
    agent_name      text NOT NULL,
    model           text,                   -- opus, sonnet, haiku
    capabilities    jsonb                   -- capability vector
);

-- Fact: crawl quality measurements
-- GRAIN: one row per page per crawl round
CREATE TABLE reporting.fact_crawl_quality (
    crawl_quality_sk    bigserial PRIMARY KEY,
    page_sk             integer REFERENCES reporting.dim_page(page_sk),
    round_sk            integer REFERENCES reporting.dim_round(round_sk),
    agent_sk            integer REFERENCES reporting.dim_agent(agent_sk),
    date_sk             integer,            -- FK to date dimension
    completeness_score  real,
    structure_score     real,
    accuracy_score      real,
    coherence_score     real,
    safety_score        real,
    overall_score       real,
    token_cost_usd      numeric(10,6),
    extraction_duration_ms integer,
    content_changed     boolean,            -- did content differ from prior crawl?
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- Fact: dispatch events
-- GRAIN: one row per dispatch task execution
CREATE TABLE reporting.fact_dispatch (
    dispatch_sk         bigserial PRIMARY KEY,
    round_sk            integer REFERENCES reporting.dim_round(round_sk),
    agent_sk            integer REFERENCES reporting.dim_agent(agent_sk),
    date_sk             integer,
    task_type           text,               -- simple, parallel, sequential
    platform            text,               -- cli, github_actions, chrome, slack
    quality_score       real,
    input_tokens        integer,
    output_tokens       integer,
    cost_usd            numeric(10,6),
    duration_ms         integer,
    success             boolean,
    created_at          timestamptz NOT NULL DEFAULT now()
);
```

**TypeScript type**:
```typescript
// src/types/reporting.ts
type SurrogateKey = Brand<number, 'SurrogateKey'>;

type FactCrawlQuality = {
    readonly crawlQualitySk: SurrogateKey;
    readonly pageSk: SurrogateKey;
    readonly roundSk: SurrogateKey;
    readonly agentSk: SurrogateKey;
    readonly completenessScore: number;
    readonly structureScore: number;
    readonly accuracyScore: number;
    readonly overallScore: number;
    readonly tokenCostUsd: USD;
    readonly contentChanged: boolean;
};
```

### Semantic Layer (`src/**/semantic/` or exposed via API/MCP)

The business contract. This layer defines metrics and dimensions in
business-meaningful terms. Consumers (dashboards, reports, skills, agents)
ONLY see semantic definitions — never physical tables.

**Kimball mapping**: Business process dimensional model + metric definitions

**Rules**:
- Every metric has: `name`, `description`, `formula`, `grain`, `dimensions`
- Metrics are **additive**, **semi-additive**, or **non-additive** — declared explicitly
- Dimensions have **hierarchies** (e.g., domain → page_type → page)
- **No SQL** in this layer — only metric definitions and dimension descriptions
- Changes to semantic layer require business justification, not technical
- This layer is the **API contract** — breaking changes require versioning

```typescript
// src/types/semantic.ts

type Additivity = 'additive' | 'semi_additive' | 'non_additive';

type MetricDefinition = {
    readonly name: string;
    readonly description: string;
    readonly formula: string;           // e.g., "SUM(overall_score) / COUNT(*)"
    readonly grain: string;             // e.g., "one row per page per round"
    readonly additivity: Additivity;
    readonly dimensions: ReadonlyArray<string>;
    readonly unit: string;              // e.g., "score_0_to_1", "usd", "count"
};

type DimensionDefinition = {
    readonly name: string;
    readonly description: string;
    readonly hierarchy: ReadonlyArray<string>;  // e.g., ["domain", "page_type", "url"]
    readonly attributes: ReadonlyArray<string>;
};

// ── Metric Catalog ──────────────────────────────────────────
const METRICS: ReadonlyArray<MetricDefinition> = [
    {
        name: 'average_crawl_quality',
        description: 'Average extraction quality score across all pages in a round',
        formula: 'AVG(fact_crawl_quality.overall_score)',
        grain: 'one value per round',
        additivity: 'non_additive',
        dimensions: ['round', 'page_type', 'agent'],
        unit: 'score_0_to_1',
    },
    {
        name: 'quality_improvement_rate',
        description: 'Rate of quality improvement between consecutive rounds',
        formula: '(current_round.avg_quality - prior_round.avg_quality) / prior_round.avg_quality',
        grain: 'one value per round transition',
        additivity: 'non_additive',
        dimensions: ['round'],
        unit: 'percentage',
    },
    {
        name: 'total_crawl_cost',
        description: 'Total token cost in USD for all dispatches in a round',
        formula: 'SUM(fact_dispatch.cost_usd)',
        grain: 'one value per round',
        additivity: 'additive',
        dimensions: ['round', 'agent', 'platform', 'task_type'],
        unit: 'usd',
    },
    {
        name: 'pages_changed',
        description: 'Count of pages whose content changed since prior crawl',
        formula: 'COUNT(*) WHERE fact_crawl_quality.content_changed = true',
        grain: 'one value per round',
        additivity: 'additive',
        dimensions: ['round', 'page_type', 'domain'],
        unit: 'count',
    },
    {
        name: 'cost_per_quality_point',
        description: 'USD cost per 0.01 improvement in quality score',
        formula: 'total_crawl_cost / (quality_improvement_rate * 100)',
        grain: 'one value per round transition',
        additivity: 'non_additive',
        dimensions: ['round'],
        unit: 'usd_per_point',
    },
    {
        name: 'dispatch_success_rate',
        description: 'Percentage of dispatch tasks that completed successfully',
        formula: 'COUNT(*) WHERE success = true / COUNT(*)',
        grain: 'one value per round per platform',
        additivity: 'non_additive',
        dimensions: ['round', 'platform', 'agent', 'task_type'],
        unit: 'percentage',
    },
    {
        name: 'convergence_velocity',
        description: 'Number of rounds needed to reach quality threshold',
        formula: 'MIN(round_number) WHERE overall_score >= quality_threshold',
        grain: 'one value per quality threshold',
        additivity: 'non_additive',
        dimensions: ['quality_threshold'],
        unit: 'rounds',
    },
];

// ── Dimension Catalog ───────────────────────────────────────
const DIMENSIONS: ReadonlyArray<DimensionDefinition> = [
    {
        name: 'page',
        description: 'Crawled documentation pages across all Anthropic domains',
        hierarchy: ['domain', 'page_type', 'url'],
        attributes: ['first_seen', 'last_seen', 'is_current'],
    },
    {
        name: 'round',
        description: 'Iterative crawl rounds (1-10) with escalating quality thresholds',
        hierarchy: ['round_number'],
        attributes: ['round_name', 'goal', 'quality_threshold', 'started_at', 'completed_at'],
    },
    {
        name: 'agent',
        description: 'AI agents assigned to dispatch tasks',
        hierarchy: ['model', 'agent_name'],
        attributes: ['capabilities'],
    },
    {
        name: 'platform',
        description: 'Dispatch execution platform',
        hierarchy: ['platform'],
        attributes: [],
    },
    {
        name: 'date',
        description: 'Standard date dimension for time-series analysis',
        hierarchy: ['year', 'quarter', 'month', 'week', 'day'],
        attributes: ['is_weekend', 'fiscal_quarter'],
    },
];
```

## Bus Matrix

The bus matrix declares which dimensions apply to which fact tables.
This is the single source of truth for cross-process analysis.

```
                        page  round  agent  platform  date
                        ────  ─────  ─────  ────────  ────
fact_crawl_quality       ✓      ✓      ✓               ✓
fact_dispatch                   ✓      ✓      ✓        ✓
fact_channel_event (R8)         ✓             ✓        ✓
fact_pg_cache (R9)       ✓      ✓                      ✓
fact_plugin_route (R10)         ✓      ✓      ✓        ✓
```

## Data Flow Between Layers

```
Source Systems (Scrapy, Channels, Dispatch, Audit)
        │
        ▼
┌─ RUNTIME LAYER ──────────────────────────────────────┐
│  INSERT INTO runtime.crawl_events (...)              │
│  INSERT INTO runtime.dispatch_events (...)           │
│  INSERT INTO runtime.channel_events (...)            │
│  INSERT INTO runtime.audit_logs (...)                │
│                                                      │
│  Append-only. 3NF. Write-optimized.                  │
│  Neon PG18: pg_uuidv7, BRIN indexes, partitioning   │
└──────────────────────┬───────────────────────────────┘
                       │ ETL (pg_cron scheduled)
                       ▼
┌─ REPORTING LAYER ────────────────────────────────────┐
│  UPSERT INTO reporting.dim_page (...)  -- SCD Type 2│
│  INSERT INTO reporting.fact_crawl_quality (...)      │
│  REFRESH MATERIALIZED VIEW reporting.mv_round_agg   │
│                                                      │
│  Star schema. Denormalized. Read-optimized.          │
│  Neon PG18: pgvector, bloom index, timescaledb      │
└──────────────────────┬───────────────────────────────┘
                       │ Semantic definitions
                       ▼
┌─ SEMANTIC LAYER ─────────────────────────────────────┐
│  MetricDefinition[]  — business metrics              │
│  DimensionDefinition[] — conformed dimensions        │
│  Bus matrix — cross-process join contract            │
│                                                      │
│  Exposed via MCP tools and API only.                 │
│  No SQL. No physical schema references.              │
│  This is the ONLY layer consumers see.               │
└──────────────────────────────────────────────────────┘
```

## Neon PG18 Extensions for Each Layer

### Runtime Layer
- `pg_uuidv7` — Time-ordered UUIDs for natural sort
- `hstore` — Flexible metadata on crawl events
- `pg_trgm` — Fuzzy URL matching for dedup
- BRIN indexes — Efficient range scans on `created_at`
- Table partitioning — By month on `created_at`

### Reporting Layer
- `pgvector` — Semantic similarity for page dedup
- `bloom` — Multi-column probabilistic index for fact table scans
- `timescaledb` — Time-series hypertables for quality trends
- `pg_cron` — Scheduled ETL from runtime to reporting
- Materialized views — Pre-aggregated round summaries

### Semantic Layer
- `pg_graphql` — GraphQL API auto-generated from semantic definitions
- `pg_jsonschema` — Validate metric definitions against schema
- No direct table access — all queries go through views/functions

## Scrapy Integration

### Change Detection Middleware (replaces DeltaFetch)
```python
# Instead of BsdDb3 fingerprints, use Neon Postgres:
class NeonDeltaFetchMiddleware:
    """Skip pages that haven't changed since last crawl.

    Uses content_hash (SHA-256) and HTTP conditional headers
    (If-Modified-Since, If-None-Match) stored in runtime.crawl_events.
    """
    def process_request(self, request, spider):
        # Query latest crawl event for this URL
        # If content_hash matches → skip (return cached response)
        # Set If-Modified-Since and If-None-Match headers from stored values
        pass

    def process_response(self, request, response, spider):
        # If 304 Not Modified → return cached version
        # If 200 → compute content_hash, compare with stored
        # If changed → process normally, update runtime.crawl_events
        # If unchanged → skip pipeline, log "no change"
        pass
```

### HTTP Cache Storage (Postgres-backed)
```python
class NeonPostgresCacheStorage:
    """Store HTTP cache in Neon Postgres instead of filesystem.

    Survives compute scale-to-zero. Shared across Scrapy instances.
    Uses RFC2616 conditional requests automatically.
    """
    # Store: response body (compressed), headers, status, url, timestamp
    # Retrieve: by URL + request fingerprint
    # Expire: via pg_cron cleanup job
```

## Code Organization

Every module directory MUST contain a `layer` declaration:

```typescript
// src/crawl/runtime/events.ts     — writes to runtime.crawl_events
// src/crawl/reporting/quality.ts  — reads from reporting.fact_crawl_quality
// src/crawl/semantic/metrics.ts   — exposes MetricDefinition[]
```

Files that cross layers (ETL transforms) live in `src/etl/` and are
clearly documented with source/target layer annotations:

```typescript
// src/etl/crawl-to-warehouse.ts
// SOURCE: runtime.crawl_events
// TARGET: reporting.dim_page, reporting.fact_crawl_quality
// SCHEDULE: pg_cron every 15 minutes
```

## Anti-Patterns (Never Do This)

1. **Never query runtime tables from the semantic layer** — go through reporting
2. **Never write to reporting tables from application code** — only ETL
3. **Never expose surrogate keys outside the reporting layer** — use natural keys in semantic
4. **Never put business logic in ETL** — transformations only, no decisions
5. **Never denormalize the runtime layer** — that's what reporting is for
6. **Never let the semantic layer reference physical column names** — use metric formulas
7. **Never skip the bus matrix** — if two facts share a dimension, declare it
