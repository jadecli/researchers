#!/usr/bin/env bash
set -euo pipefail

# run-crawl.sh — Entry point for CI-driven spider crawls.
# Usage: bash scripts/run-crawl.sh <target_url> [spider_name]

TARGET_URL="${1:?Usage: run-crawl.sh <target_url> [spider_name]}"
SPIDER="${2:-default}"
OUTPUT_DIR="${OUTPUT_DIR:-output/${SPIDER}}"
MAX_PAGES="${MAX_PAGES:-100}"
TIMEOUT="${TIMEOUT:-300}"
VERBOSE="${VERBOSE:-0}"

log() { echo "[$(date -u '+%Y-%m-%d %H:%M:%S')] $*"; }

log "Starting crawl: target=${TARGET_URL} spider=${SPIDER}"
log "Output dir: ${OUTPUT_DIR}"
log "Max pages: ${MAX_PAGES}, Timeout: ${TIMEOUT}s"

mkdir -p "${OUTPUT_DIR}"

# Record crawl metadata
cat > "${OUTPUT_DIR}/crawl-meta.json" <<EOF
{
  "target": "${TARGET_URL}",
  "spider": "${SPIDER}",
  "max_pages": ${MAX_PAGES},
  "timeout": ${TIMEOUT},
  "started_at": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "hostname": "$(hostname)",
  "python_version": "$(python3 --version 2>&1 | head -1)"
}
EOF

# Check Python dependencies
if ! python3 -c "import requests, yaml, jinja2" 2>/dev/null; then
    log "ERROR: Missing Python dependencies. Run: pip install -e ."
    exit 1
fi

# Select spider implementation
case "${SPIDER}" in
    default)
        SPIDER_MODULE="spiders.default_spider"
        SPIDER_CLASS="DefaultSpider"
        ;;
    deep)
        SPIDER_MODULE="spiders.deep_spider"
        SPIDER_CLASS="DeepSpider"
        ;;
    breadth)
        SPIDER_MODULE="spiders.breadth_spider"
        SPIDER_CLASS="BreadthSpider"
        ;;
    api)
        SPIDER_MODULE="spiders.api_spider"
        SPIDER_CLASS="ApiSpider"
        ;;
    *)
        log "ERROR: Unknown spider '${SPIDER}'. Available: default, deep, breadth, api"
        exit 1
        ;;
esac

log "Using spider: ${SPIDER_MODULE}.${SPIDER_CLASS}"

# Run the crawl via Python
CRAWL_EXIT=0
timeout "${TIMEOUT}" python3 -c "
import json
import sys
import time
from pathlib import Path

try:
    from ${SPIDER_MODULE} import ${SPIDER_CLASS}
    spider = ${SPIDER_CLASS}(
        target_url='${TARGET_URL}',
        max_pages=${MAX_PAGES},
        output_dir='${OUTPUT_DIR}',
    )
    result = spider.crawl()
    # Write results summary
    summary = {
        'pages_crawled': result.get('pages_crawled', 0),
        'pages_failed': result.get('pages_failed', 0),
        'elapsed_seconds': result.get('elapsed_seconds', 0),
        'errors': result.get('errors', []),
    }
    Path('${OUTPUT_DIR}/crawl-summary.json').write_text(json.dumps(summary, indent=2))
    print(f'Crawled {summary[\"pages_crawled\"]} pages in {summary[\"elapsed_seconds\"]:.1f}s')
    if summary['pages_failed'] > 0:
        print(f'Warning: {summary[\"pages_failed\"]} pages failed')
    sys.exit(0)
except ImportError:
    # Fallback: use requests-based simple crawl
    import requests
    from urllib.parse import urljoin, urlparse

    seen = set()
    queue = ['${TARGET_URL}']
    results = []
    start = time.time()

    while queue and len(results) < ${MAX_PAGES}:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)

        try:
            resp = requests.get(url, timeout=15, headers={'User-Agent': 'ClaudeCodeActions/1.0'})
            resp.raise_for_status()
            content = resp.text
            results.append({
                'url': url,
                'status': resp.status_code,
                'length': len(content),
                'content_type': resp.headers.get('content-type', ''),
            })

            # Extract links for further crawling
            parsed_base = urlparse('${TARGET_URL}')
            for line in content.split('href=\"'):
                if len(line) > 1:
                    href = line.split('\"')[0]
                    full = urljoin(url, href)
                    full_parsed = urlparse(full)
                    if full_parsed.netloc == parsed_base.netloc and full not in seen:
                        queue.append(full)
        except Exception as e:
            results.append({'url': url, 'error': str(e)})

    elapsed = time.time() - start
    summary = {
        'pages_crawled': len([r for r in results if 'error' not in r]),
        'pages_failed': len([r for r in results if 'error' in r]),
        'elapsed_seconds': round(elapsed, 2),
        'errors': [r['error'] for r in results if 'error' in r][:20],
    }
    Path('${OUTPUT_DIR}/crawl-summary.json').write_text(json.dumps(summary, indent=2))
    Path('${OUTPUT_DIR}/crawl-results.json').write_text(json.dumps(results, indent=2))
    print(f'Crawled {summary[\"pages_crawled\"]} pages in {summary[\"elapsed_seconds\"]:.1f}s (fallback mode)')
    sys.exit(0)
except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    sys.exit(1)
" || CRAWL_EXIT=$?

if [ "${CRAWL_EXIT}" -ne 0 ]; then
    log "ERROR: Crawl exited with code ${CRAWL_EXIT}"
    echo '{"status": "failed", "exit_code": '"${CRAWL_EXIT}"'}' > "${OUTPUT_DIR}/crawl-status.json"
    exit "${CRAWL_EXIT}"
fi

# Verify output
if [ -f "${OUTPUT_DIR}/crawl-summary.json" ]; then
    PAGES=$(python3 -c "import json; print(json.load(open('${OUTPUT_DIR}/crawl-summary.json'))['pages_crawled'])")
    log "Crawl complete: ${PAGES} pages written to ${OUTPUT_DIR}"
else
    log "WARNING: No crawl summary found"
fi

log "Done"
