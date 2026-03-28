---
name: mcp-architecture-complete
description: Complete MCP architecture map — 5 local servers, 5 official plugins, auth patterns, cross-device reality, scopes, upgrade path from v1 stdio to v2 HTTP. Prevents re-debugging MCP issues.
type: reference
---

## MCP Servers in This Monorepo (All v1, Stdio)

All 5 servers use `@modelcontextprotocol/sdk@1.28.0` (v1) with `StdioServerTransport`.

| Server | Repo | File | Tools | Resources |
|--------|------|------|-------|-----------|
| multi-agent-research | claude-multi-agent-sdk | src/mcp/server.ts | classify_query, generate_tasks, synthesize_results, estimate_costs + 3 memory tools (save/recall/list) | research://patterns, memory://architecture |
| shannon-thinking | claude-multi-agent-dispatch | src/thinking/server.ts | create_thought, chain_thoughts, track_assumption, challenge_assumption, compute_confidence, get_report | shannon://methodology |
| dispatch-server | claude-multi-agent-dispatch | src/dispatch/mcp-server.ts | classify_dispatch, plan_dispatch, execute_dispatch, check_status, get_transcript | dispatch://patterns (ResourceTemplate) |
| dispatch-channel | claude-channel-dispatch-routing | src/channel/server.ts | reply | Implements `claude/channel` capability — push events + permission relay via HTTP/SSE on port 8788 |
| (Python generator) | claude-code-agents-python | src/plugin_gen/mcp_config.py | Generates .mcp.json configs for stdio/sse/streamable-http | ConnectorSpec Pydantic model |

**Project-scoped .mcp.json files** exist in: claude-multi-agent-sdk, claude-multi-agent-dispatch, claude-channel-dispatch-routing.

## Claude Code Plugin MCP Servers (Official)

5 plugins enabled in `~/.claude/settings.json`:

| Plugin | Transport | Auth | Status (2026-03-28) |
|--------|-----------|------|---------------------|
| vercel@claude-plugins-official | HTTP → mcp endpoints | OAuth (auto) | Working |
| slack@claude-plugins-official | HTTP → Slack API | OAuth (auto) | Working |
| neon@claude-plugins-official | HTTP → Neon API | OAuth (auto) | Working |
| linear@claude-plugins-official | HTTP → Linear API | OAuth (auto) | Working |
| github@claude-plugins-official | HTTP → api.githubcopilot.com/mcp/ | `${GITHUB_PERSONAL_ACCESS_TOKEN}` env var | Fixed 2026-03-28 |

**GitHub plugin fix**: Added `export GITHUB_PERSONAL_ACCESS_TOKEN="$(gh auth token)"` to `~/.config/zsh/env.zsh`. Dynamically resolves from `gh` CLI OAuth token (has admin:org, gist, repo, workflow scopes). No PAT to rotate.

## Cross-Device MCP Reality

| Surface | Local plugins (`plugin:*`) | Remote MCPs (`claude.ai *`) | `gh` CLI |
|---------|---------------------------|----------------------------|----------|
| CLI (macOS) | Yes (env vars available) | Yes | Yes |
| Claude Desktop | Yes (if shell profile sourced) | Yes | Yes |
| claude.ai/code (web) | No (no local env) | Yes | No |
| claude.ai/code (iPhone) | No (no local env) | Yes | No |

**Key insight**: Only `claude.ai *` remote MCPs work on mobile/web. There is NO `claude.ai GitHub` remote MCP integration (as of 2026-03-28). Vercel, Slack, Linear, Gmail, Google Calendar have remote versions. GitHub does not.

**To add remote MCPs visible on all devices**: Configure at claude.ai/settings/connectors (Team/Enterprise: admin only).

## MCP Scopes (Where Config Lives)

| Scope | Storage | Shared? | Use case |
|-------|---------|---------|----------|
| local (default) | ~/.claude.json under project path | No | Personal dev servers, sensitive creds |
| project | .mcp.json in project root | Yes (git) | Team-shared servers |
| user | ~/.claude.json global section | No | Personal utils across all projects |
| managed | /Library/Application Support/ClaudeCode/managed-mcp.json | Org-wide | IT admin lockdown |

## Auth Patterns

1. **OAuth 2.0** (recommended for remote): `/mcp` → browser flow → token stored securely
2. **Environment variable**: `${VAR}` expansion in .mcp.json headers (local only)
3. **headersHelper**: Shell command that outputs JSON headers (dynamic tokens, Kerberos, SSO)
4. **Pre-configured OAuth**: `--client-id --client-secret --callback-port` for servers without dynamic client registration

## MCP v1 → v2 Upgrade Path

Current: All servers on `@modelcontextprotocol/sdk@1.28.0` (v1, stable).
Target: `@modelcontextprotocol/server` v2 (pre-alpha, Q1 2026 stable target).

| v1 | v2 | Impact |
|----|-----|--------|
| `server.tool()` | `registerTool()` with options object | All 5 servers |
| `extra` parameter | `ctx` object (logging, sampling, elicitation) | All tool handlers |
| No `outputSchema` | `outputSchema` with Zod v4 | Type-safe structured output |
| Stdio primary | Streamable HTTP primary (SSE deprecated) | Critical for cross-device |
| Single package | Split: /server, /client, /node, /express | Package restructure |
| No Tasks API | Experimental Tasks API (working/completed/failed) | Long-running dispatch |
| No dynamic tools | `handle.disable()/enable()` | Runtime tool management |

**Strategic priority**: Migrate from Stdio to Streamable HTTP transport. This is the single change that enables cross-device access (mobile, web, Desktop) by making servers remotely accessible.

## Tool Search (Context Optimization)

Claude Code defers MCP tool schemas by default (only names loaded at startup). Tools are discovered on-demand via ToolSearch. This means adding more MCP servers has minimal context cost.

- `ENABLE_TOOL_SEARCH=true` (default) — all deferred
- `ENABLE_TOOL_SEARCH=auto` — upfront if <10% context, deferred otherwise
- `ENABLE_TOOL_SEARCH=false` — all upfront (legacy)

## Channels (Push Messages)

Only `claude-channel-dispatch-routing` implements `claude/channel` capability. This allows external events (webhooks, chat messages, CI results) to push into a Claude Code session.

- Server declares `claude/channel` capability
- Client opts in with `--channels` flag at startup
- Events sent via `notifications/claude/channel/event`
- Permission relay via `notifications/claude/channel/permission`

## GitHub Actions Status

GitHub Actions was disabled at org level for `jadecli/researchers`. Fixed 2026-03-28 by adding repo to org's allowed list via `gh api -X PUT orgs/jadecli/actions/permissions/repositories/<id>`. All 9 workflows now active.
