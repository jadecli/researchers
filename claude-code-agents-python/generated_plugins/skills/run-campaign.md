---
description: Run an iterative crawl campaign against target URLs with automatic quality improvement.
tools:
  - Bash
  - Read
  - Write
  - Glob
  - Grep
model: claude-sonnet-4-20250514
references:
  - src/orchestrator/campaign.py
  - src/orchestrator/headless_runner.py
  - src/orchestrator/improvement_chain.py
scripts:
  - python -m src.cli campaign
---

# run-campaign

Run an iterative crawl campaign against target URLs with automatic quality improvement.

## Usage

Use this skill when you need to crawl websites and extract structured data with iterative quality improvement. The campaign will:

1. Plan the crawl based on target URLs, budget, and iteration limits.
2. Execute crawls using HeadlessRunner (wrapping `claude -p`).
3. Classify extracted pages using the DSPy PageClassifier.
4. Score extraction quality across completeness, structure, and link dimensions.
5. Propose selector improvements when quality is below threshold.
6. Re-crawl with improved selectors until convergence or budget exhaustion.

## Parameters

- **target**: The URL to crawl (required).
- **spider**: Spider name to use (default: `generic`).
- **max-pages**: Maximum pages per target (default: 50).
- **iterations**: Maximum improvement iterations (default: 3).
- **budget**: Total budget in USD (default: $5.00).
- **threshold**: Quality threshold to stop iterating (default: 0.8).

## Example

```bash
python -m src.cli campaign \
  --target https://docs.anthropic.com \
  --spider docs \
  --max-pages 100 \
  --iterations 5 \
  --threshold 0.85 \
  --output results.json
```

## Instructions

1. Gather the target URL and any preferences (spider type, page limits).
2. Set appropriate budget and iteration limits based on site size.
3. Run the campaign command and monitor iteration-by-iteration quality improvements.
4. Review the output JSON for extraction results and quality scores.
5. If quality is still below threshold, examine failing selectors and consider manual adjustments.

## Quality Metrics

- **Completeness** (0-1): Was all relevant content captured?
- **Structure** (0-1): Is the output well-organized?
- **Links** (0-1): Are links resolved and valid?
- **Overall**: Weighted combination (40% completeness, 35% structure, 25% links).
