-- TABLE_NAME: staging.crawl_events_clean
-- LOAD_TYPE: hourly_snapshot (TRUNCATE + INSERT)
-- SCHEDULE: every hour at :05
-- START_BACKFILL_DATE: 2026-03-26
-- DEPENDS_ON: runtime.crawl_events (source)
-- QUALITY_CHECKS: no null urls, no null spider_name, quality_score 0-1, row_count > 0

CREATE SCHEMA IF NOT EXISTS staging;

CREATE TABLE IF NOT EXISTS staging.crawl_events_clean (
    id              uuid PRIMARY KEY,
    url             citext NOT NULL,
    url_normalized  citext NOT NULL,
    domain          text NOT NULL,
    spider_name     text NOT NULL,
    round_number    smallint,
    quality_score   real CHECK (quality_score >= 0 AND quality_score <= 1),
    content_hash    bytea,
    metadata        hstore,
    created_at      timestamptz NOT NULL,
    loaded_at       timestamptz NOT NULL DEFAULT now()
);

-- TRUNCATE + INSERT (no merge complexity)
TRUNCATE staging.crawl_events_clean;

INSERT INTO staging.crawl_events_clean (
    id, url, url_normalized, domain, spider_name,
    round_number, quality_score, content_hash, metadata, created_at
)
SELECT DISTINCT ON (lower(trim(trailing '/' from url)))
    id,
    url,
    lower(trim(trailing '/' from url)) as url_normalized,
    coalesce(
        substring(url from 'https?://([^/]+)'),
        'unknown'
    ) as domain,
    spider_name,
    round_number,
    quality_score,
    content_hash,
    metadata,
    created_at
FROM runtime.crawl_events
WHERE url IS NOT NULL
  AND spider_name IS NOT NULL
ORDER BY lower(trim(trailing '/' from url)), created_at DESC;

-- QUALITY CHECKS
DO $$ BEGIN
    ASSERT (SELECT count(*) FROM staging.crawl_events_clean) > 0,
        'FAIL: staging.crawl_events_clean is empty';
    ASSERT (SELECT count(*) FROM staging.crawl_events_clean WHERE url IS NULL) = 0,
        'FAIL: null URLs in staging';
    ASSERT (SELECT count(*) FROM staging.crawl_events_clean WHERE spider_name IS NULL) = 0,
        'FAIL: null spider_name in staging';
    ASSERT (SELECT count(*) FROM staging.crawl_events_clean WHERE quality_score < 0 OR quality_score > 1) = 0,
        'FAIL: quality_score out of range';
    RAISE NOTICE 'PASS: staging.crawl_events_clean — % rows',
        (SELECT count(*) FROM staging.crawl_events_clean);
END $$;
