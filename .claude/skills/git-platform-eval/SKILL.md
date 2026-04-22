---
name: git-platform-eval
description: >
  Produce a structured GitHub-vs-GitLab decision report for this monorepo.
  Reads all session git diffs, loads the XML spec from refs/, scores both
  platforms on 12 weighted criteria, and emits a <decision-report> document
  that the platform-eval agent validates against the spec's rubric using
  Opus 4.7.
triggers:
  - git platform decision
  - github vs gitlab
  - should we use github or gitlab
  - platform recommendation
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
---

# /git-platform-eval

Decide GitHub vs GitLab as the primary host for this monorepo, backed by a
structured spec and a deterministic evaluator.

## Inputs

- **Spec**: `refs/git-platform-decision-spec.xml` — criteria, weights, output
  schema, pass rubric.
- **Session diffs**: `git diff HEAD` + `git log --since="session start"` —
  summarised by `scripts/read-session-diffs.ts`.
- **Repo signals**: presence of `claude-code-actions/`, `.github/`, MCP config.

## Steps

1. **Gather diffs**: run `npx tsx .claude/skills/git-platform-eval/scripts/read-session-diffs.ts`
   to emit a JSON summary of what changed this session. Fall back to an empty
   summary when run outside a session.

2. **Load the spec**: run `npx tsx .claude/skills/git-platform-eval/scripts/parse-spec.ts
   refs/git-platform-decision-spec.xml` to produce a typed criteria list and
   the output schema.

3. **Score both platforms** against each of the 12 criteria using concrete
   signals from:
   - The URLs listed in each `<signal>` element of the spec
   - Files in this repo (`claude-code-actions/`, `.github/workflows/`, MCP config)
   - Claude.com customer stories, docs.github.com, and about.gitlab.com

4. **Compute weighted averages** per platform (`scripts/score-platforms.ts`
   handles the arithmetic so the evaluator's `final-score-computed` check
   cannot drift from the rationales).

5. **Emit the decision report** as XML to
   `refs/out/git-platform-decision-report.xml`. The document root MUST be
   `<decision-report>` matching the spec's `<output-schema>`.

6. **Hand off to the evaluator**: run
   `npx tsx claude-code-agents-typescript/src/agents/platform-eval/cli.ts
   --spec refs/git-platform-decision-spec.xml
   --report refs/out/git-platform-decision-report.xml`.
   This invokes the Opus 4.7 Agent SDK evaluator which validates the report
   against the rubric and returns `pass` / `needs-revision`.

## Output contract

The report MUST include:

| Element | Constraint |
|---|---|
| `<diff-summary>` | Non-empty, populated from actual git state |
| `<scores><platform>` | Exactly 2: `id="github"` and `id="gitlab"` |
| `<criterion>` | All 12 criteria present per platform, `score` ∈ [1,5] |
| `<rationale>` | ≥ 40 chars, references a real signal or URL |
| `<final-score>` | Weighted average — computed, not estimated |
| `<recommendation>` | `choice` ∈ {github, gitlab}, `confidence` ∈ {low, medium, high} |
| `<hedge>` | Names the concrete condition that would flip the decision |
| `<next-actions>` | ≥ 3 concrete, verifiable actions |

## When to re-run

- Claude Code changelog adds new integrations (check
  `code.claude.com/docs/en/whats-new/rss.xml`)
- GitLab CI/CD integration graduates from beta
- Copilot's Anthropic Claude integration changes licensing
- New customer story at `claude.com/customers/*` changes the evidence base
