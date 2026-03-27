-- 001_extensions.sql — Neon PG18 extensions for Kimball three-layer architecture
-- FAIL FAST: if any CREATE EXTENSION fails, the transaction rolls back entirely.

BEGIN;

-- Runtime layer: time-ordered UUIDs, flexible metadata, fuzzy URL matching
CREATE EXTENSION IF NOT EXISTS "pgx_ulid";      -- PG18: use pgx_ulid instead of pg_uuidv7
CREATE EXTENSION IF NOT EXISTS hstore;           -- Key-value metadata on events
CREATE EXTENSION IF NOT EXISTS pg_trgm;          -- Trigram fuzzy URL matching for dedup

-- Reporting layer: vector similarity, bloom index, time-series
CREATE EXTENSION IF NOT EXISTS vector;           -- pgvector for semantic page dedup
CREATE EXTENSION IF NOT EXISTS bloom;            -- Multi-column probabilistic index
CREATE EXTENSION IF NOT EXISTS timescaledb;      -- Time-series hypertables (Apache-2 only)

-- Cross-layer: statistics and scheduling
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;  -- Query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_cron;              -- Scheduled ETL jobs

-- Utility
CREATE EXTENSION IF NOT EXISTS citext;           -- Case-insensitive text for URLs
CREATE EXTENSION IF NOT EXISTS pg_trgm;          -- Already created above, idempotent

COMMIT;

-- Verify extensions loaded
SELECT extname, extversion FROM pg_extension ORDER BY extname;
