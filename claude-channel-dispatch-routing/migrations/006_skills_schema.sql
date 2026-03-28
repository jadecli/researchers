-- 006_skills_schema.sql — Official vendor skills crawl persistence
--
-- Extends the Kimball 3-layer architecture (TD-003) with skills data.
-- Only stores official/verified vendor skills — no community skills.
--
-- Runtime: append-only skill crawl events
-- Reporting: dim_skill (SCD Type 2) + fact_skill_quality (star schema)
-- Semantic: skill catalog + quality metrics

-- ════════════════════════════════════════════════════════════════════
-- RUNTIME LAYER — Write path
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS runtime.skill_events (
    id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    url             citext      NOT NULL,
    skill_name      text        NOT NULL,
    publisher       text        NOT NULL,
    repo            text        NOT NULL,
    round_number    smallint    NOT NULL DEFAULT 0,
    response_status smallint    NOT NULL DEFAULT 200,
    content_hash    text        NOT NULL,           -- SHA-256 of markdown content
    body_size       integer     NOT NULL DEFAULT 0,
    quality_score   real        NOT NULL CHECK (quality_score >= 0 AND quality_score <= 1),
    domain          text,                           -- BAML enum: engineering, data, design, etc.
    maturity        text,                           -- BAML enum: flagship, established, growing, etc.
    content_type    text,                           -- BAML enum: framework, workflow, generator, etc.
    agent_target    text,                           -- BAML enum: claude-code, cursor, multi-agent, etc.
    install_count   integer,                        -- parsed from page (nullable)
    is_official     boolean     NOT NULL DEFAULT true,
    metadata        hstore,                         -- flexible key-value pairs
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- BRIN index for time-range queries (append-only pattern)
CREATE INDEX IF NOT EXISTS idx_skill_events_brin
    ON runtime.skill_events USING brin (created_at);

-- B-tree for exact lookups by URL + content hash (change detection)
CREATE INDEX IF NOT EXISTS idx_skill_events_url_hash
    ON runtime.skill_events (url, content_hash);

-- B-tree for publisher filtering (official-only queries)
CREATE INDEX IF NOT EXISTS idx_skill_events_publisher
    ON runtime.skill_events (publisher);

-- Trigram for fuzzy skill name search
CREATE INDEX IF NOT EXISTS idx_skill_events_name_trgm
    ON runtime.skill_events USING gin (skill_name gin_trgm_ops);

-- ════════════════════════════════════════════════════════════════════
-- REPORTING LAYER — Read path (star schema)
-- ════════════════════════════════════════════════════════════════════

-- Dimension: Skills (SCD Type 2 for tracking metadata changes)
CREATE TABLE IF NOT EXISTS reporting.dim_skill (
    skill_sk        serial      PRIMARY KEY,
    skill_name      text        NOT NULL,
    publisher       text        NOT NULL,
    repo            text        NOT NULL,
    domain          text,                           -- latest BAML classification
    maturity        text,                           -- latest BAML classification
    content_type    text,                           -- latest BAML classification
    agent_target    text,                           -- latest BAML classification
    install_count   integer,                        -- latest observed count
    source_url      text,                           -- GitHub source
    skills_sh_url   text,                           -- skills.sh page
    is_official     boolean     NOT NULL DEFAULT true,
    first_seen      timestamptz NOT NULL DEFAULT now(),
    last_seen       timestamptz NOT NULL DEFAULT now(),
    is_current      boolean     NOT NULL DEFAULT true,
    valid_from      timestamptz NOT NULL DEFAULT now(),
    valid_to        timestamptz NOT NULL DEFAULT '9999-12-31'::timestamptz
);

-- Current skills lookup
CREATE INDEX IF NOT EXISTS idx_dim_skill_current
    ON reporting.dim_skill (skill_name, publisher) WHERE is_current = true;

-- Fact: Skill crawl quality (one row per skill per round)
CREATE TABLE IF NOT EXISTS reporting.fact_skill_quality (
    skill_sk        integer     NOT NULL REFERENCES reporting.dim_skill(skill_sk),
    round_sk        integer     NOT NULL REFERENCES reporting.dim_round(round_sk),
    date_sk         integer     NOT NULL REFERENCES reporting.dim_date(date_sk),
    quality_score   real        NOT NULL CHECK (quality_score >= 0 AND quality_score <= 1),
    body_size       integer     NOT NULL DEFAULT 0,
    install_count   integer,
    content_changed boolean     NOT NULL DEFAULT false,
    extraction_ms   integer,
    PRIMARY KEY (skill_sk, round_sk, date_sk)
);

-- Bloom index for multi-column filtering (same pattern as fact_crawl_quality)
CREATE INDEX IF NOT EXISTS idx_fact_skill_quality_bloom
    ON reporting.fact_skill_quality USING bloom (skill_sk, round_sk, date_sk)
    WITH (col1 = 2, col2 = 2, col3 = 3);

-- Materialized view: skill catalog summary
CREATE MATERIALIZED VIEW IF NOT EXISTS reporting.mv_skill_catalog AS
SELECT
    ds.publisher,
    ds.domain,
    ds.maturity,
    COUNT(*)                    AS skill_count,
    AVG(fsq.quality_score)      AS avg_quality,
    SUM(ds.install_count)       AS total_installs,
    MAX(ds.last_seen)           AS last_crawled
FROM reporting.dim_skill ds
LEFT JOIN reporting.fact_skill_quality fsq ON ds.skill_sk = fsq.skill_sk
WHERE ds.is_current = true AND ds.is_official = true
GROUP BY ds.publisher, ds.domain, ds.maturity;

-- ════════════════════════════════════════════════════════════════════
-- SEMANTIC LAYER — Business contract (views only)
-- ════════════════════════════════════════════════════════════════════

-- Semantic view: current official skill catalog
CREATE OR REPLACE VIEW semantic.official_skill_catalog AS
SELECT
    skill_name,
    publisher,
    repo,
    domain,
    maturity,
    content_type,
    agent_target,
    install_count,
    skills_sh_url,
    source_url,
    first_seen,
    last_seen
FROM reporting.dim_skill
WHERE is_current = true
  AND is_official = true
ORDER BY install_count DESC NULLS LAST;

-- Semantic view: skill quality by publisher
CREATE OR REPLACE VIEW semantic.skill_quality_by_publisher AS
SELECT
    ds.publisher,
    COUNT(DISTINCT ds.skill_sk)     AS skill_count,
    AVG(fsq.quality_score)          AS avg_quality,
    SUM(ds.install_count)           AS total_installs,
    COUNT(CASE WHEN ds.maturity = 'flagship' THEN 1 END) AS flagship_count,
    COUNT(CASE WHEN ds.maturity = 'established' THEN 1 END) AS established_count
FROM reporting.dim_skill ds
LEFT JOIN reporting.fact_skill_quality fsq ON ds.skill_sk = fsq.skill_sk
WHERE ds.is_current = true AND ds.is_official = true
GROUP BY ds.publisher
ORDER BY total_installs DESC NULLS LAST;

-- Semantic view: skill domain distribution
CREATE OR REPLACE VIEW semantic.skill_domain_distribution AS
SELECT
    ds.domain,
    COUNT(DISTINCT ds.skill_sk)     AS skill_count,
    AVG(fsq.quality_score)          AS avg_quality,
    ARRAY_AGG(DISTINCT ds.publisher) AS publishers
FROM reporting.dim_skill ds
LEFT JOIN reporting.fact_skill_quality fsq ON ds.skill_sk = fsq.skill_sk
WHERE ds.is_current = true AND ds.is_official = true
GROUP BY ds.domain
ORDER BY skill_count DESC;

-- ════════════════════════════════════════════════════════════════════
-- ETL FUNCTION — runtime → reporting
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION etl_skill_events_to_warehouse()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    _rec RECORD;
    _skill_sk integer;
    _date_sk integer;
    _round_sk integer;
BEGIN
    FOR _rec IN
        SELECT DISTINCT ON (url)
            url, skill_name, publisher, repo, round_number,
            content_hash, body_size, quality_score,
            domain, maturity, content_type, agent_target,
            install_count, is_official, created_at
        FROM runtime.skill_events
        ORDER BY url, created_at DESC
    LOOP
        -- Upsert dim_skill (SCD Type 2)
        SELECT skill_sk INTO _skill_sk
        FROM reporting.dim_skill
        WHERE skill_name = _rec.skill_name
          AND publisher = _rec.publisher
          AND is_current = true;

        IF _skill_sk IS NULL THEN
            INSERT INTO reporting.dim_skill (
                skill_name, publisher, repo, domain, maturity,
                content_type, agent_target, install_count,
                source_url, skills_sh_url, is_official
            ) VALUES (
                _rec.skill_name, _rec.publisher, _rec.repo,
                _rec.domain, _rec.maturity, _rec.content_type,
                _rec.agent_target, _rec.install_count,
                'https://github.com/' || _rec.publisher || '/' || _rec.repo,
                _rec.url, _rec.is_official
            ) RETURNING skill_sk INTO _skill_sk;
        ELSE
            -- Update last_seen and install_count
            UPDATE reporting.dim_skill
            SET last_seen = now(),
                install_count = COALESCE(_rec.install_count, install_count),
                domain = COALESCE(_rec.domain, domain),
                maturity = COALESCE(_rec.maturity, maturity)
            WHERE skill_sk = _skill_sk;
        END IF;

        -- Resolve date dimension
        _date_sk := TO_CHAR(_rec.created_at, 'YYYYMMDD')::integer;

        -- Resolve round dimension
        SELECT round_sk INTO _round_sk
        FROM reporting.dim_round
        WHERE round_number = _rec.round_number;

        IF _round_sk IS NOT NULL AND _date_sk IS NOT NULL THEN
            -- Insert fact if not exists (idempotent)
            INSERT INTO reporting.fact_skill_quality (
                skill_sk, round_sk, date_sk, quality_score,
                body_size, install_count, content_changed
            ) VALUES (
                _skill_sk, _round_sk, _date_sk, _rec.quality_score,
                _rec.body_size, _rec.install_count, false
            ) ON CONFLICT (skill_sk, round_sk, date_sk) DO UPDATE SET
                quality_score = EXCLUDED.quality_score,
                install_count = EXCLUDED.install_count;
        END IF;
    END LOOP;

    -- Refresh materialized view
    REFRESH MATERIALIZED VIEW CONCURRENTLY reporting.mv_skill_catalog;
END;
$$;

-- Schedule ETL (same 15-min cadence as crawl events ETL)
-- SELECT cron.schedule('etl_skills', '*/15 * * * *', 'SELECT etl_skill_events_to_warehouse()');
