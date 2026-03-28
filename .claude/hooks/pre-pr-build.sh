#!/usr/bin/env bash
# .claude/hooks/pre-pr-build.sh — Full build validation before PR creation
# Exit 0 = build passes (safe to create PR)
# Exit 2 = build fails (block PR creation)

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"

# ── Check if agenttasks has any changes ────────────────────────
AGENTTASKS_CHANGED=false
if git diff --name-only HEAD -- agenttasks/ 2>/dev/null | grep -q .; then
  AGENTTASKS_CHANGED=true
fi
if git diff --cached --name-only -- agenttasks/ 2>/dev/null | grep -q .; then
  AGENTTASKS_CHANGED=true
fi

# ── Always validate build (even if agenttasks unchanged) ───────
# The build can fail due to environment issues (fonts, deps, etc.)
echo "Running agenttasks build validation..."

if ! (cd "$ROOT/agenttasks" && npm install --silent 2>/dev/null && npm run build 2>&1); then
  echo ""
  echo "BUILD FAILED"
  echo ""
  echo "The agenttasks Next.js build failed. Do NOT create a PR until this is fixed."
  echo "Vercel Turbo compute costs \$0.126/min — failed builds waste money."
  echo ""
  echo "Common fixes:"
  echo "  - next/font/google 403 → switch to next/font/local (see layout.tsx)"
  echo "  - Missing types → cd agenttasks && npx tsc --noEmit"
  echo "  - Missing deps → cd agenttasks && npm install"
  exit 2
fi

echo "Build passed. Safe to create PR."
exit 0
