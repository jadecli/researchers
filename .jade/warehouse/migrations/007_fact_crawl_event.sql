-- 007_fact_crawl_event.sql — Crawl event fact table
--
-- Grain: one crawl attempt of one page by one agent at one instant
-- If the same page is crawled three times, that is three rows.
-- Degenerate dimension: crawl_run_id (groups events in one batch)
--
-- Kimball bus matrix: dim_date x dim_time x dim_doc_surface x dim_agent x dim_crawl_config
-- Cube.js semantic: ../cube/fact_crawl_event.yml

CREATE TABLE fact_crawl_event (
    crawl_event_id      BIGSERIAL       PRIMARY KEY,
    -- Foreign keys to conformed dimensions
    date_key            INT             NOT NULL REFERENCES dim_date(date_key),
    time_key            INT             NOT NULL REFERENCES dim_time_of_day(time_key),
    doc_surface_key     INT             NOT NULL REFERENCES dim_doc_surface(doc_surface_key),
    agent_key           INT             NOT NULL REFERENCES dim_agent(agent_key),
    crawl_config_key    INT             NOT NULL REFERENCES dim_crawl_config(crawl_config_key),
    -- Degenerate dimension
    crawl_run_id        UUID            NOT NULL DEFAULT uuid_generate_v4(),
    -- Bloom filter dedup tracking
    bloom_filter_hit    BOOLEAN         NOT NULL DEFAULT FALSE,  -- TRUE = URL was already seen
    bloom_filter_size   INT,                                     -- filter size at time of check
    -- Measures (additive facts)
    http_status_code    SMALLINT,
    response_bytes      INT,
    elapsed_ms          INT,
    items_extracted     INT             DEFAULT 0,
    links_discovered    INT             DEFAULT 0,
    retry_count         SMALLINT        DEFAULT 0,
    -- Semi-additive facts
    is_success          BOOLEAN         NOT NULL,
    error_class         VARCHAR(100),    -- NULL on success; e.g. 'TimeoutError'
    -- Exact timestamp for drill-down
    crawl_ts            TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Star schema access patterns
CREATE INDEX idx_crawl_event_doc ON fact_crawl_event (doc_surface_key, date_key);
CREATE INDEX idx_crawl_event_agent ON fact_crawl_event (agent_key, date_key);
CREATE INDEX idx_crawl_event_run ON fact_crawl_event (crawl_run_id);
CREATE INDEX idx_crawl_event_ts ON fact_crawl_event (crawl_ts);

COMMENT ON TABLE fact_crawl_event IS
    'Crawl event fact table. Grain: one crawl attempt of one page by one agent at one instant. '
    'bloom_filter_hit tracks whether the URL was already in the bloom filter at crawl time.';
