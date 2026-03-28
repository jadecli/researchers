#!/usr/bin/env bash
# .claude/scripts/ci-failure-router.sh — Headless CI failure response
# Called by GitHub Actions on_failure to route to cheap models for triage.
#
# Usage (from GitHub Actions):
#   .claude/scripts/ci-failure-router.sh "${{ github.run_id }}" "${{ job.status }}"
#
# Usage (local):
#   .claude/scripts/ci-failure-router.sh --log-file /path/to/ci-output.log
#
# Decision tree:
#   1. Classify failure with deterministic regex (free)
#   2. If unclassifiable, route to haiku ($0.001)
#   3. If fixable, route to sonnet with codebase context ($0.01)
#   4. If not fixable, Slack + Linear + TODO (never fail silent)

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
TRIAGE="$ROOT/.claude/scripts/triage-ci-failure.py"

# ── Parse arguments ──────────────────────────────────────────
LOG_FILE=""
RUN_ID=""
JOB_STATUS=""

if [ "${1:-}" = "--log-file" ] && [ -n "${2:-}" ]; then
  LOG_FILE="$2"
elif [ -n "${1:-}" ] && [ -n "${2:-}" ]; then
  RUN_ID="$1"
  JOB_STATUS="$2"
fi

# ── Step 1: Collect failure output ───────────────────────────
ERROR_TEXT=""
if [ -n "$LOG_FILE" ] && [ -f "$LOG_FILE" ]; then
  ERROR_TEXT=$(cat "$LOG_FILE")
elif [ -n "$RUN_ID" ]; then
  # Try to fetch from GitHub Actions (if gh CLI available)
  if command -v gh >/dev/null 2>&1; then
    ERROR_TEXT=$(gh run view "$RUN_ID" --log-failed 2>/dev/null | tail -100 || echo "Failed to fetch logs for run $RUN_ID")
  else
    ERROR_TEXT="CI job $RUN_ID failed with status: $JOB_STATUS (gh CLI not available for log fetch)"
  fi
elif ! [ -t 0 ]; then
  # Read from stdin
  ERROR_TEXT=$(cat)
fi

if [ -z "$ERROR_TEXT" ]; then
  echo "ERROR: No failure output to triage"
  echo "Usage: $0 --log-file <path> OR $0 <run_id> <status> OR pipe stdin"
  exit 1
fi

echo "=== CI Failure Router ==="
echo "Triaging $(echo "$ERROR_TEXT" | wc -l | tr -d ' ') lines of error output..."

# ── Step 2: Run Python triage (deterministic + escalation) ───
if [ -f "$TRIAGE" ] && command -v python3 >/dev/null 2>&1; then
  echo "$ERROR_TEXT" | python3 "$TRIAGE" --stdin --json 2>&1
  TRIAGE_EXIT=$?

  if [ $TRIAGE_EXIT -ne 0 ]; then
    echo ""
    echo "WARNING: Python triage script failed (exit $TRIAGE_EXIT)"
    echo "Falling through to headless Claude triage..."
  else
    echo ""
    echo "Triage complete via deterministic classifier"
    exit 0
  fi
else
  echo "Python triage unavailable — routing to headless Claude"
fi

# ── Step 3: Headless Claude triage (if deterministic fails) ──
if command -v claude >/dev/null 2>&1 && [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  echo "Routing to haiku for classification..."

  PROMPT="You are a CI/CD failure classifier. Analyze this error and output ONLY a JSON object:
{
  \"failure_type\": \"type_error|lint_error|build_failure|test_failure|security_finding|dependency_error|architecture_violation|unknown\",
  \"severity\": \"critical|high|medium|low\",
  \"file\": \"path or empty\",
  \"description\": \"one line summary\",
  \"fixable\": true|false,
  \"suggested_action\": \"description of fix or escalation\"
}

Error output:
$(echo "$ERROR_TEXT" | head -50)"

  RESULT=$(claude -p "$PROMPT" --model haiku --max-turns 1 --output-format text 2>/dev/null || echo "")

  if [ -n "$RESULT" ]; then
    echo ""
    echo "Haiku classification:"
    echo "$RESULT"

    # Check if fixable
    if echo "$RESULT" | grep -q '"fixable":\s*true'; then
      echo ""
      echo "Attempting auto-fix with sonnet..."

      FIX_PROMPT="You are a CI/CD auto-fix agent for the jadecli/researchers monorepo.
Architecture: 9 sub-repos (agenttasks, claude-code, claude-multi-agent-sdk, etc.)
Rules: Boris Cherny strict types, Result<T,E>, branded types, conventional commits.
Sub-repos must NOT import from each other directly.

Fix this CI failure. Output ONLY the fix (file path + content changes), nothing else.
If you cannot fix it confidently, output: ESCALATE

Classification: $RESULT

Full error:
$(echo "$ERROR_TEXT" | head -100)"

      FIX_RESULT=$(claude -p "$FIX_PROMPT" --model sonnet --max-turns 1 --output-format text 2>/dev/null || echo "ESCALATE")

      if echo "$FIX_RESULT" | grep -q "ESCALATE"; then
        echo "Sonnet cannot fix — escalating to Slack + Linear + TODO"
        echo "$ERROR_TEXT" | python3 "$TRIAGE" --stdin 2>/dev/null || true
      else
        echo "Sonnet proposed fix:"
        echo "$FIX_RESULT"
        echo ""
        echo "NOTE: Auto-fix requires manual review before applying"
        # Still log as TODO for tracking
        echo "build_failure: CI auto-fix proposed but needs review" | python3 "$TRIAGE" --stdin --dry-run 2>/dev/null || true
      fi
    else
      echo "Not auto-fixable — escalating..."
      echo "$ERROR_TEXT" | python3 "$TRIAGE" --stdin 2>/dev/null || true
    fi
  else
    echo "Haiku classification failed — logging raw error as TODO"
    echo "$ERROR_TEXT" | python3 "$TRIAGE" --stdin 2>/dev/null || true
  fi
else
  echo "Claude headless not available — logging raw error as TODO"
  # Guaranteed fallback: always log to todos.jsonl
  if [ -f "$TRIAGE" ] && command -v python3 >/dev/null 2>&1; then
    echo "$ERROR_TEXT" | python3 "$TRIAGE" --stdin 2>/dev/null || true
  else
    # Last resort: append directly to todos.jsonl
    NEXT_ID=$(python3 -c "
import json
ids = []
try:
    for line in open('$ROOT/todos.jsonl'):
        ids.append(json.loads(line).get('id', 0))
except: pass
print(max(ids, default=0) + 1)
" 2>/dev/null || echo 999)

    echo "{\"id\":$NEXT_ID,\"repo\":\"unknown\",\"file\":\"ci-output\",\"line\":0,\"marker\":\"CI-UNKNOWN\",\"content\":\"CI failure: $(echo "$ERROR_TEXT" | head -1 | tr '"' "'")\",\"status\":\"open\",\"priority\":\"high\",\"created\":\"$(date +%Y-%m-%d)\"}" >> "$ROOT/todos.jsonl"
    echo "Logged TODO #$NEXT_ID (last resort fallback)"
  fi
fi

echo ""
echo "=== CI Failure Router Complete ==="
