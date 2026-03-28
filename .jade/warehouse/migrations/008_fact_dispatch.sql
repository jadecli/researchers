-- 008_fact_dispatch.sql — Dispatch decision fact table
--
-- Grain: one dispatch decision assigning one task to one agent
-- A retry is a new row. Tracks queue wait time and dispatch outcome.
--
-- Kimball bus matrix: dim_date x dim_time x dim_doc_surface x dim_agent x dim_crawl_config
-- Cube.js semantic: ../cube/fact_dispatch.yml

CREATE TABLE fact_dispatch (
    dispatch_id         BIGSERIAL       PRIMARY KEY,
    -- Foreign keys to conformed dimensions
    date_key            INT             NOT NULL REFERENCES dim_date(date_key),
    time_key            INT             NOT NULL REFERENCES dim_time_of_day(time_key),
    doc_surface_key     INT             NOT NULL REFERENCES dim_doc_surface(doc_surface_key),
    agent_key           INT             NOT NULL REFERENCES dim_agent(agent_key),
    crawl_config_key    INT             NOT NULL REFERENCES dim_crawl_config(crawl_config_key),
    -- Degenerate dimension
    dispatch_run_id     UUID            NOT NULL DEFAULT uuid_generate_v4(),
    priority            SMALLINT        NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    -- Measures
    queue_wait_ms       INT,            -- time from enqueue to agent pickup
    dispatch_outcome    VARCHAR(30)     NOT NULL CHECK (dispatch_outcome IN ('assigned', 'rejected', 'timed_out')),
    -- Model routing cost tracking
    model_tier_used     VARCHAR(20),    -- 'haiku','sonnet','opus'
    input_tokens        INT,
    output_tokens       INT,
    -- Timestamp
    dispatch_ts         TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dispatch_doc ON fact_dispatch (doc_surface_key, date_key);
CREATE INDEX idx_dispatch_agent ON fact_dispatch (agent_key, date_key);
CREATE INDEX idx_dispatch_run ON fact_dispatch (dispatch_run_id);

COMMENT ON TABLE fact_dispatch IS
    'Dispatch decision fact table. Grain: one dispatch decision for one task to one agent. '
    'Tracks model routing tier and token usage for cost analysis.';
