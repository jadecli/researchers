# jadecli/researchers

Monorepo containing 9 sub-repos for iterative documentation crawling and multi-agent dispatch.

## Key Commands
- `cd agenttasks && npm run dev` — Run the webapp
- `cd claude-code && PYTHONPATH=. python3 -m scrapy list` — List spiders
- `cd claude-multi-agent-sdk && npx vitest run` — Run SDK tests (54)
- `cd claude-multi-agent-dispatch && npx vitest run` — Run dispatch tests (252)

## Structure
Each subdirectory is an independent repo with its own .claude/CLAUDE.md.
The root ARCHITECTURE.md documents the full orchestration trace.
The todos.jsonl tracks 12 indexed improvement items across all repos.
