---
name: dispatch
description: Execute a multi-agent dispatch task with quality scoring and logging
disable-model-invocation: true
allowed-tools: Bash(npx tsx *), Read, Write, Edit, Agent
argument-hint: <task-description>
---

Execute a full dispatch: analyze task → classify complexity → select agents → fan out → score quality → log to JSONL. Use `npx tsx src/dispatch/cli.ts` for headless execution.
