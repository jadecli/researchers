# MCP TypeScript SDK

> Source: https://github.com/modelcontextprotocol/typescript-sdk
> Fetched: 2026-03-28

Official Model Context Protocol TypeScript SDK. Monorepo supporting Node.js, Bun, and Deno.

## Version Status

- **Main branch**: v2 (pre-alpha, expected stable Q1 2026)
- **v1.x branch**: Recommended for production. Support continues 6+ months post-v2.

## Packages

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/server` | Build MCP server implementations |
| `@modelcontextprotocol/client` | Build MCP client implementations |
| `@modelcontextprotocol/node` | Node.js HTTP transport |
| `@modelcontextprotocol/express` | Express.js integration |
| `@modelcontextprotocol/hono` | Hono framework helpers |

All require Zod v4 as peer dependency.

## Installation

```bash
# Server
npm install @modelcontextprotocol/server zod

# Client
npm install @modelcontextprotocol/client zod

# Middleware (optional)
npm install @modelcontextprotocol/express express
npm install @modelcontextprotocol/hono hono
npm install @modelcontextprotocol/node
```

## Capabilities

- Tool, resource, and prompt management
- Streamable HTTP transport
- Standard I/O (stdio) support
- Built-in authentication helpers
- Multiple client transports
- OAuth integration utilities

## Documentation

- Server docs: `docs/server.md`
- Client docs: `docs/client.md`
- FAQ: `docs/faq.md`
- V1 API docs: https://ts.sdk.modelcontextprotocol.io/
- V2 API docs: https://ts.sdk.modelcontextprotocol.io/v2/
- MCP specification: https://spec.modelcontextprotocol.io

## Stats

- 12k+ stars, 1.7k forks, 167 contributors
- TypeScript 96.8%
- License: Apache 2.0 (new) + MIT (existing)
