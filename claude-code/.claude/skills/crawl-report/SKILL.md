---
name: crawl-report
description: Generate an interactive HTML quality dashboard showing crawl metrics and improvement trends
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(python *)
---

# Crawl Quality Report Generator

Generate an interactive HTML dashboard from crawl metrics.

## Instructions

1. Read all improvement logs from `improvements/*.jsonl`
2. Read all crawled data from `data/*.jsonl`
3. Compute metrics:
   - Total pages crawled per spider
   - Average quality scores per iteration
   - Quality trend over time (improving/declining/stable)
   - Selector success/failure rates
   - Content type coverage (headings, code, tables, links, images)
4. Generate a self-contained HTML file with:
   - Summary cards (total pages, avg quality, iterations)
   - Line chart showing quality trend per spider
   - Bar chart showing content type coverage
   - Table of top failing selectors with proposed fixes
   - Collapsible per-spider details
5. Write to `data/crawl-report.html`
6. Open in browser: `open data/crawl-report.html`

Use `python scripts/generate-report.py` if available, otherwise generate inline.
