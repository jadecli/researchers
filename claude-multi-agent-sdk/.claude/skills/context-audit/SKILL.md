---
name: context-audit
description: >
  Audit current context window usage and recommend compaction strategies.
  Use when a session feels slow, when context is filling up, or to optimize
  token spend before a large operation.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob
argument-hint: [verbose]
---

# Context Window Audit

Analyze current context utilization and recommend optimization strategies.

## Audit Steps

1. **Measure current state**:
   - Count loaded CLAUDE.md files and their approximate token sizes
   - Count active tool definitions (each ~200 tokens)
   - Estimate conversation history tokens
   - Calculate remaining budget

2. **Identify waste**:
   - Large tool results that could be trimmed to relevant fields
   - Verbose exploration output that should have been delegated to subagents
   - Stale conversation turns that could be compacted
   - Tool definitions loaded but unused in this session

3. **Recommend strategy** (from `src/context/manager.ts`):
   - Usage < 70%: **Tool result clearing** — keep 5 most recent, clear older
   - Usage 70-90%: **Conversation summary** — preserve key decisions + recent files
   - Usage > 90%: **Sub-agent delegation** — continue task in fresh context

4. **Estimate savings**:
   - Progressive tool disclosure: ~85% reduction in tool definition tokens
   - Tool result trimming: ~60% reduction in result tokens
   - Subagent isolation: prevents verbose exploration from filling context

## Quick Actions
- `/compact` — trigger conversation compaction
- Delegate exploration to Explore subagent (read-only, isolated context)
- Use `trimToolOutput()` pattern for verbose API responses
