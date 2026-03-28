---
name: mcp-auth-debugging
description: How to diagnose and fix MCP plugin auth failures. Learned from GitHub plugin debugging 2026-03-28.
type: feedback
---

When an MCP plugin shows "failed" in `/mcp`, debug in this order:

1. **Check the plugin's .mcp.json** at `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/.mcp.json`
   - Look for `${VAR}` env var references — if the var isn't set, the server fails silently
2. **Check `~/.claude/mcp-needs-auth-cache.json`** — lists servers that need auth with timestamps
3. **Check env vars** — `env | grep -i <SERVICE>` to see if the required token exists
4. **For GitHub specifically**: `export GITHUB_PERSONAL_ACCESS_TOKEN="$(gh auth token)"` in shell profile
   - Uses existing `gh` CLI OAuth token (no separate PAT to manage)
   - Located in `~/.config/zsh/env.zsh` for this user

**Why:** Plugin MCP configs use env var interpolation (`${VAR}`). If the var is unset, the HTTP request has no auth header → 401 → "failed". The error is not surfaced clearly in the UI.

**How to apply:** When any `plugin:*` MCP server fails, first check its `.mcp.json` for env var requirements before assuming OAuth or server issues. For cross-device access, only `claude.ai *` remote MCPs work on mobile/web — local plugins never will.
