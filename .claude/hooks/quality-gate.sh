#!/usr/bin/env bash
# .claude/hooks/quality-gate.sh — PreToolUse hook for code quality enforcement
# Intercepts Bash tool calls containing 'git commit' to run quality checks.
# Runs AFTER validate-commit.sh (which checks message format).
#
# Checks:
# 1. TypeScript: strict return types, no implicit any
# 2. Python: type annotations on public functions
# 3. Style guide: no console.log in production, no TODO without ticket
# 4. Architecture: no cross-boundary imports
# 5. Secrets: no hardcoded credentials
#
# Exit 0 = allow, Exit 2 = block with message

set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# Only intercept git commits
if [ "$TOOL_NAME" != "Bash" ] || ! echo "$COMMAND" | grep -q 'git commit'; then
  exit 0
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
ERRORS=()
WARNINGS=()

# ── Get staged files ──────────────────────────────────────────
STAGED_TS=$(git diff --cached --name-only --diff-filter=ACM -- '*.ts' '*.tsx' 2>/dev/null || true)
STAGED_PY=$(git diff --cached --name-only --diff-filter=ACM -- '*.py' 2>/dev/null || true)
STAGED_ALL=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)

# ── 1. TypeScript: return types on exported functions ─────────
if [ -n "$STAGED_TS" ]; then
  for file in $STAGED_TS; do
    [ -f "$ROOT/$file" ] || continue
    # Check for exported functions missing return types
    # Pattern: export function name(params) { — missing : ReturnType
    MISSING_RETURNS=$(grep -nE '^\s*export\s+(async\s+)?function\s+\w+\s*\([^)]*\)\s*\{' "$ROOT/$file" 2>/dev/null | grep -v ')\s*:\s*' || true)
    if [ -n "$MISSING_RETURNS" ]; then
      ERRORS+=("$file: exported function(s) missing return type annotation")
    fi

    # Check for console.log in non-test files
    if ! echo "$file" | grep -qE '(test|spec|__tests__)'; then
      CONSOLE_LOGS=$(grep -nE '\bconsole\.(log|debug)\b' "$ROOT/$file" 2>/dev/null || true)
      if [ -n "$CONSOLE_LOGS" ]; then
        WARNINGS+=("$file: console.log/debug found — use logger instead")
      fi
    fi
  done
fi

# ── 2. Python: type annotations on public functions ───────────
if [ -n "$STAGED_PY" ]; then
  for file in $STAGED_PY; do
    [ -f "$ROOT/$file" ] || continue
    # Check for public functions (not starting with _) missing return type
    MISSING_PY_RETURNS=$(grep -nE '^\s*def\s+[a-zA-Z][a-zA-Z0-9_]*\s*\(' "$ROOT/$file" 2>/dev/null | grep -v '__' | grep -v ')\s*->' || true)
    if [ -n "$MISSING_PY_RETURNS" ]; then
      COUNT=$(echo "$MISSING_PY_RETURNS" | wc -l | tr -d ' ')
      WARNINGS+=("$file: $COUNT public function(s) missing return type annotation (-> Type)")
    fi
  done
fi

# ── 3. Architecture: cross-boundary import checks ────────────
if [ -n "$STAGED_ALL" ]; then
  for file in $STAGED_ALL; do
    [ -f "$ROOT/$file" ] || continue
    SUBREPO=$(echo "$file" | cut -d/ -f1)

    # Check TypeScript imports crossing sub-repo boundaries
    if echo "$file" | grep -qE '\.(ts|tsx)$'; then
      # Imports should not reference sibling sub-repos directly
      BAD_IMPORTS=$(grep -nE "from\s+['\"]\.\./(claude-|agenttasks)" "$ROOT/$file" 2>/dev/null || true)
      if [ -n "$BAD_IMPORTS" ]; then
        ERRORS+=("$file: cross-boundary import detected — sub-repos must not import from siblings directly")
      fi
    fi

    # Check Python imports crossing sub-repo boundaries
    if echo "$file" | grep -qE '\.py$'; then
      BAD_PY_IMPORTS=$(grep -nE "^(from|import)\s+(claude_code|claude_multi|claude_channel|claude_dspy|agenttasks)" "$ROOT/$file" 2>/dev/null || true)
      if [ -n "$BAD_PY_IMPORTS" ]; then
        # Only flag if the import is from a different sub-repo
        IMPORT_TARGET=$(echo "$BAD_PY_IMPORTS" | head -1 | grep -oE '(claude_code|claude_multi|claude_channel|claude_dspy|agenttasks)\w*' | head -1 || true)
        if [ -n "$IMPORT_TARGET" ]; then
          WARNINGS+=("$file: possible cross-boundary Python import — verify this is intentional")
        fi
      fi
    fi
  done
fi

# ── 4. Secrets check (enhanced) ──────────────────────────────
if [ -n "$STAGED_ALL" ]; then
  for file in $STAGED_ALL; do
    [ -f "$ROOT/$file" ] || continue
    # Skip binary files and lock files
    echo "$file" | grep -qE '\.(lock|png|jpg|woff2|ico)$' && continue

    # Check for hardcoded secrets patterns
    SECRETS=$(grep -nEi '(password|secret|api_key|apikey|token|credential)\s*[:=]\s*["\x27][A-Za-z0-9+/=_-]{16,}' "$ROOT/$file" 2>/dev/null || true)
    if [ -n "$SECRETS" ]; then
      ERRORS+=("$file: possible hardcoded secret detected — use environment variables")
    fi

    # Check for AWS keys
    AWS_KEYS=$(grep -nE 'AKIA[0-9A-Z]{16}' "$ROOT/$file" 2>/dev/null || true)
    if [ -n "$AWS_KEYS" ]; then
      ERRORS+=("$file: AWS access key detected — never commit credentials")
    fi
  done
fi

# ── 5. Style: TODO without reference ─────────────────────────
if [ -n "$STAGED_ALL" ]; then
  for file in $STAGED_ALL; do
    [ -f "$ROOT/$file" ] || continue
    echo "$file" | grep -qE '\.(lock|png|jpg|woff2|ico|jsonl)$' && continue
    # TODOs should reference a ticket or todos.jsonl ID
    BARE_TODOS=$(grep -nE '\bTODO\b' "$ROOT/$file" 2>/dev/null | grep -v 'TODO(#\|TODO(\w\|todos.jsonl\|TODO.*id:' || true)
    if [ -n "$BARE_TODOS" ]; then
      COUNT=$(echo "$BARE_TODOS" | wc -l | tr -d ' ')
      if [ "$COUNT" -gt 0 ]; then
        WARNINGS+=("$file: $COUNT TODO(s) without ticket/ID reference")
      fi
    fi
  done
fi

# ── Report results ────────────────────────────────────────────
if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "QUALITY GATE FAILED"
  echo ""
  echo "Blocking issues:"
  for err in "${ERRORS[@]}"; do
    echo "  ERROR: $err"
  done
  if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo ""
    echo "Warnings (non-blocking):"
    for warn in "${WARNINGS[@]}"; do
      echo "  WARN: $warn"
    done
  fi
  echo ""
  echo "Fix the errors above before committing."
  exit 2
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo "Quality gate passed with warnings:"
  for warn in "${WARNINGS[@]}"; do
    echo "  WARN: $warn"
  done
fi

exit 0
