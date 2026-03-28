#!/usr/bin/env bash
# .claude/hooks/context-pre-commit.sh — PreToolUse hook for git commit
# Context-aware pre-commit that understands the codebase architecture.
#
# Instead of rigid regex, this hook:
# 1. Loads codebase context (which sub-repos are affected)
# 2. Validates changes fit the architecture
# 3. Checks quality with gradual degradation
# 4. On failure: logs TODO, never fails silent
#
# Exit 0 = allow, Exit 2 = block with guidance

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
GUIDANCE=()

# ── Get staged files and affected sub-repos ──────────────────
STAGED_ALL=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)
if [ -z "$STAGED_ALL" ]; then
  exit 0  # Nothing staged, nothing to check
fi

# Determine affected sub-repos
declare -A AFFECTED_REPOS
for file in $STAGED_ALL; do
  SUBREPO=$(echo "$file" | cut -d/ -f1)
  AFFECTED_REPOS[$SUBREPO]=1
done

REPO_LIST=$(echo "${!AFFECTED_REPOS[@]}" | tr ' ' ', ')

# ── 1. Conventional commit format ────────────────────────────
COMMIT_MSG=""
if echo "$COMMAND" | grep -qE '\-m\s+"'; then
  COMMIT_MSG=$(echo "$COMMAND" | sed -n 's/.*-m\s*"\([^"]*\)".*/\1/p' | head -1)
elif echo "$COMMAND" | grep -q 'EOF'; then
  COMMIT_MSG=$(echo "$COMMAND" | sed -n '/cat <<.*EOF/,/EOF/p' | grep -v 'EOF\|cat <<' | head -1 | sed 's/^[[:space:]]*//')
fi

if [ -n "$COMMIT_MSG" ]; then
  FIRST_LINE=$(echo "$COMMIT_MSG" | head -1)
  if ! echo "$FIRST_LINE" | grep -qE '^(feat|fix|chore|docs|style|refactor|perf|test|ci|build|revert)(\([^)]+\))?!?:\s+.+'; then
    ERRORS+=("Commit message not in conventional format: $FIRST_LINE")
    GUIDANCE+=("Format: type(scope): description — types: feat, fix, chore, docs, refactor, test, ci, build")
  fi
fi

# ── 2. TypeScript: return types on exports ───────────────────
STAGED_TS=$(echo "$STAGED_ALL" | grep -E '\.(ts|tsx)$' || true)
for file in $STAGED_TS; do
  [ -f "$ROOT/$file" ] || continue
  # Only check new/modified exported functions
  MISSING_RETURNS=$(grep -nE '^\s*export\s+(async\s+)?function\s+\w+\s*\([^)]*\)\s*\{' "$ROOT/$file" 2>/dev/null | grep -v ')\s*:\s*' || true)
  if [ -n "$MISSING_RETURNS" ]; then
    COUNT=$(echo "$MISSING_RETURNS" | wc -l | tr -d ' ')
    ERRORS+=("$file: $COUNT exported function(s) missing return type — add : ReturnType after parameters")
    GUIDANCE+=("Every exported function must have an explicit return type for the architecture contract")
  fi
done

# ── 3. Python: return type annotations ───────────────────────
STAGED_PY=$(echo "$STAGED_ALL" | grep -E '\.py$' || true)
for file in $STAGED_PY; do
  [ -f "$ROOT/$file" ] || continue
  MISSING_PY=$(grep -E '^\s*def\s+[a-zA-Z][a-zA-Z0-9_]*\s*\(' "$ROOT/$file" 2>/dev/null | grep -v '__' | grep -vc ')\s*->' 2>/dev/null || echo 0)
  if [ "$MISSING_PY" -gt 0 ]; then
    WARNINGS+=("$file: $MISSING_PY public function(s) missing -> return type annotation")
  fi
done

# ── 4. Architecture: cross-boundary imports ──────────────────
for file in $STAGED_TS; do
  [ -f "$ROOT/$file" ] || continue
  BAD_IMPORTS=$(grep -nE "from\s+['\"]\.\./(claude-|agenttasks)" "$ROOT/$file" 2>/dev/null || true)
  if [ -n "$BAD_IMPORTS" ]; then
    ERRORS+=("$file: cross-boundary import — sub-repos must communicate via MCP/SDK, not direct imports")
    GUIDANCE+=("Architecture: sub-repos are independent. Use the claude-multi-agent-sdk types or MCP tools for cross-repo communication")
  fi
done

for file in $STAGED_PY; do
  [ -f "$ROOT/$file" ] || continue
  # Check if importing from a different sub-repo
  FILE_REPO=$(echo "$file" | cut -d/ -f1)
  BAD_PY=$(grep -nE "^(from|import)\s+(claude_code|claude_multi|claude_channel|claude_dspy|agenttasks)" "$ROOT/$file" 2>/dev/null || true)
  if [ -n "$BAD_PY" ]; then
    # Only flag if it's actually cross-boundary
    for match in $BAD_PY; do
      IMPORT_REPO=$(echo "$match" | grep -oE '(claude_code|claude_multi|claude_channel|claude_dspy|agenttasks)' | head -1 | tr '_' '-' || true)
      if [ -n "$IMPORT_REPO" ] && [ "$IMPORT_REPO" != "$FILE_REPO" ]; then
        WARNINGS+=("$file: cross-boundary Python import from $IMPORT_REPO — verify this is via shared interface")
      fi
    done
  fi
done

# ── 5. Secrets detection ─────────────────────────────────────
for file in $STAGED_ALL; do
  [ -f "$ROOT/$file" ] || continue
  echo "$file" | grep -qE '\.(lock|png|jpg|woff2|ico)$' && continue
  if echo "$file" | grep -qiE '\.env$|credentials|\.key$'; then
    ERRORS+=("$file: sensitive file staged — remove from commit")
    continue
  fi
  if grep -qE 'AKIA[0-9A-Z]{16}' "$ROOT/$file" 2>/dev/null; then
    ERRORS+=("$file: AWS access key detected")
  fi
  if grep -qE '-----BEGIN (RSA |EC )?PRIVATE KEY' "$ROOT/$file" 2>/dev/null; then
    ERRORS+=("$file: private key detected")
  fi
done

# ── 6. Style: console.log in production code ─────────────────
for file in $STAGED_TS; do
  [ -f "$ROOT/$file" ] || continue
  echo "$file" | grep -qE '(test|spec|__tests__)' && continue
  LOGS=$(grep -c '\bconsole\.\(log\|debug\)\b' "$ROOT/$file" 2>/dev/null || echo 0)
  if [ "$LOGS" -gt 0 ]; then
    WARNINGS+=("$file: $LOGS console.log/debug — use structured logger (telemetry.ts pattern)")
  fi
done

# ── Report ────────────────────────────────────────────────────
if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "COMMIT BLOCKED — Quality gate failed"
  echo ""
  echo "Affected repos: $REPO_LIST"
  echo ""
  echo "Errors (must fix):"
  for err in "${ERRORS[@]}"; do
    echo "  ✗ $err"
  done
  if [ ${#GUIDANCE[@]} -gt 0 ]; then
    echo ""
    echo "Guidance:"
    for guide in "${GUIDANCE[@]}"; do
      echo "  → $guide"
    done
  fi
  if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo ""
    echo "Warnings (should fix):"
    for warn in "${WARNINGS[@]}"; do
      echo "  ⚠ $warn"
    done
  fi

  # Log to triage script for tracking (never fail silent)
  TRIAGE_SCRIPT="$ROOT/.claude/scripts/triage-ci-failure.py"
  if [ -f "$TRIAGE_SCRIPT" ] && command -v python3 >/dev/null 2>&1; then
    FIRST_ERROR="${ERRORS[0]}"
    echo "$FIRST_ERROR" | python3 "$TRIAGE_SCRIPT" --stdin --dry-run 2>/dev/null || true
  fi

  exit 2
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo "Commit allowed with warnings (repos: $REPO_LIST):"
  for warn in "${WARNINGS[@]}"; do
    echo "  ⚠ $warn"
  done
fi

exit 0
