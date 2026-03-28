-- 006_dim_crawl_config.sql — Crawl configuration dimension
--
-- Grain: one row per distinct crawl configuration
-- Captures: depth, politeness, bloom filter params, retry policy
-- Cube.js semantic: ../cube/dim_crawl_config.yml

CREATE TABLE dim_crawl_config (
    crawl_config_key        SERIAL          PRIMARY KEY,
    config_label            VARCHAR(100)    NOT NULL,
    -- Crawl behavior
    max_depth               SMALLINT        NOT NULL DEFAULT 3,
    politeness_delay_ms     INT             NOT NULL DEFAULT 1000,
    respect_robots_txt      BOOLEAN         NOT NULL DEFAULT TRUE,
    follow_redirects        BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Bloom filter parameters (for dedup)
    bloom_expected_items    INT             NOT NULL DEFAULT 10000,
    bloom_false_positive    NUMERIC(6,5)    NOT NULL DEFAULT 0.001,
    bloom_hash_functions    SMALLINT,
    bloom_bit_size          INT,
    -- Retry policy
    retry_policy            VARCHAR(50)     NOT NULL DEFAULT 'exponential_backoff',
    max_retries             SMALLINT        NOT NULL DEFAULT 3,
    -- Full config snapshot for auditability
    config_json             JSONB
);

COMMENT ON TABLE dim_crawl_config IS
    'Crawl configuration dimension. Captures bloom filter params, '
    'politeness settings, and retry policies. '
    'bloom_expected_items and bloom_false_positive drive filter sizing.';
