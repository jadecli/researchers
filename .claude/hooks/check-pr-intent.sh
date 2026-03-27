#!/usr/bin/env bash
# .claude/hooks/check-pr-intent.sh — UserPromptSubmit hook
# Detects PR creation intent and injects build validation warning.
# Non-blocking (always exits 0). Adds context to Claude's response.

set -euo pipefail

# Read the user prompt from stdin
INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.user_prompt // .prompt // ""' 2>/dev/null || echo "")

# Check if the prompt mentions PR creation
if echo "$PROMPT" | grep -qiE '(create|open|make|submit|push).*(pr|pull.?request)|/pr|pull.?request'; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"

  # Quick build check (tsc only — fast, no full next build)
  if command -v npx >/dev/null 2>&1 && [ -d "$ROOT/agenttasks/node_modules" ]; then
    if ! (cd "$ROOT/agenttasks" && npx tsc --noEmit 2>/dev/null); then
      echo "REMINDER: agenttasks has TypeScript errors. Run 'cd agenttasks && npm run build' before creating the PR. Vercel build failures on Turbo compute cost \$0.126/min."
      exit 0
    fi
  fi

  # Remind about build validation even if tsc passes
  echo "REMINDER: Before creating this PR, verify 'cd agenttasks && npm run build' passes locally. The Vercel Preview build runs on every PR push."
fi

exit 0
