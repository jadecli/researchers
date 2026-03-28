-- 009_fact_quality_check.sql — Quality evaluation fact table
--
-- Grain: one quality evaluation of one crawled document
-- Links back to the crawl event that produced the content.
--
-- Kimball bus matrix: dim_date x dim_time x dim_doc_surface x dim_agent
-- Cube.js semantic: ../cube/fact_quality_check.yml

CREATE TABLE fact_quality_check (
    quality_check_id    BIGSERIAL       PRIMARY KEY,
    -- Foreign keys to conformed dimensions
    date_key            INT             NOT NULL REFERENCES dim_date(date_key),
    time_key            INT             NOT NULL REFERENCES dim_time_of_day(time_key),
    doc_surface_key     INT             NOT NULL REFERENCES dim_doc_surface(doc_surface_key),
    agent_key           INT             NOT NULL REFERENCES dim_agent(agent_key),
    -- Link to the crawl that produced this content
    crawl_event_id      BIGINT          REFERENCES fact_crawl_event(crawl_event_id),
    -- Measures (semi-additive: can be averaged, not summed)
    completeness_score  NUMERIC(5,4)    CHECK (completeness_score BETWEEN 0 AND 1),
    freshness_score     NUMERIC(5,4)    CHECK (freshness_score BETWEEN 0 AND 1),
    structural_score    NUMERIC(5,4)    CHECK (structural_score BETWEEN 0 AND 1),
    overall_score       NUMERIC(5,4)    CHECK (overall_score BETWEEN 0 AND 1),
    -- Additive measures
    sections_missing    SMALLINT        DEFAULT 0,
    sections_found      SMALLINT        DEFAULT 0,
    -- Flags
    is_stale            BOOLEAN         NOT NULL DEFAULT FALSE,
    -- Timestamp
    evaluated_ts        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quality_doc ON fact_quality_check (doc_surface_key, date_key);
CREATE INDEX idx_quality_crawl ON fact_quality_check (crawl_event_id);

COMMENT ON TABLE fact_quality_check IS
    'Quality evaluation fact table. Grain: one quality assessment of one crawled document. '
    'Scores are semi-additive (average across dimensions, do not sum).';
