# MCP Architecture — jadecli/researchers

> Model Context Protocol servers, plugins, and cross-device integration for this monorepo.

## Local MCP Servers (5 servers, all v1 Stdio)

All servers use `@modelcontextprotocol/sdk@1.28.0` with `StdioServerTransport`.

| Server | Sub-repo | Entry | Tools | Resources |
|--------|----------|-------|-------|-----------|
| multi-agent-research | claude-multi-agent-sdk | `src/mcp/server.ts` | classify_query, generate_tasks, synthesize_results, estimate_costs, save_memory, recall_memory, list_memories | research://patterns, memory://architecture |
| shannon-thinking | claude-multi-agent-dispatch | `src/thinking/server.ts` | create_thought, chain_thoughts, track_assumption, challenge_assumption, compute_confidence, get_report | shannon://methodology |
| dispatch-server | claude-multi-agent-dispatch | `src/dispatch/mcp-server.ts` | classify_dispatch, plan_dispatch, execute_dispatch, check_status, get_transcript | dispatch://patterns |
| dispatch-channel | claude-channel-dispatch-routing | `src/channel/server.ts` | reply | Implements `claude/channel` push capability |
| (config generator) | claude-code-agents-python | `src/plugin_gen/mcp_config.py` | Generates .mcp.json for stdio/sse/streamable-http | — |

## Project-Scoped .mcp.json Files

```
claude-multi-agent-sdk/.mcp.json        → multi-agent-research server
claude-multi-agent-dispatch/.mcp.json   → shannon-thinking + dispatch-tools servers
claude-channel-dispatch-routing/.mcp.json → dispatch-channel server
```

## Official Plugin MCP Servers

Enabled in `~/.claude/settings.json` via `enabledPlugins`:

| Plugin | Endpoint | Auth | Cross-device |
|--------|----------|------|-------------|
| vercel | Vercel MCP | OAuth (auto) | Yes (`claude.ai Vercel` exists) |
| slack | Slack API | OAuth (auto) | Yes (`claude.ai Slack` exists) |
| linear | Linear API | OAuth (auto) | Yes (`claude.ai Linear` exists) |
| neon | Neon API | OAuth (auto) | CLI only (no remote version) |
| github | api.githubcopilot.com/mcp/ | `$GITHUB_PERSONAL_ACCESS_TOKEN` env var | CLI only (no remote version) |

### GitHub Plugin Auth Fix

The GitHub plugin requires `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable.
Set in `~/.config/zsh/env.zsh`:

```bash
if command -v gh &>/dev/null && gh auth status &>/dev/null 2>&1; then
  export GITHUB_PERSONAL_ACCESS_TOKEN="$(gh auth token)"
fi
```

This dynamically resolves from the `gh` CLI OAuth token — no separate PAT to manage.

## Cross-Device Reality

| Surface | Local plugins | Remote MCPs (`claude.ai *`) | `gh` CLI |
|---------|--------------|---------------------------|----------|
| CLI (macOS) | Yes | Yes | Yes |
| Claude Desktop | Yes (if shell sourced) | Yes | Yes |
| claude.ai/code (web) | No | Yes | No |
| claude.ai/code (iPhone) | No | Yes | No |

Only `claude.ai *` remote MCPs work on mobile/web. There is no `claude.ai GitHub` integration as of 2026-03-28.

## MCP Scopes

| Scope | Storage | Shared | Use case |
|-------|---------|--------|----------|
| local | `~/.claude.json` (project path) | No | Personal dev servers |
| project | `.mcp.json` in repo root | Yes (git) | Team-shared servers |
| user | `~/.claude.json` (global) | No | Personal cross-project |
| managed | `/Library/Application Support/ClaudeCode/managed-mcp.json` | Org | IT admin lockdown |

## Upgrade Path: v1 → v2

Current: `@modelcontextprotocol/sdk@1.28.0` (v1, stable)
Target: `@modelcontextprotocol/server` v2 (pre-alpha, targeting Q1 2026 stable)

| v1 | v2 | Impact |
|----|-----|--------|
| `server.tool()` | `registerTool()` | All 5 servers |
| `extra` param | `ctx` object | All tool handlers |
| No outputSchema | `outputSchema` + Zod v4 | Type-safe structured output |
| Stdio primary | Streamable HTTP primary | **Enables cross-device** |
| Single package | Split: /server, /client, /node | Package restructure |
| No Tasks API | Tasks API (working/completed/failed) | Long-running dispatch |

**Strategic priority**: Migrate Stdio → Streamable HTTP transport to enable cross-device MCP access.

## Channel Architecture

Only `claude-channel-dispatch-routing` implements `claude/channel`:

```
External webhook → POST :8788/ → MCP notification → Claude Code session
Claude Code ← SSE :8788/events ← reply tool → dispatch router
Permission requests relayed via notifications/claude/channel/permission
```

Sender gating via `~/.claude/channels/dispatch/access.json`.
