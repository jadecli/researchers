# claude-multi-agent-sdk

See root ARCHITECTURE.md § Orchestration Layer. Production-ready TypeScript multi-agent orchestration patterns for Claude, following Boris Cherny's strict typing discipline.

## Architecture
- **src/types/core.ts** — Branded types, Result<T,E>, discriminated unions, agent state machine
- **src/agent/loop.ts** — Core agentic loop: while + tool execution + stop_reason check
- **src/agent/orchestrator.ts** — Lead-subagent pattern: Opus lead, Sonnet workers, parallel fan-out
- **src/context/manager.ts** — Context budget, compaction strategies, progressive tool disclosure, agent memory
- **src/mcp/server.ts** — MCP server with classify/generate/synthesize/estimate tools
- **src/hooks/profiles.ts** — Hook profiles: research, security, CI/CD
- **src/monitoring/telemetry.ts** — OTel+Prometheus cost tracking, session tracker

## Key Patterns
1. Branded types prevent AgentId/SessionId confusion at compile time
2. Result<T,E> replaces try/catch — no thrown exceptions crossing agent boundaries
3. Tool calls execute in parallel via Promise.all (90% perf improvement)
4. Subagents get clean context windows — context must be explicitly passed
5. Three-tier compaction: clear tool results → summarize → delegate to sub-agent
6. Progressive tool disclosure: 85% token reduction via deferred loading

## TypeScript Standards (Boris Cherny)
- `strict: true` + `noUncheckedIndexedAccess: true`
- Discriminated unions for all state machines
- `assertNever` for exhaustive pattern matching
- Branded types for nominal typing

## Models
- Opus 4: $15/$75 per million tokens — lead agent, synthesis
- Sonnet 4: $3/$15 per million — subagent workers
- Haiku 3.5: $0.80/$4 per million — classification, lightweight tasks

## Test Status
- 54/54 vitest tests pass (5 test files)
- TypeScript compiles clean under strict mode + noUncheckedIndexedAccess
- All branded types, Result operations, agent loop, orchestrator, telemetry verified
