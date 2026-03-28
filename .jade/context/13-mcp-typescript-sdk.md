---
source: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/README.md
fetched: 2026-03-28
description: MCP TypeScript SDK v2 pre-alpha — server/client/middleware packages for Node.js, Bun, Deno
---

# MCP TypeScript SDK

The official TypeScript SDK for the Model Context Protocol (MCP). This is a v2 pre-alpha rewrite with a modular package architecture for building MCP servers and clients in Node.js, Bun, and Deno.

## Packages

### @modelcontextprotocol/server

The core server package for building MCP servers:

```bash
npm install @modelcontextprotocol/server
```

Features:
- Define tools, resources, and prompts
- Handle JSON-RPC 2.0 messages
- Capability negotiation
- Multiple transport support

### @modelcontextprotocol/client

The client package for connecting to MCP servers:

```bash
npm install @modelcontextprotocol/client
```

Features:
- Connect to MCP servers via stdio, SSE, or streamable HTTP
- Discover and invoke tools
- Read resources
- Use prompts

## Middleware

### @modelcontextprotocol/middleware-node

Node.js middleware for serving MCP over HTTP:

```bash
npm install @modelcontextprotocol/middleware-node
```

### @modelcontextprotocol/middleware-express

Express.js middleware integration:

```bash
npm install @modelcontextprotocol/middleware-express
```

### @modelcontextprotocol/middleware-hono

Hono framework middleware integration:

```bash
npm install @modelcontextprotocol/middleware-hono
```

## Installation

```bash
# Server only
npm install @modelcontextprotocol/server

# Client only
npm install @modelcontextprotocol/client

# Both
npm install @modelcontextprotocol/server @modelcontextprotocol/client
```

## Quick Start

### Creating a Server

```typescript
import { McpServer } from "@modelcontextprotocol/server";

const server = new McpServer({
  name: "my-server",
  version: "1.0.0",
});

// Add a tool
server.tool("greet", { name: "string" }, async ({ name }) => {
  return { content: [{ type: "text", text: `Hello, ${name}!` }] };
});

// Add a resource
server.resource("config", "config://app", async () => {
  return { content: [{ type: "text", text: JSON.stringify(config) }] };
});

// Start with stdio transport
server.start({ transport: "stdio" });
```

### Creating a Client

```typescript
import { McpClient } from "@modelcontextprotocol/client";

const client = new McpClient();

// Connect via stdio
await client.connect({
  transport: "stdio",
  command: "node",
  args: ["server.js"],
});

// List available tools
const tools = await client.listTools();

// Call a tool
const result = await client.callTool("greet", { name: "World" });
console.log(result);

// Disconnect
await client.disconnect();
```

### Using with Express

```typescript
import express from "express";
import { McpServer } from "@modelcontextprotocol/server";
import { createExpressMiddleware } from "@modelcontextprotocol/middleware-express";

const app = express();
const server = new McpServer({ name: "api-server", version: "1.0.0" });

server.tool("query", { sql: "string" }, async ({ sql }) => {
  const result = await db.query(sql);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

app.use("/mcp", createExpressMiddleware(server));
app.listen(3000);
```

### Using with Hono

```typescript
import { Hono } from "hono";
import { McpServer } from "@modelcontextprotocol/server";
import { createHonoMiddleware } from "@modelcontextprotocol/middleware-hono";

const app = new Hono();
const server = new McpServer({ name: "hono-server", version: "1.0.0" });

app.use("/mcp/*", createHonoMiddleware(server));
export default app;
```

## Documentation

- [MCP Specification](https://spec.modelcontextprotocol.io)
- [TypeScript SDK Docs](https://modelcontextprotocol.io/docs/typescript)
- [Examples](https://github.com/modelcontextprotocol/typescript-sdk/tree/main/examples)
- [API Reference](https://modelcontextprotocol.io/docs/typescript/api)
