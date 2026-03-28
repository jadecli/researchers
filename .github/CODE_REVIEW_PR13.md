# Code Review: PR #13 — CI/CD Infrastructure

## Commit-by-commit review

### 1. `872e391` feat: add cross-session memory persistence via MCP tools
- **MCP memory.ts**: save_memory, recall_memory, list_memories with branded MemoryDomain type
- **Storage**: File-backed (~/compass-data/memories/), upgradeable to Neon PG18
- **Tests**: 7 new vitest tests, 61/61 total suite
- **Verdict**: Clean. Result<T,E> error handling consistent with SDK patterns.

### 2. `af2be4c` chore: add pre-commit quality gates with Makefile
- **Hooks**: ruff, tsc (SDK/dispatch/agenttasks), eslint, vitest (SDK/dispatch), pytest, radon complexity
- **Makefile**: `make setup` idempotent — installs pre-commit + radon via uv, npm install for sub-repos
- **Note**: agenttasks tsc/eslint hooks had `|| true` (fixed in cd3d4d7)
- **Verdict**: Good foundation. Pre-commit config is monorepo-aware with path-scoped hooks.

### 3. `935ae81` feat: add /fix-precommit skill
- **Skill**: Parses pre-commit output → structured JSON → chains fixes per hook type
- **Scripts**: parse-output.sh categorizes failures by ruff/tsc/vitest/eslint/pytest
- **Verdict**: Useful automation. Follows skill guide patterns (SKILL.md + scripts/).

### 4. `771d6b8` feat: add agentcrawls-ts changelog crawler
- **Crawler**: CheerioCrawler targeting 3 Anthropic repos
- **Detection**: SHA-256 bloom filter (10K items, 1% FP rate)
- **Extraction**: Regex primary, @ax-llm/ax AI fallback (currently unused in index.ts)
- **Storage**: Neon PG18 upsert, file-based bloom state
- **Tests**: 23/23 pass (bullets, change-detect, changelog)
- **Gap**: Neon bloom persistence code exists but unused (saveBloomState/loadBloomState)
- **Verdict**: Solid. Bloom filter is the right choice for incremental detection.

### 5. `85f3a94` ci: add quality-gates GitHub Actions workflow
- **Approach**: `make setup` + `pre-commit run --all-files` — delegates to pre-commit hooks
- **Node**: actions/setup-node@v6 with .nvmrc and monorepo cache-dependency-path
- **Python**: astral-sh/setup-uv@v4 for pre-commit + radon
- **Verdict**: Clean. Single-job design reduces CI minutes.

### 6. `b9c2d7d` ci: add claude-code-action + security-review workflows
- **CI**: anthropics/claude-code-action@v1 with claude_code_oauth_token
- **Security**: anthropics/claude-code-security-review@v1 with claude-sonnet-4-6
- **Alerts**: Channel webhook on failure
- **Verdict**: Good. Review-only (no auto-approve).

### 7. `835203f` chore: pin @anthropic-ai packages to exact versions
- **Pinned**: @anthropic-ai/sdk@0.80.0, @anthropic-ai/claude-agent-sdk@0.2.86, @anthropic-ai/tokenizer@0.0.4, @modelcontextprotocol/sdk@1.28.0
- **Scope**: All 5 sub-repos that use these packages
- **Verdict**: Critical for reproducibility. No caret ranges.

### 8. `cd3d4d7` fix: resolve 7 tsc errors + remove silent pre-commit failures
- **SDK**: Removed unused USD/toUSD imports (TS6133)
- **Dispatch**: Added VariantCompletedEvent/ExperimentCompletedEvent to Event union, fixed Date vs string
- **Pre-commit**: Removed `|| true` from agenttasks hooks
- **Verdict**: All real bugs. The `|| true` removal is the most important fix.

### 9. `f673da5` feat: vitest v8 coverage with baseline thresholds
- **Coverage**: @vitest/coverage-v8 for SDK (50%), dispatch (~70%), crawls (48%)
- **Configs**: vitest.config.ts in each sub-repo
- **Scripts**: coverage:sdk, coverage:dispatch, coverage:crawls, coverage:all
- **Verdict**: Good baseline. Crawls threshold set to 45% to match reality.

### 10. GitHub Actions Workflows (6 new)

| Workflow | Action | Version | Verified |
|---|---|---|---|
| Linear Sync | Linear GraphQL API | N/A | Custom (curl) |
| Slack Notify | slackapi/slack-github-action | @v2 | Yes |
| Neon Preview | neondatabase/create-branch-action | @v6 | Yes |
| Neon Cleanup | neondatabase/delete-branch-action | @v3 | Yes |
| Neon Schema Diff | neondatabase/schema-diff-action | @v1 | Yes |
| Gitflow Labeler | actions/labeler | @v6 | Yes (GitHub) |
| Conventional Commits | amannn/action-semantic-pull-request | @v6 | Popular |
| Dependabot Auto-merge | dependabot/fetch-metadata | @v2 | Yes (GitHub) |
| Release Drafter | release-drafter/release-drafter | @v7 | Yes |
| Changelog Monitor | actions/cache + actions/github-script | @v4/@v7 | Yes (GitHub) |

### 11. `0b79cae` docs: ARCHITECTURE.md cross-references
- All 9 sub-repo CLAUDE.md files reference root ARCHITECTURE.md section
- Created missing agentcrawls-ts/.claude/CLAUDE.md
- **Verdict**: Good discoverability.

## Secrets Validation

| Secret | Configured | Used By |
|---|---|---|
| NEON_API_KEY | Yes | neon-preview.yml |
| NEON_PROJECT_ID | Yes (variable) | neon-preview.yml |
| DATABASE_URL | Yes | changelog-monitor.yml |
| CLAUDE_CODE_OAUTH_TOKEN | Yes | claude-code-ci.yml, claude-code-security.yml |
| SLACK_WEBHOOK_URL | Pending | slack-notify.yml |
| LINEAR_API_KEY | Pending | linear-sync.yml |

## Test Results Post-Merge

- SDK: 61/61 pass
- Dispatch: 278/278 pass
- Crawls: 23/23 pass
- **Total: 362/362 ALL PASS**
- agenttasks build: 66 routes, 0 errors
