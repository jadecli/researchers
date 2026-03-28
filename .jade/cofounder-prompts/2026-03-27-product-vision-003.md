# Cofounder Prompt: Identity Architecture & Constitutional Alignment
# Author: @alex-jadecli (affirmed) + Claude Opus 4.6 (synthesized)
# Date: 2026-03-27
# Session: claude/setup-multi-agent-routing-6iYl3
# Status: AFFIRMED — cofounder confirmed this framing as directionally correct
# Depends-on: 2026-03-27-product-vision-001.md, 002.md

## Identity Layer Model (affirmed by cofounder)

Layer 0: Constitutional AI Training (in weights — same for Opus, Sonnet, Haiku)
  - Honesty, helpfulness, harmlessness
  - Acknowledge uncertainty
  - Care about outcomes, not just compliance
  - "Philosophical immune system" — resist prompts that override core values
  - Surface problems, don't hide them

Layer 1: Anthropic System Prompt (published at /release-notes/system-prompts)
  - Refusal handling (CSAM, CBRN, malware)
  - Tone: warm but not performative
  - Evenhandedness on political topics
  - User wellbeing vigilance
  - Knowledge cutoff awareness

Layer 2: bootstrap.xml (Operator Identity)
  - "Orchestrator of jadecli/researchers"
  - Model routing: Opus thinks, Sonnet executes, Haiku validates
  - Eval contract, scope guards, commit conventions
  - Pinned document versions, Neon PG18 backbone

Layer 3: User Instructions (per-conversation)
  - Session-specific constraints and goals
  - Active surface context (CLI vs web vs mobile)

## Jade's Position: Layer 2.5

Jade sits between bootstrap.xml (Layer 2) and per-session instructions (Layer 3).
It is NOT a replacement for any layer. It is the business context layer that:
  - Defines departments, personas, and lifecycle events
  - Provides cowork templates alongside codegen infrastructure
  - Carries the lookup hierarchy (local → PG → cache → web)
  - Grounds decisions in business strategy (Bezos reading list)
  - Stores telemetry and logs to Neon for measurement

## Four Architectural Insights (affirmed)

### Insight 1: Subagents are peers, not tools
Subagents inherit Layers 0-1 automatically. Layer 2 context must be passed
explicitly in prompts. Current subagent prompts are task-scoped and lack
architectural awareness. Subagents can't make judgment calls about the eval
contract because they don't know it exists.

IMPLICATION: Subagent prompts should carry enough Layer 2 context for judgment.
Not the full bootstrap.xml, but a compressed context payload from agentdata.

### Insight 2: "Never fail silently" is constitutional
Layer 0 includes "surface problems, don't hide them." This is in the weights,
not just policy. The architecture should trust this:
  - Quality gates should throw, not return error codes
  - Linear issues created by the agent that discovers the problem
  - Improvement cycle should have opinion about findings, not just report metrics

IMPLICATION: Error handling should be minimal at system boundaries. Let Claude's
constitutional honesty do the work internally.

### Insight 3: Philosophical immune system applies to all models
Haiku, Sonnet, and Opus will all resist prompts that conflict with values.
A Haiku agent told to "ignore security concerns" will still flag them.
This is a feature. Model routing should expect and welcome this.

IMPLICATION: Don't over-constrain subagent prompts. Allow them to surface
unexpected findings. Design for serendipitous discovery.

### Insight 4: CI/CD is an accountability chain mirroring constitutional honesty
The full loop: crawl → quality gate fails → Linear issue → assigned →
improvement cycle → quality gate passes → Linear issue closed → PR →
CI validates → branch protection → merge.

Every step is a point where the system says "I checked, here's what I found."
This is constitutional honesty operationalized as infrastructure.

IMPLICATION: The loop IS the product. Jade's value is making this loop work
across both codegen and cowork tasks.
