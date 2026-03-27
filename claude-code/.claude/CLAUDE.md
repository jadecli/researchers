# Claude Code — Iterative Research Crawlers

## Project Overview
Multi-language Scrapy crawler system that crawls Anthropic's documentation ecosystem with iterative quality improvement. Each page crawled generates a context delta that steers the next iteration toward better extraction.

## Architecture
- **scrapy_researchers/** — Python Scrapy spiders (core crawl engine)
- **extractors_ts/** — TypeScript: cheerio HTML parsing, code block extraction, Agent SDK runner
- **extractors_go/** — Go: concurrent link validation, sitemap parsing, rate limiting
- **extractors_rust/** — Rust: high-perf CSS selector engine, HTML→markdown, quality scoring
- **extractors_java/** — Java: Jsoup HTML extraction, metadata parsing
- **extractors_csharp/** — C#: AngleSharp extraction pipeline
- **extractors_kotlin/** — Kotlin: coroutine-based async extraction
- **extractors_php/** — PHP: DOMDocument extraction
- **extractors_ruby/** — Ruby: Nokogiri extraction
- **extractors_swift/** — Swift: SwiftSoup extraction
- **extractors_lua/** — Lua: lightweight text extraction
- **extractors_cpp/** — C/C++: libxml2 high-perf extraction

## Iterative Improvement Loop
1. Spider crawls page → extractors process it
2. Pipeline scores quality → writes improvements/iter_N.jsonl
3. context_delta.py generates small steering payload
4. Delta injected into next spider iteration
5. extract-review skill evaluates, spider-architect patches if needed

## Skills
- `/crawl-plan <url>` — Plan crawl campaign from sitemap/llms.txt
- `/improve-spider <spider>` — Apply accumulated improvements
- `/crawl-report` — Generate HTML quality dashboard

## Agents
- `spider-architect` — Designs/patches spider selectors
- `extraction-critic` — Reviews extraction quality
- `crawl-orchestrator` — Multi-spider campaign coordination

## LSP Support
`.lsp.json` configures language servers for all 12 languages.

## Round 1 Results (2026-03-26)
- Target: code.claude.com/docs/llms.txt
- Pages crawled: 4
- Average quality: 0.75 (threshold 0.60 PASS)
- Scores: zero-data-retention (0.71), web-scheduled-tasks (0.71), vs-code (0.81), voice-dictation (0.76)
- Next: provide custom crawl targets for Round 2

## Crawl Configuration
- Default spider: docs_spider (code.claude.com/docs/llms.txt)
- Available: platform_spider, anthropic_spider, claude_com_spider
- Settings: ROBOTSTXT_OBEY=True, DOWNLOAD_DELAY=2.0, DEPTH_LIMIT=5
- Extensions: scrapy-deltafetch (change detection), spidermon (monitoring)
- Cache: RFC2616 conditional requests, filesystem-backed (Neon PG18 optional)
