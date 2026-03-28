# Bloom Filters PR — Planned Deliverables Queue

> **Purpose**: One-time workaround to prevent context loss across long sessions.
> Each item is a discrete commit-sized deliverable. Agent should process sequentially,
> committing after each item. Check off items as completed.

## Completed Deliverables

- [x] Initial bloom filter implementation (`52d5164`)
- [x] BloomProfile per-spider contextual defaults (`48f5339`)
- [x] Agent tool applicability analysis matrix (`adcc60c`)
- [x] BLOOM_TOOLS_ARCHITECTURE.md human-readable doc (`eb1df01`)
- [x] BLOOM_TOOLS_ARCHITECTURE_AGENT.md agent-optimized doc (`471a449`)
- [x] Improve agent doc with Claude prompting best practices, system prompts, DSPy patterns (`3468e3d`)

## Remaining Deliverables (in order)

- [ ] **Audit & fix bugs**: Review all bloom filter code for bugs in tool setup/usage, especially Scrapy integration points (dupefilter, pipelines, settings injection, base_spider)
- [ ] **Extend tool usage**: Update bloom_tool_analysis.py to reflect full Claude Code tools reference (29 tools, not 14), add missing tools like LSP, TaskCreate/List/Update, CronCreate, EnterWorktree, Skill, PowerShell
- [ ] **Update agent doc**: Reflect extended tool matrix and any bug fixes in BLOOM_TOOLS_ARCHITECTURE_AGENT.md
- [ ] **Update human doc**: Reflect same changes in BLOOM_TOOLS_ARCHITECTURE.md
- [ ] **Final test pass**: Run all 27 tests, verify eval output, confirm no regressions

## Context for Resumption

- Branch: `claude/bloom-filters-crawling-ANAsd`
- Repo: `jadecli/researchers`, subdir: `claude-code`
- Test: `cd claude-code && PYTHONPATH=. python3 -m pytest tests/test_bloom_filter.py -v`
- Eval: `cd claude-code && PYTHONPATH=. python3 -m scrapy_researchers.bloom_eval`
- All bloom code is in `claude-code/scrapy_researchers/`
- Key files: bloom_filter.py, bloom_dupefilter.py, pipelines.py, settings.py, spiders/base_spider.py
