-- TABLE_NAME: reporting.dim_page
-- LOAD_TYPE: full_refresh (TRUNCATE + INSERT)
-- SCHEDULE: daily 02:00 UTC
-- START_BACKFILL_DATE: 2026-03-26
-- DEPENDS_ON: 010_stg_crawl_events
-- QUALITY_CHECKS: row_count > 0, no duplicate urls, no null domains

TRUNCATE reporting.dim_page CASCADE;

INSERT INTO reporting.dim_page (url, domain, page_type, first_seen, last_seen, is_current, valid_from)
SELECT
    url_normalized as url,
    domain,
    metadata -> 'page_type' as page_type,
    min(created_at) as first_seen,
    max(created_at) as last_seen,
    true as is_current,
    now() as valid_from
FROM staging.crawl_events_clean
GROUP BY url_normalized, domain, metadata -> 'page_type';

-- QUALITY CHECKS
DO $$ BEGIN
    ASSERT (SELECT count(*) FROM reporting.dim_page) > 0,
        'FAIL: dim_page is empty';
    ASSERT (SELECT count(*) FROM reporting.dim_page WHERE url IS NULL) = 0,
        'FAIL: null URLs in dim_page';
    ASSERT (SELECT count(*) FROM reporting.dim_page WHERE domain IS NULL) = 0,
        'FAIL: null domains in dim_page';
    ASSERT (SELECT count(*) - count(DISTINCT url) FROM reporting.dim_page WHERE is_current) = 0,
        'FAIL: duplicate URLs in dim_page';
    RAISE NOTICE 'PASS: dim_page — % rows', (SELECT count(*) FROM reporting.dim_page);
END $$;
