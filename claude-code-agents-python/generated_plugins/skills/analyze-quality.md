---
description: Analyze extraction quality from crawl campaign results.
tools:
  - Bash
  - Read
  - Grep
model: claude-sonnet-4-20250514
references:
  - src/models/extraction_result.py
  - src/orchestrator/improvement_chain.py
scripts:
  - python -m src.cli analyze
---

# analyze-quality

Analyze extraction quality from crawl campaign results.

## Usage

Use this skill after running a crawl campaign to assess the quality of extracted data. It provides:

- Overall statistics (average quality, count above/below threshold).
- Quality breakdown by page type (doc, api, research, etc.).
- Identification of potentially failing selectors.
- Recommendations for improvement.

## Parameters

- **input-file**: Path to a JSON file containing extraction results (required).
- **threshold**: Quality threshold for analysis (default: 0.8).

## Example

```bash
# Run a campaign first
python -m src.cli campaign --target https://docs.example.com --output results.json

# Then analyze the results
python -m src.cli analyze --input-file results.json --threshold 0.75
```

## Quality Dimensions

- **Completeness** (40% weight): Was all relevant content captured from the page?
- **Structure** (35% weight): Is the extracted data well-organized and properly nested?
- **Links** (25% weight): Are links resolved, valid, and properly categorized?

## Understanding Results

- **High quality (0.8+)**: Extraction is reliable and comprehensive.
- **Medium quality (0.5-0.8)**: Some content may be missing or poorly structured.
- **Low quality (<0.5)**: Selectors likely need significant revision.

## Instructions

1. Ensure you have a results JSON file from a previous campaign run.
2. Run the analyze command with an appropriate quality threshold.
3. Review the per-type quality breakdown to identify problem areas.
4. Check the failing selectors list for patterns to fix.
5. Use the SelectorProposer DSPy module to get improvement suggestions.
