#!/usr/bin/env bash
# .claude/hooks/git-pre-commit.sh — Git pre-commit hook
# Installed to .git/hooks/pre-commit by session-setup.sh
# Validates code quality before allowing git commit.
#
# Checks:
# 1. TypeScript compilation for agenttasks changes
# 2. Return types on exported TypeScript functions
# 3. Return type annotations on Python public functions
# 4. No secrets in staged files
# 5. No cross-boundary imports
# 6. Style: no bare console.log in production code

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
ERRORS=()
WARNINGS=()

STAGED_TS=$(git diff --cached --name-only --diff-filter=ACM -- '*.ts' '*.tsx' 2>/dev/null || true)
STAGED_PY=$(git diff --cached --name-only --diff-filter=ACM -- '*.py' 2>/dev/null || true)
STAGED_ALL=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)

# ── 1. TypeScript compilation (agenttasks only) ──────────────
AGENTTASKS_STAGED=$(git diff --cached --name-only -- agenttasks/ 2>/dev/null | head -1)
if [ -n "$AGENTTASKS_STAGED" ]; then
  if [ -d "$ROOT/agenttasks/node_modules" ] && command -v npx >/dev/null 2>&1; then
    echo "Pre-commit: checking agenttasks TypeScript..."
    if ! (cd "$ROOT/agenttasks" && npx tsc --noEmit 2>&1 | tail -5); then
      ERRORS+=("agenttasks TypeScript compilation failed")
    fi
  fi
fi

# ── 2. Return types on exported TS functions ─────────────────
for file in $STAGED_TS; do
  [ -f "$ROOT/$file" ] || continue
  MISSING=$(grep -cE '^\s*export\s+(async\s+)?function\s+\w+\s*\([^)]*\)\s*\{' "$ROOT/$file" 2>/dev/null || echo 0)
  TYPED=$(grep -cE '^\s*export\s+(async\s+)?function\s+\w+\s*\([^)]*\)\s*:\s*' "$ROOT/$file" 2>/dev/null || echo 0)
  DIFF=$((MISSING - TYPED))
  if [ "$DIFF" -gt 0 ]; then
    WARNINGS+=("$file: $DIFF exported function(s) missing return type annotation")
  fi
done

# ── 3. Return types on Python public functions ───────────────
for file in $STAGED_PY; do
  [ -f "$ROOT/$file" ] || continue
  TOTAL_FN=$(grep -cE '^\s*def\s+[a-zA-Z][a-zA-Z0-9_]*\s*\(' "$ROOT/$file" 2>/dev/null || echo 0)
  TYPED_FN=$(grep -cE '^\s*def\s+[a-zA-Z][a-zA-Z0-9_]*\s*\([^)]*\)\s*->' "$ROOT/$file" 2>/dev/null || echo 0)
  MISSING_PY=$((TOTAL_FN - TYPED_FN))
  if [ "$MISSING_PY" -gt 0 ] 2>/dev/null; then
    WARNINGS+=("$file: $MISSING_PY public function(s) missing -> return type")
  fi
done

# ── 4. Secrets in staged files ───────────────────────────────
for file in $STAGED_ALL; do
  # Check filename
  if echo "$file" | grep -qiE '\.env$|credentials|secret|\.key$'; then
    ERRORS+=("Potentially sensitive file staged: $file")
    continue
  fi
  [ -f "$ROOT/$file" ] || continue
  echo "$file" | grep -qE '\.(lock|png|jpg|woff2|ico)$' && continue

  # Check content for AWS keys and private keys
  if grep -qE 'AKIA[0-9A-Z]{16}' "$ROOT/$file" 2>/dev/null; then
    ERRORS+=("$file: AWS access key detected")
  fi
  if grep -qE '-----BEGIN (RSA |EC )?PRIVATE KEY' "$ROOT/$file" 2>/dev/null; then
    ERRORS+=("$file: private key detected")
  fi
done

# ── 5. Cross-boundary imports ────────────────────────────────
for file in $STAGED_TS; do
  [ -f "$ROOT/$file" ] || continue
  if grep -qE "from\s+['\"]\.\./(claude-|agenttasks)" "$ROOT/$file" 2>/dev/null; then
    ERRORS+=("$file: cross-boundary TypeScript import — sub-repos must not import siblings")
  fi
done

# ── 6. Style: no console.log in production TS ────────────────
for file in $STAGED_TS; do
  [ -f "$ROOT/$file" ] || continue
  echo "$file" | grep -qE '(test|spec|__tests__)' && continue
  if grep -qE '\bconsole\.(log|debug)\b' "$ROOT/$file" 2>/dev/null; then
    WARNINGS+=("$file: console.log/debug in production code — use structured logger")
  fi
done

# ── Report ────────────────────────────────────────────────────
if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo "Pre-commit warnings:"
  for warn in "${WARNINGS[@]}"; do
    echo "  WARN: $warn"
  done
fi

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo ""
  echo "PRE-COMMIT BLOCKED"
  for err in "${ERRORS[@]}"; do
    echo "  ERROR: $err"
  done
  echo ""
  echo "Fix errors above or use --no-verify to skip (not recommended)."
  exit 1
fi

exit 0
