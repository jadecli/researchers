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

# ── Pre-commit + tools setup ──────────────────────────────────
if command -v make >/dev/null 2>&1 && [ -f "$ROOT/Makefile" ]; then
  if make -C "$ROOT" -s setup 2>/dev/null; then
    STATUS+=("pre-commit: installed via make setup")
  else
    STATUS+=("WARNING: make setup failed")
  fi
elif command -v uv >/dev/null 2>&1; then
  command -v pre-commit >/dev/null || uv tool install pre-commit 2>/dev/null
  command -v radon >/dev/null || uv tool install radon 2>/dev/null
  if command -v pre-commit >/dev/null 2>&1; then
    pre-commit install --install-hooks 2>/dev/null && STATUS+=("pre-commit: installed") || true
  fi
else
  STATUS+=("WARNING: neither make nor uv found. Pre-commit not installed.")
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
