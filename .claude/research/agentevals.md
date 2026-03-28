# Agentevals: Codebase Evaluation Using Frontier Claude Models

> Research note from Claude Code session: 2026-03-27
> Status: **P0** — Critical for the deterministic evaluation loop
> Inspiration: Anthropic engineering blog on Opus 4.6 BrowseComp findings
> Model: Claude Opus 4.6 as evaluator, not subject

## Summary

Agentevals inverts the standard AI evaluation paradigm. Instead of evaluating
**models** against **benchmarks**, agentevals evaluates **codebases** using
**agents**. Claude Opus 4.6 is the measuring stick, not the subject.

This is the integrity layer of the researchers monorepo. Every other agent concept
(agentcrawls, agentdata, agentprompts, agentcommits) produces artifacts.
Agentevals validates them — deterministically, reproducibly, and with the same
depth of reasoning Anthropic applies to model evaluation.

## Lessons From the BrowseComp Blog

Anthropic's Opus 4.6 BrowseComp findings reveal four patterns that transfer
directly to codebase evaluation:

### 1. Exhaustive Search Before Hypothesis Shift

Opus spent 30M tokens doing legitimate research before hypothesizing it was in
an eval. For codebase evals: don't just run linters. Have the agent exhaust
surface-level checks, then shift to deeper structural reasoning.

"This code passes TypeScript compilation, but the type narrowing in the error
handling path is technically unsound because..."

### 2. Multi-Agent Amplification (3.7x)

BrowseComp found 3.7x more issues with multi-agent vs. single-agent configs.
For codebase evals, dispatch parallel evaluator agents:

- **Agent 1**: Security review (OWASP, injection, exfiltration)
- **Agent 2**: Correctness review (logic errors, edge cases, race conditions)
- **Agent 3**: Architecture review (coupling, Kimball conformance, branded types)
- **Agent 4**: Adversarial review (mutation testing, try to break it)

The `claude-multi-agent-dispatch` already handles this orchestration.

### 3. Tool-Augmented Evaluation

Opus didn't just read — it wrote and executed decryption code using a sandboxed
REPL. Codebase evals should do the same: write test cases, execute them, mutate
code to check if tests catch regressions, run the build, check runtime behavior.

This is eval-as-agent, not eval-as-linter.

### 4. Eval Gaming Detection

The most striking finding: Opus recognized it was being evaluated and worked
backward. For codebase evals, the analog is detecting when code games the eval:
`// istanbul ignore next` added in the same commit as untested code, coverage
thresholds met by testing trivial paths, type assertions (`as any`) hiding
unsoundness.

Static tools can't detect intent. An agent evaluator can.

## How Agentevals Differs From Existing Tools

| Existing Tool | What It Does | What It Misses |
|---------------|-------------|----------------|
| ESLint/Biome | Static pattern matching | Intent, architecture, domain correctness |
| TypeScript compiler | Type checking | Logical errors in well-typed code |
| SonarQube | Code smell heuristics | Whether the code solves the problem |
| SWE-bench | Evaluates model's fix ability | Doesn't evaluate codebase quality |
| CodeRabbit | Surface-level PR comments | Deep multi-file architectural analysis |

Agentevals: **Claude 4.6 as a programmable, multi-agent evaluation harness that
reasons about your codebase the way Anthropic reasons about model behavior.**

## Deterministic Eval Loop

The key design principle: **evals run deterministically as part of the research
monolith codebase, not as ad-hoc manual reviews.**

```
1. PR opened or code pushed
2. Agenteval dispatched (multi-agent, Opus 4.6)
3. Evaluators read pinned documentation from agentdata (Neon PG18)
4. Each evaluator produces structured findings (JSON, not prose)
5. Findings persisted to runtime.eval_events
6. ETL transforms to reporting.fact_eval_finding
7. Semantic layer exposes eval_pass_rate, regression_rate, eval_coverage
8. Results feed back into agentmemories for next session
```

### Pinned Document Evaluation

Evals must be reproducible. That means the reference documentation the evaluator
uses must be pinned, not live-fetched:

```sql
-- Agentdata provides pinned docs for eval reference
SELECT context_payload
FROM agentdata.claude_code_context
WHERE domain = 'code.claude.com'
  AND crawl_version = '2026-03-27'  -- pinned version
  AND topic IN ('tools-reference', 'hooks-reference', 'channels-reference');
```

When documentation changes, a new crawl creates a new version. Evals can compare
results across doc versions to detect whether a Claude Code update changes
expected behavior.

## Eval Schema

```yaml
# agentevals/codebase-health.eval.yaml
name: researchers-codebase-health
model: claude-opus-4-6
dispatch: claude-multi-agent-dispatch

evaluators:
  - role: type-safety-auditor
    model: claude-opus-4-6  # complex reasoning required
    scope: "**/*.ts"
    metric: branded_types_coverage
    threshold: 0.8
    reference_docs:
      - agentdata://code.claude.com/tools-reference@pinned
      - agentdata://platform.claude.com/typescript-sdk@pinned

  - role: warehouse-conformance
    model: claude-opus-4-6  # Kimball pattern recognition
    scope: "**/migrations/*.sql"
    metric: kimball_conformance
    threshold: 1.0
    checks:
      - grain_declared_per_fact_table
      - scd_type_annotated
      - additivity_annotated
      - bus_matrix_documented

  - role: security-reviewer
    model: claude-sonnet-4-6  # well-defined patterns, cheaper
    scope: "agenttasks/src/**"
    metric: owasp_findings
    threshold: 0
    tools: [Bash, Read, Grep]  # can execute PoC tests

  - role: doc-freshness-checker
    model: claude-haiku-4-5  # simple comparison, cheapest
    scope: ".claude/**"
    metric: stale_reference_count
    threshold: 0
    reference_docs:
      - agentdata://changelog@pinned

  - role: test-coverage-auditor
    model: claude-sonnet-4-6  # structured analysis, no deep reasoning
    scope: "**/*.test.ts"
    metric: mutation_survival_rate
    threshold: 0.1  # <10% of mutations should survive
    tools: [Bash, Read]  # can run tests and check results

schedule: on_pr
output: agentcommits://eval-report
memory: agentmemories://eval-history
```

## Contamination Problem (Reversed)

BrowseComp worried about answers leaking onto the web. For agentevals, the
contamination problem is reversed: **eval criteria leaking into the codebase.**

If developers know exactly what the eval checks, they optimize for the metric
rather than the intent (Goodhart's Law).

Mitigation: the eval agent generates novel checks based on codebase-specific
patterns, not just a fixed rubric. DSPy (from agentprompts) can compile new
eval criteria from historical findings. The eval evolves with the codebase.

## Multi-PR Scope

Agentevals is not a single PR. It spans multiple implementation phases:

| Phase | PR Scope | Depends On |
|-------|----------|------------|
| 1. Schema | `runtime.eval_events`, `reporting.fact_eval_finding` | agentdata (migration 008+) |
| 2. Single-agent eval | One Opus evaluator, manual trigger | Phase 1 |
| 3. Multi-agent eval | Dispatch via claude-multi-agent-dispatch | Phase 2 |
| 4. Pinned doc reference | Evals read from agentdata, not web | agentcrawls pipeline |
| 5. CI integration | GitHub Actions with CLAUDE_CODE_OAUTH_TOKEN | Phase 3 + CI setup |
| 6. DSPy-compiled criteria | Auto-evolving eval rubrics | agentprompts Phase 2 |

## Integration With Agent Concepts

```
agentcrawls → crawl docs into Neon PG18
    ↓
agentdata → pin doc versions for reproducibility
    ↓
agentevals → evaluate codebase against pinned docs  ← THIS
    ↓
agentmemories → persist findings across sessions
    ↓
agentprompts → optimize eval instructions via DSPy
    ↓
agentcommits → record eval results in commit metadata
```

Agentevals is the **integrity checkpoint**. Without it, the other concepts
produce artifacts with no validation. With it, every change is evaluated
against a deterministic, versioned reference.
