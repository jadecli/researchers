import { describe, it, expect, beforeEach } from 'vitest';
import {
  EvalOrchestrator,
  createEvalAgents,
  getEvalAgent,
  getAllEvaluatorRoles,
  type EvaluatorRole,
  type EvalFinding,
  type EvalSeverity,
} from '../src/orchestrator/eval-orchestrator.js';

// ── Helper ──────────────────────────────────────────────────────

function makeFinding(overrides?: Partial<EvalFinding>): EvalFinding {
  return {
    evaluatorRole: 'type-safety-auditor',
    targetPath: 'src/types/core.ts',
    finding: { check: 'branded-types', result: 'pass' },
    severity: 'info',
    pass: true,
    score: 0.85,
    pinnedDocVersion: null,
    rationale: 'All branded types correctly used.',
    ...overrides,
  };
}

// ── Evaluator Agent Definitions ─────────────────────────────────

describe('createEvalAgents', () => {
  it('creates exactly 5 evaluator agents', () => {
    const agents = createEvalAgents();
    expect(agents).toHaveLength(5);
  });

  it('assigns correct roles to agents', () => {
    const agents = createEvalAgents();
    const roles = agents.map(a => a.role);
    expect(roles).toContain('type-safety-auditor');
    expect(roles).toContain('warehouse-conformance');
    expect(roles).toContain('security-reviewer');
    expect(roles).toContain('doc-freshness-checker');
    expect(roles).toContain('test-coverage-auditor');
  });

  it('uses Opus for complex reasoning roles', () => {
    const agents = createEvalAgents();
    const typeSafety = agents.find(a => a.role === 'type-safety-auditor');
    const warehouse = agents.find(a => a.role === 'warehouse-conformance');
    expect(typeSafety?.model).toBe('opus');
    expect(warehouse?.model).toBe('opus');
  });

  it('uses Sonnet for structured analysis roles', () => {
    const agents = createEvalAgents();
    const security = agents.find(a => a.role === 'security-reviewer');
    const coverage = agents.find(a => a.role === 'test-coverage-auditor');
    expect(security?.model).toBe('sonnet');
    expect(coverage?.model).toBe('sonnet');
  });

  it('uses Haiku for simple comparison roles', () => {
    const agents = createEvalAgents();
    const freshness = agents.find(a => a.role === 'doc-freshness-checker');
    expect(freshness?.model).toBe('haiku');
  });

  it('every agent has a non-empty prompt', () => {
    const agents = createEvalAgents();
    for (const agent of agents) {
      expect(agent.prompt.length).toBeGreaterThan(50);
    }
  });

  it('every agent has a scope glob', () => {
    const agents = createEvalAgents();
    for (const agent of agents) {
      expect(agent.scopeGlob).toBeTruthy();
      expect(agent.scopeGlob.includes('*')).toBe(true);
    }
  });
});

describe('getEvalAgent', () => {
  it('returns agent for valid role', () => {
    const agent = getEvalAgent('security-reviewer');
    expect(agent.role).toBe('security-reviewer');
    expect(agent.model).toBe('sonnet');
  });

  it('throws for unknown role', () => {
    expect(() => getEvalAgent('nonexistent' as EvaluatorRole)).toThrow();
  });
});

describe('getAllEvaluatorRoles', () => {
  it('returns all 5 roles', () => {
    const roles = getAllEvaluatorRoles();
    expect(roles).toHaveLength(5);
  });
});

// ── EvalOrchestrator State Machine ──────────────────────────────

describe('EvalOrchestrator', () => {
  let orch: EvalOrchestrator;

  beforeEach(() => {
    orch = new EvalOrchestrator();
  });

  it('starts in idle state', () => {
    expect(orch.getState().status).toBe('idle');
  });

  it('has 5 agents', () => {
    expect(orch.getAgents()).toHaveLength(5);
  });

  it('starts with empty findings', () => {
    expect(orch.getFindings()).toHaveLength(0);
  });

  // ── planEval ────────────────────────────────────────────────

  it('transitions idle → planning with valid targets', () => {
    const result = orch.planEval(['src/types/core.ts']);
    expect(result.ok).toBe(true);
    expect(orch.getState().status).toBe('planning');
  });

  it('rejects planEval with empty target paths', () => {
    const result = orch.planEval([]);
    expect(result.ok).toBe(false);
  });

  // ── State transitions ───────────────────────────────────────

  it('follows full lifecycle: idle → planning → dispatching → executing → scoring → complete', () => {
    expect(orch.planEval(['src/foo.ts']).ok).toBe(true);
    expect(orch.getState().status).toBe('planning');

    expect(orch.startDispatching().ok).toBe(true);
    expect(orch.getState().status).toBe('dispatching');

    expect(orch.startExecuting().ok).toBe(true);
    expect(orch.getState().status).toBe('executing');

    orch.recordFinding(makeFinding());

    expect(orch.scoreEval().ok).toBe(true);
    expect(orch.getState().status).toBe('scoring');

    const result = orch.completeEval();
    expect(result.ok).toBe(true);
    expect(orch.getState().status).toBe('complete');
  });

  it('rejects out-of-order transitions', () => {
    // Can't dispatch from idle
    expect(orch.startDispatching().ok).toBe(false);
    // Can't execute from idle
    expect(orch.startExecuting().ok).toBe(false);
    // Can't score from idle
    expect(orch.scoreEval().ok).toBe(false);
    // Can't complete from idle
    expect(orch.completeEval().ok).toBe(false);
  });

  // ── Finding recording ───────────────────────────────────────

  it('records findings and returns them', () => {
    orch.planEval(['src/foo.ts']);
    orch.startDispatching();
    orch.startExecuting();

    orch.recordFinding(makeFinding({ targetPath: 'a.ts', score: 0.9 }));
    orch.recordFinding(makeFinding({ targetPath: 'b.ts', score: 0.7 }));

    expect(orch.getFindings()).toHaveLength(2);
  });

  it('getFindings returns a copy (not a reference)', () => {
    orch.recordFinding(makeFinding());
    const findings = orch.getFindings();
    findings.push(makeFinding()); // mutate the copy
    expect(orch.getFindings()).toHaveLength(1); // original unchanged
  });

  // ── evaluateTarget ──────────────────────────────────────────

  it('evaluateTarget produces a finding via alignment judge', async () => {
    const result = await orch.evaluateTarget(
      'type-safety-auditor',
      'src/types/core.ts',
      'export type AgentId = Brand<string, "AgentId">; This uses branded types correctly with Result<T,E> and assertNever for exhaustive matching.',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.evaluatorRole).toBe('type-safety-auditor');
      expect(result.value.targetPath).toBe('src/types/core.ts');
      expect(result.value.score).toBeGreaterThan(0);
      expect(typeof result.value.pass).toBe('boolean');
      expect(['critical', 'warning', 'info']).toContain(result.value.severity);
    }
  });

  it('evaluateTarget returns Err for unknown role', async () => {
    const result = await orch.evaluateTarget(
      'nonexistent' as EvaluatorRole,
      'foo.ts',
      'content',
    );
    expect(result.ok).toBe(false);
  });

  it('evaluateTarget auto-records the finding', async () => {
    await orch.evaluateTarget('security-reviewer', 'app.tsx', 'safe code here');
    expect(orch.getFindings()).toHaveLength(1);
  });

  // ── scoreEval ───────────────────────────────────────────────

  it('scoreEval computes pass rate and coverage', () => {
    orch.planEval(['a.ts', 'b.ts']);
    orch.startDispatching();
    orch.startExecuting();

    orch.recordFinding(makeFinding({ targetPath: 'a.ts', pass: true }));
    orch.recordFinding(makeFinding({ targetPath: 'b.ts', pass: false }));
    orch.recordFinding(makeFinding({ targetPath: 'a.ts', pass: true }));

    const result = orch.scoreEval();
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 2 pass, 1 fail → 2/3 ≈ 0.667
      expect(result.value.passRate).toBeCloseTo(2 / 3, 2);
      expect(result.value.coveragePathCount).toBe(2); // a.ts and b.ts
    }
  });

  // ── completeEval ────────────────────────────────────────────

  it('completeEval returns a full EvalRun', () => {
    orch.planEval(['src/foo.ts']);
    orch.startDispatching();
    orch.startExecuting();

    orch.recordFinding(makeFinding({ evaluatorRole: 'type-safety-auditor' }));
    orch.recordFinding(makeFinding({ evaluatorRole: 'security-reviewer' }));

    orch.scoreEval();
    const result = orch.completeEval();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.runId).toMatch(/^eval-/);
      expect(result.value.evaluators).toHaveLength(2);
      expect(result.value.findings).toHaveLength(2);
      expect(result.value.passRate).toBe(1);
      expect(result.value.startedAt).toBeInstanceOf(Date);
      expect(result.value.completedAt).toBeInstanceOf(Date);
    }
  });

  // ── summarize ───────────────────────────────────────────────

  it('summarize groups findings by evaluator role', () => {
    orch.recordFinding(makeFinding({ evaluatorRole: 'type-safety-auditor', pass: true, score: 0.9 }));
    orch.recordFinding(makeFinding({ evaluatorRole: 'type-safety-auditor', pass: false, score: 0.2 }));
    orch.recordFinding(makeFinding({ evaluatorRole: 'security-reviewer', pass: true, score: 0.8 }));

    const summary = orch.summarize();

    expect(summary['type-safety-auditor'].total).toBe(2);
    expect(summary['type-safety-auditor'].passed).toBe(1);
    expect(summary['type-safety-auditor'].failed).toBe(1);
    expect(summary['type-safety-auditor'].passRate).toBe(0.5);
    expect(summary['type-safety-auditor'].avgScore).toBeCloseTo(0.55, 2);

    expect(summary['security-reviewer'].total).toBe(1);
    expect(summary['security-reviewer'].passRate).toBe(1);

    // Roles with no findings have zero values
    expect(summary['warehouse-conformance'].total).toBe(0);
    expect(summary['warehouse-conformance'].passRate).toBe(0);
  });
});

// ── SQL Generators ──────────────────────────────────────────────

describe('EvalOrchestrator SQL generation', () => {
  it('generateInsertSQL produces parameterized SQL', () => {
    const findings: EvalFinding[] = [
      makeFinding({ evaluatorRole: 'type-safety-auditor', targetPath: 'a.ts' }),
      makeFinding({ evaluatorRole: 'security-reviewer', targetPath: 'b.ts' }),
    ];

    const { sql, params } = EvalOrchestrator.generateInsertSQL(findings);

    expect(sql).toContain('INSERT INTO runtime.eval_events');
    expect(sql).toContain('$1');
    expect(sql).toContain('RETURNING');
    expect(params).toHaveLength(14); // 7 params per finding × 2
    expect(params[0]).toBe('type-safety-auditor');
    expect(params[7]).toBe('security-reviewer');
  });

  it('generateInsertSQL handles empty findings', () => {
    const { sql, params } = EvalOrchestrator.generateInsertSQL([]);
    expect(sql).toContain('-- No findings');
    expect(params).toHaveLength(0);
  });

  it('generateFactInsertSQL produces parameterized SQL with date_sk', () => {
    const findings: EvalFinding[] = [makeFinding()];
    const dateSk = 20260329;

    const { sql, params } = EvalOrchestrator.generateFactInsertSQL(findings, dateSk);

    expect(sql).toContain('INSERT INTO reporting.fact_eval_finding');
    expect(sql).toContain('dim_evaluator');
    expect(params).toHaveLength(6); // 6 params per finding
    expect(params[1]).toBe(dateSk);
  });

  it('generateFactInsertSQL handles empty findings', () => {
    const { sql, params } = EvalOrchestrator.generateFactInsertSQL([], 20260329);
    expect(sql).toContain('-- No findings');
    expect(params).toHaveLength(0);
  });

  it('SQL params contain no raw JSON (finding is stringified)', () => {
    const findings = [makeFinding()];
    const { params } = EvalOrchestrator.generateInsertSQL(findings);
    // The finding JSON should be stringified, not a raw object
    const findingParam = params[2];
    expect(typeof findingParam).toBe('string');
    expect(() => JSON.parse(findingParam as string)).not.toThrow();
  });
});
