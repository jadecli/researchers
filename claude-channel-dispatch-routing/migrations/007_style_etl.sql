-- 007_style_etl.sql — ETL functions + pg_cron scheduling for style analytics
-- Transforms runtime.style_events → reporting star schema.
-- Follows conventions from 005_etl_functions.sql.
-- Scheduled via pg_cron to run every 15 minutes.

BEGIN;

-- ── ETL: Style Events → dim_style + dim_session + facts ──────
CREATE OR REPLACE FUNCTION etl_style_events_to_warehouse()
RETURNS void AS $$
DECLARE
    v_new_styles   integer := 0;
    v_new_sessions integer := 0;
    v_new_usage    integer := 0;
    v_new_creation integer := 0;
BEGIN
    -- Step 1: Upsert dim_session
    -- New session IDs get a fresh dimension row.
    INSERT INTO reporting.dim_session (session_id, started_at)
    SELECT DISTINCT ON (se.session_id)
        se.session_id,
        MIN(se.created_at)
    FROM runtime.style_events se
    WHERE NOT EXISTS (
        SELECT 1 FROM reporting.dim_session ds
        WHERE ds.session_id = se.session_id
    )
    GROUP BY se.session_id
    ON CONFLICT (session_id) DO NOTHING;

    GET DIAGNOSTICS v_new_sessions = ROW_COUNT;

    -- Step 2: Upsert dim_style (SCD Type 2)
    -- New style_ids get a fresh dimension row.
    -- Changed instructions_hash closes the old row and opens a new one.

    -- 2a: Close old rows where instructions_hash changed
    UPDATE reporting.dim_style ds
    SET
        is_current = false,
        valid_to = now()
    FROM (
        SELECT DISTINCT ON (style_id)
            style_id,
            style_name,
            style_kind,
            instructions_hash
        FROM runtime.style_events
        WHERE event_type IN ('create', 'edit')
          AND instructions_hash IS NOT NULL
        ORDER BY style_id, created_at DESC
    ) latest
    WHERE ds.style_id = latest.style_id
      AND ds.is_current = true
      AND ds.instructions_hash IS DISTINCT FROM latest.instructions_hash;

    -- 2b: Insert new current rows for changed or new styles
    INSERT INTO reporting.dim_style (style_id, style_name, style_kind, instructions_hash)
    SELECT DISTINCT ON (se.style_id)
        se.style_id,
        se.style_name,
        se.style_kind,
        se.instructions_hash
    FROM runtime.style_events se
    WHERE se.event_type IN ('create', 'edit')
      AND NOT EXISTS (
          SELECT 1 FROM reporting.dim_style ds
          WHERE ds.style_id = se.style_id
            AND ds.is_current = true
            AND ds.instructions_hash IS NOT DISTINCT FROM se.instructions_hash
      )
    ORDER BY se.style_id, se.created_at DESC
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_new_styles = ROW_COUNT;

    -- Step 3: Insert fact_style_usage (idempotent)
    -- One row per style selection event, deduped by style + session + timestamp date
    INSERT INTO reporting.fact_style_usage (
        style_sk, session_sk, agent_sk, date_sk,
        duration_active_ms, messages_sent, switches_in_session
    )
    SELECT
        ds.style_sk,
        sess.session_sk,
        da.agent_sk,
        to_char(se.created_at, 'YYYYMMDD')::integer,
        0,  -- duration filled by subsequent ETL pass
        0,  -- messages filled by subsequent ETL pass
        (
            SELECT COUNT(*) - 1
            FROM runtime.style_events se2
            WHERE se2.session_id = se.session_id
              AND se2.event_type = 'select'
              AND se2.created_at::date = se.created_at::date
        )::integer
    FROM runtime.style_events se
    JOIN reporting.dim_style ds
        ON ds.style_id = se.style_id AND ds.is_current = true
    JOIN reporting.dim_session sess
        ON sess.session_id = se.session_id
    LEFT JOIN reporting.dim_agent da
        ON da.agent_id = se.agent_id
    WHERE se.event_type = 'select'
      AND NOT EXISTS (
          SELECT 1 FROM reporting.fact_style_usage fu
          WHERE fu.style_sk = ds.style_sk
            AND fu.session_sk = sess.session_sk
            AND fu.date_sk = to_char(se.created_at, 'YYYYMMDD')::integer
      );

    GET DIAGNOSTICS v_new_usage = ROW_COUNT;

    -- Step 4: Insert fact_style_creation (idempotent)
    INSERT INTO reporting.fact_style_creation (
        style_sk, date_sk, session_sk,
        creation_method, sample_count
    )
    SELECT
        ds.style_sk,
        to_char(se.created_at, 'YYYYMMDD')::integer,
        sess.session_sk,
        CASE se.style_kind
            WHEN 'custom_upload'   THEN 'upload'
            WHEN 'custom_describe' THEN 'describe'
            WHEN 'custom_manual'   THEN 'manual'
            ELSE 'manual'
        END,
        COALESCE((se.metadata -> 'sample_count')::integer, 0)
    FROM runtime.style_events se
    JOIN reporting.dim_style ds
        ON ds.style_id = se.style_id AND ds.is_current = true
    JOIN reporting.dim_session sess
        ON sess.session_id = se.session_id
    WHERE se.event_type = 'create'
      AND NOT EXISTS (
          SELECT 1 FROM reporting.fact_style_creation fc
          WHERE fc.style_sk = ds.style_sk
            AND fc.session_sk = sess.session_sk
      );

    GET DIAGNOSTICS v_new_creation = ROW_COUNT;

    -- Step 5: Refresh materialized view
    REFRESH MATERIALIZED VIEW CONCURRENTLY reporting.mv_style_summary;

    RAISE NOTICE 'Style ETL complete: % new styles, % new sessions, % usage facts, % creation facts',
        v_new_styles, v_new_sessions, v_new_usage, v_new_creation;
END;
$$ LANGUAGE plpgsql;

-- ── Schedule ETL via pg_cron ──────────────────────────────────
-- Runs every 15 minutes. Pauses when Neon compute scales to zero.
DO $$
BEGIN
    PERFORM cron.schedule(
        'etl_style_to_warehouse',
        '*/15 * * * *',
        'SELECT etl_style_events_to_warehouse()'
    );
EXCEPTION
    WHEN undefined_function THEN
        RAISE NOTICE 'pg_cron not available — style ETL scheduling skipped. Run manually or enable pg_cron.';
END;
$$;

COMMIT;
