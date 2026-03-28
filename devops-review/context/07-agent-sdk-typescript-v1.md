# Agent SDK Reference — TypeScript V1

> Source: https://platform.claude.com/docs/en/agent-sdk/typescript
> Fetched: 2026-03-28
> Note: Full reference is 700+ lines. Key API surface documented below.

## Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
```

## Core Functions

### `query({ prompt, options })` → `Query`

Primary function. Creates async generator streaming messages.

```typescript
function query({
  prompt: string | AsyncIterable<SDKUserMessage>,
  options?: Options
}): Query;
```

### `tool(name, description, inputSchema, handler, extras?)` → `SdkMcpToolDefinition`

Creates type-safe MCP tool definitions with Zod schemas.

```typescript
const searchTool = tool(
  "search", "Search the web",
  { query: z.string() },
  async ({ query }) => ({ content: [{ type: "text", text: `Results for: ${query}` }] }),
  { annotations: { readOnlyHint: true, openWorldHint: true } }
);
```

### `createSdkMcpServer({ name, version?, tools? })` → `McpSdkServerConfigWithInstance`

Creates in-process MCP server.

### `listSessions(options?)` → `Promise<SDKSessionInfo[]>`
### `getSessionMessages(sessionId, options?)` → `Promise<SessionMessage[]>`
### `getSessionInfo(sessionId, options?)` → `Promise<SDKSessionInfo | undefined>`
### `renameSession(sessionId, title, options?)` → `Promise<void>`
### `tagSession(sessionId, tag, options?)` → `Promise<void>`

## Key Types

### Options (selected fields)

| Property | Type | Description |
|----------|------|-------------|
| `model` | `string` | Claude model to use |
| `permissionMode` | `PermissionMode` | default, acceptEdits, bypassPermissions, plan, dontAsk |
| `maxTurns` | `number` | Max agentic turns |
| `maxBudgetUsd` | `number` | Max budget in USD |
| `effort` | `'low' \| 'medium' \| 'high' \| 'max'` | Effort level |
| `systemPrompt` | `string \| { type: 'preset', preset: 'claude_code', append?: string }` | System prompt |
| `agents` | `Record<string, AgentDefinition>` | Programmatic subagents |
| `mcpServers` | `Record<string, McpServerConfig>` | MCP server configs |
| `hooks` | `Partial<Record<HookEvent, HookCallbackMatcher[]>>` | Hook callbacks |
| `allowedTools` | `string[]` | Auto-approved tools |
| `disallowedTools` | `string[]` | Blocked tools |
| `canUseTool` | `CanUseTool` | Custom permission function |
| `settingSources` | `SettingSource[]` | 'user', 'project', 'local' |
| `plugins` | `SdkPluginConfig[]` | Local plugins |
| `outputFormat` | `{ type: 'json_schema', schema: JSONSchema }` | Structured output |
| `thinking` | `ThinkingConfig` | Thinking/reasoning control |
| `enableFileCheckpointing` | `boolean` | File change tracking |

### AgentDefinition

```typescript
type AgentDefinition = {
  description: string;        // When to use this agent
  tools?: string[];            // Allowed tools (inherits if omitted)
  disallowedTools?: string[];  // Blocked tools
  prompt: string;              // System prompt
  model?: "sonnet" | "opus" | "haiku" | "inherit";
  mcpServers?: AgentMcpServerSpec[];
  skills?: string[];
  maxTurns?: number;
};
```

### Query Object Methods

| Method | Description |
|--------|-------------|
| `interrupt()` | Interrupt the query |
| `rewindFiles(messageId)` | Restore files to checkpoint |
| `setPermissionMode(mode)` | Change permission mode |
| `setModel(model)` | Change model |
| `streamInput(stream)` | Multi-turn streaming |
| `setMcpServers(servers)` | Dynamic MCP server replacement |
| `close()` | Terminate and cleanup |

### MCP Server Configs

```typescript
type McpServerConfig =
  | McpStdioServerConfig   // { type?: "stdio", command, args?, env? }
  | McpSSEServerConfig     // { type: "sse", url, headers? }
  | McpHttpServerConfig    // { type: "http", url, headers? }
  | McpSdkServerConfigWithInstance; // { type: "sdk", name, instance }
```

### PermissionMode

```typescript
type PermissionMode =
  | "default"              // Standard permission behavior
  | "acceptEdits"          // Auto-accept file edits
  | "bypassPermissions"    // Bypass all checks
  | "plan"                 // Planning mode - no execution
  | "dontAsk";             // Deny if not pre-approved
```
