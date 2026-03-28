-- 010_bloom_filter_state.sql — Bloom filter persistence table
--
-- Persists bloom filter state across crawler restarts.
-- Each crawler (Crawlee TypeScript, Scrapy Python) maintains its own filter.
-- The binary state is stored as BYTEA for fast serialization/deserialization.

CREATE TABLE bloom_filter_state (
    filter_id           SERIAL          PRIMARY KEY,
    crawler_id          VARCHAR(100)    NOT NULL,        -- e.g. 'crawlee-docs', 'scrapy-docs'
    domain              VARCHAR(255)    NOT NULL,        -- e.g. 'docs.anthropic.com'
    -- Filter parameters (frozen at creation)
    expected_items      INT             NOT NULL,
    false_positive_rate NUMERIC(8,7)    NOT NULL,
    hash_functions      SMALLINT        NOT NULL,
    bit_array_size      INT             NOT NULL,
    -- State
    items_inserted      INT             NOT NULL DEFAULT 0,
    filter_bytes        BYTEA           NOT NULL,        -- serialized bloom filter
    -- Metadata
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (crawler_id, domain)
);

COMMENT ON TABLE bloom_filter_state IS
    'Persists bloom filter binary state across crawler restarts. '
    'One row per (crawler_id, domain) pair. '
    'Crawlee and Scrapy crawlers load/save filter state via this table.';
