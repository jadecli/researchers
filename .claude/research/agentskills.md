# Agentskills: Skill Ecosystem Assessment for Agent-Native Codebases

> Research note from Claude Code session: 2026-03-28
> Status: **P2 — Assessment complete**. No refactoring warranted. Additive opportunities identified.
> Scope: Anthropic skills.sh ecosystem (11 sources, 256 skills, 893K installs) vs. this repo's hooks
> Related: agentcommits, agentevals, agentcrawls

## Summary

Agentskills evaluates the Anthropic skills ecosystem (skills.sh, knowledge-work-plugins,
claude-plugins-official, claude-code skills) against this repo's custom enforcement
layer. The assessment is skeptical by design: the question is not "can a skill do
something similar" but "would a skill do it better than architecture-specific code."

**Finding: No skill in the ecosystem replaces the enforcement layer.** The hooks
are hard-blocking gates with architecture-specific knowledge (9 sub-repos,
Boris Cherny types, Kimball schema, cross-boundary imports, triage escalation).
Ecosystem skills are advisory prompts invoked on demand. Different tool, different job.

Three skills are worth installing alongside existing hooks as additive complements.

## Ecosystem Inventory (2026-03-28)

### Sources Evaluated

| Source | Skills | Installs | Relevance |
|--------|--------|----------|-----------|
| `anthropics/skills` | 18 | 759K | Skill authoring meta-tools |
| `anthropics/knowledge-work-plugins` | 147 | 55K | Domain workflow skills |
| `anthropics/claude-code` | 10 | 53K | Hook/skill development reference |
| `anthropics/claude-plugins-official` | 30 | 19.6K | Production-ready plugins |
| `anthropics/claude-agent-sdk-demos` | 6 | 180 | SDK demo patterns |

### Skills Assessed in Detail

| Skill | What It Does | Overlap With Our Code | Replace? |
|-------|-------------|----------------------|----------|
| `hook-development` | Reference manual for writing hooks (9 event types, matchers, I/O) | Nothing operational | No — additive for authoring new hooks |
| `commit-commands` `/commit` | Generates conventional commit messages by learning repo style | Commit format drafting | No — generates, does not block |
| `hookify` + `writing-rules` | Single-pattern bash/file guards via YAML frontmatter rules | Simple command guards | No — wrong execution model for multi-step hooks |
| `code-review` plugin | 4 parallel agents: CLAUDE.md compliance, bugs, git-blame context | Post-PR code quality | No — post-hoc, not blocking gate |
| `pr-review-toolkit` | 6 agents: type-design-analyzer, silent-failure-hunter, code-simplifier | Post-PR type/test/doc review | No — post-hoc only |
| `knowledge-work-plugins/engineering` | `/standup`, `/review`, `/debug`, `/architecture`, `/incident` | Nothing | No — manual workflow tools |
| `knowledge-work-plugins/operations` | Vendor management, process optimization, compliance | Nothing | No — business ops, not DevOps |
| `claude-code-setup` | Read-only scanner recommending automations | Session initialization | No — passive advisor vs active bootstrap |

## Why Our Hooks Are Not Replaceable

### 1. Hard-Blocking Gates vs Advisory Prompts

Ecosystem skills are invoked by the user (`/commit`, `/review`). Our PreToolUse hooks
fire automatically on every `git commit` and `gh pr create` with no opt-out.
A skill that *suggests* a good commit message doesn't prevent a bad one.

### 2. Architecture-Specific Knowledge

Our hooks encode knowledge no generic skill can have:

```
context-pre-commit.sh knows:
├── 9 sub-repo boundaries (agenttasks, claude-code, claude-multi-agent-sdk, ...)
├── Sub-repos must NOT import from siblings (MCP/SDK only)
├── Exported TS functions must have return types (Boris Cherny contract)
├── Python public functions must have -> annotations
├── Only agenttasks/ deploys to Vercel ($0.126/min Turbo compute)
└── Failures log to triage-ci-failure.py (never silent)

context-pre-pr.sh knows:
├── SDK types changed → dispatch must be updated (coherence check)
├── Channel routing changed → SDK types must be consistent
├── agenttasks TypeScript must compile (Vercel will fail otherwise)
├── Branch must be pushed to remote before PR
└── Failures create Linear tickets + TODO (escalation chain)
```

Generic skills like `code-review` check for "bugs, security, performance,
maintainability" — they don't know about Kimball star schema coherence,
branded type requirements, or the cost of a failed Vercel build.

### 3. Zero-Cost Deterministic Execution

Our hooks are regex classifiers and shell checks — no API calls, no tokens spent.
The triage script only calls Claude headless when deterministic classification fails.
Ecosystem skills are LLM-invoked on every use (minimum ~1K tokens per call).

### 4. Escalation Chain

No ecosystem skill implements gradual degradation:
```
Fix at source (hook blocks + guidance)
  → Slack alert (CI failures)
    → Linear ticket (architecture/complex)
      → TODO in todos.jsonl (guaranteed, never silent)
```

## Additive Opportunities (Worth Installing)

### 1. `commit-commands` — Draft + Enforce Pattern

Install the `commit-commands` plugin from `anthropics/claude-plugins-official`.
The `/commit` command drafts conventional commit messages by learning from recent
history. Our `context-pre-commit.sh` hook then validates the result. Together:

```
/commit generates → context-pre-commit.sh validates → commit succeeds or blocks
```

This eliminates the friction of manually formatting commit messages while keeping
the enforcement gate. **Low risk, high value.**

### 2. `pr-review-toolkit` — Type Design Analyzer

The `type-design-analyzer` agent rates type quality 1-10 on: encapsulation,
invariant expression, discriminated union completeness, and generic constraint
tightness. Relevant for `claude-multi-agent-sdk` and `claude-multi-agent-dispatch`
where Boris Cherny patterns (branded types, Result\<T,E\>, exhaustive matching)
are architectural requirements.

Run post-PR as a review supplement, not a replacement for the pre-PR gate.

### 3. `code-review` — CLAUDE.md Compliance Auditing

The `code-review` plugin reads CLAUDE.md for project rules and audits PRs against
them. Since our CLAUDE.md documents the conventional commit requirement, Vercel cost
warnings, and pre-PR checklist, this plugin would enforce those rules in PR reviews
without additional configuration.

## What agentskills.io Owns (Anthropic-Owned, Not Ours)

The agentskills specification and agentskills.io are Anthropic-owned. Our role:

1. **Consume** — Install relevant skills, evaluate them, report gaps
2. **Complement** — Build architecture-specific enforcement that generic skills cannot
3. **Contribute** — If patterns emerge that generalize, propose as skills (e.g., the
   conventional commit + agent trailer validator could become a community skill)
4. **Don't compete** — Our hooks solve a different problem at a different layer

## Integration With Other Agent Concepts

```
agentskills ← evaluates ecosystem skills for this codebase
    ↓
agentcommits ← skills draft commit messages, hooks validate them
    ↓
agentevals ← type-design-analyzer supplements eval dimensions
    ↓
agentcrawls ← skill ecosystem docs are a crawl target for knowledge base
    ↓
agentdata ← skill assessment persists in Neon for cross-session reuse
```

## Recommended Phases

**Phase 1 (now):** This assessment document. No code changes warranted.

**Phase 2 (next session):** Install `commit-commands` plugin. Test the
draft-then-validate workflow for 1 week. Measure commit rejection rate before
and after.

**Phase 3 (if Phase 2 valuable):** Install `pr-review-toolkit` for post-PR
type design analysis on SDK/dispatch repos. Wire findings into agentevals
dimension scores.

**Phase 4 (community):** If the conventional commit + agent trailer hook pattern
proves reusable, package as a skill on skills.sh. The hook validates format; the
skill teaches the format. Together they form a complete commit quality pipeline.

**Anti-pattern:** Installing every available skill "just in case." Each skill
adds context tokens to every session. Only install skills that demonstrably
improve outcomes for this specific codebase.

## Risk Assessment

Near-zero risk. This is an assessment document — no code changes. The three
additive skills are opt-in and non-breaking. The existing enforcement layer
is validated and deployed. Worst case: installed skills add noise to sessions.
Best case: 30% fewer commit rejections via `/commit` drafting + 10% better
type design scores via post-PR analysis.
