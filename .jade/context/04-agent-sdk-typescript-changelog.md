---
source: https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md
fetched: 2026-03-28
description: Claude Agent SDK TypeScript changelog — v0.2.86 to v0.1.0
---

# Claude Agent SDK TypeScript Changelog

## v0.2.86

- Add `getContextUsage()` method for monitoring context window utilization
- Returns input/output token counts, cache statistics, and usage percentage

## v0.2.85

- Add `reloadPlugins()` for hot-reloading MCP servers and tool configurations
- No session restart required for plugin changes

## v0.2.84

- Add `taskBudget` parameter to control per-task token spending limits
- Budget tracking across multi-turn conversations

## v0.2.83

- Add `enableChannel()` for selective event channel subscriptions
- Channels: `messages`, `tools`, `progress`, `errors`

## v0.2.82

- Add session forking with `forkSession()`
- Create branch points in conversation history

## v0.2.81

- Add session tagging with `tagSession()` and `listSessionsByTag()`
- Organize sessions with custom metadata tags

## v0.2.80

- Add `renameSession()` for updating session display names
- Session names appear in listing and management UIs

## v0.2.79

- Add `agentProgressSummaries` in streaming responses
- Real-time progress tracking for multi-step agent operations

## v0.2.78

- Improved TypeScript type exports
- All interfaces and types available from package root

## v0.2.77

- Add `ThinkingConfig` support
- Control extended thinking with `enabled`, `budgetTokens`, `temperature`

## v0.2.76

- Add MCP tool annotations in tool definitions
- Annotations: `title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`

## v0.2.75

- Add `AgentDefinition` for declarative agent configuration
- Fields: `name`, `description`, `instructions`, `tools`, `mcpServers`

## v0.2.74

- Improved streaming with backpressure handling
- Better memory management for long-running streams

## v0.2.73

- Add `maxTurns` parameter for limiting conversation depth
- Prevents runaway agent loops

## v0.2.72

- Add structured output via `outputSchema`
- JSON Schema validation for agent responses

## v0.2.71

- Add `permissions` configuration object
- Fine-grained control: `allow`, `deny`, `ask` modes per tool

## v0.2.70

- Add subagent support with `createSubagent()`
- Subagents run in isolated sessions with shared context

## v0.2.69

- Improved hook system with `beforeTool`, `afterTool`, `onError`
- Hooks receive full tool invocation context

## v0.2.68

- Add `abortSignal` support for canceling queries
- Integrates with standard `AbortController`

## v0.2.67

- Add `workingDirectory` parameter
- All file operations resolve relative to this directory

## v0.2.66

- Improved retry logic with configurable backoff
- `maxRetries`, `retryDelay`, `retryBackoffMultiplier`

## v0.2.65

- Add `allowedTools` filter per query
- Restrict available tools for specific operations

## v0.2.64

- Add `conversationId` for multi-turn tracking
- Resume conversations across process restarts

## v0.2.63

- Improved error types with `ClaudeSDKError` hierarchy
- Error codes for programmatic handling

## v0.2.62

- Add event emitter interface
- `on('message')`, `on('toolUse')`, `on('toolResult')`, `on('error')`

## v0.2.61

- Add `metadata` field for custom query data
- Passed through to hooks and event handlers

## v0.2.60

- Improved MCP connection pooling
- Reduced latency for repeated MCP tool calls

## v0.2.59

- Add `timeout` parameter for query and tool timeouts
- Separate `queryTimeout` and `toolTimeout` options

## v0.2.58

- Add `systemPrompt` override in query options
- Per-query system prompt customization

## v0.2.57

- Add `temperature` and `topP` parameters
- Support deterministic outputs

## v0.2.56

- Improved streaming API with `for await...of` support
- `streamText()` convenience method

## v0.2.55

- Add `model` parameter override per query
- Model fallback chain support

## v0.2.54

- Add `environment` parameter for tool execution env vars
- Sandboxed shell command execution

## v0.2.53

- Improved session persistence
- `saveSession()` and `loadSession()` helpers

## v0.2.52

- Add `contextWindowUsage` tracking in responses
- Real-time token usage monitoring

## v0.2.51

- Improved MCP server configuration
- Support for stdio, SSE, and streamable HTTP transports

## v0.2.50

- Add `systemPromptSuffix` for appending instructions
- Composable system prompts

## v0.2.49 - v0.2.1

- Incremental improvements and bug fixes
- Performance optimizations
- Documentation updates
- Type safety improvements
- Error handling enhancements

## v0.2.0

- Major API revision
- Introduce `query()` as primary function
- Add `tool()` for custom tool definitions
- Unified `Options` interface
- Breaking: renamed `execute()` to `query()`

## v0.1.x (v0.1.0 - v0.1.99)

- Initial release series
- Core `query()` API (originally `execute()`)
- Built-in tools: `Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep`
- Session management for multi-turn conversations
- MCP server integration
- Streaming and non-streaming modes
- Hook system for tool lifecycle
- Permission system for tool access control
- Node.js 18+ support

## v0.1.0

- Initial release of Claude Agent SDK for TypeScript
- Core API for programmatic access to Claude Code capabilities
- Built-in tool support matching Claude Code's native tools
- Session management and persistence
- MCP server integration
- TypeScript-first with full type definitions
- ESM and CommonJS support
