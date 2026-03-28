-- 004_dim_doc_surface.sql — SCD Type 2 documentation surface dimension
--
-- UDA metamodel projection: TypeScript DocPageBase -> Postgres dim_doc_surface
-- Grain: one row per VERSION of a documentation page
-- The surrogate key (doc_surface_key) isolates fact tables from natural key instability.
-- Natural key: canonical_url (stable across versions)
--
-- Kimball SCD Type 2: effective_date, expiration_date, is_current
-- Maps 1:1 to VersionEnvelope<T> in .jade/models/base.ts
-- Cube.js semantic: ../cube/dim_doc_surface.yml

-- Enums projected from .jade/surfaces/doc-surface.ts
CREATE TYPE doc_surface_enum AS ENUM (
    'capabilities',
    'tools',
    'tool-reference',
    'tool-infrastructure',
    'context-management',
    'files-assets',
    'agent-skills'
);

CREATE TYPE crawl_priority_enum AS ENUM ('critical', 'high', 'medium', 'low');

CREATE TYPE agent_strategy_enum AS ENUM (
    'direct-fetch-extract',
    'headless-subagent',
    'sdk-stream',
    'batch-process'
);

CREATE TYPE output_format_enum AS ENUM ('markdown', 'yaml', 'json', 'typescript');

CREATE TABLE dim_doc_surface (
    doc_surface_key     SERIAL              PRIMARY KEY,
    -- Natural key (stable across SCD Type 2 versions)
    canonical_url       TEXT                NOT NULL,
    -- Projected from DocPageBase
    slug                VARCHAR(255)        NOT NULL,
    page_title          TEXT                NOT NULL,
    surface             doc_surface_enum    NOT NULL,
    priority            crawl_priority_enum NOT NULL,
    agent_strategy      agent_strategy_enum NOT NULL,
    output_formats      output_format_enum[] NOT NULL,
    parent_slug         VARCHAR(255),
    content_hash        CHAR(64),           -- SHA-256 of page body (change detection)
    -- SCD Type 2 bookkeeping (maps to VersionEnvelope<T>)
    version             INT                 NOT NULL DEFAULT 1,
    effective_date      DATE                NOT NULL DEFAULT CURRENT_DATE,
    expiration_date     DATE                NOT NULL DEFAULT '9999-12-31',
    is_current          BOOLEAN             NOT NULL DEFAULT TRUE,
    edited_by           VARCHAR(100)        NOT NULL DEFAULT 'crawl-orchestrator',
    edit_reason         TEXT                NOT NULL DEFAULT 'Initial creation'
);

CREATE INDEX idx_doc_surface_natural ON dim_doc_surface (canonical_url, is_current);
CREATE INDEX idx_doc_surface_slug ON dim_doc_surface (slug, is_current);
CREATE INDEX idx_doc_surface_type ON dim_doc_surface (surface, is_current);

COMMENT ON TABLE dim_doc_surface IS
    'SCD Type 2 dimension for documentation pages. '
    'Projected from .jade/surfaces/doc-surface.ts DocPageBase. '
    'Natural key: canonical_url. Surrogate key: doc_surface_key. '
    'Each version of a page gets a new row; old fact rows preserve historical context.';
