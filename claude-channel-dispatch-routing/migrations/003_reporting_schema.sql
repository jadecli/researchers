-- 003_reporting_schema.sql — Reporting layer (star schema, read-optimized)
-- Conformed dimensions + fact tables. Surrogate keys. SCD Type 2 for pages.
-- Only ETL writes here — never application code.

BEGIN;

CREATE SCHEMA IF NOT EXISTS reporting;

-- ── Dimension: Date ─────────────────────────────────────────
CREATE TABLE reporting.dim_date (
    date_sk         integer PRIMARY KEY,    -- YYYYMMDD format
    full_date       date NOT NULL,
    year            smallint NOT NULL,
    quarter         smallint NOT NULL,
    month           smallint NOT NULL,
    week            smallint NOT NULL,
    day             smallint NOT NULL,
    day_of_week     smallint NOT NULL,
    is_weekend      boolean NOT NULL,
    fiscal_quarter  smallint
);

-- Pre-populate 10 years of dates
INSERT INTO reporting.dim_date
SELECT
    to_char(d, 'YYYYMMDD')::integer AS date_sk,
    d AS full_date,
    EXTRACT(year FROM d)::smallint,
    EXTRACT(quarter FROM d)::smallint,
    EXTRACT(month FROM d)::smallint,
    EXTRACT(week FROM d)::smallint,
    EXTRACT(day FROM d)::smallint,
    EXTRACT(isodow FROM d)::smallint,
    EXTRACT(isodow FROM d) IN (6, 7),
    EXTRACT(quarter FROM d)::smallint
FROM generate_series('2024-01-01'::date, '2033-12-31'::date, '1 day') AS d
ON CONFLICT DO NOTHING;

-- ── Dimension: Page (SCD Type 2) ────────────────────────────
CREATE TABLE reporting.dim_page (
    page_sk         serial PRIMARY KEY,
    url             citext NOT NULL,
    domain          text NOT NULL,
    page_type       text,                   -- doc, research, news, api, plugin, legal, product
    first_seen      timestamptz,
    last_seen       timestamptz,
    is_current      boolean NOT NULL DEFAULT true,
    valid_from      timestamptz NOT NULL DEFAULT now(),
    valid_to        timestamptz NOT NULL DEFAULT '9999-12-31'::timestamptz
);

CREATE INDEX idx_dim_page_url ON reporting.dim_page (url) WHERE is_current = true;

-- ── Dimension: Round ────────────────────────────────────────
CREATE TABLE reporting.dim_round (
    round_sk        serial PRIMARY KEY,
    round_number    smallint NOT NULL UNIQUE,
    round_name      text NOT NULL,
    goal            text,
    quality_threshold real,
    target_repos    text[],
    started_at      timestamptz,
    completed_at    timestamptz
);

-- Pre-populate 10 rounds
INSERT INTO reporting.dim_round (round_number, round_name, goal, quality_threshold, target_repos) VALUES
(1, 'Foundation', 'Base dispatch types and unified inference', 0.60, ARRAY['safety-tooling', 'mcp-python-sdk', 'mcp-typescript-sdk']),
(2, 'Shannon Thinking', 'Structured thinking MCP server', 0.65, ARRAY['shannon-thinking']),
(3, 'Bloom Pipeline', 'Multi-stage dispatch pipeline', 0.65, ARRAY['bloom']),
(4, 'Petri Auditing', 'Dispatch audit system', 0.70, ARRAY['petri']),
(5, 'Orchestrator', 'Core DispatchOrchestrator', 0.70, ARRAY['bloom', 'petri', 'shannon-thinking']),
(6, 'Logging', 'Full JSONL observability', 0.75, ARRAY['petri']),
(7, 'Quality Scoring', 'Multi-dimensional scoring pipeline', 0.75, ARRAY['bloom', 'petri', 'shannon-thinking']),
(8, 'Channel Infrastructure', 'MCP channel server + webhook + permission relay', 0.80, ARRAY['channels-reference']),
(9, 'Neon Persistence', 'Postgres-backed crawl cache + change detection', 0.80, ARRAY['neon-pg18']),
(10, 'Production Routing', 'Community plugin index + safety validation', 0.85, ARRAY['claude-plugins-community']);

-- ── Dimension: Agent ────────────────────────────────────────
CREATE TABLE reporting.dim_agent (
    agent_sk        serial PRIMARY KEY,
    agent_id        text NOT NULL UNIQUE,
    agent_name      text NOT NULL,
    model           text NOT NULL,          -- opus, sonnet, haiku
    capabilities    jsonb                   -- {code: 0.8, research: 0.9, ...}
);

-- Pre-populate default agents
INSERT INTO reporting.dim_agent (agent_id, agent_name, model, capabilities) VALUES
('dispatch-orchestrator', 'Dispatch Orchestrator', 'opus', '{"code": 0.7, "research": 0.9, "analysis": 0.9, "creative": 0.6, "safety": 0.8}'),
('audit-agent', 'Audit Agent', 'sonnet', '{"code": 0.5, "research": 0.7, "analysis": 0.9, "creative": 0.3, "safety": 0.9}'),
('quality-scorer', 'Quality Scorer', 'sonnet', '{"code": 0.4, "research": 0.6, "analysis": 0.9, "creative": 0.3, "safety": 0.8}'),
('refinement-agent', 'Refinement Agent', 'sonnet', '{"code": 0.6, "research": 0.8, "analysis": 0.8, "creative": 0.7, "safety": 0.7}');

-- ── Fact: Crawl Quality ─────────────────────────────────────
-- GRAIN: one row per page per crawl round
CREATE TABLE reporting.fact_crawl_quality (
    crawl_quality_sk    bigserial PRIMARY KEY,
    page_sk             integer NOT NULL REFERENCES reporting.dim_page(page_sk),
    round_sk            integer NOT NULL REFERENCES reporting.dim_round(round_sk),
    agent_sk            integer REFERENCES reporting.dim_agent(agent_sk),
    date_sk             integer NOT NULL REFERENCES reporting.dim_date(date_sk),
    completeness_score  real,
    structure_score     real,
    accuracy_score      real,
    coherence_score     real,
    safety_score        real,
    overall_score       real NOT NULL,
    token_cost_usd      numeric(10,6),
    extraction_duration_ms integer,
    content_changed     boolean NOT NULL DEFAULT true
);

-- Bloom index for multi-column filtering on fact table
CREATE INDEX idx_fact_crawl_bloom ON reporting.fact_crawl_quality
    USING bloom (page_sk, round_sk, agent_sk, date_sk)
    WITH (col1 = 2, col2 = 2, col3 = 2, col4 = 3);

-- ── Fact: Dispatch ──────────────────────────────────────────
-- GRAIN: one row per dispatch task execution
CREATE TABLE reporting.fact_dispatch (
    dispatch_sk         bigserial PRIMARY KEY,
    round_sk            integer NOT NULL REFERENCES reporting.dim_round(round_sk),
    agent_sk            integer NOT NULL REFERENCES reporting.dim_agent(agent_sk),
    date_sk             integer NOT NULL REFERENCES reporting.dim_date(date_sk),
    task_type           text NOT NULL,
    platform            text NOT NULL,
    quality_score       real,
    input_tokens        integer,
    output_tokens       integer,
    cost_usd            numeric(10,6),
    duration_ms         integer,
    success             boolean NOT NULL DEFAULT true
);

CREATE INDEX idx_fact_dispatch_bloom ON reporting.fact_dispatch
    USING bloom (round_sk, agent_sk, date_sk)
    WITH (col1 = 2, col2 = 2, col3 = 3);

-- ── Fact: Channel Events ────────────────────────────────────
-- GRAIN: one row per inbound channel event
CREATE TABLE reporting.fact_channel_event (
    channel_event_sk    bigserial PRIMARY KEY,
    round_sk            integer REFERENCES reporting.dim_round(round_sk),
    date_sk             integer NOT NULL REFERENCES reporting.dim_date(date_sk),
    channel_source      text NOT NULL,
    platform            text NOT NULL,
    event_count         integer NOT NULL DEFAULT 1,
    reply_count         integer NOT NULL DEFAULT 0,
    permission_relays   integer NOT NULL DEFAULT 0
);

-- ── Materialized View: Round Summary ────────────────────────
CREATE MATERIALIZED VIEW reporting.mv_round_summary AS
SELECT
    r.round_number,
    r.round_name,
    r.quality_threshold,
    COUNT(DISTINCT f.page_sk) AS pages_crawled,
    AVG(f.overall_score) AS avg_quality,
    SUM(f.token_cost_usd) AS total_cost_usd,
    COUNT(*) FILTER (WHERE f.content_changed) AS pages_changed,
    AVG(f.extraction_duration_ms) AS avg_duration_ms
FROM reporting.fact_crawl_quality f
JOIN reporting.dim_round r ON r.round_sk = f.round_sk
GROUP BY r.round_number, r.round_name, r.quality_threshold
ORDER BY r.round_number;

COMMIT;
