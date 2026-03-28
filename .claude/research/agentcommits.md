# Agentcommits: Extending Conventional Commits for Agent Workflows

> Research note from Claude Code session: 2026-03-27
> Status: P2 — Conceptual, not yet implemented
> Related: agentskills.io, agenttasks specification, conventional commits

## Summary

Agentcommits is a proposed backward-compatible extension to conventional commits
that adds structured agent metadata via native git trailers. It fills the "commit
layer" gap in the dual human/agent format pipeline.

## The Gap Conventional Commits Leave

Conventional commits (`feat:`, `fix:`, `chore:`) were designed for human changelog
generation and semver automation. They answer: *"What changed and should the version bump?"*

They don't answer questions agents care about:
- **What tool/capability was used?** (code generation, web search, file editing)
- **What was the confidence level?** (deterministic refactor vs. heuristic fix)
- **What context was consumed?** (which files were read, what MCP tools invoked)
- **Is this human-authored, agent-authored, or collaborative?**

This metadata matters increasingly as codebases become mixed-authorship. GitHub
already surfaces "co-authored-by" in commits — agentcommits formalizes the agent side.

## Alignment With Existing Stack

| Layer | Human Format | Agent Format | Status |
|-------|-------------|-------------|--------|
| **Tasks** | agenttasks.io webapp | agenttasks specification (JSON) | Covered |
| **Skills** | agentskills.io docs | agentskills specification | Covered |
| **Commits** | conventional commits | ??? | **Gap — agentcommits fills this** |
| **Web Content** | HTML pages | llms.txt, AGENTS.md, markdown mirrors | Planned |

## Proposed Format

Backward-compatible with conventional commits. Any valid conventional commit is
a valid agentcommit. Agent metadata lives in git trailers (a native git concept):

```
feat(styles): add style management module with Kimball analytics

agent: claude-opus-4-6
tools: [Read, Write, Edit, Grep, Glob]
context-files: 6 read, 4 created, 1 modified
confidence: high
authorship: agent-primary, human-directed
task-ref: agenttasks://style-artifacts
skill-ref: agentskills://typescript-strict, agentskills://dimensional-modeling
```

The first line is a standard conventional commit — any tool that parses conventional
commits ignores the structured trailer.

## Why Extension, Not Fork

1. **Tooling compatibility** — commitlint, semantic-release, changelogen, and every
   CI tool that parses conventional commits continues to work. Agent metadata lives
   in trailers, which these tools ignore gracefully.

2. **Adoption path** — Developers already know conventional commits. Asking them to
   learn a new format is a non-starter. Asking them to *optionally append structured
   trailers* is trivial.

3. **Progressive enhancement** — Human-only repos don't need agent trailers.
   Agent-heavy repos get richer metadata. Mixed repos benefit most. This mirrors
   the dual-format webapp vision exactly.

## End-to-End Traceability With agenttasks

```
agenttask (input) → agentskill (capability) → agentcommit (output) → changelog (human) + audit log (agent)
```

This gives end-to-end traceability from task intent to code change, in both
human-readable and machine-parseable formats.

## Recommended Phases

**Phase 1 (this repo, low cost):** Start using git trailers in commits informally.
No spec needed — just append `agent: claude-opus-4-6` and `authorship: agent-primary`
to commits. See if the metadata proves useful in practice.

**Phase 2 (if Phase 1 proves valuable):** Formalize the trailer schema as part of
the agenttasks specification. Define required vs. optional fields, valid values,
and how they map to agentskills.

**Phase 3 (community):** If the pattern works, publish as a companion spec to
conventional commits. Position as "conventional commits + agent metadata trailers"
rather than a competing standard.

**Anti-pattern:** Creating a formal spec before using it in practice for several
weeks. The dual-format webapp work will generate real agentcommit data — that's
when the important trailer fields become clear.

## Risk Assessment

Near-zero risk. Worst case: stop appending trailers. Best case: a complete
dual-format pipeline from task to deployment.
