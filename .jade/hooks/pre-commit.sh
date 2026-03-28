#!/usr/bin/env bash
# .jade/hooks/pre-commit.sh — Pre-commit validation
#
# Model routing:
#   - haiku: file existence, import resolution, basic lint (fast, cheap)
#   - sonnet: code review for canonical pattern violations (medium cost)
#
# Checks:
#   1. No hardcoded URL lists that duplicate .jade/surfaces/registry.ts
#   2. No thrown exceptions in Result<T,E> boundaries
#   3. Staged .jade/ files pass tsc --noEmit
#   4. No duplicate type definitions across repos

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
JADE_DIR="${ROOT_DIR}/.jade"
DISPATCH_DIR="${ROOT_DIR}/claude-multi-agent-dispatch"

errors=()
warnings=()

# Get staged files (if in a git context)
STAGED_FILES=""
if git rev-parse --git-dir &>/dev/null 2>&1; then
  STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)
fi

# ─── 1. Haiku-level: File existence for .jade imports ──────────────────────
# Scan staged TS files for imports from .jade/ and verify targets exist.
if [ -n "${STAGED_FILES}" ]; then
  while IFS= read -r file; do
    if [[ "${file}" == *.ts ]] && [ -f "${ROOT_DIR}/${file}" ]; then
      # Extract .jade/ import paths
      jade_imports=$(grep -oE "from ['\"].*\.jade/[^'\"]+['\"]" "${ROOT_DIR}/${file}" 2>/dev/null || true)
      if [ -n "${jade_imports}" ]; then
        while IFS= read -r imp; do
          # Extract the path portion
          imp_path=$(echo "${imp}" | sed "s/from ['\"]//;s/['\"]//;s/\.js$/\.ts/")
          # Resolve relative to the file's directory
          file_dir=$(dirname "${ROOT_DIR}/${file}")
          resolved=$(cd "${file_dir}" && realpath -m "${imp_path}" 2>/dev/null || echo "")
          if [ -n "${resolved}" ] && [ ! -f "${resolved}" ]; then
            errors+=("Broken .jade import in ${file}: ${imp}")
          fi
        done <<< "${jade_imports}"
      fi
    fi
  done <<< "${STAGED_FILES}"
fi

# ─── 2. Sonnet-level: Canonical pattern violations ─────────────────────────
# Check for hardcoded URL arrays that should use ANTHROPIC_DOC_TARGETS.
CANONICAL_VIOLATIONS=0
if [ -n "${STAGED_FILES}" ]; then
  while IFS= read -r file; do
    if [[ "${file}" == *.ts ]] && [ -f "${ROOT_DIR}/${file}" ]; then
      # Skip test files and the registry itself
      if [[ "${file}" == *test* ]] || [[ "${file}" == *registry* ]]; then
        continue
      fi
      # Check for hardcoded docs.anthropic.com URL arrays
      url_count=$(grep -c 'docs\.anthropic\.com' "${ROOT_DIR}/${file}" 2>/dev/null || echo 0)
      if [ "${url_count}" -gt 3 ]; then
        warnings+=("${file} has ${url_count} hardcoded docs.anthropic.com URLs — should import from .jade/surfaces/registry.ts")
        CANONICAL_VIOLATIONS=$((CANONICAL_VIOLATIONS + 1))
      fi
      # Check for thrown exceptions in files that use Result<T,E>
      if grep -q 'Result<' "${ROOT_DIR}/${file}" 2>/dev/null; then
        throw_count=$(grep -c 'throw new' "${ROOT_DIR}/${file}" 2>/dev/null || echo 0)
        if [ "${throw_count}" -gt 0 ]; then
          warnings+=("${file} uses Result<T,E> but has ${throw_count} 'throw new' statements — prefer Err()")
        fi
      fi
    fi
  done <<< "${STAGED_FILES}"
fi

# ─── 3. TypeScript check on staged .jade/ files ───────────────────────────
jade_staged=false
if [ -n "${STAGED_FILES}" ]; then
  if echo "${STAGED_FILES}" | grep -q '\.jade/'; then
    jade_staged=true
  fi
fi

if [ "${jade_staged}" = true ] && [ -f "${JADE_DIR}/tsconfig.json" ]; then
  if ! (cd "${JADE_DIR}" && npx tsc --noEmit 2>/dev/null); then
    errors+=("Staged .jade/ files have TypeScript errors")
  fi
fi

# ─── 4. Duplicate type check ──────────────────────────────────────────────
# Ensure CrawlTarget is not redefined outside crawl-orchestrator.ts
if [ -n "${STAGED_FILES}" ]; then
  while IFS= read -r file; do
    if [[ "${file}" == *.ts ]] && [ -f "${ROOT_DIR}/${file}" ]; then
      if [[ "${file}" != *crawl-orchestrator* ]] && [[ "${file}" != *test* ]]; then
        if grep -q 'interface CrawlTarget' "${ROOT_DIR}/${file}" 2>/dev/null; then
          warnings+=("${file} redefines CrawlTarget — should import from crawl-orchestrator.ts")
        fi
      fi
    fi
  done <<< "${STAGED_FILES}"
fi

# ─── Report ────────────────────────────────────────────────────────────────
if [ ${#warnings[@]} -gt 0 ]; then
  echo "[pre-commit] ${#warnings[@]} warning(s):"
  for w in "${warnings[@]}"; do
    echo "  ⚠ ${w}"
  done
fi

if [ ${#errors[@]} -gt 0 ]; then
  echo "[pre-commit] ${#errors[@]} error(s) — commit blocked:"
  for e in "${errors[@]}"; do
    echo "  ✗ ${e}"
  done
  exit 1
fi

echo "[pre-commit] All checks passed"
exit 0
