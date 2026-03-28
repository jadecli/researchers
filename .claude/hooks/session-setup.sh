#!/usr/bin/env bash
# .claude/hooks/session-setup.sh — SessionStart hook
# Validates environment and emits session stream event on start.
# Captures surface, device, agent metadata for agentstreams pipeline.
# NEVER blocks (always exits 0). Prints warnings only.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
STATUS=()

# ── Agentstreams: Generate session ID and capture metadata ────
BUFFER_DIR="$ROOT/.claude/memory/streams"
mkdir -p "$BUFFER_DIR"
SESSION_ID="${CLAUDE_SESSION_ID:-$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "session-$(date +%s)")}"
echo "$SESSION_ID" > "$BUFFER_DIR/.session_id"

# Surface detection (cli, web, ios, vscode, jetbrains, desktop)
SURFACE="${CLAUDE_SURFACE:-cli}"
if [ -n "${VSCODE_PID:-}" ] || [ -n "${TERM_PROGRAM:-}" ] && [ "${TERM_PROGRAM:-}" = "vscode" ]; then
  SURFACE="vscode"
elif [ -n "${JETBRAINS_IDE:-}" ]; then
  SURFACE="jetbrains"
fi

# Device/OS metadata
OS_NAME=$(uname -s 2>/dev/null || echo "unknown")
OS_VERSION=$(uname -r 2>/dev/null || echo "unknown")
ARCH=$(uname -m 2>/dev/null || echo "unknown")
HOSTNAME_SHORT=$(hostname -s 2>/dev/null || echo "unknown")
SHELL_NAME=$(basename "${SHELL:-unknown}" 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_USER=$(git config user.name 2>/dev/null || echo "unknown")
GIT_EMAIL=$(git config user.email 2>/dev/null || echo "unknown")
CWD=$(pwd)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

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

# ── Agentstreams: Emit session start event ────────────────────
NODE_VER_FULL=$(node -v 2>/dev/null || echo "unknown")
CLAUDE_VER="${CLAUDE_CODE_VERSION:-unknown}"
BUFFER_FILE="$BUFFER_DIR/buffer.jsonl"
MANIFEST_FILE="$BUFFER_DIR/${GIT_BRANCH//\//_}.json"

# Build session start stream event
if command -v jq >/dev/null 2>&1; then
  SESSION_EVENT=$(jq -n \
    --arg event_type "session" \
    --arg session_id "$SESSION_ID" \
    --argjson sequence_number 0 \
    --arg git_branch "$GIT_BRANCH" \
    --arg git_sha "$GIT_SHA" \
    --arg agent_id "orchestrator" \
    --arg user_id "$GIT_USER" \
    --arg surface "$SURFACE" \
    --arg created_at "$TIMESTAMP" \
    --arg phase "start" \
    --arg os_name "$OS_NAME" \
    --arg os_version "$OS_VERSION" \
    --arg arch "$ARCH" \
    --arg hostname "$HOSTNAME_SHORT" \
    --arg shell_name "$SHELL_NAME" \
    --arg node_version "$NODE_VER_FULL" \
    --arg claude_code_version "$CLAUDE_VER" \
    --arg model "${CLAUDE_MODEL:-opus}" \
    --arg cwd "$CWD" \
    --arg git_email "$GIT_EMAIL" \
    '{
      event_type: $event_type,
      session_id: $session_id,
      sequence_number: $sequence_number,
      git_branch: $git_branch,
      git_sha: $git_sha,
      agent_id: $agent_id,
      user_id: $user_id,
      surface: $surface,
      token_count: 150,
      created_at: $created_at,
      payload: {
        phase: $phase,
        surface: $surface,
        os: $os_name,
        os_version: $os_version,
        arch: $arch,
        hostname: $hostname,
        shell: $shell_name,
        node_version: $node_version,
        claude_code_version: $claude_code_version,
        model: $model,
        branch: $git_branch,
        cwd: $cwd,
        git_user: $user_id,
        git_email: $git_email
      }
    }')

  echo "$SESSION_EVENT" >> "$BUFFER_FILE"

  # Initialize or update branch manifest
  if [ -f "$MANIFEST_FILE" ]; then
    jq \
      --arg session_id "$SESSION_ID" \
      --arg ts "$TIMESTAMP" \
      '.session_id = $session_id | .event_counts.session = ((.event_counts.session // 0) + 1) | .last_flushed_at = $ts' \
      "$MANIFEST_FILE" > "$MANIFEST_FILE.tmp" && mv "$MANIFEST_FILE.tmp" "$MANIFEST_FILE"
  else
    jq -n \
      --arg branch "$GIT_BRANCH" \
      --arg session_id "$SESSION_ID" \
      --arg ts "$TIMESTAMP" \
      '{
        branch: $branch,
        session_id: $session_id,
        last_event_id: 0,
        event_counts: { prompt: 0, commit: 0, session: 1 },
        last_flushed_at: $ts,
        neon_synced: false
      }' > "$MANIFEST_FILE"
  fi

  echo "  agentstreams: session event captured ($SESSION_ID)"
else
  echo "  WARNING: jq not found, agentstreams session capture skipped"
fi

# Never block session start
exit 0
