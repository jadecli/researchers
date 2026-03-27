-- 006_style_analytics.sql — Style analytics (runtime + reporting + semantic)
-- Extends the Kimball 3-layer architecture with style usage tracking.
-- Follows conventions from 002 (runtime), 003 (reporting), 004 (semantic).

BEGIN;

-- ════════════════════════════════════════════════════════════════
-- RUNTIME LAYER — Append-only, write-optimized
-- ════════════════════════════════════════════════════════════════

-- ── Style Events ──────────────────────────────────────────────
-- One row per style interaction (select, create, edit, hide, etc.)
CREATE TABLE IF NOT EXISTS runtime.style_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      text NOT NULL CHECK (event_type IN (
                        'select', 'create', 'edit', 'hide', 'unhide', 'reorder', 'delete'
                    )),
    style_id        text NOT NULL,
    style_name      text NOT NULL,
    style_kind      text NOT NULL CHECK (style_kind IN (
                        'preset', 'custom_upload', 'custom_describe', 'custom_manual'
                    )),
    session_id      text NOT NULL,
    agent_id        text,
    instructions_hash text,
    metadata        hstore,                 -- Flexible key-value (sample_count, starting_point, etc.)
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- BRIN index: efficient range scans on append-only timestamp column
CREATE INDEX IF NOT EXISTS idx_style_events_created
    ON runtime.style_events USING brin (created_at);
-- B-tree: lookups by style and session
CREATE INDEX IF NOT EXISTS idx_style_events_style
    ON runtime.style_events (style_id);
CREATE INDEX IF NOT EXISTS idx_style_events_session
    ON runtime.style_events (session_id);

-- ════════════════════════════════════════════════════════════════
-- REPORTING LAYER — Star schema, read-optimized
-- ════════════════════════════════════════════════════════════════

-- ── Dimension: Style (SCD Type 2) ─────────────────────────────
-- Style instructions change over time. SCD Type 2 preserves history.
CREATE TABLE IF NOT EXISTS reporting.dim_style (
    style_sk            serial PRIMARY KEY,
    style_id            text NOT NULL,              -- natural key
    style_name          text NOT NULL,
    style_kind          text NOT NULL,              -- preset, custom_upload, custom_describe, custom_manual
    instructions_hash   text,                       -- content-addressable fingerprint
    is_current          boolean NOT NULL DEFAULT true,
    valid_from          timestamptz NOT NULL DEFAULT now(),
    valid_to            timestamptz NOT NULL DEFAULT '9999-12-31'::timestamptz
);

CREATE INDEX IF NOT EXISTS idx_dim_style_current
    ON reporting.dim_style (style_id) WHERE is_current = true;

-- Pre-populate the 6 default styles
INSERT INTO reporting.dim_style (style_id, style_name, style_kind, instructions_hash) VALUES
    ('preset-normal',              'Normal',              'preset',        NULL),
    ('preset-concise',             'Concise',             'preset',        NULL),
    ('preset-formal',              'Formal',              'preset',        NULL),
    ('preset-explanatory',         'Explanatory',         'preset',        NULL),
    ('custom-typescript-strict',   'TypeScript Strict',   'custom_manual', NULL),
    ('custom-dimensional-modeler', 'Dimensional Modeler', 'custom_manual', NULL)
ON CONFLICT DO NOTHING;

-- ── Dimension: Session ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reporting.dim_session (
    session_sk      serial PRIMARY KEY,
    session_id      text NOT NULL UNIQUE,
    started_at      timestamptz
);

-- ── Fact: Style Usage ─────────────────────────────────────────
-- GRAIN: one row per style selection per session
CREATE TABLE IF NOT EXISTS reporting.fact_style_usage (
    style_usage_sk      bigserial PRIMARY KEY,
    style_sk            integer NOT NULL REFERENCES reporting.dim_style(style_sk),
    session_sk          integer NOT NULL REFERENCES reporting.dim_session(session_sk),
    agent_sk            integer REFERENCES reporting.dim_agent(agent_sk),
    date_sk             integer NOT NULL REFERENCES reporting.dim_date(date_sk),
    duration_active_ms  integer,
    messages_sent       integer NOT NULL DEFAULT 0,
    switches_in_session integer NOT NULL DEFAULT 0
);

-- Bloom index for multi-column filtering on fact table
CREATE INDEX IF NOT EXISTS idx_fact_style_usage_bloom
    ON reporting.fact_style_usage
    USING bloom (style_sk, session_sk, agent_sk, date_sk)
    WITH (col1 = 2, col2 = 2, col3 = 2, col4 = 3);

-- ── Fact: Style Creation ──────────────────────────────────────
-- GRAIN: one row per style creation event
CREATE TABLE IF NOT EXISTS reporting.fact_style_creation (
    style_creation_sk   bigserial PRIMARY KEY,
    style_sk            integer NOT NULL REFERENCES reporting.dim_style(style_sk),
    date_sk             integer NOT NULL REFERENCES reporting.dim_date(date_sk),
    session_sk          integer NOT NULL REFERENCES reporting.dim_session(session_sk),
    creation_method     text NOT NULL CHECK (creation_method IN ('upload', 'describe', 'manual')),
    sample_count        integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_fact_style_creation_bloom
    ON reporting.fact_style_creation
    USING bloom (style_sk, date_sk, session_sk)
    WITH (col1 = 2, col2 = 3, col3 = 2);

-- ── Materialized View: Style Summary ──────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS reporting.mv_style_summary AS
SELECT
    s.style_name,
    s.style_kind,
    COUNT(DISTINCT fu.session_sk) AS unique_sessions,
    COUNT(fu.style_usage_sk) AS total_selections,
    AVG(fu.duration_active_ms) AS avg_duration_ms,
    AVG(fu.messages_sent) AS avg_messages_per_use,
    SUM(fu.switches_in_session) AS total_switches
FROM reporting.fact_style_usage fu
JOIN reporting.dim_style s ON s.style_sk = fu.style_sk AND s.is_current = true
GROUP BY s.style_name, s.style_kind
ORDER BY total_selections DESC;

-- ════════════════════════════════════════════════════════════════
-- SEMANTIC LAYER — Business contract (consumer-facing views)
-- ════════════════════════════════════════════════════════════════

-- ── Metric: Style Adoption Rate ───────────────────────────────
-- Additivity: NON-ADDITIVE (cannot SUM percentages)
-- Grain: one value per date
CREATE OR REPLACE VIEW semantic.style_adoption_rate AS
SELECT
    d.full_date,
    COUNT(DISTINCT fu.session_sk)
        FILTER (WHERE s.style_kind != 'preset') AS custom_sessions,
    COUNT(DISTINCT fu.session_sk) AS total_sessions,
    CASE
        WHEN COUNT(DISTINCT fu.session_sk) > 0
        THEN ROUND(
            COUNT(DISTINCT fu.session_sk) FILTER (WHERE s.style_kind != 'preset')::numeric
            / COUNT(DISTINCT fu.session_sk),
            3
        )
        ELSE 0
    END AS adoption_rate
FROM reporting.fact_style_usage fu
JOIN reporting.dim_date d ON d.date_sk = fu.date_sk
JOIN reporting.dim_style s ON s.style_sk = fu.style_sk AND s.is_current = true
GROUP BY d.full_date;

-- ── Metric: Popular Styles ────────────────────────────────────
-- Additivity: ADDITIVE (can SUM selection counts across dates)
-- Grain: one value per style
CREATE OR REPLACE VIEW semantic.popular_styles AS
SELECT
    s.style_name,
    s.style_kind,
    COUNT(fu.style_usage_sk) AS selection_count,
    COUNT(DISTINCT fu.session_sk) AS unique_sessions,
    RANK() OVER (ORDER BY COUNT(fu.style_usage_sk) DESC) AS popularity_rank
FROM reporting.fact_style_usage fu
JOIN reporting.dim_style s ON s.style_sk = fu.style_sk AND s.is_current = true
GROUP BY s.style_name, s.style_kind;

-- ── Metric: Style Switch Frequency ────────────────────────────
-- Additivity: NON-ADDITIVE (cannot SUM averages)
-- Grain: one value per session
CREATE OR REPLACE VIEW semantic.style_switch_frequency AS
SELECT
    sess.session_id,
    COUNT(fu.style_usage_sk) AS total_switches,
    COUNT(DISTINCT fu.style_sk) AS unique_styles_used,
    MAX(fu.switches_in_session) AS max_switches
FROM reporting.fact_style_usage fu
JOIN reporting.dim_session sess ON sess.session_sk = fu.session_sk
GROUP BY sess.session_id;

-- ── Dimension View: Style Catalog ─────────────────────────────
-- Shows only current versions of all styles (SCD Type 2 filtered)
CREATE OR REPLACE VIEW semantic.style_catalog AS
SELECT
    s.style_id,
    s.style_name,
    s.style_kind,
    s.valid_from AS active_since
FROM reporting.dim_style s
WHERE s.is_current = true
ORDER BY s.style_name;

-- ── Bus Matrix (documented as comment) ────────────────────────
-- ┌───────────────────────┬───────┬──────┬───────┬─────────┐
-- │ Fact Table             │ style │ date │ agent │ session │
-- ├───────────────────────┼───────┼──────┼───────┼─────────┤
-- │ fact_style_usage       │   ✓   │  ✓   │  ✓    │   ✓     │
-- │ fact_style_creation    │   ✓   │  ✓   │       │   ✓     │
-- └───────────────────────┴───────┴──────┴───────┴─────────┘

COMMIT;
