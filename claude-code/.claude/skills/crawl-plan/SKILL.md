---
name: crawl-plan
description: Analyze a sitemap or llms.txt index and plan optimal crawl order by page type and priority. Use when starting a new crawl campaign.
disable-model-invocation: true
context: fork
agent: Explore
allowed-tools: Read, Grep, Glob, Bash(curl *), Bash(python *)
argument-hint: [url]
---

# Crawl Plan Generator

Analyze the target URL and produce a structured crawl plan.

## Instructions

1. **Fetch the target**: `curl -s $ARGUMENTS`
2. **Detect format**:
   - If XML sitemap: parse `<url><loc>` entries, extract `<lastmod>` dates
   - If llms.txt: parse markdown links to documentation pages
   - If HTML: extract all internal links
3. **Classify pages** by type: doc, api-reference, research, news, engineering, legal, product
4. **Prioritize**: API docs and skills/plugins docs first, then guides, then reference
5. **Estimate scope**: count total pages, estimate crawl time at 1.5s/page
6. **Output** a JSON crawl plan to stdout:

```json
{
  "target": "<url>",
  "total_pages": N,
  "estimated_time_minutes": N,
  "groups": [
    {"type": "doc", "urls": [...], "priority": 1},
    {"type": "api", "urls": [...], "priority": 2}
  ]
}
```

## Additional resources
- For sitemap parsing, use `python -c "from scrapy_researchers.extractors.link_graph import ..."`
- Quality thresholds: completeness > 0.7, structure > 0.6
