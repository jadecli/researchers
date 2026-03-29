-- 009_multiagent_teams.sql — Red/Blue/White multi-agent team infrastructure
--
-- Informed by:
--   arxiv.org/abs/2511.02823 — Optimizing AI agent attacks (modular scaffolds)
--   alignment.anthropic.com/2025/strengthening-red-teams — SHADE-Arena red/blue
--   arxiv.org/abs/2511.02997 — Multi-agent blue team structural improvement
--   anthropic.com/engineering — Engineering best practices
--   anthropic.com/research — Frontier research methodology
--
-- GRAIN (teams.findings): one row per finding per agent per sweep
-- GRAIN (teams.sweeps): one row per team sweep execution
-- GRAIN (teams.crawl_store): one row per crawled page stored from team sweep
--
-- Dependencies: 001_extensions.sql (bloom, hstore, pg_trgm)

BEGIN;

CREATE SCHEMA IF NOT EXISTS teams;

-- ══════════════════════════════════════════════════════════════
-- RUNTIME LAYER: team sweep execution and findings
-- ══════════════════════════════════════════════════════════════

-- ── Team Types ─────────────────────────────────────────────
-- Discriminated union of team roles, mirroring TypeScript types
CREATE TYPE teams.team_role AS ENUM (
    'red',          -- Security QA: vulnerability scanning, attack surface analysis
    'blue',         -- Structural: codebase hardening, defensive improvements
    'white',        -- Functionality: feature buildout, integration testing
    'engineering',  -- Engineering: crawl→store→bloom pipeline operations
    'research'      -- Research: frontier paper crawl, knowledge extraction
);

CREATE TYPE teams.severity AS ENUM (
    'critical', 'high', 'medium', 'low', 'info'
);

CREATE TYPE teams.finding_status AS ENUM (
    'open', 'acknowledged', 'in_progress', 'resolved', 'wont_fix', 'false_positive'
);

CREATE TYPE teams.sweep_status AS ENUM (
    'queued', 'running', 'scoring', 'complete', 'failed'
);

-- ── Team Sweeps ────────────────────────────────────────────
-- One row per team sweep execution. A sweep is a coordinated
-- multi-agent pass over the codebase or target URLs.
CREATE TABLE teams.sweeps (
    sweep_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_role       teams.team_role NOT NULL,
    sweep_status    teams.sweep_status NOT NULL DEFAULT 'queued',
    session_id      text,
    git_branch      text,
    git_sha         text,
    agent_model     text CHECK (agent_model IN ('opus', 'sonnet', 'haiku')),
    agent_count     smallint NOT NULL DEFAULT 1,
    target_urls     text[],                 -- URLs crawled during sweep
    target_paths    text[],                 -- Codebase paths analyzed
    config          jsonb NOT NULL DEFAULT '{}',
    findings_count  integer NOT NULL DEFAULT 0,
    quality_score   real CHECK (quality_score >= 0 AND quality_score <= 1),
    token_cost_usd  numeric(10,6),
    duration_ms     integer,
    started_at      timestamptz,
    completed_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sweeps_created ON teams.sweeps USING brin (created_at);
CREATE INDEX idx_sweeps_role ON teams.sweeps (team_role, created_at DESC);
CREATE INDEX idx_sweeps_status ON teams.sweeps (sweep_status) WHERE sweep_status != 'complete';

-- ── Team Findings ──────────────────────────────────────────
-- One row per finding discovered during a sweep.
-- Red: vulnerabilities. Blue: structural issues. White: feature gaps.
-- Engineering: pipeline failures. Research: knowledge extractions.
CREATE TABLE teams.findings (
    finding_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sweep_id        uuid NOT NULL REFERENCES teams.sweeps(sweep_id),
    team_role       teams.team_role NOT NULL,
    severity        teams.severity NOT NULL DEFAULT 'medium',
    status          teams.finding_status NOT NULL DEFAULT 'open',
    category        text NOT NULL,              -- e.g., 'xss', 'sql_injection', 'missing_type', 'dead_code'
    title           text NOT NULL,
    description     text NOT NULL,
    evidence        text,                       -- code snippet, URL, or proof
    file_path       text,                       -- affected file
    line_number     integer,
    suggested_fix   text,
    agent_id        text NOT NULL DEFAULT 'orchestrator',
    agent_model     text,
    confidence      real CHECK (confidence >= 0 AND confidence <= 1),
    metadata        jsonb NOT NULL DEFAULT '{}',
    resolved_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_findings_sweep ON teams.findings (sweep_id);
CREATE INDEX idx_findings_severity ON teams.findings (team_role, severity, status);
CREATE INDEX idx_findings_file ON teams.findings (file_path) WHERE file_path IS NOT NULL;
CREATE INDEX idx_findings_open ON teams.findings (team_role, created_at DESC)
    WHERE status IN ('open', 'acknowledged', 'in_progress');

-- Bloom index: probabilistic multi-column filter for dashboard queries
CREATE INDEX idx_findings_bloom
    ON teams.findings USING bloom (team_role, severity, status, category)
    WITH (col1=2, col2=2, col3=2, col4=4);

-- GIN: full-text search on finding descriptions
CREATE INDEX idx_findings_description
    ON teams.findings USING gin (to_tsvector('english', description));

-- ── Crawl Store ────────────────────────────────────────────
-- Pages crawled and stored during team sweeps.
-- Connects crawlee/scrapy output to Neon for bloom filter reads.
CREATE TABLE teams.crawl_store (
    crawl_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sweep_id        uuid REFERENCES teams.sweeps(sweep_id),
    url             citext NOT NULL,
    content_hash    bytea,                  -- SHA-256 for change detection
    title           text,
    content_markdown text,
    content_length  integer,
    page_type       text,                   -- doc, api, research, product, security
    quality_score   real CHECK (quality_score >= 0 AND quality_score <= 1),
    extraction_data jsonb NOT NULL DEFAULT '{}',
    crawler_type    text CHECK (crawler_type IN ('scrapy', 'crawlee', 'cheerio')),
    bloom_indexed   boolean NOT NULL DEFAULT false,
    metadata        hstore,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crawl_store_created ON teams.crawl_store USING brin (created_at);
CREATE INDEX idx_crawl_store_url ON teams.crawl_store USING gin (url gin_trgm_ops);
CREATE INDEX idx_crawl_store_hash ON teams.crawl_store (url, content_hash);
CREATE INDEX idx_crawl_store_bloom_pending ON teams.crawl_store (created_at)
    WHERE bloom_indexed = false;

-- ── Agent Heartbeats ───────────────────────────────────────
-- Persistent heartbeat records for dispatch workers.
-- Mirrors the file-based heartbeat from heartbeat.ts but in Neon.
CREATE TABLE teams.agent_heartbeats (
    agent_id        text PRIMARY KEY,
    team_role       teams.team_role,
    sweep_id        uuid REFERENCES teams.sweeps(sweep_id),
    status          text NOT NULL CHECK (status IN ('idle', 'working', 'draining', 'shutdown')),
    current_task    text,
    heartbeat_at    timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    iteration_count integer NOT NULL DEFAULT 0,
    pid             integer
);

-- ══════════════════════════════════════════════════════════════
-- REPORTING LAYER: star schema for team analytics
-- ══════════════════════════════════════════════════════════════

-- ── Dimension: team roles ──────────────────────────────────
CREATE TABLE reporting.dim_team (
    team_sk         SERIAL PRIMARY KEY,
    team_role       text NOT NULL UNIQUE,
    description     text,
    primary_model   text,               -- default model for this team
    created_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO reporting.dim_team (team_role, description, primary_model) VALUES
    ('red',         'Security QA — vulnerability scanning, attack surface analysis',   'opus'),
    ('blue',        'Structural — codebase hardening, defensive improvements',         'sonnet'),
    ('white',       'Functionality — feature buildout, integration testing',           'sonnet'),
    ('engineering', 'Engineering — crawl→store→bloom pipeline operations',             'sonnet'),
    ('research',    'Research — frontier paper crawl, knowledge extraction',           'opus');

-- ── Fact: team findings (denormalized for analytics) ───────
-- GRAIN: one row per finding per sweep per team
CREATE TABLE reporting.fact_team_finding (
    finding_sk      BIGSERIAL PRIMARY KEY,
    finding_id      uuid NOT NULL,          -- natural key
    team_sk         integer REFERENCES reporting.dim_team(team_sk),
    sweep_id        uuid,
    agent_sk        integer REFERENCES reporting.dim_agent(agent_sk),
    date_sk         integer,
    severity        text,
    category        text,
    confidence      real,
    resolved        boolean DEFAULT false,
    resolution_time_ms integer,             -- time from open to resolved
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fact_team_finding_bloom
    ON reporting.fact_team_finding USING bloom (team_sk, severity, category)
    WITH (col1=2, col2=2, col3=4);

CREATE INDEX idx_fact_team_finding_created
    ON reporting.fact_team_finding USING brin (created_at);

-- ══════════════════════════════════════════════════════════════
-- SEMANTIC LAYER: business views for agent consumption
-- ══════════════════════════════════════════════════════════════

-- ── Team Sweep Summary ─────────────────────────────────────
-- Aggregated sweep outcomes per team role
CREATE OR REPLACE VIEW semantic.team_sweep_summary AS
SELECT
    s.team_role,
    COUNT(*) AS total_sweeps,
    COUNT(*) FILTER (WHERE s.sweep_status = 'complete') AS completed_sweeps,
    AVG(s.quality_score) AS avg_quality,
    SUM(s.findings_count) AS total_findings,
    SUM(s.token_cost_usd) AS total_cost_usd,
    AVG(s.duration_ms) AS avg_duration_ms,
    MAX(s.completed_at) AS last_sweep_at
FROM teams.sweeps s
GROUP BY s.team_role
ORDER BY total_sweeps DESC;

-- ── Open Findings Dashboard ────────────────────────────────
-- Current open findings by team and severity
CREATE OR REPLACE VIEW semantic.open_findings AS
SELECT
    f.team_role,
    f.severity,
    f.category,
    COUNT(*) AS finding_count,
    AVG(f.confidence) AS avg_confidence,
    MIN(f.created_at) AS oldest_finding,
    array_agg(DISTINCT f.file_path) FILTER (WHERE f.file_path IS NOT NULL) AS affected_files
FROM teams.findings f
WHERE f.status IN ('open', 'acknowledged', 'in_progress')
GROUP BY f.team_role, f.severity, f.category
ORDER BY
    CASE f.severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        WHEN 'info' THEN 5
    END,
    finding_count DESC;

-- ── Crawl Store Coverage ───────────────────────────────────
-- How much content has been crawled and indexed by bloom filters
CREATE OR REPLACE VIEW semantic.crawl_coverage AS
SELECT
    cs.page_type,
    cs.crawler_type,
    COUNT(*) AS total_pages,
    COUNT(*) FILTER (WHERE cs.bloom_indexed) AS bloom_indexed_pages,
    AVG(cs.quality_score) AS avg_quality,
    SUM(cs.content_length) AS total_content_bytes,
    COUNT(DISTINCT cs.url) AS unique_urls
FROM teams.crawl_store cs
GROUP BY cs.page_type, cs.crawler_type
ORDER BY total_pages DESC;

-- ── Team Velocity ──────────────────────────────────────────
-- Findings opened vs resolved per team per day
CREATE OR REPLACE VIEW semantic.team_velocity AS
SELECT
    date_trunc('day', f.created_at) AS finding_date,
    f.team_role,
    COUNT(*) FILTER (WHERE f.status = 'open') AS opened,
    COUNT(*) FILTER (WHERE f.status = 'resolved') AS resolved,
    COUNT(*) FILTER (WHERE f.severity IN ('critical', 'high')) AS high_severity_count
FROM teams.findings f
GROUP BY date_trunc('day', f.created_at), f.team_role
ORDER BY finding_date DESC;

COMMIT;
