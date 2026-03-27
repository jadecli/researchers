# claude-dspy-crawl-planning

Shannon-thinking crawl planner using Claude Agent SDK v2 canonical objects.
Forked patterns from jadecli/shannon-thinking. Iterative multi-round crawler
covering all platform.claude.com doc categories.

## Architecture
- **src/types/core.ts** — Branded types, Shannon thought types, Agent SDK v2 session types
- **src/thinking/planner.ts** — Shannon 5-step crawl planner (problem→constraints→model→proof→implementation)
- **src/crawl/runner.ts** — Iterative crawl runner with convergence detection

## Agent SDK v2 Patterns Used
- `unstable_v2_createSession()` / `unstable_v2_prompt()` for session management
- `session.send()` + `session.stream()` for multi-turn conversations
- `SDKMessage` types: system, assistant, user, result
- `SDKResultMessage.subtype`: success, error_max_turns, error_budget

## Shannon Thinking Steps
1. problem_definition — strip to fundamentals
2. constraints — system limitations
3. model — structural framework
4. proof — validate feasibility
5. implementation — practical execution plan

## Running
- `npx tsx src/thinking/planner.ts [round]` — generate crawl plan
- `npx tsx src/crawl/runner.ts [rounds] [maxPages]` — execute iterative crawl
