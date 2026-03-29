-- 010_agentdata_tier4_agentevals.sql — Agentdata Tier 4 context views + Agentevals schema
--
-- Part A: Three agent-ready context views in the agentdata schema.
--         These sit between the semantic layer and agent sessions,
--         providing token-efficient, pre-formatted knowledge retrieval.
--
-- Part B: Agentevals deterministic evaluation loop schema.
--         runtime.eval_events (append-only findings),
--         reporting.dim_evaluator + fact_eval_finding (star schema),
--         semantic.eval_pass_rate + eval_coverage (business metrics).
--
-- Dependencies:
--   002_runtime_schema.sql   (runtime.crawl_events, runtime.audit_logs)
--   003_reporting_schema.sql (reporting.dim_page, reporting.fact_crawl_quality,
--                             reporting.dim_date, reporting.dim_agent)
--   008_agentdata_schema.sql (agentdata schema, doc_pins, changelog_bullets)
--   009_multiagent_teams.sql (teams.sweeps — optional FK)
--
-- GRAIN documentation per Kimball methodology included on each fact table.

BEGIN;

-- ══════════════════════════════════════════════════════════════════
-- PART A: Agentdata Tier 4 — Agent-Ready Context Views
-- ══════════════════════════════════════════════════════════════════

-- ── View 1: claude_code_context ─────────────────────────────────
-- Pre-formatted context for injection into Claude's context window.
-- Returns the latest quality score per current page, filtered to
-- quality >= 0.7. Token estimate derived from page body size.
--
-- Usage:
--   SELECT * FROM agentdata.claude_code_context
--   WHERE domain = 'platform.claude.com'
--   ORDER BY overall_score DESC LIMIT 10;

CREATE OR REPLACE VIEW agentdata.claude_code_context AS
SELECT DISTINCT ON (dp.page_sk)
    dp.page_sk,
    dp.domain,
    dp.url,
    dp.page_type,
    fcq.overall_score,
    fcq.completeness_score,
    fcq.structure_score,
    fcq.accuracy_score,
    fcq.coherence_score,
    fcq.safety_score,
    dp.last_seen,
    dp.first_seen,
    -- Token estimate: ~4 chars per token, body_size from latest crawl event
    COALESCE(
        (SELECT ce.body_size / 4
         FROM runtime.crawl_events ce
         WHERE ce.url = dp.url::citext
         ORDER BY ce.created_at DESC
         LIMIT 1),
        0
    ) AS token_estimate,
    json_build_object(
        'domain', dp.domain,
        'url', dp.url,
        'type', dp.page_type,
        'quality', fcq.overall_score,
        'completeness', fcq.completeness_score,
        'structure', fcq.structure_score,
        'last_seen', dp.last_seen,
        'tokens', COALESCE(
            (SELECT ce.body_size / 4
             FROM runtime.crawl_events ce
             WHERE ce.url = dp.url::citext
             ORDER BY ce.created_at DESC
             LIMIT 1),
            0
        )
    ) AS context_payload
FROM reporting.dim_page dp
JOIN reporting.fact_crawl_quality fcq ON fcq.page_sk = dp.page_sk
WHERE dp.is_current = true
  AND fcq.overall_score >= 0.7
ORDER BY dp.page_sk, fcq.crawl_quality_sk DESC;

COMMENT ON VIEW agentdata.claude_code_context IS
    'Tier 4: Token-budgeted agent context. Quality-filtered (>=0.7), latest score per page.';

-- ── View 2: session_briefing ────────────────────────────────────
-- Single-row JSON summary for the SessionStart hook.
-- Designed to be queried as:
--   SELECT row_to_json(t) FROM agentdata.session_briefing t;
--
-- Injects stale page counts, recent quality, and pending improvements
-- into the agent's session context in ~100 tokens.

CREATE OR REPLACE VIEW agentdata.session_briefing AS
SELECT
    (SELECT count(*)
     FROM reporting.dim_page
     WHERE is_current = true
       AND last_seen < now() - interval '7 days'
    ) AS stale_pages,

    (SELECT round(avg(overall_score)::numeric, 3)
     FROM reporting.fact_crawl_quality
     WHERE crawl_quality_sk IN (
         SELECT max(crawl_quality_sk)
         FROM reporting.fact_crawl_quality
         WHERE crawl_quality_sk > 0
         GROUP BY page_sk
     )
    ) AS avg_quality,

    (SELECT round(avg(overall_score)::numeric, 3)
     FROM reporting.fact_crawl_quality
     WHERE date_sk = to_char(current_date, 'YYYYMMDD')::integer
    ) AS today_quality,

    (SELECT count(*)
     FROM runtime.audit_logs
     WHERE created_at > now() - interval '24 hours'
       AND finding_type = 'improvement'
    ) AS pending_improvements,

    (SELECT count(*)
     FROM runtime.audit_logs
     WHERE created_at > now() - interval '24 hours'
       AND severity = 'critical'
    ) AS critical_findings_24h,

    (SELECT count(*)
     FROM runtime.crawl_events
     WHERE created_at > now() - interval '1 hour'
    ) AS active_crawls,

    (SELECT count(*)
     FROM reporting.dim_page
     WHERE is_current = true
    ) AS total_pages,

    now() AS briefing_generated_at;

COMMENT ON VIEW agentdata.session_briefing IS
    'Tier 4: Single-row session briefing for SessionStart hook. ~100 tokens.';

-- ── View 3: domain_summary ──────────────────────────────────────
-- Per-domain aggregation of crawl coverage and quality.
-- Useful for agents deciding which domains need re-crawling.
--
-- Usage:
--   SELECT * FROM agentdata.domain_summary
--   WHERE staleness_days > 7 ORDER BY page_count DESC;

CREATE OR REPLACE VIEW agentdata.domain_summary AS
SELECT
    dp.domain,
    count(*) AS page_count,
    round(avg(latest_q.overall_score)::numeric, 3) AS avg_quality,
    round(min(latest_q.overall_score)::numeric, 3) AS min_quality,
    round(max(latest_q.overall_score)::numeric, 3) AS max_quality,
    max(dp.last_seen) AS last_crawled,
    round(EXTRACT(epoch FROM (now() - max(dp.last_seen))) / 86400.0, 1) AS staleness_days,
    count(*) FILTER (WHERE dp.last_seen < now() - interval '7 days') AS stale_page_count
FROM reporting.dim_page dp
LEFT JOIN LATERAL (
    SELECT fcq.overall_score
    FROM reporting.fact_crawl_quality fcq
    WHERE fcq.page_sk = dp.page_sk
    ORDER BY fcq.crawl_quality_sk DESC
    LIMIT 1
) latest_q ON true
WHERE dp.is_current = true
GROUP BY dp.domain
ORDER BY page_count DESC;

COMMENT ON VIEW agentdata.domain_summary IS
    'Tier 4: Per-domain crawl coverage and quality aggregation.';


-- ══════════════════════════════════════════════════════════════════
-- PART B: Agentevals — Deterministic Evaluation Loop Schema
-- ══════════════════════════════════════════════════════════════════

-- ── Runtime: eval_events (append-only) ──────────────────────────
-- GRAIN: one row per finding per evaluator per eval run.
-- Mirrors runtime.audit_logs pattern but specialized for eval findings.

CREATE TABLE runtime.eval_events (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluator_role      text NOT NULL,
    sweep_id            uuid,                   -- optional FK to teams.sweeps
    target_path         text NOT NULL,           -- file or glob being evaluated
    finding             jsonb NOT NULL,          -- structured finding details
    severity            text NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
    pass                boolean NOT NULL,        -- did this check pass?
    score               real CHECK (score >= 0 AND score <= 1),
    pinned_doc_version  date,                   -- agentdata doc_pins version used
    rationale           text,                   -- evaluator's reasoning
    created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE runtime.eval_events IS
    'Append-only eval findings. GRAIN: one row per finding per evaluator per run.';

-- BRIN on append-only timestamp
CREATE INDEX idx_eval_events_created ON runtime.eval_events USING brin (created_at);
-- B-tree for role-based queries
CREATE INDEX idx_eval_events_role ON runtime.eval_events (evaluator_role);
-- GIN for JSONB finding queries
CREATE INDEX idx_eval_events_finding ON runtime.eval_events USING gin (finding);
-- Bloom for multi-column filter queries
CREATE INDEX idx_eval_events_bloom ON runtime.eval_events
    USING bloom (evaluator_role, severity, pass)
    WITH (col1 = 2, col2 = 2, col3 = 1);

-- ── Reporting: dim_evaluator ────────────────────────────────────
-- Conformed dimension for evaluator roles.
-- Pre-seeded with 5 evaluator roles from agentevals.md design.

CREATE TABLE reporting.dim_evaluator (
    evaluator_sk    serial PRIMARY KEY,
    evaluator_role  text NOT NULL UNIQUE,
    model           text NOT NULL,
    scope_glob      text NOT NULL,
    metric_name     text NOT NULL,
    threshold       real NOT NULL,
    description     text
);

COMMENT ON TABLE reporting.dim_evaluator IS
    'Conformed dimension: evaluator roles with model routing and thresholds.';

-- Pre-populate 5 evaluator roles (from agentevals.md)
INSERT INTO reporting.dim_evaluator
    (evaluator_role, model, scope_glob, metric_name, threshold, description)
VALUES
    ('type-safety-auditor', 'claude-opus-4-6', '**/*.ts',
     'branded_types_coverage', 0.8,
     'Boris Cherny branded types, Result<T,E>, exhaustive unions'),
    ('warehouse-conformance', 'claude-opus-4-6', '**/migrations/*.sql',
     'kimball_conformance', 1.0,
     'Grain declared, SCD annotated, additivity documented, bus matrix'),
    ('security-reviewer', 'claude-sonnet-4-6', 'agenttasks/src/**',
     'owasp_findings', 0.0,
     'OWASP Top 10, injection, XSS, SSRF, credential exposure'),
    ('doc-freshness-checker', 'claude-haiku-4-5', '.claude/**',
     'stale_reference_count', 0.0,
     'Pinned doc staleness vs changelog versions'),
    ('test-coverage-auditor', 'claude-sonnet-4-6', '**/*.test.ts',
     'mutation_survival_rate', 0.1,
     'Mutation testing: <10% mutations should survive');

-- ── Reporting: fact_eval_finding ─────────────────────────────────
-- GRAIN: one row per finding per evaluator per eval run.
-- Star schema fact table joining dim_evaluator, dim_date, dim_agent.

CREATE TABLE reporting.fact_eval_finding (
    eval_finding_sk     bigserial PRIMARY KEY,
    evaluator_sk        integer NOT NULL REFERENCES reporting.dim_evaluator(evaluator_sk),
    date_sk             integer NOT NULL REFERENCES reporting.dim_date(date_sk),
    agent_sk            integer REFERENCES reporting.dim_agent(agent_sk),
    eval_event_id       uuid REFERENCES runtime.eval_events(id),
    target_path         text NOT NULL,
    severity            text NOT NULL,
    pass                boolean NOT NULL,
    score               real,
    resolution_time_hours real   -- NULL until resolved
);

COMMENT ON TABLE reporting.fact_eval_finding IS
    'GRAIN: one row per finding per evaluator per eval run. Star schema fact.';

-- Bloom index for multi-column filtering
CREATE INDEX idx_fact_eval_bloom ON reporting.fact_eval_finding
    USING bloom (evaluator_sk, date_sk, agent_sk)
    WITH (col1 = 2, col2 = 3, col3 = 2);

-- B-tree for severity filtering
CREATE INDEX idx_fact_eval_severity ON reporting.fact_eval_finding (severity)
    WHERE NOT pass;

-- ── Semantic: eval_pass_rate ────────────────────────────────────
-- Business metric: pass rate per evaluator role.

CREATE OR REPLACE VIEW semantic.eval_pass_rate AS
SELECT
    de.evaluator_role,
    de.model,
    de.metric_name,
    de.threshold,
    count(*) AS total_findings,
    count(*) FILTER (WHERE fef.pass) AS passed,
    count(*) FILTER (WHERE NOT fef.pass) AS failed,
    round(
        (count(*) FILTER (WHERE fef.pass))::numeric /
        NULLIF(count(*), 0),
        3
    ) AS pass_rate,
    CASE
        WHEN round(
            (count(*) FILTER (WHERE fef.pass))::numeric /
            NULLIF(count(*), 0),
            3
        ) >= de.threshold THEN true
        ELSE false
    END AS meets_threshold
FROM reporting.fact_eval_finding fef
JOIN reporting.dim_evaluator de ON de.evaluator_sk = fef.evaluator_sk
GROUP BY de.evaluator_role, de.model, de.metric_name, de.threshold
ORDER BY pass_rate ASC;

COMMENT ON VIEW semantic.eval_pass_rate IS
    'Business metric: eval pass rate per evaluator role with threshold check.';

-- ── Semantic: eval_coverage ─────────────────────────────────────
-- Business metric: what fraction of the codebase has been evaluated.

CREATE OR REPLACE VIEW semantic.eval_coverage AS
SELECT
    de.evaluator_role,
    de.scope_glob,
    count(DISTINCT fef.target_path) AS paths_evaluated,
    count(DISTINCT fef.eval_finding_sk) AS total_findings,
    round(avg(fef.score)::numeric, 3) AS avg_score,
    min(dd.full_date) AS first_eval_date,
    max(dd.full_date) AS last_eval_date,
    max(dd.full_date) - min(dd.full_date) AS eval_span_days
FROM reporting.fact_eval_finding fef
JOIN reporting.dim_evaluator de ON de.evaluator_sk = fef.evaluator_sk
JOIN reporting.dim_date dd ON dd.date_sk = fef.date_sk
GROUP BY de.evaluator_role, de.scope_glob
ORDER BY paths_evaluated DESC;

COMMENT ON VIEW semantic.eval_coverage IS
    'Business metric: codebase evaluation coverage per evaluator role.';

-- ── Semantic: eval_severity_breakdown ───────────────────────────
-- Business metric: severity distribution across all eval findings.

CREATE OR REPLACE VIEW semantic.eval_severity_breakdown AS
SELECT
    de.evaluator_role,
    fef.severity,
    count(*) AS finding_count,
    count(*) FILTER (WHERE fef.pass) AS passed,
    count(*) FILTER (WHERE NOT fef.pass) AS failed,
    round(avg(fef.score)::numeric, 3) AS avg_score
FROM reporting.fact_eval_finding fef
JOIN reporting.dim_evaluator de ON de.evaluator_sk = fef.evaluator_sk
GROUP BY de.evaluator_role, fef.severity
ORDER BY de.evaluator_role,
    CASE fef.severity
        WHEN 'critical' THEN 1
        WHEN 'warning' THEN 2
        WHEN 'info' THEN 3
    END;

COMMENT ON VIEW semantic.eval_severity_breakdown IS
    'Business metric: eval finding severity distribution per evaluator role.';

COMMIT;
