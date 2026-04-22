// Public entry for the platform-eval Agent SDK evaluator.
//
// The evaluator uses Opus 4.7 to validate a <decision-report> XML document
// against a spec in refs/. Deterministic checks run first; the LLM only
// judges rationale quality and structural coherence issues that regex can't
// catch.

export { loadSpec } from './xml-spec.js';
export type { Spec, Criterion, RubricCheck } from './xml-spec.js';
export { readSessionDiff } from './diff-reader.js';
export type { DiffSnapshot } from './diff-reader.js';
export { runDeterministicChecks, shouldBlock } from './deterministic-checks.js';
export type { CheckResult } from './deterministic-checks.js';
export { evaluateReport } from './eval-loop.js';
export type { EvaluatorVerdict, EvaluatorInput } from './eval-loop.js';
