-- 008_agentdata_schema.sql — Ground truth store for agent context
--
-- Tier 4 of the Kimball architecture: agentdata schema.
-- Stores crawled documentation, structured changelog bullets,
-- and bloom filter state for change detection.
--
-- Dependencies: 001_extensions.sql (pg_graphql)
-- Used by: agentcrawls-ts crawler pipeline

-- Enable pg_graphql if not already (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_graphql;

-- ── Schema ───────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS agentdata;

COMMENT ON SCHEMA agentdata IS '@graphql({"inflect_names": true})';

-- ── Pinned document storage (crawled markdown) ───────────────────
CREATE TABLE agentdata.doc_pins (
  pin_id         TEXT PRIMARY KEY,
  source_url     TEXT NOT NULL,
  content_md     TEXT NOT NULL,
  content_hash   TEXT NOT NULL,
  crawl_version  DATE NOT NULL DEFAULT CURRENT_DATE,
  token_count    INTEGER,
  created_at     TIMESTAMPTZ DEFAULT now(),
  is_current     BOOLEAN DEFAULT true
);

COMMENT ON TABLE agentdata.doc_pins IS 'Pinned documentation snapshots (SCD Type 2)';

-- ── Changelog bullets (structured extraction) ────────────────────
CREATE TABLE agentdata.changelog_bullets (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_repo    TEXT NOT NULL,
  version        TEXT NOT NULL,
  release_date   DATE,
  category       TEXT,
  description    TEXT NOT NULL,
  breaking       BOOLEAN DEFAULT false,
  raw_markdown   TEXT,
  crawled_at     TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE agentdata.changelog_bullets IS 'Structured changelog entries extracted by agentcrawls-ts';

-- Unique constraint to prevent duplicate bullets
CREATE UNIQUE INDEX idx_changelog_unique
  ON agentdata.changelog_bullets (source_repo, version, description);

-- ── Bloom filter state persistence ───────────────────────────────
CREATE TABLE agentdata.bloom_state (
  filter_name    TEXT PRIMARY KEY,
  filter_data    BYTEA NOT NULL,
  item_count     INTEGER DEFAULT 0,
  updated_at     TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE agentdata.bloom_state IS 'Serialized bloom filter state for change detection';

-- ── Indexes ──────────────────────────────────────────────────────

-- Bloom index for multi-column queries on changelog_bullets
-- Requires btree_gin extension (already in 001_extensions.sql)
CREATE INDEX idx_changelog_repo_version
  ON agentdata.changelog_bullets (source_repo, version);

CREATE INDEX idx_changelog_crawled_at
  ON agentdata.changelog_bullets (crawled_at DESC);

CREATE INDEX idx_doc_pins_current
  ON agentdata.doc_pins (is_current) WHERE is_current = true;

-- ── Views ────────────────────────────────────────────────────────

-- Agent-consumable view: latest changelog per repo (last 7 days)
CREATE VIEW agentdata.latest_changelog AS
SELECT source_repo, version, release_date, category, description, breaking
FROM agentdata.changelog_bullets
WHERE crawled_at > now() - INTERVAL '7 days'
ORDER BY source_repo, release_date DESC NULLS LAST, id DESC;

COMMENT ON VIEW agentdata.latest_changelog IS 'Recent changelog entries for agent context injection';

-- Agent-consumable view: current pinned docs
CREATE VIEW agentdata.current_pins AS
SELECT pin_id, source_url, content_md, crawl_version, token_count
FROM agentdata.doc_pins
WHERE is_current = true;

COMMENT ON VIEW agentdata.current_pins IS 'Active pinned documentation for agent context';

-- Summary view: bullet counts per repo/version
CREATE VIEW agentdata.changelog_summary AS
SELECT
  source_repo,
  version,
  release_date,
  COUNT(*) AS bullet_count,
  COUNT(*) FILTER (WHERE breaking) AS breaking_count,
  MIN(crawled_at) AS first_crawled
FROM agentdata.changelog_bullets
GROUP BY source_repo, version, release_date
ORDER BY source_repo, first_crawled DESC;

COMMENT ON VIEW agentdata.changelog_summary IS 'Aggregated changelog stats per repo/version';
