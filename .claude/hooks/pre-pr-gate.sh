#!/usr/bin/env bash
# .claude/hooks/pre-pr-gate.sh — PreToolUse hook for PR creation
# Intercepts mcp__github__create_pull_request and gh pr create calls.
# Runs full build validation + quality checks before allowing PR creation.
#
# Exit 0 = allow, Exit 2 = block with message

set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# Intercept PR creation via MCP or gh CLI
IS_PR_CREATE=false
if [ "$TOOL_NAME" = "mcp__github__create_pull_request" ]; then
  IS_PR_CREATE=true
elif [ "$TOOL_NAME" = "Bash" ] && echo "$COMMAND" | grep -qE 'gh\s+pr\s+create'; then
  IS_PR_CREATE=true
fi

if [ "$IS_PR_CREATE" != "true" ]; then
  exit 0
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
ERRORS=()

echo "Pre-PR gate: running quality checks..."

# ── 1. agenttasks build validation ────────────────────────────
if [ -d "$ROOT/agenttasks/node_modules" ]; then
  echo "  Checking agenttasks TypeScript..."
  if ! (cd "$ROOT/agenttasks" && npx tsc --noEmit 2>&1 | tail -5); then
    ERRORS+=("agenttasks TypeScript check failed — fix type errors before PR")
  else
    echo "  agenttasks TypeScript: clean"
  fi
else
  echo "  WARNING: agenttasks/node_modules missing — skipping TS check"
fi

# ── 2. Python lint (if ruff available) ────────────────────────
if command -v ruff >/dev/null 2>&1; then
  echo "  Checking Python with ruff..."
  CHANGED_PY=$(git diff --name-only HEAD~1..HEAD -- '*.py' 2>/dev/null || true)
  if [ -n "$CHANGED_PY" ]; then
    for pyfile in $CHANGED_PY; do
      [ -f "$ROOT/$pyfile" ] || continue
      if ! ruff check "$ROOT/$pyfile" 2>&1 | tail -3; then
        ERRORS+=("$pyfile: ruff lint errors")
      fi
    done
  fi
  echo "  Python lint: done"
fi

# ── 3. Check for unresolved merge conflicts ───────────────────
CONFLICT_FILES=$(git diff --name-only HEAD 2>/dev/null | xargs grep -l '<<<<<<< \|======= \|>>>>>>> ' 2>/dev/null || true)
if [ -n "$CONFLICT_FILES" ]; then
  ERRORS+=("Unresolved merge conflicts in: $CONFLICT_FILES")
fi

# ── 4. Check that all staged changes are committed ────────────
UNCOMMITTED=$(git diff --name-only 2>/dev/null || true)
UNSTAGED=$(git diff --cached --name-only 2>/dev/null || true)
if [ -n "$UNCOMMITTED" ] || [ -n "$UNSTAGED" ]; then
  ERRORS+=("Uncommitted changes detected — commit all changes before creating PR")
fi

# ── 5. Verify branch is pushed to remote ─────────────────────
BRANCH=$(git branch --show-current 2>/dev/null)
if [ -n "$BRANCH" ]; then
  REMOTE_REF=$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo "")
  LOCAL_REF=$(git rev-parse HEAD 2>/dev/null || echo "")
  if [ "$REMOTE_REF" != "$LOCAL_REF" ]; then
    ERRORS+=("Local branch is ahead of remote — push before creating PR")
  fi
fi

# ── 6. Security scan on changed files ─────────────────────────
CHANGED_ALL=$(git diff --name-only HEAD~1..HEAD 2>/dev/null || true)
for file in $CHANGED_ALL; do
  [ -f "$ROOT/$file" ] || continue
  # Quick secret scan
  if grep -qEi 'AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC )?PRIVATE KEY' "$ROOT/$file" 2>/dev/null; then
    ERRORS+=("$file: credential or private key detected — remove before PR")
  fi
done

# ── Report ────────────────────────────────────────────────────
if [ ${#ERRORS[@]} -gt 0 ]; then
  echo ""
  echo "PRE-PR GATE FAILED"
  echo ""
  for err in "${ERRORS[@]}"; do
    echo "  ERROR: $err"
  done
  echo ""
  echo "Fix the issues above before creating a pull request."
  echo "Vercel Turbo compute costs \$0.126/min — failed builds waste money."
  exit 2
fi

echo "Pre-PR gate: all checks passed"
exit 0
