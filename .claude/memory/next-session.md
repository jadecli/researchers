# Next Session Context

> This file is dynamically replaced at the end of each Claude Code session.
> It captures out-of-scope items from the current session that should be
> addressed in a fresh PR. Read by the SessionStart hook for continuity.
>
> Last updated: 2026-03-27 (session: typescript-data-warehouse-artifacts)

## Out of Scope (do NOT add to current PR)

### ci: add Claude Code CI/CD checks to GitHub Actions

Add two GitHub Actions workflows using `CLAUDE_CODE_OAUTH_TOKEN` from repo secrets
(alternative to `ANTHROPIC_API_KEY` for Claude Code Pro Max subscribers at $200/month):

1. **Claude Code CI check** (`claude-code-ci.yml`)
   - Trigger: on PR to `main`
   - Runs `claude -p "review this PR for correctness"` against the diff
   - Uses `anthropics/claude-code-action@v1` with `CLAUDE_CODE_OAUTH_TOKEN`
   - Scope: `agenttasks/` changes only (skip non-deployed sub-repos)

2. **Claude Code security review** (`claude-code-security.yml`)
   - Trigger: on PR to `main`
   - Runs the `claude-code-security-review/` scanners (PII, SSRF, injection, exfiltration)
   - Uses `CLAUDE_CODE_OAUTH_TOKEN` for AI-assisted triage of findings
   - Posts findings as PR review comments

### References
- Existing workflows in `claude-code-actions/.github/workflows/` (7 workflows)
- Security scanners in `claude-code-security-review/scanners/` (Python, TS, Go, Rust)
- Hook profiles in `claude-multi-agent-sdk/src/hooks/profiles.ts` (CI profile pattern)
- `CLAUDE_CODE_OAUTH_TOKEN`: GitHub repo secret, OAuth token from Claude Code Pro Max subscription
