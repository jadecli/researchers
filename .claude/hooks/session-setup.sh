#!/usr/bin/env bash
# .claude/hooks/session-setup.sh — SessionStart hook
# Validates environment on session start for both cloud and iOS.
# NEVER blocks (always exits 0). Prints warnings only.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
STATUS=()

# ── Node.js version check ──────────────────────────────────────
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -ge 20 ] 2>/dev/null; then
    STATUS+=("Node $(node -v)")
  else
    STATUS+=("WARNING: Node $(node -v) detected, need >= 20. Run: nvm use 20")
  fi
else
  STATUS+=("WARNING: node not found. Install Node.js >= 20")
fi

# ── agenttasks dependencies ────────────────────────────────────
if [ -d "$ROOT/agenttasks/node_modules" ]; then
  STATUS+=("agenttasks/node_modules: present")
else
  STATUS+=("WARNING: agenttasks/node_modules missing. Run: cd agenttasks && npm install")
fi

# ── Quick TypeScript check (only if node available) ────────────
if [ -d "$ROOT/agenttasks/node_modules" ] && command -v npx >/dev/null 2>&1; then
  if (cd "$ROOT/agenttasks" && npx tsc --noEmit 2>/dev/null); then
    STATUS+=("agenttasks TypeScript: clean")
  else
    STATUS+=("WARNING: agenttasks has TypeScript errors. Run: cd agenttasks && npx tsc --noEmit")
  fi
fi

# ── Print status ───────────────────────────────────────────────
echo "--- Session Environment ---"
for line in "${STATUS[@]}"; do
  echo "  $line"
done
echo "---"

# ── Next session context (scope carryover) ─────────────────────
NEXT_SESSION="$ROOT/.claude/memory/next-session.md"
if [ -f "$NEXT_SESSION" ]; then
  echo ""
  echo "--- Prior Session Context ---"
  cat "$NEXT_SESSION"
  echo "---"
  echo ""
  echo "NOTE: The above items are OUT OF SCOPE for the current PR."
  echo "Start a new branch/PR to address them."
fi

# Never block session start
exit 0
