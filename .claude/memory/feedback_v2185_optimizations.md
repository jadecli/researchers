---
name: claude-code-v2185-optimizations
description: v2.1.85 latency and codegen state-of-the-art. Apply these to all crawl rounds and dispatch operations.
type: feedback
---

## Top 5 Highest-ROI Actions
1. Compact at 50% context fill, /clear between tasks — prevents quality cliff
2. Install PostToolUse hooks (format + typecheck + test) — catches the last 10%
3. Use auto mode or wildcard permissions — eliminates permission prompt latency
4. Keep CLAUDE.md at ~60 lines, split rest into .claude/rules/ — ensures rules followed
5. Plan with Opus + ultrathink, execute with subagents — best quality-to-speed ratio

**Why:** "Agent dumb zone" after 50% context. Prompt caching reduces tokens 70-80%. Auto mode has 0.4% false positive rate.

**How to apply:** Route Opus for planning/synthesis, Sonnet/Haiku for execution. Use --bare for scripted claude -p. Delegate exploration to Explore subagent with context: fork.
