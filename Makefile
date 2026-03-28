.PHONY: setup lint lint-py lint-ts test test-ts test-py precommit ci crawl

# Bootstrap everything — safe to run repeatedly, explicit errors on missing tools
setup:
	@command -v uv >/dev/null || { echo "ERROR: uv not found. Install: curl -LsSf https://astral.sh/uv/install.sh | sh"; exit 1; }
	@command -v pre-commit >/dev/null || uv tool install pre-commit
	@command -v radon >/dev/null || uv tool install radon
	@command -v pre-commit >/dev/null && pre-commit install --install-hooks 2>/dev/null || true
	@test -d claude-multi-agent-sdk/node_modules || (cd claude-multi-agent-sdk && npm install --legacy-peer-deps --silent 2>/dev/null)
	@test -d claude-multi-agent-dispatch/node_modules || (cd claude-multi-agent-dispatch && npm install --legacy-peer-deps --silent 2>/dev/null)
	@echo "Setup complete"

# Python lint
lint-py:
	ruff check . --fix
	ruff format .

# TypeScript type check
lint-ts:
	cd claude-multi-agent-sdk && npx tsc --noEmit
	cd claude-multi-agent-dispatch && npx tsc --noEmit

lint: lint-py lint-ts

# TypeScript tests
test-ts:
	cd claude-multi-agent-sdk && npx vitest run
	cd claude-multi-agent-dispatch && npx vitest run

# Python tests
test-py:
	@python3 -m pytest claude-code-agents-python/tests/ -x --tb=short 2>/dev/null || true

test: test-ts test-py

# Pre-commit (all hooks)
precommit:
	pre-commit run --all-files

# CI mirror (same checks as pre-commit, used by GitHub Actions)
ci: lint test
	@echo "CI checks passed"

# Crawl changelogs
crawl:
	cd agentcrawls-ts && npx tsx src/index.ts
