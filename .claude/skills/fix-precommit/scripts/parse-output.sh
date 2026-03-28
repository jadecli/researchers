#!/usr/bin/env bash
# parse-output.sh — Parse pre-commit output into structured JSON
# Usage: pre-commit run --all-files 2>&1 | bash parse-output.sh
#
# Output: JSON array of hook results:
# [{"hook": "ruff", "status": "failed", "files": ["a.py"], "errors": ["E501..."]}]

set -euo pipefail

INPUT=$(cat)
RESULTS="[]"

# Extract each hook block from pre-commit output
# Format: "hook-name...Status" followed by error lines
current_hook=""
current_status=""
current_errors=""

while IFS= read -r line; do
  # Match hook result lines: "hook-name...(dots)...Passed/Failed/Skipped"
  if echo "$line" | grep -qE '^[a-zA-Z].*\.\.\.' ; then
    # Save previous hook if it failed
    if [ -n "$current_hook" ] && [ "$current_status" = "failed" ]; then
      escaped_errors=$(echo "$current_errors" | jq -Rs '.')
      RESULTS=$(echo "$RESULTS" | jq --arg hook "$current_hook" --arg status "$current_status" --argjson errors "$escaped_errors" \
        '. + [{"hook": $hook, "status": $status, "errors": $errors}]')
    fi

    # Parse new hook line
    current_hook=$(echo "$line" | sed 's/[. ].*//' | tr -d ' ')
    current_errors=""

    if echo "$line" | grep -qi "Passed"; then
      current_status="passed"
    elif echo "$line" | grep -qi "Skipped"; then
      current_status="skipped"
    elif echo "$line" | grep -qi "Failed"; then
      current_status="failed"
    else
      current_status="unknown"
    fi
  elif [ "$current_status" = "failed" ] && [ -n "$line" ]; then
    # Accumulate error lines for failed hooks
    if [ -n "$current_errors" ]; then
      current_errors="$current_errors
$line"
    else
      current_errors="$line"
    fi
  fi
done <<< "$INPUT"

# Save last hook if failed
if [ -n "$current_hook" ] && [ "$current_status" = "failed" ]; then
  escaped_errors=$(echo "$current_errors" | jq -Rs '.')
  RESULTS=$(echo "$RESULTS" | jq --arg hook "$current_hook" --arg status "$current_status" --argjson errors "$escaped_errors" \
    '. + [{"hook": $hook, "status": $status, "errors": $errors}]')
fi

echo "$RESULTS" | jq .
