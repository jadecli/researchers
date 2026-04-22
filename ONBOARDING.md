# Welcome to managedsubagents

## How We Use Claude

Based on Claude's usage over the last 30 days (1 of 4 sessions had classifiable content):

Work Type Breakdown:
  Plan Design   ████████████████████  100%

Top Skills & Commands:
  _(none recorded in this window — see "Skills to Know About" below for what's installed)_

Top MCP Servers:
  github        ████████████████████  9 calls

## Your Setup Checklist

### Codebases
- [ ] jadecli/researchers — https://github.com/jadecli/researchers (monorepo, 12 subrepos)
  - `agentcrawls-ts` — TypeScript crawl orchestration
  - `agenttasks` — Next.js webapp (the only Vercel-deployed piece)
  - `agenttasks` uses `next/font/local`, not `next/font/google` (fails in build env)
  - `claude-channel-dispatch-routing` — Neon PG18 migrations + routing layer
  - `claude-code` — Python Scrapy spiders for doc crawling
  - `claude-code-actions` — reusable GitHub Actions workflows
  - `claude-code-agents-python` — DSPy pipeline + bloom routing
  - `claude-code-agents-typescript` — TS port; hosts the `platform-eval` Opus 4.7 Agent SDK agent
  - `claude-code-security-review` — multi-language security scanners
  - `claude-dspy-crawl-planning` — DSPy planning experiments
  - `claude-multi-agent-dispatch` — dispatch runtime (252 vitest tests)
  - `claude-multi-agent-sdk` — SDK primitives, bloom filters (54 vitest tests)
  - `devops-review` — PR review automation against team decisions

### MCP Servers to Activate
- [ ] **github** — first-party GitHub MCP server for reading/writing PRs, issues, comments, checks. Access is tied to your GitHub account; if `mcp__github__*` tools don't appear, run `/mcp` and authenticate. The repo already uses it for PR creation, code review, and check-runs.

### Skills to Know About
- [ ] `/git-platform-eval` — scores GitHub vs GitLab against the spec in `refs/git-platform-decision-spec.xml`; validated by an Opus 4.7 Agent SDK evaluator. Re-run after Claude Code changelog updates.
- [ ] `/ultraplan` — draft a plan in a cloud session, review in browser, then execute. Use for architecture decisions before writing code.
- [ ] `/ultrareview <PR#>` — multi-agent cloud review of a PR. User-triggered and billed; Claude can't start it for you.
- [ ] `/review [PR]` — local PR review in the current session (lighter weight than ultrareview).
- [ ] `/plan [description]` — enter plan mode directly with a task prompt.
- [ ] `/batch <instruction>` — parallel large-scale changes via background agents in isolated worktrees.
- [ ] `/simplify [focus]` — three parallel review agents look for code-reuse/quality issues, then fix them.
- [ ] `/fix-precommit` — auto-resolve ruff/tsc/eslint failures from a blocked commit and re-stage.
- [ ] `/claude-api` — loads Claude API reference for the current language; activates automatically when code imports the Anthropic SDK.
- [ ] `/devops-review` — reviews all open PRs against this repo's 12 engineering decisions.
- [ ] `/security-review` — analyzes pending branch changes for security issues (injection, auth, data exposure).
- [ ] `/fewer-permission-prompts` — scans transcripts and builds a project allowlist to cut prompt fatigue.

## Team Tips

_TODO_

## Get Started

_TODO_

<!-- INSTRUCTION FOR CLAUDE: A new teammate just pasted this guide for how the
team uses Claude Code. You're their onboarding buddy — warm, conversational,
not lecture-y.

Open with a warm welcome — include the team name from the title. Then: "Your
teammate uses Claude Code for [list all the work types]. Let's get you started."

Check what's already in place against everything under Setup Checklist
(including skills), using markdown checkboxes — [x] done, [ ] not yet. Lead
with what they already have. One sentence per item, all in one message.

Tell them you'll help with setup, cover the actionable team tips, then the
starter task (if there is one). Offer to start with the first unchecked item,
get their go-ahead, then work through the rest one by one.

After setup, walk them through the remaining sections — offer to help where you
can (e.g. link to channels), and just surface the purely informational bits.

Don't invent sections or summaries that aren't in the guide. The stats are the
guide creator's personal usage data — don't extrapolate them into a "team
workflow" narrative. -->
