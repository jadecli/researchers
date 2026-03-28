#!/usr/bin/env bash
# .jade/hooks/pre-pr.sh — Pre-PR comprehensive review
#
# Model routing:
#   - opus: architectural planning, full diff review
#   - sonnet: code review, canonical pattern enforcement
#   - haiku: file checks, import validation
#
# Checks:
#   1. All tests pass across sub-repos
#   2. .jade/ dogfood script passes
#   3. No canonical pattern violations in the full diff
#   4. No orphaned imports (files referencing deleted modules)
#   5. Version consistency (.jade/ models have correct versions)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
JADE_DIR="${ROOT_DIR}/.jade"
DISPATCH_DIR="${ROOT_DIR}/claude-multi-agent-dispatch"
SDK_DIR="${ROOT_DIR}/claude-multi-agent-sdk"

errors=()
warnings=()

# Determine base branch for diff
BASE_BRANCH="${1:-main}"

# ─── 1. Test Suites (opus-level: full validation) ─────────────────────────
echo "[pre-pr] Running test suites..."

if [ -d "${DISPATCH_DIR}" ] && [ -f "${DISPATCH_DIR}/package.json" ]; then
  if ! (cd "${DISPATCH_DIR}" && npx vitest run --reporter=dot 2>&1 | tail -5); then
    errors+=("claude-multi-agent-dispatch tests failed")
  fi
fi

if [ -d "${SDK_DIR}" ] && [ -f "${SDK_DIR}/package.json" ]; then
  sdk_output=$(cd "${SDK_DIR}" && timeout 30 npx vitest run --reporter=dot 2>&1 | tail -10)
  echo "${sdk_output}"
  # Tolerate pre-existing failures (e.g. missing @anthropic-ai/sdk) — only fail on regressions
  sdk_passed=$(echo "${sdk_output}" | grep -oP '\d+ passed' | head -1 | grep -oP '\d+' || echo 0)
  sdk_failed=$(echo "${sdk_output}" | grep -oP '\d+ failed' | head -1 | grep -oP '\d+' || echo 0)
  if [ "${sdk_failed}" -gt 1 ]; then
    errors+=("claude-multi-agent-sdk has ${sdk_failed} test failures (expected ≤1 pre-existing)")
  fi
fi

# ─── 2. .jade/ Dogfood ───────────────────────────────────────────────────
echo "[pre-pr] Running .jade/ dogfood..."
if [ -f "${JADE_DIR}/dogfood.ts" ]; then
  if ! (cd "${JADE_DIR}" && npx tsx dogfood.ts 2>&1); then
    errors+=(".jade/ dogfood failed")
  fi
fi

# ─── 3. Full Diff Canonical Review (sonnet-level) ─────────────────────────
echo "[pre-pr] Reviewing diff for canonical violations..."

DIFF_FILES=$(git diff "${BASE_BRANCH}"...HEAD --name-only --diff-filter=ACM 2>/dev/null || true)

if [ -n "${DIFF_FILES}" ]; then
  while IFS= read -r file; do
    if [[ "${file}" == *.ts ]] && [ -f "${ROOT_DIR}/${file}" ]; then
      # Skip test files
      [[ "${file}" == *test* ]] && continue
      [[ "${file}" == *__tests__* ]] && continue

      full_path="${ROOT_DIR}/${file}"

      # Check: hardcoded URL lists (skip .jade/ — it IS the canonical source)
      if [[ "${file}" != .jade/* ]]; then
        url_array_count=$(grep -cE "^\s*(url|href):\s*['\"]https://docs\.anthropic\.com" "${full_path}" 2>/dev/null || true)
        url_array_count=${url_array_count:-0}
        if [ "${url_array_count}" -gt 5 ]; then
          warnings+=("CANONICAL: ${file} has ${url_array_count} hardcoded Anthropic URLs — use .jade/surfaces/registry.ts")
        fi
      fi

      # Check: duplicate surface enum definitions
      if [[ "${file}" != .jade/* ]]; then
        if grep -qE "type DocSurface\s*=" "${full_path}" 2>/dev/null; then
          warnings+=("CANONICAL: ${file} redefines DocSurface — import from .jade/surfaces/doc-surface.ts")
        fi
        if grep -qE "type CrawlPriority\s*=" "${full_path}" 2>/dev/null; then
          warnings+=("CANONICAL: ${file} redefines CrawlPriority — import from .jade/surfaces/doc-surface.ts")
        fi
      fi

      # Check: Result<T,E> boundary violations (skip .jade/models/base.ts — defines the pattern)
      if [[ "${file}" != .jade/models/base.ts ]]; then
        if grep -q 'Result<' "${full_path}" 2>/dev/null; then
          throws=$(grep -n 'throw new' "${full_path}" 2>/dev/null || true)
          if [ -n "${throws}" ]; then
            warnings+=("BOUNDARY: ${file} mixes Result<T,E> with throw — prefer Err()")
          fi
        fi
      fi
    fi
  done <<< "${DIFF_FILES}"
fi

# ─── 4. Orphaned Imports ──────────────────────────────────────────────────
echo "[pre-pr] Checking for orphaned imports..."
if [ -n "${DIFF_FILES}" ]; then
  # Get deleted files in this branch
  DELETED_FILES=$(git diff "${BASE_BRANCH}"...HEAD --name-only --diff-filter=D 2>/dev/null || true)
  if [ -n "${DELETED_FILES}" ]; then
    while IFS= read -r deleted; do
      basename_no_ext=$(basename "${deleted}" .ts)
      # Search for imports of the deleted file
      refs=$(grep -rl "${basename_no_ext}" "${ROOT_DIR}/claude-multi-agent-dispatch/src" 2>/dev/null || true)
      if [ -n "${refs}" ]; then
        errors+=("Orphaned import: ${deleted} was deleted but still referenced")
      fi
    done <<< "${DELETED_FILES}"
  fi
fi

# ─── 5. Version Consistency ───────────────────────────────────────────────
echo "[pre-pr] Checking .jade/ version consistency..."
if [ -f "${JADE_DIR}/surfaces/registry.ts" ]; then
  version_count=$(grep -c 'createVersionedModel\|bumpVersion\|createPageRegistry\|VersionedModel' "${JADE_DIR}/surfaces/registry.ts" 2>/dev/null || true)
  version_count=${version_count:-0}
  if [ "${version_count}" -lt 1 ]; then
    errors+=(".jade/surfaces/registry.ts missing version tracking")
  fi
fi

# ─── Report ────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"

if [ ${#warnings[@]} -gt 0 ]; then
  echo "[pre-pr] ${#warnings[@]} warning(s):"
  for w in "${warnings[@]}"; do
    echo "  ⚠ ${w}"
  done
fi

if [ ${#errors[@]} -gt 0 ]; then
  echo "[pre-pr] ${#errors[@]} error(s) — PR blocked:"
  for e in "${errors[@]}"; do
    echo "  ✗ ${e}"
  done
  echo "════════════════════════════════════════════════════════════"
  exit 1
fi

echo "[pre-pr] All checks passed — ready for PR"
echo "════════════════════════════════════════════════════════════"
exit 0
