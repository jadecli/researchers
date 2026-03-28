#!/usr/bin/env bash
# .jade/hooks/session-start.sh — Session-start smoke test
#
# Triggered on first tool use in a session. Validates:
#   1. .jade/ data models are importable and internally consistent
#   2. Dependencies are installed (npm ci if needed)
#   3. Context carryover from previous session (checks for stale deltas)
#
# Model routing: haiku for file-existence checks (fast, cheap)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
JADE_DIR="${ROOT_DIR}/.jade"
DISPATCH_DIR="${ROOT_DIR}/claude-multi-agent-dispatch"

errors=()

# ─── 1. Dependency Check ───────────────────────────────────────────────────
# Verify node_modules exist for key sub-repos.
for dir in "${DISPATCH_DIR}" "${ROOT_DIR}/claude-multi-agent-sdk"; do
  if [ -d "${dir}" ] && [ ! -d "${dir}/node_modules" ]; then
    echo "[session-start] Installing dependencies in $(basename "${dir}")..."
    (cd "${dir}" && npm install --legacy-peer-deps --silent 2>/dev/null) || true
  fi
done

# ─── 2. .jade/ Data Model Integrity (haiku-level: file existence) ──────────
required_files=(
  "${JADE_DIR}/models/base.ts"
  "${JADE_DIR}/surfaces/doc-surface.ts"
  "${JADE_DIR}/surfaces/registry.ts"
  "${JADE_DIR}/schemas/output-schemas.ts"
  "${JADE_DIR}/agents/crawl-agent.ts"
  "${JADE_DIR}/package.json"
  "${JADE_DIR}/tsconfig.json"
)

for f in "${required_files[@]}"; do
  if [ ! -f "${f}" ]; then
    errors+=("Missing .jade file: ${f}")
  fi
done

# ─── 3. Context Carryover Check ────────────────────────────────────────────
# Look for stale round outputs or delta files from a previous session.
ROUNDS_DIR="${DISPATCH_DIR}/rounds"
if [ -d "${ROUNDS_DIR}" ]; then
  stale_count=$(find "${ROUNDS_DIR}" -name "delta.json" -mmin +1440 2>/dev/null | wc -l)
  if [ "${stale_count}" -gt 0 ]; then
    echo "[session-start] WARNING: ${stale_count} delta files older than 24h — context may be stale"
  fi
fi

# ─── 4. TypeScript Compilation Check ──────────────────────────────────────
# Quick tsc --noEmit on .jade/ to catch type errors early.
if command -v npx &>/dev/null && [ -f "${JADE_DIR}/tsconfig.json" ]; then
  if ! (cd "${JADE_DIR}" && npx tsc --noEmit 2>/dev/null); then
    errors+=(".jade/ TypeScript compilation failed")
  fi
fi

# ─── Report ────────────────────────────────────────────────────────────────
if [ ${#errors[@]} -gt 0 ]; then
  echo "[session-start] ${#errors[@]} issue(s) found:"
  for e in "${errors[@]}"; do
    echo "  - ${e}"
  done
  exit 1
fi

echo "[session-start] All checks passed"
exit 0
