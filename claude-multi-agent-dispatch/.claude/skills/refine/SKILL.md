---
name: refine
description: Run a refinement cycle on dispatch prompts or agent selection criteria
disable-model-invocation: true
allowed-tools: Read, Edit, Grep, Glob
argument-hint: <prompts|selectors|pipeline|all> [--iterations N]
---

Load quality scores. Identify lowest-scoring dimensions. Generate N candidate improved prompts via seed_improver. Score candidates. Select best. Update context delta. Detect stagnation/regression.
