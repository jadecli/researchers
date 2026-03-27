-- 004_semantic_views.sql — Semantic layer (business contract)
-- These views are the ONLY interface consumers see.
-- No physical schema details leak through. Business names only.

BEGIN;

CREATE SCHEMA IF NOT EXISTS semantic;

-- ── Metric: Average Crawl Quality ───────────────────────────
-- Additivity: NON-ADDITIVE (cannot SUM averages)
-- Grain: one value per round
CREATE OR REPLACE VIEW semantic.average_crawl_quality AS
SELECT
    r.round_number,
    r.round_name,
    AVG(f.overall_score) AS average_quality,
    r.quality_threshold,
    CASE
        WHEN AVG(f.overall_score) >= r.quality_threshold THEN 'PASS'
        ELSE 'FAIL'
    END AS threshold_status,
    COUNT(*) AS pages_scored
FROM reporting.fact_crawl_quality f
JOIN reporting.dim_round r ON r.round_sk = f.round_sk
GROUP BY r.round_number, r.round_name, r.quality_threshold;

-- ── Metric: Quality Improvement Rate ────────────────────────
-- Additivity: NON-ADDITIVE
-- Grain: one value per round transition
CREATE OR REPLACE VIEW semantic.quality_improvement_rate AS
WITH round_avgs AS (
    SELECT
        r.round_number,
        r.round_name,
        AVG(f.overall_score) AS avg_quality
    FROM reporting.fact_crawl_quality f
    JOIN reporting.dim_round r ON r.round_sk = f.round_sk
    GROUP BY r.round_number, r.round_name
)
SELECT
    curr.round_number,
    curr.round_name,
    prev.avg_quality AS previous_quality,
    curr.avg_quality AS current_quality,
    CASE
        WHEN prev.avg_quality > 0
        THEN (curr.avg_quality - prev.avg_quality) / prev.avg_quality
        ELSE NULL
    END AS improvement_rate
FROM round_avgs curr
LEFT JOIN round_avgs prev ON prev.round_number = curr.round_number - 1;

-- ── Metric: Total Crawl Cost ────────────────────────────────
-- Additivity: ADDITIVE (can SUM across any dimension)
-- Grain: one value per round per agent per platform
CREATE OR REPLACE VIEW semantic.total_crawl_cost AS
SELECT
    r.round_number,
    r.round_name,
    a.agent_name,
    fd.platform,
    SUM(fd.cost_usd) AS total_cost_usd,
    SUM(fd.input_tokens) AS total_input_tokens,
    SUM(fd.output_tokens) AS total_output_tokens,
    COUNT(*) AS dispatch_count
FROM reporting.fact_dispatch fd
JOIN reporting.dim_round r ON r.round_sk = fd.round_sk
JOIN reporting.dim_agent a ON a.agent_sk = fd.agent_sk
GROUP BY r.round_number, r.round_name, a.agent_name, fd.platform;

-- ── Metric: Pages Changed ───────────────────────────────────
-- Additivity: ADDITIVE
-- Grain: one value per round per page type
CREATE OR REPLACE VIEW semantic.pages_changed AS
SELECT
    r.round_number,
    r.round_name,
    p.page_type,
    p.domain,
    COUNT(*) FILTER (WHERE f.content_changed) AS pages_changed,
    COUNT(*) AS total_pages,
    ROUND(COUNT(*) FILTER (WHERE f.content_changed)::numeric / NULLIF(COUNT(*), 0), 3) AS change_rate
FROM reporting.fact_crawl_quality f
JOIN reporting.dim_round r ON r.round_sk = f.round_sk
JOIN reporting.dim_page p ON p.page_sk = f.page_sk
GROUP BY r.round_number, r.round_name, p.page_type, p.domain;

-- ── Metric: Dispatch Success Rate ───────────────────────────
-- Additivity: NON-ADDITIVE
-- Grain: one value per round per platform per agent
CREATE OR REPLACE VIEW semantic.dispatch_success_rate AS
SELECT
    r.round_number,
    fd.platform,
    a.agent_name,
    COUNT(*) FILTER (WHERE fd.success) AS successful,
    COUNT(*) AS total,
    ROUND(COUNT(*) FILTER (WHERE fd.success)::numeric / NULLIF(COUNT(*), 0), 3) AS success_rate
FROM reporting.fact_dispatch fd
JOIN reporting.dim_round r ON r.round_sk = fd.round_sk
JOIN reporting.dim_agent a ON a.agent_sk = fd.agent_sk
GROUP BY r.round_number, fd.platform, a.agent_name;

-- ── Metric: Cost Per Quality Point ──────────────────────────
-- Additivity: NON-ADDITIVE
-- Grain: one value per round transition
CREATE OR REPLACE VIEW semantic.cost_per_quality_point AS
WITH costs AS (
    SELECT r.round_number, SUM(fd.cost_usd) AS total_cost
    FROM reporting.fact_dispatch fd
    JOIN reporting.dim_round r ON r.round_sk = fd.round_sk
    GROUP BY r.round_number
),
improvements AS (
    SELECT round_number, improvement_rate
    FROM semantic.quality_improvement_rate
)
SELECT
    c.round_number,
    c.total_cost,
    i.improvement_rate,
    CASE
        WHEN i.improvement_rate > 0
        THEN c.total_cost / (i.improvement_rate * 100)
        ELSE NULL
    END AS cost_per_point_usd
FROM costs c
LEFT JOIN improvements i ON i.round_number = c.round_number;

-- ── Dimension View: Page Catalog ────────────────────────────
CREATE OR REPLACE VIEW semantic.page_catalog AS
SELECT
    p.url,
    p.domain,
    p.page_type,
    p.first_seen,
    p.last_seen
FROM reporting.dim_page p
WHERE p.is_current = true;

-- ── Dimension View: Round Progress ──────────────────────────
CREATE OR REPLACE VIEW semantic.round_progress AS
SELECT
    r.round_number,
    r.round_name,
    r.goal,
    r.quality_threshold,
    r.started_at,
    r.completed_at,
    CASE
        WHEN r.completed_at IS NOT NULL THEN 'completed'
        WHEN r.started_at IS NOT NULL THEN 'in_progress'
        ELSE 'pending'
    END AS status
FROM reporting.dim_round r
ORDER BY r.round_number;

COMMIT;
