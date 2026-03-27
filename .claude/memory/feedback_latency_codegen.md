---
name: latency-and-codegen-best-practices
description: Key levers for latency and codegen quality from awesome-claude-code research — apply these to all repos in the researchers project
type: feedback
---

## Latency Levers (Priority Order)
1. **Context management** — #1 factor. Use /clear between tasks, /compact proactively, /btw for side questions, delegate to subagents to keep main context small.
2. **Prompt caching** — enabled by default in Claude Code; use cache_control in API calls.
3. **Streaming** — reduces perceived latency.
4. **Model selection** — Haiku for speed, Sonnet for balance, Opus for quality.
5. **Parallel execution** — multiple terminals, git worktrees, AsyncAnthropic, claude -p in loops.
6. **Auto mode** — eliminates permission prompt interruptions.

**Why:** These were extracted from 21.6k-star awesome-claude-code and validated across 135 agents, 150+ plugins, 100+ subagents.

**How to apply:** When building dispatch/routing, always route to cheapest model that meets quality threshold. Use subagent delegation for verbose exploration. Avoid correction spirals (2 failures → start fresh).

## Codegen Levers (Priority Order)
1. **CLAUDE.md** — single most important tool. Concise rules, not bloat.
2. **Verification-driven** — provide tests/screenshots/expected output for self-verification.
3. **Plan-first** — Explore → Plan → Implement → Commit. Interview for larger features.
4. **Specific prompts** — @-reference files, paste images, scope precisely, point to patterns.
5. **Writer/Reviewer** — one session writes, second reviews with fresh context.
6. **Custom skills & subagents** — .claude/skills/ for workflows, .claude/agents/ for reviewers.
7. **Avoid correction spirals** — after 2 failed corrections, start fresh with better prompt.

## Reference Repos
- hesreallyhim/awesome-claude-code (21.6k stars, 75+ repos, 35+ tips)
- rohitg00/awesome-claude-code-toolkit (135 agents, 150+ plugins, 19 hooks)
- VoltAgent/awesome-claude-code-subagents (100+ specialized subagents)
- shanraisshan/claude-code-best-practice
