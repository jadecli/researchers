# Compass MCP: Evaluation and Integration Analysis

> Research note from Claude Code session: 2026-03-28
> Status: **Evaluated** — Pattern extracted, integration implemented
> Source: https://github.com/richlira/compass-mcp
> License: MIT

## Summary

Compass MCP is a minimal MCP server (9 source files, ~200 lines of logic) that
provides cross-session persistence across Claude Chat, Cowork, and Code via 6
tools operating on markdown files in `~/compass-data/`.

**Verdict**: The repo itself is a toy — no tests, regex parsing, `includes()`
fuzzy matching, markdown-as-database. But it reveals a real gap in our
architecture: **none of our 4 existing MCP servers handle cross-session memory
persistence**. We extracted the one useful pattern (context persistence via MCP
tools) and integrated it with proper types, error handling, and tests.

## What Compass Does

| Tool | Purpose | Implementation |
|------|---------|----------------|
| `init_workspace` | Create `~/compass-data/` dir | `fs.mkdir` + template files |
| `add_task` | Add task to `tasks.md` | Regex-based markdown insertion |
| `complete_task` | Mark task done | `includes()` fuzzy match + line replace |
| `get_tasks` | Filter tasks | Section-based markdown parsing |
| `save_context` | Write project context file | `fs.writeFile` to `contexts/<name>.md` |
| `get_context` | Read project context file | `fs.readFile` from `contexts/<name>.md` |

**Architecture**: Stdio-based MCP server using `@modelcontextprotocol/sdk`
v1.25.2 + Zod v4.3.6. Data stored as plain markdown. No database.

## Skeptical Assessment

### What's wrong with Compass

1. **No tests** — Zero test files, no test framework, no CI. The only testing
   is manual via MCP Inspector. This contradicts our agentevals integrity layer.

2. **Markdown-as-database** — Regex parsing of `- [ ] Task | tags: x | deadline: y`
   is fragile. One malformed line breaks the parser. No transactions, no
   concurrent access safety, no query optimization.

3. **Fuzzy matching via `includes()`** — `complete_task` finds tasks using
   `task.title.toLowerCase().includes(searchLower)`. This will match wrong
   tasks when titles are substrings of each other.

4. **No error handling** — `readDataFile` returns empty string on any error
   (including permission denied, disk full). No `Result<T,E>`, no error types.

5. **Task system reinvents poorly** — We already have `todos.jsonl` with 22
   indexed items. Compass tasks add nothing we don't have.

6. **Zod v4 incompatibility** — Compass uses Zod v4.3.6; we use v3.23.0.
   Breaking API changes between major versions.

7. **MCP SDK version gap** — Compass uses v1.25.2; we use v1.12.0. Not
   necessarily bad (could be an upgrade signal), but needs validation.

### What's right about Compass

1. **Cross-surface persistence via MCP** — The core idea is sound. An MCP
   server visible to Chat, Cowork, and Code provides shared state that our
   hook-based flat files cannot.

2. **`save_context`/`get_context` primitive** — This is the simplest useful
   abstraction for cross-session memory. Project-scoped, markdown-in/markdown-
   out, no schema overhead.

3. **Composable tool registration** — `addXTools(server)` pattern is clean.
   We already use this in our MCP servers.

4. **Deliberate simplicity** — "Six tools, two file types, zero database"
   forces intelligence into the model, not the tool. This is philosophically
   aligned with MCP's design intent.

## Gap Analysis: Our Architecture

### Existing MCP Servers (4)

| Server | Location | Tools | Handles Persistence? |
|--------|----------|-------|---------------------|
| Research | `claude-multi-agent-sdk/src/mcp/server.ts` | classify, generate, synthesize, estimate | No |
| Thinking | `claude-multi-agent-dispatch/src/thinking/server.ts` | create_thought, chain, track, challenge, compute | In-memory only |
| Dispatch | `claude-multi-agent-dispatch/src/dispatch/mcp-server.ts` | classify, plan, execute, check, transcript | In-memory only |
| Channel | `claude-channel-dispatch-routing/src/channel/server.ts` | reply | No |

**The gap**: No MCP server persists anything across sessions. The Thinking
engine loses all thoughts when the process exits. The Dispatch server loses
all plans. There is no "remember this for next time" capability.

### Current persistence mechanisms

- `.claude/context/next-session.md` — Hook-written flat file, read by SessionStart
- `.claude/memory/` — Flat files (if they exist), not MCP-accessible
- `agentdata` Neon PG18 — Planned but not yet connected to MCP tools

Compass's contribution: **proving that MCP tools are the right transport for
persistence**, not hooks or flat files.

## Integration Design

### What we extracted

Only the context persistence pattern (`save_context`/`get_context`). Everything
else (tasks, workspace init) is either redundant or poorly implemented.

### How we adapted it

Created `claude-multi-agent-sdk/src/mcp/memory.ts`:

1. **Branded types**: `MemoryDomain` (project slug), `MemoryVersion` (ISO date)
2. **Result<T,E>**: All operations return `Result`, never throw
3. **File-backed now, SQL-upgradeable later**: Uses `~/compass-data/memories/`
   today, designed for Neon PG18 swap via `agentdata` Tier 4
4. **Composable**: `addMemoryTools(server)` follows existing pattern
5. **Tested**: vitest suite validates save, recall, list, and error paths

### Tools added

| Tool | Derived From | Changes |
|------|-------------|---------|
| `save_memory` | Compass `save_context` | Branded types, Result<T,E>, versioned with date |
| `recall_memory` | Compass `get_context` | Returns structured result, not raw string |
| `list_memories` | New (Compass had none) | Lists all domains with metadata |

### What we deliberately omitted

- **Task tools** — Redundant with `todos.jsonl` and agentevals task tracking
- **`init_workspace`** — Our SessionStart hook handles initialization
- **Fuzzy matching** — Exact domain slugs, not substring matching
- **Markdown parsing** — Content is opaque markdown; metadata is structured

## Upgrade Path to Neon PG18

When `agentdata` Tier 4 is implemented (migration 008+), the memory tools swap
from file I/O to SQL queries:

```
File-backed (now):
  save_memory → fs.writeFile('memories/domain.md', content)
  recall_memory → fs.readFile('memories/domain.md')

SQL-backed (future):
  save_memory → INSERT INTO agentdata.memories (domain, content, version)
  recall_memory → SELECT content FROM agentdata.memories WHERE domain = $1
  list_memories → SELECT domain, updated_at FROM agentdata.memories
```

The MCP tool interface stays identical. Callers (Chat/Cowork/Code) never know
the backend changed.

## Connection to Agentevals

The memory tools are the first component that bridges `agentmemories` (research
doc, P1) with the existing MCP infrastructure. The eval loop can:

1. **Persist eval findings** via `save_memory` (domain: `eval-results`)
2. **Recall previous findings** via `recall_memory` for regression detection
3. **Version findings** via the date-stamped file naming

This creates the `agentmemories → agentevals` feedback loop described in the
agentevals research doc without requiring the full Neon PG18 infrastructure.

## References

- Compass MCP source: https://github.com/richlira/compass-mcp (MIT)
- Our MCP servers: `claude-multi-agent-sdk/src/mcp/server.ts`, 3 others
- Agentmemories research: `.claude/research/` (not yet written, P1)
- Agentevals research: `.claude/research/agentevals.md`
- MCP SDK: `@modelcontextprotocol/sdk` (our v1.12.0 vs Compass v1.25.2)
