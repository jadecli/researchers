---
source: https://platform.claude.com/docs/en/agent-sdk/overview
fetched: 2026-03-28
description: Claude Agent SDK overview — build production AI agents with Claude Code as a library
---

# Claude Agent SDK Overview

The Claude Agent SDK lets you build production AI agents using Claude Code as a library. It provides programmatic access to Claude Code's full capabilities — tools, sessions, hooks, subagents, MCP, and permissions — so you can embed agentic AI into your applications.

## Installation

### TypeScript

```bash
npm install @anthropic-ai/claude-agent-sdk
```

### Python

```bash
pip install claude-agent-sdk
```

## Capabilities

### Built-in tools

The Agent SDK includes all of Claude Code's built-in tools:

- **Read** — Read files from the filesystem
- **Write** — Write files to the filesystem
- **Edit** — Make targeted edits to existing files
- **Bash** — Execute shell commands
- **Glob** — Find files by pattern matching
- **Grep** — Search file contents with regex

### Hooks

Hooks let you run custom code before and after tool executions:

- `beforeTool` — Run before a tool is invoked (can modify or cancel)
- `afterTool` — Run after a tool completes (can modify results)
- `onError` — Handle errors during tool execution

### Subagents

Spawn child agents that run in isolated sessions but can share context with the parent agent. Useful for parallel task execution and divide-and-conquer strategies.

### MCP (Model Context Protocol)

Connect to MCP servers to extend Claude's capabilities with custom tools, resources, and prompts. Supports stdio, SSE, and streamable HTTP transports.

### Permissions

Fine-grained control over what tools agents can use:

- `allow` — Automatically approve tool use
- `deny` — Block tool use
- `ask` — Prompt for approval (interactive mode)

### Sessions

Manage multi-turn conversations with persistent state:

- Create, resume, fork, and delete sessions
- Tag sessions for organization
- Track session history and metadata
- Session persistence across process restarts

## Comparison with Client SDK and CLI

| Feature | Agent SDK | Client SDK | CLI |
|---|---|---|---|
| Built-in tools | Yes | No | Yes |
| Session management | Yes | No | Yes |
| MCP integration | Yes | No | Yes |
| Hooks | Yes | No | No |
| Subagents | Yes | No | No |
| Streaming | Yes | Yes | Yes |
| Non-interactive use | Yes | Yes | Partial |
| Custom tools | Yes | Yes (via API) | No |
| Programmatic API | Yes | Yes | No |

**Use the Agent SDK when** you need Claude Code's full agentic capabilities (tools, sessions, MCP) in your application.

**Use the Client SDK when** you only need to send prompts and receive responses without agentic features.

**Use the CLI when** you want interactive terminal-based coding assistance.

## Changelog

- [TypeScript changelog](https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md)
- [Python changelog](https://github.com/anthropics/claude-agent-sdk-python/blob/main/CHANGELOG.md)

## Branding guidelines

When referencing the Agent SDK in your applications:

- Use "Claude Agent SDK" as the full name
- Do not use "Anthropic Agent SDK"
- Follow Anthropic's brand guidelines for logo and trademark usage
- Include attribution: "Powered by Claude Agent SDK"

## License

The Claude Agent SDK is released under the MIT License.
