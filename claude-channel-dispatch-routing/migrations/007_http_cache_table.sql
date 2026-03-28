-- 007_http_cache_table.sql — Missing runtime.http_cache table
--
-- Gap found in audit: NeonPostgresCacheStorage (neon_middleware.py:253)
-- creates this table inline via CREATE TABLE IF NOT EXISTS, but it was
-- never declared in the migration sequence. This migration formalizes it
-- so schema-diff tools and CI can track it.

BEGIN;

CREATE TABLE IF NOT EXISTS runtime.http_cache (
    fingerprint  text            PRIMARY KEY,
    url          text            NOT NULL,
    status       integer         NOT NULL,
    headers_json text            NOT NULL,
    body_gzip    bytea           NOT NULL,
    cached_at    double precision NOT NULL
);

-- Index for expiration cleanup (cached_at range scans)
CREATE INDEX IF NOT EXISTS idx_http_cache_cached_at
    ON runtime.http_cache (cached_at);

-- Index for URL lookups (debugging, admin)
CREATE INDEX IF NOT EXISTS idx_http_cache_url
    ON runtime.http_cache (url);

COMMENT ON TABLE runtime.http_cache IS
    'HTTP response cache for Scrapy HttpCacheStorage. '
    'Populated by NeonPostgresCacheStorage (neon_middleware.py). '
    'Keyed by SHA-1 fingerprint of request URL. '
    'Body stored as gzip-compressed bytea.';

COMMIT;
