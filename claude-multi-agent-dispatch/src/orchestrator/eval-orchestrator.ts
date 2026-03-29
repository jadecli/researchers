// src/orchestrator/eval-orchestrator.ts — Deterministic evaluation loop orchestrator
//
// Implements the agentevals design from .claude/research/agentevals.md:
//   Phase 1: Schema (runtime.eval_events + reporting.fact_eval_finding) — migration 010
//   Phase 2: Single-agent eval — this file
//   Phase 3: Multi-agent eval — this file (5 parallel evaluator agents)
//
// Dogfoods: transitions.ts (state machine), judge.ts (alignment scoring),
//   scorer.ts (quality dimensions), team-orchestrator.ts (agent pattern).
//
// Boris Cherny patterns: Branded types, Result<T,E>, discriminated unions.

import type { AgentId, Result, TokenUsage } from '../types/core.js';
import { toAgentId, toDispatchId, toUSD, toTokenCount, Ok, Err, assertNever } from '../types/core.js';
import type { DispatchState, DispatchPlan, DispatchResult } from '../types/dispatch.js';
import {
  transitionToPlanning,
  transitionToDispatching,
  transitionToExecuting,
  transitionToScoring,
  transitionToComplete,
  transitionToError,
  runSentinelGate,
  type SentinelCheck,
} from './transitions.js';
import { alignmentJudge, classifyScore } from '../audit/judge.js';

// ── Evaluator Role (Discriminated Union) ──────────────────────

export type EvaluatorRole =
  | 'type-safety-auditor'
  | 'warehouse-conformance'
  | 'security-reviewer'
  | 'doc-freshness-checker'
  | 'test-coverage-auditor';

/** Severity levels matching runtime.eval_events CHECK constraint */
export type EvalSeverity = 'critical' | 'warning' | 'info';

// ── Evaluator Agent Definition ────────────────────────────────

export interface EvalAgent {
  readonly id: AgentId;
  readonly role: EvaluatorRole;
  readonly model: 'opus' | 'sonnet' | 'haiku';
  readonly scopeGlob: string;
  readonly metricName: string;
  readonly threshold: number;
  readonly prompt: string;
}

// ── Eval Finding ──────────────────────────────────────────────

export interface EvalFinding {
  readonly evaluatorRole: EvaluatorRole;
  readonly targetPath: string;
  readonly finding: Record<string, unknown>;
  readonly severity: EvalSeverity;
  readonly pass: boolean;
  readonly score: number;
  readonly pinnedDocVersion: string | null;
  readonly rationale: string;
}

// ── Eval Run ──────────────────────────────────────────────────

export interface EvalRun {
  readonly runId: string;
  readonly evaluators: readonly EvaluatorRole[];
  readonly findings: readonly EvalFinding[];
  readonly passRate: number;
  readonly coveragePathCount: number;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
}

// ── Evaluator Agent Factory ───────────────────────────────────

export function createEvalAgents(): readonly EvalAgent[] {
  return [
    {
      id: toAgentId('eval-type-safety'),
      role: 'type-safety-auditor',
      model: 'opus',
      scopeGlob: '**/*.ts',
      metricName: 'branded_types_coverage',
      threshold: 0.8,
      prompt: `You are a type safety auditor evaluating TypeScript code.

Check for:
- Boris Cherny branded types used for all IDs (AgentId, DispatchId, SessionId, etc.)
- Result<T,E> used instead of thrown exceptions at module boundaries
- Discriminated unions with exhaustive switch + assertNever()
- No \`as any\` type assertions hiding unsoundness
- \`strict: true\` + \`noUncheckedIndexedAccess: true\` compliance

Report each finding with: severity, file_path, evidence, pass (boolean), score (0-1).`,
    },
    {
      id: toAgentId('eval-warehouse'),
      role: 'warehouse-conformance',
      model: 'opus',
      scopeGlob: '**/migrations/*.sql',
      metricName: 'kimball_conformance',
      threshold: 1.0,
      prompt: `You are a Kimball data warehouse conformance auditor.

Check every SQL migration for:
- GRAIN documented per fact table (one comment per table stating the grain)
- SCD Type annotated on dimension tables (Type 1, 2, or 3)
- Additivity documented on measures (additive, semi-additive, non-additive)
- Bus matrix consistency: shared dimensions use identical surrogate keys
- runtime (OLTP) → reporting (OLAP) → semantic (metrics) layer separation
- BRIN indexes on append-only timestamp columns
- Bloom indexes on multi-column filter fact tables

Report each finding with: severity, file_path, evidence, pass (boolean), score (0-1).`,
    },
    {
      id: toAgentId('eval-security'),
      role: 'security-reviewer',
      model: 'sonnet',
      scopeGlob: 'agenttasks/src/**',
      metricName: 'owasp_findings',
      threshold: 0.0,
      prompt: `You are a security reviewer checking for OWASP Top 10 vulnerabilities.

Check for:
- SQL injection in parameterized queries
- Command injection in Bash hook scripts
- XSS in React/Next.js components (unsanitized user input, dangerouslySetInnerHTML)
- SSRF via user-controlled URLs in fetch/web requests
- Credential exposure (API keys, tokens, passwords in source)
- Path traversal in file operations
- Insecure deserialization of untrusted JSON

Report each finding with: severity, file_path, evidence, pass (boolean), score (0-1).`,
    },
    {
      id: toAgentId('eval-doc-freshness'),
      role: 'doc-freshness-checker',
      model: 'haiku',
      scopeGlob: '.claude/**',
      metricName: 'stale_reference_count',
      threshold: 0.0,
      prompt: `You are a documentation freshness checker.

Check for:
- Pinned doc versions that reference outdated Claude Code versions
- Research docs referencing features that have been superseded
- Stale URLs pointing to moved or deleted pages
- Version pins that lag behind current releases

Report each finding with: severity, file_path, evidence, pass (boolean), score (0-1).`,
    },
    {
      id: toAgentId('eval-test-coverage'),
      role: 'test-coverage-auditor',
      model: 'sonnet',
      scopeGlob: '**/*.test.ts',
      metricName: 'mutation_survival_rate',
      threshold: 0.1,
      prompt: `You are a test coverage auditor using mutation testing principles.

Check for:
- Source files without corresponding test files
- Tests that only check happy paths (no error/edge case coverage)
- \`// istanbul ignore\` or \`/* c8 ignore */\` suppressing real gaps
- Tests that assert on implementation details rather than behavior
- Mock-heavy tests that don't test real integrations

Report each finding with: severity, file_path, evidence, pass (boolean), score (0-1).`,
    },
  ] as const;
}

/** Get evaluator agents for a specific role */
export function getEvalAgent(role: EvaluatorRole): EvalAgent {
  const agents = createEvalAgents();
  const agent = agents.find(a => a.role === role);
  if (!agent) {
    // Exhaustive check — if we add a new role, this line errors at compile time
    // because the find above covers all roles in the union
    throw new Error(`Unknown evaluator role: ${role}`);
  }
  return agent;
}

/** Get all evaluator roles */
export function getAllEvaluatorRoles(): readonly EvaluatorRole[] {
  return [
    'type-safety-auditor',
    'warehouse-conformance',
    'security-reviewer',
    'doc-freshness-checker',
    'test-coverage-auditor',
  ] as const;
}

// ── Eval Orchestrator ─────────────────────────────────────────

export class EvalOrchestrator {
  private state: DispatchState = { status: 'idle' };
  private readonly agents: readonly EvalAgent[];
  private readonly findingsLog: EvalFinding[] = [];
  private runStartedAt: Date | null = null;

  constructor() {
    this.agents = createEvalAgents();
  }

  getState(): DispatchState { return this.state; }
  getAgents(): readonly EvalAgent[] { return this.agents; }
  getFindings(): readonly EvalFinding[] { return [...this.findingsLog]; }

  /** Transition to planning phase with pre-eval sentinel checks */
  planEval(targetPaths: readonly string[]): Result<void> {
    const checks: SentinelCheck[] = [
      {
        name: 'target-paths-exist',
        check: () => targetPaths.length > 0,
      },
      {
        name: 'evaluators-available',
        check: () => this.agents.length > 0,
      },
    ];

    const gateResult = runSentinelGate(checks);
    if (!gateResult.passed) {
      return Err(new Error(`Sentinel gate failed at: ${gateResult.failedAt}`));
    }

    const transition = transitionToPlanning(this.state);
    if (!transition.ok) return Err(transition.error);

    this.state = transition.value;
    this.runStartedAt = new Date();
    return Ok(undefined);
  }

  /** Transition to dispatching phase */
  startDispatching(): Result<void> {
    const plan: DispatchPlan = {
      id: toDispatchId(`eval-${Date.now()}`),
      tasks: [],
      budget: toUSD(1.0),
      maxAgents: this.agents.length,
      timeline: {
        estimatedDurationMs: 60_000,
        createdAt: new Date(),
      },
    };

    const transition = transitionToDispatching(this.state, plan);
    if (!transition.ok) return Err(transition.error);

    this.state = transition.value;
    return Ok(undefined);
  }

  /** Transition to executing phase */
  startExecuting(): Result<void> {
    const agentIds = this.agents.map(a => a.id);
    const transition = transitionToExecuting(this.state, agentIds);
    if (!transition.ok) return Err(transition.error);

    this.state = transition.value;
    return Ok(undefined);
  }

  /** Record a finding from an evaluator */
  recordFinding(finding: EvalFinding): void {
    this.findingsLog.push(finding);
  }

  /** Run a single evaluator against a target (heuristic scoring via judge.ts) */
  async evaluateTarget(
    role: EvaluatorRole,
    targetPath: string,
    targetContent: string,
  ): Promise<Result<EvalFinding>> {
    const agent = this.agents.find(a => a.role === role);
    if (!agent) return Err(new Error(`Unknown role: ${role}`));

    const judgeResult = await alignmentJudge(targetContent, agent.prompt);
    if (!judgeResult.ok) return Err(judgeResult.error);

    const judgment = judgeResult.value;
    const pass = judgment.score >= agent.threshold;
    const severity: EvalSeverity = judgment.score < 0.3
      ? 'critical'
      : judgment.score < 0.6
        ? 'warning'
        : 'info';

    const finding: EvalFinding = {
      evaluatorRole: role,
      targetPath,
      finding: {
        dimensions: judgment.dimensions,
        classification: classifyScore(judgment.score),
      },
      severity,
      pass,
      score: judgment.score,
      pinnedDocVersion: null,
      rationale: judgment.rationale,
    };

    this.recordFinding(finding);
    return Ok(finding);
  }

  /** Transition to scoring and compute summary metrics */
  scoreEval(): Result<{ passRate: number; coveragePathCount: number }> {
    const rawOutputs = this.findingsLog.map(f => JSON.stringify(f.finding));
    const transition = transitionToScoring(this.state, rawOutputs);
    if (!transition.ok) return Err(transition.error);

    this.state = transition.value;

    const total = this.findingsLog.length;
    const passed = this.findingsLog.filter(f => f.pass).length;
    const passRate = total > 0 ? passed / total : 0;
    const uniquePaths = new Set(this.findingsLog.map(f => f.targetPath)).size;

    return Ok({ passRate, coveragePathCount: uniquePaths });
  }

  /** Complete the eval run */
  completeEval(): Result<EvalRun> {
    const total = this.findingsLog.length;
    const passed = this.findingsLog.filter(f => f.pass).length;
    const passRate = total > 0 ? passed / total : 0;
    const uniquePaths = new Set(this.findingsLog.map(f => f.targetPath)).size;

    const dispatchResult: DispatchResult = {
      id: toDispatchId(`eval-result-${Date.now()}`),
      outputs: this.findingsLog.map(f => JSON.stringify(f)),
      qualityScore: passRate,
      usage: {
        inputTokens: toTokenCount(0),
        outputTokens: toTokenCount(0),
        cacheReadTokens: toTokenCount(0),
        cacheWriteTokens: toTokenCount(0),
        totalCost: toUSD(0),
      },
      duration: Date.now() - (this.runStartedAt?.getTime() ?? Date.now()),
    };

    const transition = transitionToComplete(this.state, dispatchResult);
    if (!transition.ok) return Err(transition.error);

    this.state = transition.value;

    return Ok({
      runId: `eval-${Date.now()}`,
      evaluators: [...new Set(this.findingsLog.map(f => f.evaluatorRole))],
      findings: [...this.findingsLog],
      passRate,
      coveragePathCount: uniquePaths,
      startedAt: this.runStartedAt ?? new Date(),
      completedAt: new Date(),
    });
  }

  // ── SQL Generators ──────────────────────────────────────────

  /** Generate parameterized INSERT SQL for runtime.eval_events */
  static generateInsertSQL(findings: readonly EvalFinding[]): {
    sql: string;
    params: readonly unknown[];
  } {
    if (findings.length === 0) {
      return { sql: '-- No findings to insert', params: [] };
    }

    const placeholders: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const f of findings) {
      placeholders.push(
        `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6})`,
      );
      params.push(
        f.evaluatorRole,
        f.targetPath,
        JSON.stringify(f.finding),
        f.severity,
        f.pass,
        f.score,
        f.rationale,
      );
      idx += 7;
    }

    const sql = `INSERT INTO runtime.eval_events
  (evaluator_role, target_path, finding, severity, pass, score, rationale)
VALUES
  ${placeholders.join(',\n  ')}
RETURNING id, evaluator_role, severity, pass, score;`;

    return { sql, params };
  }

  /** Generate parameterized INSERT SQL for reporting.fact_eval_finding */
  static generateFactInsertSQL(
    findings: readonly EvalFinding[],
    dateSk: number,
  ): {
    sql: string;
    params: readonly unknown[];
  } {
    if (findings.length === 0) {
      return { sql: '-- No findings to insert into fact table', params: [] };
    }

    const placeholders: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const f of findings) {
      placeholders.push(
        `((SELECT evaluator_sk FROM reporting.dim_evaluator WHERE evaluator_role = $${idx}), $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5})`,
      );
      params.push(
        f.evaluatorRole,
        dateSk,
        f.targetPath,
        f.severity,
        f.pass,
        f.score,
      );
      idx += 6;
    }

    const sql = `INSERT INTO reporting.fact_eval_finding
  (evaluator_sk, date_sk, target_path, severity, pass, score)
VALUES
  ${placeholders.join(',\n  ')}
RETURNING eval_finding_sk, evaluator_sk, severity, pass;`;

    return { sql, params };
  }

  /** Summary of findings by evaluator role */
  summarize(): Record<EvaluatorRole, {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    avgScore: number;
  }> {
    const roles = getAllEvaluatorRoles();
    const summary = {} as Record<EvaluatorRole, {
      total: number;
      passed: number;
      failed: number;
      passRate: number;
      avgScore: number;
    }>;

    for (const role of roles) {
      const roleFindings = this.findingsLog.filter(f => f.evaluatorRole === role);
      const total = roleFindings.length;
      const passed = roleFindings.filter(f => f.pass).length;
      const failed = total - passed;
      const avgScore = total > 0
        ? roleFindings.reduce((sum, f) => sum + f.score, 0) / total
        : 0;

      summary[role] = {
        total,
        passed,
        failed,
        passRate: total > 0 ? passed / total : 0,
        avgScore,
      };
    }

    return summary;
  }
}
