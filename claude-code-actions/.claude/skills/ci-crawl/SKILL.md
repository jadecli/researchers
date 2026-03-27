# Skill: CI Crawl

Run an iterative spider crawl from CI/CD pipelines (GitHub Actions or GitLab CI).

## When to Use

- The user wants to crawl a website on a schedule or on-demand
- The user needs to run an improvement loop: crawl, evaluate, fix, repeat
- The user wants to trigger a crawl from a CI pipeline

## Instructions

1. Determine the target URL and spider type (default, deep, breadth, api).
2. Run the crawl script:
   ```bash
   bash scripts/run-crawl.sh "<target_url>" "<spider_name>"
   ```
3. Evaluate quality after each crawl:
   ```bash
   python scripts/check-quality.py --spider "<spider_name>" --threshold 0.85
   ```
4. If quality is below threshold and iterations remain:
   - Read the quality report: `output/<spider>/quality.json`
   - Identify the weakest dimension (completeness, accuracy, freshness)
   - Modify the spider code to address the weakness
   - Re-run the crawl
5. After all iterations, generate a summary report:
   ```bash
   python scripts/generate-report.py --output reports/crawl-report.html
   ```

## Key Files

- `scripts/run-crawl.sh` -- main crawl entry point
- `scripts/check-quality.py` -- quality evaluation and gate
- `scripts/generate-report.py` -- HTML dashboard generation
- `.github/workflows/scheduled-crawl.yml` -- GitHub Actions workflow
- `.gitlab-ci.yml` -- GitLab CI equivalent (crawl stage)

## Environment Variables

- `ANTHROPIC_API_KEY` -- required for Claude-assisted improvement
- `OUTPUT_DIR` -- override output directory (default: output/<spider>)
- `MAX_PAGES` -- maximum pages to crawl (default: 100)
- `TIMEOUT` -- crawl timeout in seconds (default: 300)
