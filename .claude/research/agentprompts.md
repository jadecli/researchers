# Agentprompts: Dynamic Prompt Optimization for Agents

> Research note from Claude Code session: 2026-03-27
> Status: P2 — Conceptual, not yet implemented
> Related: Claude prompting best practices, Claude system prompts, DSPy
> References:
> - https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
> - https://platform.claude.com/docs/en/release-notes/system-prompts
> - https://github.com/stanfordnlp/dspy

## Summary

Agentprompts makes prompts living artifacts that optimize themselves against known
best practices, rather than static strings written by humans. Three sources map to
three layers that together form a full prompt optimization stack.

## The Problem

Prompts in agent systems are static strings that don't improve over time. When
Claude gets better (new system prompt, new capability), every hardcoded prompt
becomes stale. The version pin ratchet in `next-session.md` is a manual workaround
for exactly this problem. Agentprompts would automate it.

## Three Sources, Three Layers

| Source | What It Provides | Layer |
|--------|-----------------|-------|
| **Claude Prompting Best Practices** | Structural patterns (XML tags, prefilling, chain-of-thought) | **Syntax layer** — how to format prompts |
| **Claude System Prompts** | Anthropic's own evolving system prompt patterns | **Reference layer** — what Anthropic considers current best practice |
| **DSPy** | Programmatic optimization (signatures, teleprompters, metrics) | **Optimization layer** — how to improve prompts automatically |

```
agentprompt = syntax (Claude best practices)
            + reference (system prompt patterns)
            + optimization (DSPy compilation)
```

## How DSPy Changes Everything

Traditional prompt engineering:

```
Human writes prompt → Agent uses prompt → Human reads output → Human rewrites prompt
```

DSPy's approach:

```
Define signature (input/output types) → Define metric (what "good" means)
→ Teleprompter compiles optimized prompt → Evaluate → Auto-iterate
```

In TypeScript with Cherny-style types, a DSPy signature maps naturally to:

```typescript
// Conceptual — what an agentprompt type could look like
type AgentPrompt<TInput, TOutput> = {
  readonly signature: PromptSignature<TInput, TOutput>
  readonly demonstrations: readonly Example<TInput, TOutput>[]
  readonly metric: (predicted: TOutput, expected: TOutput) => Score
  readonly compiled: CompiledPrompt  // DSPy output
  readonly version: SemVer
  readonly bestPractices: ClaudeBestPracticeTag[]
}
```

## Position in the Dual-Format Pipeline

```
agenttask (what to do)
  → agentskill (what capabilities exist)
    → agentprompt (how to instruct the agent)  ← THIS
      → agentcommit (what was done)
        → changelog (human) + audit (agent)
```

Agentprompts sit between skills and commits. A skill says "I can do TypeScript
analysis." An agentprompt says "Here's the optimized instruction for invoking
that skill given the current Claude model version and best practices."

## Three Dynamic Feedback Loops

**Loop 1 — Best Practice Sync (version pin pattern, generalized):**
Claude publishes best practices updates. The repo pins the last-reviewed version.
Each session, diff the best practices and recompile any agentprompts that use stale
patterns. This generalizes the changelog ratchet already in `next-session.md`.

**Loop 2 — System Prompt Alignment:**
Anthropic's system prompts evolve (documented in release notes). An agentprompt
optimal for one system prompt version may be suboptimal for the next. Tracking
system prompt versions flags prompts needing recompilation.

**Loop 3 — DSPy Optimization (the real power):**
Given a metric (e.g., "TypeScript compiles with zero errors", "SQL migration passes
pg_prove tests"), DSPy can:
- Generate few-shot demonstrations automatically
- Optimize chain-of-thought instructions
- Select between prompt strategies (zero-shot vs. few-shot vs. chain-of-thought)
- Compile to the most effective format for the current model

## Concrete Example: Style Artifacts

The prompt that generated the style management module this session was essentially:

> "Create personalized style artifacts following Boris Cherny's TypeScript patterns
> and Ralph Kimball's data warehouse patterns"

An agentprompt version:

```yaml
# agentprompts/style-artifacts.prompt.yaml
signature:
  input: StyleArtifactRequest  # book references, target patterns
  output: StyleModule           # types.ts, presets.ts, manager.ts, migrations

demonstrations:
  - input: { books: [cherny, kimball], domain: "style-management" }
    output: { files: 6, ts_errors: 0, patterns: [branded-types, result-type, scd2] }

metric: |
  typescript_compiles AND
  all_methods_return_result AND
  migrations_have_grain_declarations AND
  bus_matrix_documented

best_practices:
  - xml_tags: true          # Claude best practice: use XML structure
  - prefill: true           # Claude best practice: prefill assistant turn
  - chain_of_thought: true  # Think before coding
  - examples: 2             # Few-shot from demonstrations

claude_version_floor: "opus-4-6"
system_prompt_version: "2026-03-27"
dspy_compiled: "2026-03-27"
```

DSPy takes this declaration and compiles it into an optimized prompt that scores
highest on the metric. When Claude updates, recompile.

## All Four Concepts Together

```
agentprompts  — How to instruct agents (dynamic, optimized)
agenttasks    — What to tell agents to do (structured tasks)
agentskills   — What agents can do (capability registry)
agentcommits  — What agents did (structured commit metadata)
```

Each has a human-readable format (docs, webapp, conventional commits) and an
agent-optimized format (YAML/JSON, specification, git trailers). The dual-format
pattern is consistent across all four.

## Self-Improving Agent Development Lifecycle

1. **agenttasks** define intent
2. **agentprompts** optimize instruction (dynamically, against Claude best practices + DSPy)
3. **agentskills** declare capability
4. **agentcommits** record execution

Each layer feeds back into the others. Agentcommit data improves agentprompt
compilation. Agentprompt improvements produce better agentcommit outcomes.
The repo compounds over time.

## Recommended Phases

**Phase 0 (now):** Capture as design concept. Don't build anything yet.

**Phase 1 (near-term):** Collect prompt-result pairs from Claude Code sessions.
The `runtime.style_events` table and agentcommit trailers feed this naturally.
Need data before optimizing.

**Phase 2 (after dual-format webapp):** Introduce DSPy as a Python dependency in
the existing `claude-code/` sub-repo (already Python/Scrapy). Write first
signature + metric for one concrete task.

**Phase 3 (validation):** Compare DSPy-compiled prompts against hand-written
prompts on real tasks. If compilation measurably improves output quality,
formalize the agentprompt schema.

**Anti-pattern:** Building a general-purpose agentprompt framework before having
at least 10 concrete prompt-metric pairs from real usage. DSPy needs real
evaluation data to compile against — synthetic benchmarks won't reveal what
matters for this specific repo.

## Risk Assessment

Highest-leverage of the four concepts but hardest to get right. DSPy dependency
fits naturally in the Python `claude-code/` sub-repo. Start with data collection,
not framework building.
