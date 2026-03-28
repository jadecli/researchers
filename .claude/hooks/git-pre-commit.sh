#!/usr/bin/env bash
# .claude/hooks/git-pre-commit.sh — Git pre-commit hook
# Installed to .git/hooks/pre-commit by session-setup.sh
# Validates conventional commit format and runs quick checks.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"

# ── Check if agenttasks files are staged ──────────────────────
AGENTTASKS_STAGED=$(git diff --cached --name-only -- agenttasks/ 2>/dev/null | head -1)

if [ -n "$AGENTTASKS_STAGED" ]; then
  # Quick TypeScript check for agenttasks changes
  if [ -d "$ROOT/agenttasks/node_modules" ] && command -v npx >/dev/null 2>&1; then
    echo "Pre-commit: checking agenttasks TypeScript..."
    if ! (cd "$ROOT/agenttasks" && npx tsc --noEmit 2>&1 | tail -5); then
      echo ""
      echo "BLOCKED: agenttasks has TypeScript errors."
      echo "Fix errors before committing, or use --no-verify to skip."
      exit 1
    fi
    echo "Pre-commit: agenttasks TypeScript clean"
  fi
fi

# ── Check for secrets in staged files ──────────────────────────
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null)
for file in $STAGED_FILES; do
  if echo "$file" | grep -qiE '\.env$|credentials|secret|\.key$'; then
    echo "BLOCKED: Potentially sensitive file staged: $file"
    echo "Remove from staging or use --no-verify if intentional."
    exit 1
  fi
done

exit 0
