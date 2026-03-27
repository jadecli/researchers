-- 005_etl_functions.sql — ETL functions + pg_cron scheduling
-- These functions transform runtime data → reporting star schema.
-- Scheduled via pg_cron to run every 15 minutes.

BEGIN;

-- ── ETL: Crawl Events → dim_page + fact_crawl_quality ───────
CREATE OR REPLACE FUNCTION etl_crawl_events_to_warehouse()
RETURNS void AS $$
DECLARE
    v_new_pages integer := 0;
    v_new_facts integer := 0;
BEGIN
    -- Step 1: Upsert dim_page (SCD Type 2)
    -- New URLs get a fresh dimension row.
    -- Changed page_types close the old row and open a new one.
    INSERT INTO reporting.dim_page (url, domain, page_type, first_seen, last_seen)
    SELECT DISTINCT ON (ce.url)
        ce.url,
        substring(ce.url from 'https?://([^/]+)'),
        ce.metadata -> 'page_type',
        MIN(ce.created_at),
        MAX(ce.created_at)
    FROM runtime.crawl_events ce
    WHERE NOT EXISTS (
        SELECT 1 FROM reporting.dim_page dp
        WHERE dp.url = ce.url AND dp.is_current = true
    )
    GROUP BY ce.url, ce.metadata -> 'page_type'
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_new_pages = ROW_COUNT;

    -- Update last_seen for existing pages
    UPDATE reporting.dim_page dp
    SET last_seen = sub.max_seen
    FROM (
        SELECT url, MAX(created_at) AS max_seen
        FROM runtime.crawl_events
        GROUP BY url
    ) sub
    WHERE dp.url = sub.url AND dp.is_current = true;

    -- Step 2: Insert fact_crawl_quality
    -- Only insert events not already in the fact table (idempotent)
    INSERT INTO reporting.fact_crawl_quality (
        page_sk, round_sk, date_sk,
        overall_score, content_changed
    )
    SELECT
        dp.page_sk,
        dr.round_sk,
        to_char(ce.created_at, 'YYYYMMDD')::integer,
        ce.quality_score,
        -- Content changed if hash differs from prior crawl of same URL
        ce.content_hash IS DISTINCT FROM (
            SELECT prev.content_hash
            FROM runtime.crawl_events prev
            WHERE prev.url = ce.url
              AND prev.created_at < ce.created_at
            ORDER BY prev.created_at DESC
            LIMIT 1
        )
    FROM runtime.crawl_events ce
    JOIN reporting.dim_page dp ON dp.url = ce.url AND dp.is_current = true
    LEFT JOIN reporting.dim_round dr ON dr.round_number = ce.round_number
    WHERE ce.quality_score IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM reporting.fact_crawl_quality fcq
          WHERE fcq.page_sk = dp.page_sk
            AND fcq.round_sk = dr.round_sk
      );

    GET DIAGNOSTICS v_new_facts = ROW_COUNT;

    -- Step 3: Refresh materialized view
    REFRESH MATERIALIZED VIEW CONCURRENTLY reporting.mv_round_summary;

    RAISE NOTICE 'ETL complete: % new pages, % new facts', v_new_pages, v_new_facts;
END;
$$ LANGUAGE plpgsql;

-- ── ETL: Dispatch Events → fact_dispatch ────────────────────
CREATE OR REPLACE FUNCTION etl_dispatch_events_to_warehouse()
RETURNS void AS $$
BEGIN
    INSERT INTO reporting.fact_dispatch (
        round_sk, agent_sk, date_sk,
        task_type, platform, quality_score,
        input_tokens, output_tokens, cost_usd,
        duration_ms, success
    )
    SELECT
        dr.round_sk,
        da.agent_sk,
        to_char(de.created_at, 'YYYYMMDD')::integer,
        de.task_type,
        de.platform,
        de.quality_score,
        de.input_tokens,
        de.output_tokens,
        de.cost_usd,
        de.duration_ms,
        de.success
    FROM runtime.dispatch_events de
    LEFT JOIN reporting.dim_round dr ON dr.round_number = de.round_number
    LEFT JOIN reporting.dim_agent da ON da.agent_id = de.agent_id
    WHERE NOT EXISTS (
        SELECT 1 FROM reporting.fact_dispatch fd
        WHERE fd.round_sk = dr.round_sk
          AND fd.date_sk = to_char(de.created_at, 'YYYYMMDD')::integer
          AND fd.task_type = de.task_type
          AND fd.platform = de.platform
    );
END;
$$ LANGUAGE plpgsql;

-- ── Schedule ETL via pg_cron ────────────────────────────────
-- Runs every 15 minutes. Only active when compute is running.
-- On Neon, pg_cron jobs pause when compute scales to zero.

-- Note: pg_cron must be enabled first via Neon console.
-- These will fail silently if pg_cron is not enabled.
DO $$
BEGIN
    PERFORM cron.schedule(
        'etl_crawl_to_warehouse',
        '*/15 * * * *',
        'SELECT etl_crawl_events_to_warehouse()'
    );
    PERFORM cron.schedule(
        'etl_dispatch_to_warehouse',
        '*/15 * * * *',
        'SELECT etl_dispatch_events_to_warehouse()'
    );
EXCEPTION
    WHEN undefined_function THEN
        RAISE NOTICE 'pg_cron not available — ETL scheduling skipped. Run manually or enable pg_cron.';
END;
$$;

COMMIT;
