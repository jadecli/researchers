# jadecli/researchers

Monorepo containing 9 sub-repos for iterative documentation crawling and multi-agent dispatch.

## Key Commands
- `npm run build` — Build agenttasks Next.js app (from root)
- `npm run build:check` — TypeScript check only (fast, no full build)
- `npm run lint` — Lint agenttasks
- `cd agenttasks && npm run dev` — Run the webapp locally
- `cd claude-code && PYTHONPATH=. python3 -m scrapy list` — List spiders
- `cd claude-multi-agent-sdk && npx vitest run` — Run SDK tests (54)
- `cd claude-multi-agent-dispatch && npx vitest run` — Run dispatch tests (252)

## Structure
Each subdirectory is an independent repo with its own .claude/CLAUDE.md.
The root ARCHITECTURE.md documents the full orchestration trace.
The todos.jsonl tracks 22 indexed improvement items across all repos.

## Commit Convention (Conventional Commits)
All commits MUST use conventional commit format:
- `feat:` — New feature
- `fix:` — Bug fix
- `chore:` — Maintenance, dependency updates
- `docs:` — Documentation only
- `refactor:` — Code restructuring (no behavior change)
- `test:` — Test additions or fixes
- `ci:` — CI/CD changes

Example: `feat: add style management module with Kimball analytics`

## Pre-PR Checklist
ALWAYS run before creating a pull request:
1. `cd agenttasks && npm run build` — Vercel will run this on every PR push
2. Verify no `next/font/google` imports (use `next/font/local` with bundled woff2 files)
3. Check Vercel bot comment on PR for deployment status

The `UserPromptSubmit` hook in `.claude/settings.json` will remind you automatically.

## Vercel Deployment
- **Only `agenttasks/` deploys to Vercel** — other sub-repos are not deployed
- `vercel.json` has `ignoreCommand` that skips builds when only non-agenttasks files change
- **COST WARNING**: Turbo compute = $0.126/min (9x more than Standard at $0.014/min)
  - Recommendation: Switch to Standard in Vercel dashboard > Settings > General > Build Machine
  - Failed builds waste money — always validate locally first
- Fonts: Use `next/font/local` with woff2 files in `agenttasks/public/` (NOT `next/font/google` which fails with HTTP 403 in build environments)

## Environment
- Node.js >= 20 required (see `.nvmrc`)
- The `SessionStart` hook in `.claude/settings.json` validates the environment automatically
- Run `nvm use` or ensure Node 20+ is available before starting work

## Hooks (root .claude/settings.json)
- `SessionStart` — Validates environment, auto-installs deps, injects agentcommits context
- `PreToolUse(Bash)` — context-pre-commit.sh (commit format, return types, arch, secrets), context-pre-pr.sh (build, push, conflicts, security)
- `PreToolUse(mcp__github__create_pull_request)` — context-pre-pr.sh (same gate for MCP PR creation)
- `UserPromptSubmit` — Detects PR creation intent, warns if build not validated
- Escalation chain: fix at source → Slack alert → Linear ticket → TODO in todos.jsonl (never silent)
- Sub-repo hooks (PreToolUse, PostToolUse, Stop) are defined in each sub-repo's own settings.json
