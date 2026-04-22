# refs/

Structured XML reference documents that drive deterministic evaluations.

Each `*-spec.xml` defines the schema and rubric an agent's output must satisfy.
Agents load these at startup; the `claude-code-agents-typescript` platform-eval
agent validates skill output against them before accepting a verdict.

## Current documents

| File | Consumed by | Purpose |
|---|---|---|
| `git-platform-decision-spec.xml` | `.claude/skills/git-platform-eval` + `platform-eval` agent | GitHub vs GitLab decision criteria, weights, output schema, pass thresholds |

## Conventions

- XML root element is `<spec>` with `version` and `id` attributes.
- `<criteria>` enumerates scored dimensions (each with `id`, `weight`, `question`).
- `<output-schema>` declares the shape the skill must emit (validated structurally).
- `<rubric>` states pass thresholds (min criteria covered, min rationale length, required fields).
