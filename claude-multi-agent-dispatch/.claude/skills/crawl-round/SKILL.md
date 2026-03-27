---
name: crawl-round
description: Execute a specific crawl round from the 10-round plan
disable-model-invocation: true
allowed-tools: Bash(npx tsx *), Read, Write, Grep, Glob
argument-hint: <round-number> [--force] [--dry-run]
---

Load round definition from src/rounds/round-{N}.ts. Verify prerequisites. Inject accumulated context deltas. Execute extraction tasks. Score quality against threshold. Generate output delta. Write to rounds/{N}/.
