# Claude Agent SDK — TypeScript CHANGELOG

> Source: https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md
> Fetched: 2026-03-28
> Note: Full content was not extractable. See source for complete changelog.

The TypeScript Agent SDK changelog documents the evolution of the `@anthropic-ai/claude-agent-sdk` package.

## Key Patterns

- Package name: `@anthropic-ai/claude-agent-sdk`
- Install: `npm install @anthropic-ai/claude-agent-sdk`
- Primary API: `query()` function (V1), `unstable_v2_createSession()` (V2 preview)
- Session management: resume, fork, tag, rename
- MCP server support: stdio, SSE, HTTP, in-process SDK servers
- Hook system: PreToolUse, PostToolUse, Stop events
- Permission modes: default, acceptEdits, bypassPermissions, plan, dontAsk
- Subagent support via `AgentDefinition` type
- Structured outputs with JSON schema

For the complete version-by-version changelog, refer to the source repository.
