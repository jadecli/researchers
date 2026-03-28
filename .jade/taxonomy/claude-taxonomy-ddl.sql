-- ============================================================
-- Claude Taxonomy Data Models — Kimball Star Schema
-- ============================================================
--
-- Hierarchical classification of Claude/Anthropic public artifacts.
-- Event-sourced: every taxonomy edit is a FACT_TAXONOMY_EVENT.
-- Crawled data linked via FACT_CRAWL_INSTANCE.
--
-- Design: Kimball star schema
--   DIM_TAXONOMY_CATEGORY  — Level 0 broad categories (conformed)
--   DIM_TAXONOMY_NODE      — Recursive hierarchy (self-referential)
--   FACT_TAXONOMY_EVENT    — Event-sourced CRUD operations
--   FACT_CRAWL_INSTANCE    — Hydrated leaf data from crawlers
--
-- Conventions: ALL CAPS tables, monotonically increasing BIGSERIAL PKs
-- Target: Neon Postgres 18 (agentdata schema)
--
-- Generated: 2026-03-28

BEGIN;

-- ============================================================
-- SCHEMA
-- ============================================================

CREATE SCHEMA IF NOT EXISTS taxonomy;

-- ============================================================
-- ENUMS (type-safe categories)
-- ============================================================

CREATE TYPE taxonomy.CATEGORY_ENUM AS ENUM (
  'ORGANIZATION', 'PRODUCT', 'MODEL', 'SURFACE',
  'DOCUMENT', 'REPOSITORY', 'CONNECTOR', 'ARTIFACT',
  'DISCOVERY', 'STANDARD'
);

CREATE TYPE taxonomy.EVENT_TYPE_ENUM AS ENUM (
  'CREATE', 'UPDATE', 'DELETE', 'REPARENT', 'HYDRATE', 'DEHYDRATE'
);

-- ============================================================
-- DIM_TAXONOMY_CATEGORY — Level 0 conformed dimension
-- ============================================================
-- Slowly changing: only grows when new top-level categories added.
-- One row per CATEGORY_ENUM value.

CREATE TABLE taxonomy.DIM_TAXONOMY_CATEGORY (
  CATEGORY_SK   SMALLINT PRIMARY KEY,        -- matches TypeScript enum value
  CATEGORY_NAME TEXT     NOT NULL UNIQUE,     -- e.g. 'ORGANIZATION'
  DISPLAY_NAME  TEXT     NOT NULL,            -- e.g. 'Organizations'
  DESCRIPTION   TEXT,
  SORT_ORDER    SMALLINT NOT NULL DEFAULT 0
);

-- Seed categories
INSERT INTO taxonomy.DIM_TAXONOMY_CATEGORY (CATEGORY_SK, CATEGORY_NAME, DISPLAY_NAME, DESCRIPTION, SORT_ORDER) VALUES
  (1,  'ORGANIZATION', 'Organizations',       'Legal and GitHub entities',                    1),
  (2,  'PRODUCT',      'Products',            'Shipped products customers use',               2),
  (3,  'MODEL',        'Models',              'AI models and model families',                  3),
  (4,  'SURFACE',      'Surfaces',            'Interaction surfaces (CLI, web, mobile...)',     4),
  (5,  'DOCUMENT',     'Documents',           'Published content (docs, blogs, papers...)',     5),
  (6,  'REPOSITORY',   'Repositories',        'Code repositories across orgs',                 6),
  (7,  'CONNECTOR',    'Connectors',          'Integrations (MCP, plugins, skills, hooks)',     7),
  (8,  'ARTIFACT',     'Artifacts',           'Structured I/O formats',                        8),
  (9,  'DISCOVERY',    'Discovery Endpoints', 'Endpoints for finding content',                 9),
  (10, 'STANDARD',     'Standards',           'Protocols and specifications',                  10);

-- ============================================================
-- DIM_TAXONOMY_NODE — Recursive hierarchy dimension
-- ============================================================
-- Self-referential tree. Each node has a parent (null = root).
-- Depth 0 = category root, 1 = type, 2+ = instance.
-- SCD Type 1 (overwrite) — history captured via FACT_TAXONOMY_EVENT.

CREATE TABLE taxonomy.DIM_TAXONOMY_NODE (
  NODE_SK       BIGSERIAL PRIMARY KEY,
  PARENT_SK     BIGINT   REFERENCES taxonomy.DIM_TAXONOMY_NODE(NODE_SK),
  CATEGORY_SK   SMALLINT NOT NULL REFERENCES taxonomy.DIM_TAXONOMY_CATEGORY(CATEGORY_SK),
  TYPE_ID       INTEGER  NOT NULL DEFAULT 0,  -- subcategory enum value
  NODE_NAME     TEXT     NOT NULL,
  NODE_SLUG     TEXT     NOT NULL,
  DEPTH         SMALLINT NOT NULL DEFAULT 0,
  CANONICAL_URL TEXT,
  IS_LEAF       BOOLEAN  NOT NULL DEFAULT FALSE,
  METADATA      JSONB    NOT NULL DEFAULT '{}',
  CREATED_AT    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UPDATED_AT    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for hierarchy traversal
CREATE INDEX IDX_TAXONOMY_NODE_PARENT ON taxonomy.DIM_TAXONOMY_NODE(PARENT_SK);
CREATE INDEX IDX_TAXONOMY_NODE_CATEGORY ON taxonomy.DIM_TAXONOMY_NODE(CATEGORY_SK);
CREATE INDEX IDX_TAXONOMY_NODE_SLUG ON taxonomy.DIM_TAXONOMY_NODE(NODE_SLUG);
CREATE INDEX IDX_TAXONOMY_NODE_LEAF ON taxonomy.DIM_TAXONOMY_NODE(IS_LEAF) WHERE IS_LEAF = TRUE;

-- GIN index on metadata for flexible querying
CREATE INDEX IDX_TAXONOMY_NODE_METADATA ON taxonomy.DIM_TAXONOMY_NODE USING GIN(METADATA);

-- ============================================================
-- FACT_TAXONOMY_EVENT — Event-sourced CRUD log
-- ============================================================
-- Append-only. Every taxonomy mutation is recorded.
-- Grain: one event per node mutation.

CREATE TABLE taxonomy.FACT_TAXONOMY_EVENT (
  EVENT_SK        BIGSERIAL   PRIMARY KEY,
  NODE_SK         BIGINT      NOT NULL REFERENCES taxonomy.DIM_TAXONOMY_NODE(NODE_SK),
  EVENT_TYPE      taxonomy.EVENT_TYPE_ENUM NOT NULL,
  PREVIOUS_STATE  JSONB,       -- null for CREATE
  NEW_STATE       JSONB,       -- null for DELETE
  TRIGGER_SOURCE  TEXT NOT NULL DEFAULT 'manual',  -- tool_call_id, session_id, spider_name
  TRIGGER_MODEL   TEXT,         -- which Claude model triggered this
  CREATED_AT      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BRIN for time-series queries (append-only table)
CREATE INDEX IDX_TAXONOMY_EVENT_TIME ON taxonomy.FACT_TAXONOMY_EVENT USING BRIN(CREATED_AT);
CREATE INDEX IDX_TAXONOMY_EVENT_NODE ON taxonomy.FACT_TAXONOMY_EVENT(NODE_SK);
CREATE INDEX IDX_TAXONOMY_EVENT_TYPE ON taxonomy.FACT_TAXONOMY_EVENT(EVENT_TYPE);

-- ============================================================
-- FACT_CRAWL_INSTANCE — Hydrated leaf data from crawlers
-- ============================================================
-- Links taxonomy leaf nodes to their latest crawled content.
-- SCD Type 2 via IS_CURRENT flag (keep history of crawl snapshots).
-- Grain: one row per crawl of a leaf node.

CREATE TABLE taxonomy.FACT_CRAWL_INSTANCE (
  CRAWL_SK       BIGSERIAL   PRIMARY KEY,
  NODE_SK        BIGINT      NOT NULL REFERENCES taxonomy.DIM_TAXONOMY_NODE(NODE_SK),
  CONTENT_HASH   TEXT        NOT NULL,  -- SHA-256 for delta detection
  PAYLOAD        JSONB       NOT NULL,  -- orjson-serialized full crawl data
  PAYLOAD_SIZE   INTEGER     NOT NULL,  -- bytes
  TOKEN_ESTIMATE INTEGER     NOT NULL DEFAULT 0,
  QUALITY_SCORE  NUMERIC(4,3) NOT NULL DEFAULT 0.000,  -- 0.000 to 1.000
  SPIDER_NAME    TEXT        NOT NULL,
  IS_CURRENT     BOOLEAN     NOT NULL DEFAULT TRUE,
  CRAWLED_AT     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique index: only one current instance per node
CREATE UNIQUE INDEX IDX_CRAWL_INSTANCE_CURRENT
  ON taxonomy.FACT_CRAWL_INSTANCE(NODE_SK) WHERE IS_CURRENT = TRUE;

-- BRIN for time-series
CREATE INDEX IDX_CRAWL_INSTANCE_TIME ON taxonomy.FACT_CRAWL_INSTANCE USING BRIN(CRAWLED_AT);
CREATE INDEX IDX_CRAWL_INSTANCE_HASH ON taxonomy.FACT_CRAWL_INSTANCE(CONTENT_HASH);
CREATE INDEX IDX_CRAWL_INSTANCE_SPIDER ON taxonomy.FACT_CRAWL_INSTANCE(SPIDER_NAME);

-- ============================================================
-- SEMANTIC VIEWS — Token-efficient taxonomy queries
-- ============================================================

-- Full tree with path (for agent context)
CREATE VIEW taxonomy.TAXONOMY_TREE AS
WITH RECURSIVE tree AS (
  SELECT
    NODE_SK, PARENT_SK, CATEGORY_SK, TYPE_ID,
    NODE_NAME, NODE_SLUG, DEPTH, CANONICAL_URL, IS_LEAF,
    NODE_NAME::TEXT AS PATH,
    ARRAY[NODE_SK] AS ANCESTORS
  FROM taxonomy.DIM_TAXONOMY_NODE
  WHERE PARENT_SK IS NULL

  UNION ALL

  SELECT
    n.NODE_SK, n.PARENT_SK, n.CATEGORY_SK, n.TYPE_ID,
    n.NODE_NAME, n.NODE_SLUG, n.DEPTH, n.CANONICAL_URL, n.IS_LEAF,
    tree.PATH || ' > ' || n.NODE_NAME,
    tree.ANCESTORS || n.NODE_SK
  FROM taxonomy.DIM_TAXONOMY_NODE n
  JOIN tree ON n.PARENT_SK = tree.NODE_SK
)
SELECT
  t.*,
  c.CATEGORY_NAME,
  c.DISPLAY_NAME AS CATEGORY_DISPLAY
FROM tree t
JOIN taxonomy.DIM_TAXONOMY_CATEGORY c ON t.CATEGORY_SK = c.CATEGORY_SK
ORDER BY t.PATH;

-- Leaf nodes with latest crawl data (for hydration queries)
CREATE VIEW taxonomy.HYDRATED_LEAVES AS
SELECT
  n.NODE_SK,
  n.NODE_NAME,
  n.NODE_SLUG,
  n.CANONICAL_URL,
  c.CATEGORY_NAME,
  ci.CRAWL_SK,
  ci.CONTENT_HASH,
  ci.PAYLOAD_SIZE,
  ci.TOKEN_ESTIMATE,
  ci.QUALITY_SCORE,
  ci.SPIDER_NAME,
  ci.CRAWLED_AT,
  ci.PAYLOAD
FROM taxonomy.DIM_TAXONOMY_NODE n
JOIN taxonomy.DIM_TAXONOMY_CATEGORY c ON n.CATEGORY_SK = c.CATEGORY_SK
LEFT JOIN taxonomy.FACT_CRAWL_INSTANCE ci ON n.NODE_SK = ci.NODE_SK AND ci.IS_CURRENT = TRUE
WHERE n.IS_LEAF = TRUE;

-- Category summary (for dashboard/overview)
CREATE VIEW taxonomy.CATEGORY_SUMMARY AS
SELECT
  c.CATEGORY_SK,
  c.DISPLAY_NAME,
  COUNT(n.NODE_SK) AS TOTAL_NODES,
  COUNT(n.NODE_SK) FILTER (WHERE n.IS_LEAF) AS LEAF_NODES,
  COUNT(ci.CRAWL_SK) AS HYDRATED_LEAVES,
  COALESCE(AVG(ci.QUALITY_SCORE) FILTER (WHERE ci.IS_CURRENT), 0) AS AVG_QUALITY,
  COALESCE(SUM(ci.TOKEN_ESTIMATE) FILTER (WHERE ci.IS_CURRENT), 0) AS TOTAL_TOKENS
FROM taxonomy.DIM_TAXONOMY_CATEGORY c
LEFT JOIN taxonomy.DIM_TAXONOMY_NODE n ON c.CATEGORY_SK = n.CATEGORY_SK
LEFT JOIN taxonomy.FACT_CRAWL_INSTANCE ci ON n.NODE_SK = ci.NODE_SK AND ci.IS_CURRENT = TRUE
GROUP BY c.CATEGORY_SK, c.DISPLAY_NAME
ORDER BY c.CATEGORY_SK;

-- Event activity (for monitoring taxonomy changes)
CREATE VIEW taxonomy.RECENT_EVENTS AS
SELECT
  e.EVENT_SK,
  e.EVENT_TYPE,
  n.NODE_NAME,
  c.CATEGORY_NAME,
  e.TRIGGER_SOURCE,
  e.TRIGGER_MODEL,
  e.CREATED_AT
FROM taxonomy.FACT_TAXONOMY_EVENT e
JOIN taxonomy.DIM_TAXONOMY_NODE n ON e.NODE_SK = n.NODE_SK
JOIN taxonomy.DIM_TAXONOMY_CATEGORY c ON n.CATEGORY_SK = c.CATEGORY_SK
ORDER BY e.CREATED_AT DESC
LIMIT 100;

COMMIT;
