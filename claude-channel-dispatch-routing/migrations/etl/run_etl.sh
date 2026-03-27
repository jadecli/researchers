#!/bin/bash
# ETL Runner — executes all scripts in order with quality checks
# Usage: ./run_etl.sh
# Requires: DATABASE_URL environment variable

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set"
  exit 1
fi

echo "=== ETL Pipeline Start: $(date -Iseconds) ==="
echo ""

FAILED=0
for script in "$SCRIPT_DIR"/0*.sql; do
  name=$(basename "$script")
  echo "── Running: $name ──"

  if psql "$DATABASE_URL" -f "$script" -v ON_ERROR_STOP=1 2>&1 | grep -E "NOTICE|ERROR|FAIL"; then
    echo "  ✓ $name"
  else
    echo "  ✗ $name FAILED"
    FAILED=1
    break
  fi
  echo ""
done

if [ "$FAILED" -eq 0 ]; then
  echo "=== ETL Pipeline Complete: $(date -Iseconds) ==="
  echo ""
  echo "=== Row Counts ==="
  psql "$DATABASE_URL" -c "
    SELECT 'staging.crawl_events_clean' as tbl, count(*) FROM staging.crawl_events_clean
    UNION ALL SELECT 'reporting.dim_page', count(*) FROM reporting.dim_page
    UNION ALL SELECT 'reporting.dim_round', count(*) FROM reporting.dim_round
    UNION ALL SELECT 'reporting.dim_agent', count(*) FROM reporting.dim_agent
    UNION ALL SELECT 'reporting.dim_date', count(*) FROM reporting.dim_date
    UNION ALL SELECT 'reporting.fact_crawl_quality', count(*) FROM reporting.fact_crawl_quality
    ORDER BY tbl;
  "
else
  echo "=== ETL Pipeline FAILED ==="
  exit 1
fi
