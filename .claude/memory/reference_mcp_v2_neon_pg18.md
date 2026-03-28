---
name: neon-pg18-architecture
description: Neon PG18 architecture for building plugin data platform. MCP v2 SDK details moved to reference_mcp_architecture.md.
type: reference
---

## MCP v2 SDK
See `reference_mcp_architecture.md` for complete MCP architecture including v1→v2 upgrade path.
Current monorepo: all servers on `@modelcontextprotocol/sdk@1.28.0` (v1 stable).
v2 stable target: Q1 2026. Key change for us: Streamable HTTP transport enables cross-device MCP.

## Neon PG18 Key Features
- UUIDv7 native: `DEFAULT uuidv7()`, `uuid_extract_timestamp(id)` for time-ordered PKs
- Virtual generated columns (query-time, no storage)
- Enhanced RETURNING clause (OLD and NEW values)
- NOT NULL with NOT VALID (zero-downtime migrations)
- Parallel GIN index builds (faster JSONB indexing)
- B-tree skip scan
- Branching: instant copy-on-write clones for per-PR database isolation
- `@neondatabase/serverless`: neon() for HTTP queries, Pool for transactions
- Always use pooled connection strings (-pooler hostname)

## Knowledge-Work Plugin Architecture
- Plugins are Markdown + JSON — no code, no build steps
- `~~category` placeholders in skills resolved by .mcp.json
- `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` for paths
- 22+ hook lifecycle events with 4 handler types (command, prompt, agent, http)

## Monorepo Pattern
- apps/mcp-server/ + apps/cli/ + packages/core/ + packages/shared/
- Shared core: Drizzle ORM + @neondatabase/serverless HTTP mode
- pnpm + Turborepo, tsdown/tsc for builds, Vitest for testing
- Zod-validated environment config
