---
name: mcp-v2-neon-pg18-architecture
description: MCP TypeScript SDK v2 (pre-alpha) + Neon PG18 architecture for building plugin data platform. Key patterns for claude-channel-dispatch-routing.
type: reference
---

## MCP TypeScript SDK v2 Key Changes
- Package split: @modelcontextprotocol/server, /client, /node, /express, /hono
- `registerTool()` replaces `server.tool()` with structured options object
- `outputSchema` enables typed structured output with Zod v4
- `ctx` object replaces `extra` parameter (provides logging, sampling, elicitation)
- Experimental Tasks API for long-running operations (TaskStore, states: working/completed/failed)
- Dynamic tool management: handle.disable()/enable()
- Streamable HTTP is primary transport (SSE deprecated)
- Requires Node.js >= 20, Zod v3.25+ or v4, ESM-only

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
