-- pg-graphql-views.sql — UDA projection views for pg_graphql
--
-- pg_graphql auto-generates GraphQL types from tables with primary keys.
-- These views provide curated, analytics-friendly GraphQL entry points
-- that complement the raw table access.
--
-- Netflix UDA: "A projection produces a concrete data container."
-- These views are concrete realizations of the metamodel for GraphQL consumers.

-- ─── Current Doc Surfaces (hides SCD Type 2 complexity) ────────────────────
-- GraphQL consumers see only the current version of each page.
CREATE OR REPLACE VIEW current_doc_surfaces AS
SELECT
    doc_surface_key,
    canonical_url,
    slug,
    page_title,
    surface,
    priority,
    agent_strategy,
    output_formats,
    parent_slug,
    content_hash,
    version,
    effective_date
FROM dim_doc_surface
WHERE is_current = TRUE;

COMMENT ON VIEW current_doc_surfaces IS
    'UDA projection: current version of each doc surface for GraphQL. '
    'Hides SCD Type 2 expiration columns. Query via graphql.resolve().';

-- ─── Crawl Summary (aggregated view for dashboards) ────────────────────────
CREATE OR REPLACE VIEW crawl_summary AS
SELECT
    ds.slug,
    ds.page_title,
    ds.surface,
    ds.priority,
    a.agent_id,
    a.model_routing_tier,
    COUNT(*)                                            AS total_crawls,
    COUNT(*) FILTER (WHERE ce.is_success)               AS successful_crawls,
    COUNT(*) FILTER (WHERE ce.bloom_filter_hit)         AS bloom_deduped,
    AVG(ce.elapsed_ms)                                  AS avg_elapsed_ms,
    SUM(ce.response_bytes)                              AS total_bytes,
    SUM(ce.items_extracted)                             AS total_items,
    MAX(ce.crawl_ts)                                    AS last_crawl_ts
FROM fact_crawl_event ce
JOIN dim_doc_surface ds ON ce.doc_surface_key = ds.doc_surface_key AND ds.is_current = TRUE
JOIN dim_agent a ON ce.agent_key = a.agent_key
GROUP BY ds.slug, ds.page_title, ds.surface, ds.priority, a.agent_id, a.model_routing_tier;

COMMENT ON VIEW crawl_summary IS
    'UDA projection: aggregated crawl metrics per (page, agent) pair. '
    'Exposes bloom filter dedup effectiveness and model routing tier usage.';

-- ─── Quality Dashboard ─────────────────────────────────────────────────────
CREATE OR REPLACE VIEW quality_dashboard AS
SELECT
    ds.slug,
    ds.page_title,
    ds.surface,
    AVG(qc.completeness_score)                          AS avg_completeness,
    AVG(qc.freshness_score)                             AS avg_freshness,
    AVG(qc.structural_score)                            AS avg_structural,
    AVG(qc.overall_score)                               AS avg_overall,
    COUNT(*) FILTER (WHERE qc.is_stale)                 AS stale_checks,
    COUNT(*)                                            AS total_checks,
    MAX(qc.evaluated_ts)                                AS last_evaluated
FROM fact_quality_check qc
JOIN dim_doc_surface ds ON qc.doc_surface_key = ds.doc_surface_key AND ds.is_current = TRUE
GROUP BY ds.slug, ds.page_title, ds.surface;

COMMENT ON VIEW quality_dashboard IS
    'UDA projection: quality scores aggregated per page for dashboard consumption.';

-- ─── Model Routing Cost Analysis ───────────────────────────────────────────
CREATE OR REPLACE VIEW model_routing_costs AS
SELECT
    d.model_tier_used,
    dd.year,
    dd.month,
    COUNT(*)                                            AS total_dispatches,
    SUM(d.input_tokens)                                 AS total_input_tokens,
    SUM(d.output_tokens)                                AS total_output_tokens,
    AVG(d.queue_wait_ms)                                AS avg_queue_wait_ms
FROM fact_dispatch d
JOIN dim_date dd ON d.date_key = dd.date_key
WHERE d.model_tier_used IS NOT NULL
GROUP BY d.model_tier_used, dd.year, dd.month
ORDER BY dd.year, dd.month, d.model_tier_used;

COMMENT ON VIEW model_routing_costs IS
    'UDA projection: monthly token usage by model tier (haiku/sonnet/opus). '
    'Feeds pg_graphql for cost tracking dashboards.';
