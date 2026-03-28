-- 008_agentstreams.sql — Unified event stream backbone
-- Runtime: streams.events (append-only, BRIN on created_at)
-- Reporting: dim_stream_type, dim_session, fact_stream_event (star schema)
-- Semantic: session_timeline, prompt_history, decision_trail, branch_activity
--
-- GRAIN (streams.events): one row per agent action per session
-- GRAIN (fact_stream_event): one row per event per session per stream type
--
-- Dependencies: 001_extensions.sql (hstore, pg_trgm, bloom)

BEGIN;

-- ══════════════════════════════════════════════════════════════
-- RUNTIME LAYER: streams schema (append-only event backbone)
-- ══════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS streams;

-- ── Core event table ────────────────────────────────────────
-- Envelope: who, when, where, what. Payload: polymorphic jsonb.
CREATE TABLE streams.events (
    event_id        BIGSERIAL PRIMARY KEY,
    event_type      text NOT NULL CHECK (event_type IN (
                        'prompt', 'commit', 'crawl', 'decision',
                        'taxonomy', 'eval', 'session', 'dispatch'
                    )),
    session_id      text NOT NULL,
    parent_event_id bigint REFERENCES streams.events(event_id),
    sequence_number integer NOT NULL DEFAULT 0,
    git_branch      text,
    git_sha         text,
    agent_model     text CHECK (agent_model IN ('opus', 'sonnet', 'haiku')),
    agent_id        text NOT NULL DEFAULT 'orchestrator',
    user_id         text,
    surface         text CHECK (surface IN ('cli', 'web', 'ios', 'vscode', 'jetbrains', 'desktop')),
    payload         jsonb NOT NULL DEFAULT '{}',
    token_count     integer,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- BRIN: efficient range scans on append-only timestamp
CREATE INDEX idx_streams_events_created
    ON streams.events USING brin (created_at);

-- B-tree: session-scoped queries (most common access pattern)
CREATE INDEX idx_streams_events_session
    ON streams.events (session_id, sequence_number);

-- B-tree: branch-scoped queries for PR context
CREATE INDEX idx_streams_events_branch
    ON streams.events (git_branch, created_at);

-- GIN: payload JSONB queries (e.g., find prompts mentioning a file)
CREATE INDEX idx_streams_events_payload
    ON streams.events USING gin (payload jsonb_path_ops);

-- Partial: only prompt events (most queried type)
CREATE INDEX idx_streams_events_prompts
    ON streams.events (session_id, sequence_number)
    WHERE event_type = 'prompt';

-- ── Buffer tracking (local → Neon sync state) ──────────────
CREATE TABLE streams.sync_state (
    branch          text PRIMARY KEY,
    last_event_id   bigint NOT NULL DEFAULT 0,
    last_flushed_at timestamptz NOT NULL DEFAULT now(),
    event_counts    jsonb NOT NULL DEFAULT '{}',
    neon_synced     boolean NOT NULL DEFAULT false
);

-- ══════════════════════════════════════════════════════════════
-- REPORTING LAYER: star schema for stream analytics
-- ══════════════════════════════════════════════════════════════

-- ── Dimension: stream types ─────────────────────────────────
-- GRAIN: one row per event type
CREATE TABLE reporting.dim_stream_type (
    stream_type_sk  SERIAL PRIMARY KEY,
    event_type      text NOT NULL UNIQUE,
    description     text,
    source_hook     text,           -- which hook/pipeline generates this
    avg_payload_tokens integer,     -- typical token cost per event
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Seed stream types
INSERT INTO reporting.dim_stream_type (event_type, description, source_hook, avg_payload_tokens) VALUES
    ('prompt',   'User prompt submitted to Claude',           'UserPromptSubmit', 200),
    ('commit',   'Git commit with conventional format',       'Stop/post-commit', 50),
    ('crawl',    'Page crawled by Scrapy spider',             'Scrapy pipeline',  30),
    ('decision', 'Shannon thinking engine decision step',     'ThinkingEngine',   100),
    ('taxonomy', 'Taxonomy node create/update/delete',        'Taxonomy CRUD',    40),
    ('eval',     'Evaluation finding from eval loop',         'Eval loop',        60),
    ('session',  'Session start/stop metadata',               'SessionStart/Stop', 150),
    ('dispatch', 'Multi-agent dispatch routing event',        'Dispatch router',  80);

-- ── Dimension: sessions ─────────────────────────────────────
-- GRAIN: one row per Claude Code session (SCD Type 1 — overwrite on update)
CREATE TABLE reporting.dim_session (
    session_sk      SERIAL PRIMARY KEY,
    session_id      text NOT NULL UNIQUE,
    user_id         text,
    surface         text,
    os              text,
    node_version    text,
    claude_code_version text,
    model           text,
    git_branch      text,
    started_at      timestamptz,
    ended_at        timestamptz,
    event_count     integer DEFAULT 0,
    prompt_count    integer DEFAULT 0,
    commit_count    integer DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Fact: stream events (denormalized for analytics) ────────
-- GRAIN: one row per event per session per stream type
CREATE TABLE reporting.fact_stream_event (
    stream_event_sk     BIGSERIAL PRIMARY KEY,
    event_id            bigint NOT NULL,        -- natural key from streams.events
    stream_type_sk      integer REFERENCES reporting.dim_stream_type(stream_type_sk),
    session_sk          integer REFERENCES reporting.dim_session(session_sk),
    round_sk            integer REFERENCES reporting.dim_round(round_sk),
    agent_sk            integer REFERENCES reporting.dim_agent(agent_sk),
    date_sk             integer,
    sequence_number     integer,
    git_branch          text,
    git_sha             text,
    token_count         integer,
    payload_size_bytes  integer,
    has_parent          boolean DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- Bloom index: multi-column probabilistic filter for fact scans
CREATE INDEX idx_fact_stream_bloom
    ON reporting.fact_stream_event USING bloom (stream_type_sk, session_sk, git_branch)
    WITH (col1=2, col2=2, col3=4);

-- BRIN: time-ordered scans
CREATE INDEX idx_fact_stream_created
    ON reporting.fact_stream_event USING brin (created_at);

-- ══════════════════════════════════════════════════════════════
-- SEMANTIC LAYER: business views for agent consumption
-- ══════════════════════════════════════════════════════════════

-- ── Session Timeline ────────────────────────────────────────
-- What happened in a session, ordered, with type labels
CREATE OR REPLACE VIEW semantic.session_timeline AS
SELECT
    e.event_id,
    e.event_type,
    e.sequence_number,
    e.agent_id,
    e.agent_model,
    e.surface,
    e.git_branch,
    CASE
        WHEN e.event_type = 'prompt' THEN
            LEFT(e.payload->>'prompt_text', 200) || '...'
        WHEN e.event_type = 'commit' THEN
            e.payload->>'message'
        WHEN e.event_type = 'crawl' THEN
            e.payload->>'url'
        WHEN e.event_type = 'decision' THEN
            e.payload->>'problem'
        WHEN e.event_type = 'session' THEN
            e.payload->>'phase'
        ELSE
            LEFT(e.payload::text, 100)
    END AS summary,
    e.token_count,
    e.created_at
FROM streams.events e
ORDER BY e.session_id, e.sequence_number;

-- ── Prompt History ──────────────────────────────────────────
-- All prompts for a branch, truncated to token budget
CREATE OR REPLACE VIEW semantic.prompt_history AS
SELECT
    e.event_id,
    e.session_id,
    e.sequence_number AS prompt_index,
    e.git_branch,
    e.user_id,
    e.payload->>'prompt_text' AS prompt_text,
    (e.payload->>'char_count')::integer AS char_count,
    (e.payload->>'word_count')::integer AS word_count,
    e.payload->'intent_signals' AS intent_signals,
    e.payload->'mentions_files' AS mentions_files,
    e.created_at
FROM streams.events e
WHERE e.event_type = 'prompt'
ORDER BY e.git_branch, e.created_at;

-- ── Decision Trail ──────────────────────────────────────────
-- Shannon thinking steps linked causally
CREATE OR REPLACE VIEW semantic.decision_trail AS
SELECT
    e.event_id,
    e.session_id,
    e.parent_event_id,
    e.payload->>'step' AS thinking_step,
    e.payload->>'problem' AS problem,
    e.payload->>'model' AS model_description,
    (e.payload->>'confidence')::real AS confidence,
    e.payload->'assumptions' AS assumptions,
    e.agent_model,
    e.created_at
FROM streams.events e
WHERE e.event_type = 'decision'
ORDER BY e.session_id, e.sequence_number;

-- ── Branch Activity ─────────────────────────────────────────
-- Aggregated activity per branch for PR context
CREATE OR REPLACE VIEW semantic.branch_activity AS
SELECT
    e.git_branch,
    COUNT(*) AS total_events,
    COUNT(*) FILTER (WHERE e.event_type = 'prompt') AS prompt_count,
    COUNT(*) FILTER (WHERE e.event_type = 'commit') AS commit_count,
    COUNT(*) FILTER (WHERE e.event_type = 'crawl') AS crawl_count,
    COUNT(*) FILTER (WHERE e.event_type = 'decision') AS decision_count,
    COUNT(DISTINCT e.session_id) AS session_count,
    MIN(e.created_at) AS first_activity,
    MAX(e.created_at) AS last_activity,
    SUM(e.token_count) AS total_tokens
FROM streams.events e
WHERE e.git_branch IS NOT NULL
GROUP BY e.git_branch
ORDER BY last_activity DESC;

-- ── Stream Volume ───────────────────────────────────────────
-- Metric: event volume per type per day (ADDITIVE)
CREATE OR REPLACE VIEW semantic.stream_volume AS
SELECT
    date_trunc('day', e.created_at) AS event_date,
    e.event_type,
    COUNT(*) AS event_count,
    SUM(e.token_count) AS total_tokens,
    AVG(e.token_count) AS avg_tokens_per_event
FROM streams.events e
GROUP BY date_trunc('day', e.created_at), e.event_type
ORDER BY event_date DESC, event_count DESC;

COMMIT;
