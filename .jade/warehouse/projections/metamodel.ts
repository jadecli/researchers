// .jade/warehouse/projections/metamodel.ts — UDA Metamodel: Model Once, Represent Everywhere
//
// Netflix UDA principle: define a concept once at the conceptual level,
// then project it into Postgres DDL, GraphQL (via pg_graphql), TypeScript
// interfaces, and Cube.js semantic definitions.
//
// This file IS the control plane. Changes here propagate to all projections.

import type { Brand } from '../../models/base.js';

// ─── Metamodel Primitives ──────────────────────────────────────────────────

export type AttributeType =
  | 'identifier'     // Maps to: VARCHAR PK, string, primary_key dimension
  | 'text'           // Maps to: TEXT, string, string dimension
  | 'uri'            // Maps to: TEXT, string, string dimension
  | 'integer'        // Maps to: INT, number, number dimension
  | 'smallint'       // Maps to: SMALLINT, number, number dimension
  | 'decimal'        // Maps to: NUMERIC(p,s), number, number dimension
  | 'boolean'        // Maps to: BOOLEAN, boolean, boolean dimension
  | 'timestamp'      // Maps to: TIMESTAMPTZ, string, time dimension
  | 'date'           // Maps to: DATE, string, time dimension
  | 'enum'           // Maps to: CREATE TYPE .. AS ENUM, union type, string dimension
  | 'enum_array'     // Maps to: enum[], readonly T[], string dimension
  | 'uuid'           // Maps to: UUID, string, string dimension
  | 'bytea'          // Maps to: BYTEA, Buffer, excluded from Cube
  | 'json';          // Maps to: JSONB, object, excluded from Cube

export interface EnumDefinition {
  readonly name: string;
  readonly values: readonly string[];
}

export interface AttributeDefinition {
  readonly name: string;
  readonly type: AttributeType;
  readonly required: boolean;
  readonly primaryKey?: boolean;
  readonly naturalKey?: boolean;       // Stable across SCD Type 2 versions
  readonly pattern?: string;           // Regex constraint (maps to CHECK, Brand<>)
  readonly enumRef?: string;           // Reference to an EnumDefinition name
  readonly foreignKey?: {
    readonly table: string;
    readonly column: string;
  };
  readonly defaultValue?: string;
  readonly description?: string;
}

export interface EntityDefinition {
  readonly name: string;               // Conceptual name: 'DocSurface'
  readonly tableName: string;          // Postgres projection: 'dim_doc_surface'
  readonly description: string;
  readonly scdType2: boolean;          // Auto-adds version/effective_date/expiration_date/is_current
  readonly grain?: string;             // Kimball grain statement for fact tables
  readonly entityType: 'dimension' | 'fact' | 'state';
  readonly attributes: readonly AttributeDefinition[];
  readonly enums?: readonly EnumDefinition[];
}

// ─── Projection Type Map ───────────────────────────────────────────────────
// Maps metamodel AttributeType to each target representation.

export const PROJECTION_MAP: Record<AttributeType, {
  postgres: string;
  typescript: string;
  cubejs: string;
  graphql: string;
}> = {
  identifier:  { postgres: 'VARCHAR(255)', typescript: 'string',             cubejs: 'string',  graphql: 'String!' },
  text:        { postgres: 'TEXT',         typescript: 'string',             cubejs: 'string',  graphql: 'String' },
  uri:         { postgres: 'TEXT',         typescript: 'string',             cubejs: 'string',  graphql: 'String' },
  integer:     { postgres: 'INT',          typescript: 'number',             cubejs: 'number',  graphql: 'Int' },
  smallint:    { postgres: 'SMALLINT',     typescript: 'number',             cubejs: 'number',  graphql: 'Int' },
  decimal:     { postgres: 'NUMERIC(5,4)', typescript: 'number',             cubejs: 'number',  graphql: 'Float' },
  boolean:     { postgres: 'BOOLEAN',      typescript: 'boolean',            cubejs: 'boolean', graphql: 'Boolean' },
  timestamp:   { postgres: 'TIMESTAMPTZ',  typescript: 'string',             cubejs: 'time',    graphql: 'DateTime' },
  date:        { postgres: 'DATE',         typescript: 'string',             cubejs: 'time',    graphql: 'Date' },
  enum:        { postgres: 'ENUM_REF',     typescript: 'UNION_TYPE',         cubejs: 'string',  graphql: 'ENUM_TYPE' },
  enum_array:  { postgres: 'ENUM_REF[]',   typescript: 'readonly UNION[]',   cubejs: 'string',  graphql: '[ENUM_TYPE!]' },
  uuid:        { postgres: 'UUID',         typescript: 'string',             cubejs: 'string',  graphql: 'ID' },
  bytea:       { postgres: 'BYTEA',        typescript: 'Buffer',             cubejs: 'SKIP',    graphql: 'SKIP' },
  json:        { postgres: 'JSONB',        typescript: 'Record<string, unknown>', cubejs: 'SKIP', graphql: 'JSON' },
};

// ─── Entity Registry ───────────────────────────────────────────────────────
// The single source of truth. Every entity in the system is registered here.
// Projections read from this registry.

export const ENTITY_REGISTRY: readonly EntityDefinition[] = [
  {
    name: 'DocSurface',
    tableName: 'dim_doc_surface',
    description: 'SCD Type 2 dimension for documentation pages',
    scdType2: true,
    entityType: 'dimension',
    enums: [
      { name: 'doc_surface_enum', values: ['capabilities', 'tools', 'tool-reference', 'tool-infrastructure', 'context-management', 'files-assets', 'agent-skills'] },
      { name: 'crawl_priority_enum', values: ['critical', 'high', 'medium', 'low'] },
      { name: 'agent_strategy_enum', values: ['direct-fetch-extract', 'headless-subagent', 'sdk-stream', 'batch-process'] },
      { name: 'output_format_enum', values: ['markdown', 'yaml', 'json', 'typescript'] },
    ],
    attributes: [
      { name: 'doc_surface_key', type: 'integer', required: true, primaryKey: true, description: 'Surrogate key' },
      { name: 'canonical_url', type: 'uri', required: true, naturalKey: true },
      { name: 'slug', type: 'identifier', required: true, pattern: '^[a-z][a-z0-9_-]+$' },
      { name: 'page_title', type: 'text', required: true },
      { name: 'surface', type: 'enum', required: true, enumRef: 'doc_surface_enum' },
      { name: 'priority', type: 'enum', required: true, enumRef: 'crawl_priority_enum' },
      { name: 'agent_strategy', type: 'enum', required: true, enumRef: 'agent_strategy_enum' },
      { name: 'output_formats', type: 'enum_array', required: true, enumRef: 'output_format_enum' },
      { name: 'parent_slug', type: 'identifier', required: false },
      { name: 'content_hash', type: 'text', required: false, description: 'SHA-256 of page body for change detection' },
    ],
  },
  {
    name: 'Agent',
    tableName: 'dim_agent',
    description: 'Conformed agent dimension for spiders, crawlers, and LLM agents',
    scdType2: false,
    entityType: 'dimension',
    enums: [
      { name: 'agent_type_enum', values: ['scrapy_spider', 'crawlee_crawler', 'llm_sub_agent', 'orchestrator', 'quality_checker'] },
    ],
    attributes: [
      { name: 'agent_key', type: 'integer', required: true, primaryKey: true },
      { name: 'agent_id', type: 'identifier', required: true, naturalKey: true },
      { name: 'agent_type', type: 'enum', required: true, enumRef: 'agent_type_enum' },
      { name: 'agent_version', type: 'text', required: false },
      { name: 'model_name', type: 'text', required: false },
      { name: 'model_routing_tier', type: 'text', required: false, description: 'haiku, sonnet, or opus' },
      { name: 'concurrency_limit', type: 'smallint', required: false },
      { name: 'description', type: 'text', required: false },
    ],
  },
  {
    name: 'CrawlConfig',
    tableName: 'dim_crawl_config',
    description: 'Crawl configuration with bloom filter parameters',
    scdType2: false,
    entityType: 'dimension',
    attributes: [
      { name: 'crawl_config_key', type: 'integer', required: true, primaryKey: true },
      { name: 'config_label', type: 'text', required: true },
      { name: 'max_depth', type: 'smallint', required: true, defaultValue: '3' },
      { name: 'politeness_delay_ms', type: 'integer', required: true, defaultValue: '1000' },
      { name: 'bloom_expected_items', type: 'integer', required: true, defaultValue: '10000' },
      { name: 'bloom_false_positive', type: 'decimal', required: true, defaultValue: '0.001' },
      { name: 'bloom_hash_functions', type: 'smallint', required: false },
      { name: 'bloom_bit_size', type: 'integer', required: false },
      { name: 'retry_policy', type: 'text', required: true, defaultValue: 'exponential_backoff' },
      { name: 'max_retries', type: 'smallint', required: true, defaultValue: '3' },
      { name: 'config_json', type: 'json', required: false },
    ],
  },
  {
    name: 'CrawlEvent',
    tableName: 'fact_crawl_event',
    description: 'Crawl event fact table',
    scdType2: false,
    entityType: 'fact',
    grain: 'One crawl attempt of one page by one agent at one instant',
    attributes: [
      { name: 'crawl_event_id', type: 'integer', required: true, primaryKey: true },
      { name: 'date_key', type: 'integer', required: true, foreignKey: { table: 'dim_date', column: 'date_key' } },
      { name: 'time_key', type: 'integer', required: true, foreignKey: { table: 'dim_time_of_day', column: 'time_key' } },
      { name: 'doc_surface_key', type: 'integer', required: true, foreignKey: { table: 'dim_doc_surface', column: 'doc_surface_key' } },
      { name: 'agent_key', type: 'integer', required: true, foreignKey: { table: 'dim_agent', column: 'agent_key' } },
      { name: 'crawl_config_key', type: 'integer', required: true, foreignKey: { table: 'dim_crawl_config', column: 'crawl_config_key' } },
      { name: 'crawl_run_id', type: 'uuid', required: true },
      { name: 'bloom_filter_hit', type: 'boolean', required: true, defaultValue: 'FALSE' },
      { name: 'bloom_filter_size', type: 'integer', required: false },
      { name: 'http_status_code', type: 'smallint', required: false },
      { name: 'response_bytes', type: 'integer', required: false },
      { name: 'elapsed_ms', type: 'integer', required: false },
      { name: 'items_extracted', type: 'integer', required: false, defaultValue: '0' },
      { name: 'links_discovered', type: 'integer', required: false, defaultValue: '0' },
      { name: 'retry_count', type: 'smallint', required: false, defaultValue: '0' },
      { name: 'is_success', type: 'boolean', required: true },
      { name: 'error_class', type: 'text', required: false },
      { name: 'crawl_ts', type: 'timestamp', required: true },
    ],
  },
];

// ─── Bus Matrix (Kimball planning contract) ────────────────────────────────

export const BUS_MATRIX: Record<string, readonly string[]> = {
  'fact_crawl_event':   ['dim_date', 'dim_time_of_day', 'dim_doc_surface', 'dim_agent', 'dim_crawl_config'],
  'fact_dispatch':      ['dim_date', 'dim_time_of_day', 'dim_doc_surface', 'dim_agent', 'dim_crawl_config'],
  'fact_quality_check': ['dim_date', 'dim_time_of_day', 'dim_doc_surface', 'dim_agent'],
};
