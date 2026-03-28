-- Migration 008: Official vendor skills crawl storage
--
-- Runtime layer table for skills crawled from skills.sh/official registry.
-- Only official (creator-owned) skills are stored. Community/non-official
-- skills are excluded for security.
--
-- Spider: official_skills_spider
-- Grain: one row per skill per creator (upserted on content change)

-- ── Runtime Layer ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS runtime.skill_events (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url                 text NOT NULL,
    org                 text NOT NULL,           -- GitHub org (e.g. "anthropics")
    repo                text NOT NULL,           -- GitHub repo (e.g. "skills")
    skill_name          text NOT NULL,           -- From SKILL.md frontmatter name field
    skill_description   text DEFAULT '',         -- From SKILL.md frontmatter description
    skill_dir           text DEFAULT '',         -- Directory path within repo
    file_path           text DEFAULT '',         -- Full path to SKILL.md
    branch              text DEFAULT 'main',
    license             text DEFAULT 'unknown',  -- SPDX identifier
    frontmatter         jsonb DEFAULT '{}',      -- Full YAML frontmatter as JSON
    body                text DEFAULT '',         -- Markdown body below frontmatter
    content_hash        text NOT NULL,           -- SHA-256 for change detection
    quality_score       real DEFAULT 0.0 CHECK (quality_score >= 0.0 AND quality_score <= 1.0),
    stars               integer DEFAULT 0,
    round_number        smallint DEFAULT 0,
    has_examples        boolean DEFAULT false,
    has_scripts         boolean DEFAULT false,
    word_count          integer DEFAULT 0,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint for upsert: one skill per org/repo/name
CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_events_org_repo_name
    ON runtime.skill_events (org, repo, skill_name);

-- BRIN index for time-range queries
CREATE INDEX IF NOT EXISTS idx_skill_events_created
    ON runtime.skill_events USING brin (created_at);

-- B-tree for org lookups (filter by creator)
CREATE INDEX IF NOT EXISTS idx_skill_events_org
    ON runtime.skill_events (org);

-- GIN index on frontmatter for JSONB queries
CREATE INDEX IF NOT EXISTS idx_skill_events_frontmatter
    ON runtime.skill_events USING gin (frontmatter);

-- Full-text search on skill body
CREATE INDEX IF NOT EXISTS idx_skill_events_body_trgm
    ON runtime.skill_events USING gin (body gin_trgm_ops);

COMMENT ON TABLE runtime.skill_events IS
    'Official vendor skills from skills.sh/official registry. '
    'Crawled by official_skills_spider. Upserted on content change via content_hash.';

COMMENT ON COLUMN runtime.skill_events.content_hash IS
    'SHA-256 of SKILL.md content. Used for change detection across crawl rounds.';

COMMENT ON COLUMN runtime.skill_events.frontmatter IS
    'Full YAML frontmatter from SKILL.md as JSONB. Minimum fields: name, description.';


-- ── Reporting Layer ─────────────────────────────────────────────

-- Dimension: skill creators (official vendors)
CREATE TABLE IF NOT EXISTS reporting.dim_skill_creator (
    creator_sk          serial PRIMARY KEY,
    org                 text NOT NULL UNIQUE,
    repo                text NOT NULL,
    license             text DEFAULT 'unknown',
    stars               integer DEFAULT 0,
    skill_count         integer DEFAULT 0,
    first_seen          timestamptz DEFAULT now(),
    last_seen           timestamptz DEFAULT now(),
    is_current          boolean DEFAULT true
);

COMMENT ON TABLE reporting.dim_skill_creator IS
    'Dimension: official skill creators from skills.sh/official. SCD Type 1.';

-- Fact: skill quality measurements
-- GRAIN: one row per skill per crawl round
CREATE TABLE IF NOT EXISTS reporting.fact_skill_quality (
    skill_quality_sk    bigserial PRIMARY KEY,
    skill_name          text NOT NULL,
    creator_sk          integer REFERENCES reporting.dim_skill_creator(creator_sk),
    round_sk            integer REFERENCES reporting.dim_round(round_sk),
    date_sk             integer,
    quality_score       real,
    word_count          integer,
    has_examples        boolean,
    has_scripts         boolean,
    content_changed     boolean,
    created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE reporting.fact_skill_quality IS
    'Fact: skill quality per crawl round. GRAIN: one row per skill per round.';

-- Bloom index for multi-column scans on fact table
CREATE INDEX IF NOT EXISTS idx_fact_skill_quality_bloom
    ON reporting.fact_skill_quality USING bloom (creator_sk, round_sk, date_sk);


-- ── Semantic Views ──────────────────────────────────────────────

-- Metric: average skill quality per creator
CREATE OR REPLACE VIEW semantic.avg_skill_quality_by_creator AS
SELECT
    dc.org AS creator,
    dc.skill_count,
    dc.stars,
    ROUND(AVG(fsq.quality_score)::numeric, 4) AS avg_quality,
    COUNT(DISTINCT fsq.skill_name) AS skills_measured,
    MAX(fsq.created_at) AS last_measured
FROM reporting.fact_skill_quality fsq
JOIN reporting.dim_skill_creator dc ON dc.creator_sk = fsq.creator_sk
GROUP BY dc.org, dc.skill_count, dc.stars;

COMMENT ON VIEW semantic.avg_skill_quality_by_creator IS
    'Metric: average skill quality score per official creator. Non-additive.';

-- Metric: skill catalog overview
CREATE OR REPLACE VIEW semantic.skill_catalog AS
SELECT
    se.org AS creator,
    se.skill_name,
    se.skill_description,
    se.license,
    se.quality_score,
    se.word_count,
    se.has_examples,
    se.has_scripts,
    se.stars,
    se.updated_at
FROM runtime.skill_events se
ORDER BY se.org, se.skill_name;

COMMENT ON VIEW semantic.skill_catalog IS
    'Official vendor skill catalog from skills.sh/official. Read-only semantic view.';
