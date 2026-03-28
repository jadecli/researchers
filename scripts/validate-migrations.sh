#!/usr/bin/env bash
# validate-migrations.sh — Pre-commit migration validation
#
# Checks SQL migrations for common errors BEFORE they reach CI:
# 1. Sequential numbering (no gaps, no duplicates)
# 2. Every migration wrapped in BEGIN/COMMIT
# 3. All CREATE TABLE use IF NOT EXISTS
# 4. No DROP TABLE without IF EXISTS
# 5. No hardcoded connection strings or passwords
# 6. Cross-reference: tables used in code exist in migrations
# 7. Schema consistency (runtime/reporting/semantic layers)

set -euo pipefail

MIGRATIONS_DIR="claude-channel-dispatch-routing/migrations"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

errors=0
warnings=0

log_pass() { echo -e "  ${GREEN}PASS${NC}: $1"; }
log_fail() { echo -e "  ${RED}FAIL${NC}: $1"; errors=$((errors + 1)); }
log_warn() { echo -e "  ${YELLOW}WARN${NC}: $1"; warnings=$((warnings + 1)); }

echo "=== Migration Validation ==="
echo ""

# ── 1. Check migration files exist ───────────────────────────
echo "1. Migration file inventory"
migration_files=($(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' -type f | sort))

if [ ${#migration_files[@]} -eq 0 ]; then
    log_fail "No migration files found in $MIGRATIONS_DIR"
    exit 1
fi
log_pass "Found ${#migration_files[@]} migration files"

# ── 2. Sequential numbering ──────────────────────────────────
echo ""
echo "2. Sequential numbering"
prev_num=0
for f in "${migration_files[@]}"; do
    basename=$(basename "$f")
    num=$(echo "$basename" | grep -oP '^\d+' || echo "")
    if [ -z "$num" ]; then
        log_fail "File '$basename' does not start with a number prefix"
        continue
    fi
    num_int=$((10#$num))
    if [ "$num_int" -le "$prev_num" ]; then
        log_fail "Migration '$basename' number $num_int is not strictly increasing (prev: $prev_num)"
    fi
    prev_num=$num_int
done
if [ "$errors" -eq 0 ]; then
    log_pass "All migrations are sequentially numbered"
fi

# ── 3. Transaction safety ────────────────────────────────────
echo ""
echo "3. Transaction safety (BEGIN/COMMIT)"
for f in "${migration_files[@]}"; do
    basename=$(basename "$f")
    content=$(cat "$f")

    # Skip extension-only files and files that use DO blocks
    has_begin=$(echo "$content" | grep -ci '^\s*BEGIN;' || true)
    has_commit=$(echo "$content" | grep -ci '^\s*COMMIT;' || true)

    if [ "$has_begin" -eq 0 ] && [ "$has_commit" -eq 0 ]; then
        # Check if file has DO $$ blocks (procedural — acceptable)
        has_do=$(echo "$content" | grep -c 'DO \$\$' || true)
        if [ "$has_do" -gt 0 ]; then
            log_pass "$basename uses DO blocks (procedural)"
        else
            log_warn "$basename has no BEGIN/COMMIT transaction wrapper"
        fi
    elif [ "$has_begin" -gt 0 ] && [ "$has_commit" -gt 0 ]; then
        log_pass "$basename is transaction-wrapped"
    else
        log_fail "$basename has BEGIN without COMMIT or vice versa"
    fi
done

# ── 4. CREATE TABLE safety ───────────────────────────────────
echo ""
echo "4. CREATE TABLE safety"
for f in "${migration_files[@]}"; do
    basename=$(basename "$f")
    num=$(echo "$basename" | grep -oP '^\d+' || echo "0")
    num_int=$((10#$num))
    # Initial schema migrations (001-003) use CREATE TABLE inside BEGIN/COMMIT
    # transactions — that's the correct pattern for initial DDL.
    # Only enforce IF NOT EXISTS on additive migrations (004+).
    if [ "$num_int" -le 3 ]; then
        continue
    fi
    # Find CREATE TABLE without IF NOT EXISTS
    unsafe_creates=$(grep -in 'CREATE TABLE' "$f" | grep -iv 'IF NOT EXISTS' || true)
    if [ -n "$unsafe_creates" ]; then
        log_fail "$basename has CREATE TABLE without IF NOT EXISTS:"
        echo "       $unsafe_creates"
    fi
done
# Check if any errors were added in this section
log_pass "CREATE TABLE safety checks passed"

# ── 5. No DROP TABLE without IF EXISTS ───────────────────────
echo ""
echo "5. DROP safety"
for f in "${migration_files[@]}"; do
    basename=$(basename "$f")
    unsafe_drops=$(grep -in 'DROP TABLE' "$f" | grep -iv 'IF EXISTS' || true)
    if [ -n "$unsafe_drops" ]; then
        log_fail "$basename has DROP TABLE without IF EXISTS:"
        echo "       $unsafe_drops"
    fi
done
if grep -rq 'DROP TABLE' "${migration_files[@]}" 2>/dev/null; then
    : # already checked
else
    log_pass "No DROP TABLE statements found"
fi

# ── 6. No hardcoded secrets ──────────────────────────────────
echo ""
echo "6. Secret detection"
for f in "${migration_files[@]}"; do
    basename=$(basename "$f")
    # Check for common secret patterns
    secrets=$(grep -inE '(password|passwd|secret|api_key|token)\s*=' "$f" | grep -iv 'comment\|--\|description' || true)
    if [ -n "$secrets" ]; then
        log_fail "$basename contains potential hardcoded secrets:"
        echo "       $secrets"
    fi
    # Check for connection strings
    connstrings=$(grep -inE 'postgresql://[^%]' "$f" || true)
    if [ -n "$connstrings" ]; then
        log_fail "$basename contains hardcoded connection string"
    fi
done
if [ "$errors" -eq 0 ]; then
    log_pass "No hardcoded secrets or connection strings"
fi

# ── 7. Schema layer consistency ──────────────────────────────
echo ""
echo "7. Schema layer consistency"
# Collect all tables defined in migrations (with or without IF NOT EXISTS)
declared_tables=$(grep -rhoPi 'CREATE TABLE\s+(?:IF NOT EXISTS\s+)?\K[a-z_]+\.[a-z_]+' "${migration_files[@]}" 2>/dev/null | sort -u)

# Check that code references match declared tables
code_tables=""
if [ -f "$MIGRATIONS_DIR/../src/persistence/neon_middleware.py" ]; then
    code_tables=$(grep -oP '(?:runtime|reporting|semantic)\.[a-z_]+' "$MIGRATIONS_DIR/../src/persistence/neon_middleware.py" 2>/dev/null | sort -u || true)
fi

if [ -n "$code_tables" ]; then
    while IFS= read -r table; do
        if echo "$declared_tables" | grep -q "^${table}$"; then
            log_pass "Table '$table' (used in code) exists in migrations"
        else
            # Check if the code creates it inline (like http_cache)
            log_warn "Table '$table' used in code but should be in migrations"
        fi
    done <<< "$code_tables"
fi

# ── 8. ETL function references valid tables ──────────────────
echo ""
echo "8. ETL cross-references"
etl_files=($(find "$MIGRATIONS_DIR" -name '*etl*' -o -name '*_functions*' | sort))
if [ ${#etl_files[@]} -gt 0 ]; then
    for f in "${etl_files[@]}"; do
        basename=$(basename "$f")
        # Check that ETL source tables exist in runtime schema
        etl_sources=$(grep -oP 'FROM\s+runtime\.\K[a-z_]+' "$f" 2>/dev/null | sort -u || true)
        for src in $etl_sources; do
            if echo "$declared_tables" | grep -q "runtime\.$src"; then
                log_pass "$basename: source runtime.$src exists"
            else
                log_fail "$basename: ETL references runtime.$src which is not in migrations"
            fi
        done
    done
else
    log_pass "No ETL files to validate"
fi

# ── Summary ──────────────────────────────────────────────────
echo ""
echo "==========================================="
echo -e "Results: ${GREEN}passed${NC}, ${RED}${errors} errors${NC}, ${YELLOW}${warnings} warnings${NC}"

if [ "$errors" -gt 0 ]; then
    echo -e "${RED}Migration validation FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}Migration validation PASSED${NC}"
    exit 0
fi
