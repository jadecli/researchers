# Next Session Context

> This file is dynamically replaced at the end of each Claude Code session.
> It captures out-of-scope items from the current session that should be
> addressed in a fresh PR. Read by the SessionStart hook for continuity.
>
> Last updated: 2026-03-27 (session: typescript-data-warehouse-artifacts)

## Bootstrap

**NEW**: `.claude/bootstrap.xml` is the deterministic entry point for all sessions.
Read it at session start for model routing, pinned documents, and architecture
component awareness. The bootstrap replaces ad-hoc context loading with a
structured XML prompt that defines how this repo operates.

## Claude Code Version Pin

**Last reviewed:** `2.1.85`
**Current latest:** `2.1.85`
**Changelog:** https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md

At session start, diff the changelog from the pinned version to current.
Incorporate relevant improvements into this repo's structure, hooks, and workflows.
After reviewing, bump the pin to the latest version in this file.

### Notable changes since 2.1.80 (all reviewed this session):
- **2.1.81**: `--bare` flag for scripted API calls; `--channels` permission relay for mobile approval
- **2.1.82**: Worktree session initialization fixes
- **2.1.83**: Drop-in directory support for modular policy; `CwdChanged`/`FileChanged` reactive hooks; `initialPrompt` frontmatter for agents
- **2.1.84**: `TaskCreated` hook for task lifecycle; `PreToolUse` hooks can provide headless answers; model capability detection env vars
- **2.1.85**: Conditional hook execution via permission rule syntax; MCP OAuth RFC 9728; org-managed plugin blocking

## Research Docs (.claude/research/)

Five research docs exist, two more are planned. Read at session start:

| File | Priority | Status |
|------|----------|--------|
| `agentcrawls.md` | P0 | Infrastructure exists, formalization needed |
| `agentdata.md` | P0 | Infrastructure exists, Tier 4 views needed |
| `agentevals.md` | P0 | Design complete, implementation needed |
| `agentcommits.md` | P2 | Conceptual, start using git trailers |
| `agentprompts.md` | P2 | Conceptual, needs data from evals first |
| `agentmemories` | P1 | Not yet written — write research doc |
| `agentspecs` | P3 | Not yet written — conditional |

## Out of Scope (do NOT add to current PR)

### P0: Implement agentdata Tier 4 views (migration 008)
- Create `agentdata` Postgres schema in Neon PG18
- `agentdata.claude_code_context` view (token-budgeted agent context)
- `agentdata.session_briefing` view (SessionStart hook query)
- `agentdata.domain_summary` view (per-domain knowledge summary)
- Connect SessionStart hook to query Neon when DATABASE_URL is set

### P0: Implement agentevals deterministic loop
- `runtime.eval_events` table
- `reporting.fact_eval_finding` fact table
- `semantic.eval_pass_rate` metric view
- Single-agent evaluator (Opus) with manual trigger
- Multi-agent dispatch via claude-multi-agent-dispatch

### P1: Agent bloom filters for tool routing (separate PR in progress)
- Pre-check tool call likelihood before dispatching
- Haiku checks bloom filter, Sonnet executes actual tool call
- Reduces latency and wasted tokens on failed lookups

### P1: Write agentmemories research doc
- Cross-session knowledge persistence
- Episodic, semantic, procedural memory types
- Decay, consolidation, conflict resolution
- Replace .claude/memory/ flat files with agentdata Tier 4

### ci: add Claude Code CI/CD checks to GitHub Actions
Add two workflows using `CLAUDE_CODE_OAUTH_TOKEN` from repo secrets:
1. Claude Code CI check (`claude-code-ci.yml`) — PR correctness review
2. Claude Code security review (`claude-code-security.yml`) — scanner triage

### feat: dual-format agenttasks webapp
Human-readable + AI agent-optimized across 7 areas:
1. Site-level discovery (llms.txt, robots.txt, AGENTS.md)
2. Page-level HTML (JSON-LD, canonical, meta)
3. Markdown mirrors + content negotiation
4. Code/API docs
5. Next.js tooling (@agentmarkup/next)
6. Implementation checklist (5 phases)
7. Reference URLs

### References
- Existing workflows in `claude-code-actions/.github/workflows/` (7 workflows)
- Security scanners in `claude-code-security-review/scanners/` (Python, TS, Go, Rust)
- Hook profiles in `claude-multi-agent-sdk/src/hooks/profiles.ts` (CI profile pattern)
- `CLAUDE_CODE_OAUTH_TOKEN`: GitHub repo secret, OAuth token from Claude Code Pro Max
- Bootstrap: `.claude/bootstrap.xml` — read at every session start
- Research docs: `.claude/research/*.md` — architecture component specs
