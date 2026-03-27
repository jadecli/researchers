# Skill: Quality Gate

Evaluate crawl output quality and enforce score thresholds.

## When to Use

- After a crawl completes and you need to check if output meets standards
- When setting up quality gates in CI pipelines
- When comparing quality across spiders or over time

## Instructions

1. Run the quality check against a specific spider:
   ```bash
   python scripts/check-quality.py --spider "<spider_name>" --threshold 0.85
   ```
   Or evaluate all spiders:
   ```bash
   python scripts/check-quality.py --threshold 0.85
   ```

2. The script evaluates three dimensions:
   - **Completeness** (0.0-1.0): presence of title, content, metadata, links, no errors
   - **Accuracy** (0.0-1.0): valid URLs, non-empty content, proper encoding, reasonable size
   - **Freshness** (0.0-1.0): crawl recency, HTTP success rate, timing

3. The overall score is the average of all three dimensions.

4. Exit codes:
   - `0` -- quality meets or exceeds threshold
   - `1` -- quality below threshold (or no data found)

5. Use `--dry-run` to evaluate without failing the pipeline.

6. Use `--output <path>` to write the quality JSON to a specific location.

## Reading Results

Quality JSON format:
```json
{
  "completeness": 0.92,
  "accuracy": 0.88,
  "freshness": 0.95,
  "overall_score": 0.9167,
  "pages_evaluated": 47
}
```

## Key Files

- `scripts/check-quality.py` -- quality evaluation script
- `output/<spider>/quality.json` -- per-spider quality reports
- `output/quality.json` -- aggregate quality report
