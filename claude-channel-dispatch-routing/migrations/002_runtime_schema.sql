-- 002_runtime_schema.sql — Runtime layer (operational, write-optimized)
-- Normalized 3NF. Append-only. BRIN indexes on timestamps.
-- This is where crawlers, dispatchers, channels, and audit loggers write.

BEGIN;

CREATE SCHEMA IF NOT EXISTS runtime;

-- ── Crawl Events ────────────────────────────────────────────
-- One row per page crawled per spider run.
CREATE TABLE runtime.crawl_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url             citext NOT NULL,
    spider_name     text NOT NULL,
    round_number    smallint,
    response_status smallint,
    content_hash    bytea,                  -- SHA-256 for change detection
    headers_etag    text,                   -- For If-None-Match
    headers_lmod    timestamptz,            -- For If-Modified-Since
    body_size       integer,
    quality_score   real CHECK (quality_score >= 0 AND quality_score <= 1),
    metadata        hstore,                 -- Flexible key-value metadata
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- BRIN index: efficient range scans on append-only timestamp column
CREATE INDEX idx_crawl_events_created ON runtime.crawl_events USING brin (created_at);
-- Trigram index: fuzzy URL matching for dedup
CREATE INDEX idx_crawl_events_url_trgm ON runtime.crawl_events USING gin (url gin_trgm_ops);
-- B-tree: exact URL + hash lookups for change detection
CREATE INDEX idx_crawl_events_url_hash ON runtime.crawl_events (url, content_hash);

-- ── Dispatch Events ─────────────────────────────────────────
-- One row per dispatch task execution.
CREATE TABLE runtime.dispatch_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id     text NOT NULL,
    round_number    smallint,
    agent_id        text NOT NULL,
    agent_model     text NOT NULL,          -- opus, sonnet, haiku
    task_type       text NOT NULL,          -- simple, parallel, sequential, conditional
    platform        text NOT NULL,          -- cli, github_actions, chrome, slack
    task_summary    text,
    input_tokens    integer,
    output_tokens   integer,
    cost_usd        numeric(10,6),
    duration_ms     integer,
    quality_score   real,
    success         boolean NOT NULL DEFAULT true,
    error_message   text,
    metadata        hstore,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dispatch_events_created ON runtime.dispatch_events USING brin (created_at);
CREATE INDEX idx_dispatch_events_dispatch ON runtime.dispatch_events (dispatch_id);

-- ── Channel Events ──────────────────────────────────────────
-- One row per inbound channel message.
CREATE TABLE runtime.channel_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_source  text NOT NULL,          -- webhook, telegram, discord, slack
    sender_id       text,
    content         text NOT NULL,
    meta            hstore,                 -- Each meta key → channel tag attribute
    verdict         text,                   -- allow, deny (for permission relay)
    request_id      text,                   -- Five-letter permission request ID
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_channel_events_created ON runtime.channel_events USING brin (created_at);
CREATE INDEX idx_channel_events_source ON runtime.channel_events (channel_source);

-- ── Audit Logs ──────────────────────────────────────────────
-- One row per audit finding.
CREATE TABLE runtime.audit_logs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id        text NOT NULL,
    dispatch_id     text,
    round_number    smallint,
    agent_id        text,
    severity        text NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
    finding_type    text NOT NULL,          -- relevance, completeness, accuracy, safety, realism
    score           real CHECK (score >= 0 AND score <= 1),
    description     text NOT NULL,
    evidence        text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_created ON runtime.audit_logs USING brin (created_at);
CREATE INDEX idx_audit_logs_audit ON runtime.audit_logs (audit_id);

COMMIT;
