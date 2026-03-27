---
name: improve-spider
description: Read improvement logs and patch spider selectors for better extraction quality
disable-model-invocation: true
allowed-tools: Read, Edit, Grep, Glob, Bash(python *)
argument-hint: [spider-name]
---

# Spider Improvement

Read accumulated improvement logs and patch the specified spider's selectors.

## Instructions

1. **Read improvement logs**: `ls improvements/*.jsonl` and read the latest entries
2. **Identify the spider**: Find `scrapy_researchers/spiders/$ARGUMENTS.py`
3. **Analyze failures**: Look for patterns in failing selectors:
   - Selectors returning empty results
   - Selectors matching wrong elements
   - Missing content types (code blocks, tables, images)
4. **Read the spider code** and identify the parse methods
5. **Patch selectors**: Edit the spider file to:
   - Replace failing CSS/XPath selectors with improved ones
   - Add fallback selectors for variant page layouts
   - Add extraction for newly discovered content types
6. **Verify**: Run `scrapy crawl $ARGUMENTS -s CLOSESPIDER_PAGECOUNT=2` to test
7. **Update improvement log**: Record what was changed and why

## Selector improvement patterns
- If `.content article` fails, try `.main-content`, `[role="main"]`, `#content`
- For code blocks, check `pre > code`, `.highlight`, `[data-lang]`
- For metadata, check `meta[property]`, `script[type="application/ld+json"]`
