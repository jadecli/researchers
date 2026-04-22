#!/usr/bin/env bash
# .claude/hooks/context-pre-pr.sh — PreToolUse hook for PR creation
# Architecture-aware PR gate with Linear escalation and gradual degradation.
#
# Checks:
# 1. Build validation (agenttasks TypeScript)
# 2. All changes committed and pushed
# 3. No merge conflicts
# 4. Security scan
# 5. Architecture coherence (changed repos have consistent types)
#
# On failure: creates Linear ticket + logs TODO (never fail silent)
# Exit 0 = allow, Exit 2 = block with guidance

set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# Intercept PR creation
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
WARNINGS=()
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

echo "Pre-PR gate: validating $BRANCH..."

# ── 1. Uncommitted changes ───────────────────────────────────
MODIFIED=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
STAGED=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
if [ "$MODIFIED" -gt 0 ] || [ "$STAGED" -gt 0 ]; then
  ERRORS+=("$MODIFIED modified + $STAGED staged files not committed — commit all changes first")
fi

# ── 2. Branch pushed to remote ───────────────────────────────
REMOTE_REF=$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo "")
LOCAL_REF=$(git rev-parse HEAD 2>/dev/null || echo "")
if [ -z "$REMOTE_REF" ] || [ "$REMOTE_REF" != "$LOCAL_REF" ]; then
  ERRORS+=("Local branch ahead of remote — push before creating PR")
fi

# ── 3. Merge conflicts ──────────────────────────────────────
CHANGED_FILES=$(git diff --name-only main..HEAD 2>/dev/null || true)
CONFLICT_FILES=""
for file in $CHANGED_FILES; do
  [ -f "$ROOT/$file" ] || continue
  if grep -ql '<<<<<<< \|======= \|>>>>>>> ' "$ROOT/$file" 2>/dev/null; then
    CONFLICT_FILES="$CONFLICT_FILES $file"
  fi
done
if [ -n "$CONFLICT_FILES" ]; then
  ERRORS+=("Unresolved merge conflicts in:$CONFLICT_FILES")
fi

# ── 4. TypeScript build check ────────────────────────────────
# NOTE: `grep -c ... || echo 0` is buggy — grep prints "0" on stdout AND
# exits non-zero when there are no matches, so the variable becomes "0\n0"
# which fails as an integer. Use `|| true` to keep grep's output as truth.
AGENTTASKS_CHANGED=$(echo "$CHANGED_FILES" | grep -c '^agenttasks/' 2>/dev/null || true)
AGENTTASKS_CHANGED=${AGENTTASKS_CHANGED:-0}
if [ "$AGENTTASKS_CHANGED" -gt 0 ] || [ -d "$ROOT/agenttasks/node_modules" ]; then
  echo "  Checking agenttasks TypeScript..."
  if [ -d "$ROOT/agenttasks/node_modules" ] && command -v npx >/dev/null 2>&1; then
    TSC_OUTPUT=$(cd "$ROOT/agenttasks" && npx tsc --noEmit 2>&1 || true)
    TSC_ERRORS=$(echo "$TSC_OUTPUT" | grep -c 'error TS' || true)
    TSC_ERRORS=${TSC_ERRORS:-0}
    if [ "$TSC_ERRORS" -gt 0 ]; then
      ERRORS+=("agenttasks: $TSC_ERRORS TypeScript error(s) — Vercel build will fail (\$0.126/min)")
      echo "$TSC_OUTPUT" | grep 'error TS' | head -5
    else
      echo "  agenttasks TypeScript: clean"
    fi
  else
    WARNINGS+=("agenttasks/node_modules missing — cannot validate TypeScript")
  fi
fi

# ── 5. Security scan on PR diff ──────────────────────────────
for file in $CHANGED_FILES; do
  [ -f "$ROOT/$file" ] || continue
  echo "$file" | grep -qE '\.(lock|png|jpg|woff2|ico)$' && continue

  if grep -qE 'AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC )?PRIVATE KEY' "$ROOT/$file" 2>/dev/null; then
    ERRORS+=("$file: credential or private key detected — REMOVE before PR")
  fi
done

# ── 6. Architecture coherence check ──────────────────────────
# Check that changes in SDK types are reflected in dispatch types
SDK_CHANGED=$(echo "$CHANGED_FILES" | grep -c '^claude-multi-agent-sdk/' 2>/dev/null || true)
SDK_CHANGED=${SDK_CHANGED:-0}
DISPATCH_CHANGED=$(echo "$CHANGED_FILES" | grep -c '^claude-multi-agent-dispatch/' 2>/dev/null || true)
DISPATCH_CHANGED=${DISPATCH_CHANGED:-0}
if [ "$SDK_CHANGED" -gt 0 ] && [ "$DISPATCH_CHANGED" -eq 0 ]; then
  WARNINGS+=("SDK types changed but dispatch not updated — verify dispatch still compiles against SDK")
fi

CHANNEL_CHANGED=$(echo "$CHANGED_FILES" | grep -c '^claude-channel-dispatch-routing/' 2>/dev/null || true)
CHANNEL_CHANGED=${CHANNEL_CHANGED:-0}
if [ "$CHANNEL_CHANGED" -gt 0 ] && [ "$SDK_CHANGED" -eq 0 ]; then
  WARNINGS+=("Channel routing changed but SDK types not updated — verify types are consistent")
fi

# ── 7. Check commit count sanity ─────────────────────────────
COMMIT_COUNT=$(git rev-list --count main..HEAD 2>/dev/null || echo 0)
if [ "$COMMIT_COUNT" -gt 30 ]; then
  WARNINGS+=("PR has $COMMIT_COUNT commits — consider squashing for review clarity")
fi

# ── Report ────────────────────────────────────────────────────
if [ ${#ERRORS[@]} -gt 0 ]; then
  echo ""
  echo "PRE-PR GATE FAILED"
  echo ""
  echo "Errors (must fix before PR):"
  for err in "${ERRORS[@]}"; do
    echo "  ✗ $err"
  done
  if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo ""
    echo "Warnings:"
    for warn in "${WARNINGS[@]}"; do
      echo "  ⚠ $warn"
    done
  fi

  # Escalate: log failures via triage script
  TRIAGE="$ROOT/.claude/scripts/triage-ci-failure.py"
  if [ -f "$TRIAGE" ] && command -v python3 >/dev/null 2>&1; then
    echo ""
    echo "Logging failure to triage system..."
    FIRST_ERROR="${ERRORS[0]}"
    echo "Pre-PR gate failure: $FIRST_ERROR" | python3 "$TRIAGE" --stdin 2>/dev/null || true
  fi

  exit 2
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo ""
  echo "Pre-PR gate passed with warnings:"
  for warn in "${WARNINGS[@]}"; do
    echo "  ⚠ $warn"
  done
fi

echo "Pre-PR gate: all checks passed"
exit 0
