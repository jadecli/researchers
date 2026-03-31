#!/usr/bin/env bash
# .claude/hooks/session-setup.sh — SessionStart hook
# Context-aware session initialization with gradual degradation.
# Loads: environment, agentcommits state, recent commits, active PRs, available scripts.
# NEVER blocks (always exits 0). Injects context for the session.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
STATUS=()

# ── 1. Environment Validation ────────────────────────────────
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

# ── 2. Auto-install deps in cloud ────────────────────────────
if [ -d "$ROOT/agenttasks/node_modules" ]; then
  STATUS+=("agenttasks/node_modules: present")
else
  if [ -f "$ROOT/agenttasks/package.json" ] && command -v npm >/dev/null 2>&1; then
    STATUS+=("agenttasks/node_modules missing — auto-installing...")
    if (cd "$ROOT/agenttasks" && npm install --no-audit --no-fund --loglevel=error 2>&1 | tail -3); then
      STATUS+=("agenttasks/node_modules: installed")
    else
      STATUS+=("WARNING: agenttasks npm install failed")
    fi
  fi
fi

# ── 3. Git pre-commit hook auto-install ──────────────────────
PRECOMMIT_HOOK="$ROOT/.git/hooks/pre-commit"
PRECOMMIT_SOURCE="$ROOT/.claude/hooks/git-pre-commit.sh"
if [ -f "$PRECOMMIT_SOURCE" ] && [ ! -f "$PRECOMMIT_HOOK" ]; then
  cp "$PRECOMMIT_SOURCE" "$PRECOMMIT_HOOK"
  chmod +x "$PRECOMMIT_HOOK"
  STATUS+=("git pre-commit hook: installed")
elif [ -f "$PRECOMMIT_HOOK" ]; then
  STATUS+=("git pre-commit hook: present")
fi

# ── 4. TypeScript quick check ────────────────────────────────
if [ -d "$ROOT/agenttasks/node_modules" ] && command -v npx >/dev/null 2>&1; then
  if (cd "$ROOT/agenttasks" && npx tsc --noEmit 2>/dev/null); then
    STATUS+=("agenttasks TypeScript: clean")
  else
    STATUS+=("WARNING: agenttasks has TypeScript errors")
  fi
fi

# ── 5. Python environment ────────────────────────────────────
if command -v python3 >/dev/null 2>&1; then
  STATUS+=("$(python3 --version 2>&1)")
  python3 -c "import scrapy" 2>/dev/null && STATUS+=("scrapy: available") || STATUS+=("WARNING: scrapy not installed")
fi

# ── Print environment status ─────────────────────────────────
echo "--- Session Environment ---"
for line in "${STATUS[@]}"; do
  echo "  $line"
done
echo "---"

# ══════════════════════════════════════════════════════════════
# CONTEXT INJECTION — Agentcommits, recent history, scripts
# ══════════════════════════════════════════════════════════════

echo ""
echo "--- Agentcommits Context ---"

# ── 6. Recent commit history with agent trailer detection ────
echo "  Recent commits (last 10):"
RECENT_COMMITS=$(git log --oneline -10 2>/dev/null || echo "  (no git history)")
echo "$RECENT_COMMITS" | while IFS= read -r line; do
  echo "    $line"
done

# Count agent-authored commits in last 50
AGENT_COMMITS=$(git log -50 --format='%b' 2>/dev/null | grep -c 'Agent-Id:' || echo 0)
TOTAL_RECENT=50
echo "  Agent-authored: $AGENT_COMMITS of last $TOTAL_RECENT commits"

# ── 7. Current branch and merge base ────────────────────────
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "  Branch: $BRANCH"

# Commits ahead of main
AHEAD=$(git rev-list --count main..HEAD 2>/dev/null || echo "?")
echo "  Commits ahead of main: $AHEAD"

# ── 8. Uncommitted changes summary ──────────────────────────
MODIFIED=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
STAGED=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')
echo "  Working tree: $MODIFIED modified, $STAGED staged, $UNTRACKED untracked"

# ── 9. Open TODOs from todos.jsonl ───────────────────────────
if [ -f "$ROOT/todos.jsonl" ]; then
  OPEN_TODOS=$(grep -c '"status":"open"' "$ROOT/todos.jsonl" 2>/dev/null || echo 0)
  HIGH_TODOS=$(grep '"status":"open"' "$ROOT/todos.jsonl" 2>/dev/null | grep -c '"priority":"high"' || echo 0)
  echo "  Open TODOs: $OPEN_TODOS ($HIGH_TODOS high priority)"
fi

echo "---"

# ── 9b. Neon session briefing (if DATABASE_URL set) ─────────
if command -v psql >/dev/null 2>&1 && [ -n "${DATABASE_URL:-}" ]; then
  BRIEFING=$(psql "$DATABASE_URL" -t -A -c \
    "SELECT row_to_json(t) FROM agentdata.session_briefing t" 2>/dev/null || true)
  if [ -n "$BRIEFING" ]; then
    echo ""
    echo "--- Neon Session Briefing ---"
    echo "  $BRIEFING"
    echo "---"
  fi
fi

# ── 10. Available headless scripts ───────────────────────────
echo ""
echo "--- Available Headless Scripts ---"
if [ -d "$ROOT/.claude/scripts" ]; then
  for script in "$ROOT/.claude/scripts"/*.sh "$ROOT/.claude/scripts"/*.py "$ROOT/.claude/scripts"/*.ts; do
    [ -f "$script" ] || continue
    NAME=$(basename "$script")
    # Extract description from first comment line
    DESC=$(head -3 "$script" | grep -E '^#\s' | head -1 | sed 's/^#\s*//' || echo "")
    echo "  $NAME — $DESC"
  done
fi
echo "---"

# ── 11. Decision tree: what hooks enforce ────────────────────
echo ""
echo "--- Enforcement Layer ---"
echo "  PreToolUse hooks active:"
echo "    validate-commit.sh — Conventional commit format (blocks non-compliant)"
echo "    quality-gate.sh    — Return types, architecture, secrets (blocks errors)"
echo "    pre-pr-gate.sh     — Full build, uncommitted changes, security (blocks PR creation)"
echo "  Git pre-commit hook:"
echo "    TypeScript compilation, secrets, cross-boundary imports"
echo "  Escalation chain:"
echo "    1. Fix at source (hook blocks + provides guidance)"
echo "    2. Slack alert (CI failures via ci-quality-gate.yml)"
echo "    3. Linear ticket (triage-ci-failure.py creates issues)"
echo "    4. TODO in todos.jsonl (local fallback, never silent)"
echo "---"

# ── 12. Prior session context ────────────────────────────────
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
