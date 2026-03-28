# claude-multi-agent-dispatch

See root ARCHITECTURE.md § Orchestration Layer. Unified multi-agent dispatch system with 10 iterative crawl rounds. Combines abstractions from bloom (5-stage pipeline), petri (auditor agent, transcript types, alignment judge), safety-tooling (unified inference API), shannon-thinking (structured problem decomposition with confidence tracking), and MCP SDKs (handler registration, transport abstraction).

## Architecture
- **src/types/** — Branded types, Result<T,E>, discriminated unions for dispatch, transcript, thinking, quality
- **src/inference/** — Unified inference API with cost-aware model routing
- **src/thinking/** — Shannon methodology MCP server + ThinkingEngine
- **src/pipeline/** — 5-stage dispatch: analyze→approach→execute→evaluate→refine
- **src/audit/** — Petri-style: auditor loop, alignment judge, realism approver, AuditStore
- **src/orchestrator/** — DispatchOrchestrator with capability-vector agent selection
- **src/logging/** — JSONL writer, transcript builder, telemetry tracker
- **src/quality/** — Multi-dimensional scoring, confidence calibration, feedback loops
- **src/refinement/** — Seed improver, selector evolution, context delta accumulation
- **src/dispatch/** — Platform dispatchers: CLI, GitHub Actions, Chrome, Slack, MCP server
- **src/safety/** — SSRF/PII scanning, dispatch validation, YAML security rules
- **src/rounds/** — 10 round definitions with prerequisites, thresholds, context deltas

## Key Patterns
1. Branded types prevent DispatchId/RoundId/AgentId confusion at compile time
2. Result<T,E> — no thrown exceptions crossing dispatch boundaries
3. JSONL logging for every dispatch event
4. Context delta injection steers each subsequent round
5. Dual MCP servers: Shannon thinking + dispatch tools
6. Quality thresholds escalate: 0.60 → 0.65 → 0.70 → 0.75 → 0.80 → 0.85

## Test Status
- 252/252 vitest tests pass (11 test files)
- TypeScript compiles clean under Boris Cherny strict mode
- All 10 round definitions loaded with prerequisites and thresholds
