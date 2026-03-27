-- TABLE_NAME: reporting.fact_crawl_quality
-- LOAD_TYPE: daily_snapshot (TRUNCATE + INSERT)
-- SCHEDULE: daily 02:15 UTC
-- START_BACKFILL_DATE: 2026-03-26
-- DEPENDS_ON: 010_stg_crawl_events, 020_dim_page, 030_dim_round, 050_dim_date
-- QUALITY_CHECKS: row_count > 0, valid FKs, scores 0-1
-- GRAIN: one row per page per round

TRUNCATE reporting.fact_crawl_quality;

INSERT INTO reporting.fact_crawl_quality (
    page_sk, round_sk, date_sk,
    overall_score, content_changed
)
SELECT
    dp.page_sk,
    dr.round_sk,
    to_char(ce.created_at, 'YYYYMMDD')::integer as date_sk,
    ce.quality_score as overall_score,
    true as content_changed
FROM staging.crawl_events_clean ce
JOIN reporting.dim_page dp ON dp.url = ce.url_normalized AND dp.is_current = true
LEFT JOIN reporting.dim_round dr ON dr.round_number = ce.round_number
WHERE ce.quality_score IS NOT NULL;

-- QUALITY CHECKS
DO $$ BEGIN
    ASSERT (SELECT count(*) FROM reporting.fact_crawl_quality) > 0,
        'FAIL: fact_crawl_quality is empty';
    ASSERT (SELECT count(*) FROM reporting.fact_crawl_quality WHERE page_sk IS NULL) = 0,
        'FAIL: null page_sk (orphaned FK)';
    ASSERT (SELECT count(*) FROM reporting.fact_crawl_quality WHERE overall_score < 0 OR overall_score > 1) = 0,
        'FAIL: overall_score out of range';
    RAISE NOTICE 'PASS: fact_crawl_quality — % rows',
        (SELECT count(*) FROM reporting.fact_crawl_quality);
END $$;
