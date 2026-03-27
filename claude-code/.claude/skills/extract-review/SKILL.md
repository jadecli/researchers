---
name: extract-review
description: Review extracted data quality after crawling. Automatically scores extraction completeness and generates context delta for the next iteration.
user-invocable: false
allowed-tools: Read, Grep, Glob
---

# Extraction Quality Review

Automatically review the latest extraction results and generate improvement context.

## Review process

1. Read the latest JSONL files in `data/` directory
2. For each extracted page, assess:
   - **Completeness**: Are all expected fields populated? (title, content, metadata)
   - **Structure**: Is markdown properly formatted? Headings hierarchy correct?
   - **Code blocks**: Are code examples preserved with language tags?
   - **Links**: Are internal links valid? Are external links preserved?
   - **Tables**: Are tables converted properly?
3. Generate a quality score (0.0 - 1.0) for each dimension
4. Compare against previous iteration scores in `improvements/`
5. Identify the top 3 areas needing improvement
6. Write a context delta to guide the next crawl iteration

## Quality thresholds
- Overall < 0.6: Critical — spider-architect should rewrite selectors
- Overall 0.6-0.8: Moderate — targeted selector patches needed
- Overall > 0.8: Good — minor refinements only
