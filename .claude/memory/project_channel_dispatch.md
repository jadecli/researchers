---
name: channel-dispatch-routing-plan
description: Plan for claude-channel-dispatch-routing repo — 7th repo incorporating Channels reference, Plugins reference, community plugins catalog, and Neon PG18 persistence
type: project
---

## claude-channel-dispatch-routing

Final wrap repo incorporating:
1. **Channels Reference** — MCP servers that push events into Claude Code sessions (claude/channel capability, notifications/claude/channel, reply tools, sender gating, permission relay)
2. **Plugins Reference** — Complete plugin system (skills, agents, hooks, MCP, LSP, channels, userConfig, manifest schema)
3. **Community Plugins Catalog** — 500+ plugins from claude-plugins-community marketplace as rich problem-solving context
4. **Neon Postgres 18** — Crawl data persistence using pg_stat_statements, pgvector, hstore, pg_trgm, pg_cron, timescaledb, bloom index, pg_uuidv7 for change-detection-only crawling

**Why:** The final 3 crawl rounds (8-10) from claude-multi-agent-dispatch need a dedicated repo that handles channel-based dispatch routing with persistent Neon storage so pages aren't re-crawled unless they change.

**How to apply:** This repo becomes the production deployment target — channels push external events, the dispatch router assigns agents, Neon stores crawl state, and the iterative loop only re-crawls changed pages.
