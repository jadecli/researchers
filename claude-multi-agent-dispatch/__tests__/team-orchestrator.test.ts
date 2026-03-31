import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  TeamOrchestrator,
  createRedTeamAgents,
  createBlueTeamAgents,
  createWhiteTeamAgents,
  createEngineeringAgents,
  createResearchAgents,
  type TeamConfig,
  type TeamRole,
  type Finding,
} from '../src/orchestrator/team-orchestrator.js';
import { toDispatchId, toUSD, toTokenCount } from '../src/types/core.js';
import type { DispatchPlan } from '../src/types/dispatch.js';

// ── Agent Definitions ──────────────────────────────────────

describe('Team Agent Definitions', () => {
  it('red team has 3 agents with security capabilities', () => {
    const agents = createRedTeamAgents();
    expect(agents).toHaveLength(3);
    expect(agents.map((a) => a.capability)).toContain('vulnerability-scanning');
    expect(agents.map((a) => a.capability)).toContain('attack-surface-analysis');
    expect(agents.map((a) => a.capability)).toContain('supply-chain-audit');
    expect(agents.every((a) => a.role === 'red')).toBe(true);
  });

  it('blue team has 3 agents with defensive capabilities', () => {
    const agents = createBlueTeamAgents();
    expect(agents).toHaveLength(3);
    expect(agents.map((a) => a.capability)).toContain('type-safety-enforcement');
    expect(agents.map((a) => a.capability)).toContain('error-handling-audit');
    expect(agents.map((a) => a.capability)).toContain('architecture-compliance');
  });

  it('white team has 2 agents for functionality', () => {
    const agents = createWhiteTeamAgents();
    expect(agents).toHaveLength(2);
    expect(agents.map((a) => a.capability)).toContain('integration-testing');
    expect(agents.map((a) => a.capability)).toContain('feature-gap-analysis');
  });

  it('engineering team has 2 agents for pipeline ops', () => {
    const agents = createEngineeringAgents();
    expect(agents).toHaveLength(2);
    expect(agents.map((a) => a.capability)).toContain('pipeline-validation');
    expect(agents.map((a) => a.capability)).toContain('performance-profiling');
  });

  it('research team has 2 agents for knowledge extraction', () => {
    const agents = createResearchAgents();
    expect(agents).toHaveLength(2);
    expect(agents.map((a) => a.capability)).toContain('frontier-paper-crawl');
    expect(agents.map((a) => a.capability)).toContain('knowledge-synthesis');
  });

  it('all agents have unique IDs', () => {
    const orchestrator = new TeamOrchestrator();
    const allAgents = orchestrator.getAllAgents();
    const ids = allAgents.map((a) => String(a.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all agents have non-empty prompts', () => {
    const orchestrator = new TeamOrchestrator();
    const allAgents = orchestrator.getAllAgents();
    for (const agent of allAgents) {
      expect(agent.prompt.length).toBeGreaterThan(50);
    }
  });

  it('total agent count is 12 across all teams', () => {
    const orchestrator = new TeamOrchestrator();
    expect(orchestrator.getAllAgents()).toHaveLength(12);
  });
});

// ── Team Orchestrator ──────────────────────────────────────

describe('TeamOrchestrator', () => {
  let tmpDir: string;
  let orchestrator: TeamOrchestrator;

  const mockPlan: DispatchPlan = {
    id: toDispatchId('plan-1'),
    tasks: [{ type: 'simple', objective: 'scan', model: 'claude-sonnet-4-6' }],
    budget: toUSD(1.0),
    maxAgents: 3,
    timeline: { estimatedDurationMs: 5000, createdAt: new Date() },
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-orch-test-'));
    orchestrator = new TeamOrchestrator(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('starts in idle state', () => {
    expect(orchestrator.getState().status).toBe('idle');
  });

  it('getAgentsForTeam returns correct agents per role', () => {
    const roles: TeamRole[] = ['red', 'blue', 'white', 'engineering', 'research'];
    const expected = [3, 3, 2, 2, 2];

    for (let i = 0; i < roles.length; i++) {
      const agents = orchestrator.getAgentsForTeam(roles[i]!);
      expect(agents).toHaveLength(expected[i]!);
      expect(agents.every((a) => a.role === roles[i])).toBe(true);
    }
  });

  it('pre-sweep gate passes with valid config', () => {
    const config: TeamConfig = {
      role: 'red',
      model: 'opus',
      agentCount: 3,
      targetUrls: ['https://example.com'],
      targetPaths: [],
      sweepConfig: {},
    };
    const result = orchestrator.runPreSweepGate(config);
    expect(result.ok).toBe(true);
  });

  it('pre-sweep gate fails with zero agents', () => {
    const config: TeamConfig = {
      role: 'red',
      model: 'opus',
      agentCount: 0,
      targetUrls: ['https://example.com'],
      targetPaths: [],
      sweepConfig: {},
    };
    const result = orchestrator.runPreSweepGate(config);
    expect(result.ok).toBe(false);
  });

  it('pre-sweep gate fails with no targets', () => {
    const config: TeamConfig = {
      role: 'red',
      model: 'opus',
      agentCount: 3,
      targetUrls: [],
      targetPaths: [],
      sweepConfig: {},
    };
    const result = orchestrator.runPreSweepGate(config);
    expect(result.ok).toBe(false);
  });

  it('full sweep lifecycle: plan → start → record → complete', () => {
    // Plan
    const r1 = orchestrator.planSweep({
      role: 'red',
      model: 'opus',
      agentCount: 3,
      targetUrls: ['https://example.com'],
      targetPaths: [],
      sweepConfig: {},
    });
    expect(r1.ok).toBe(true);
    expect(orchestrator.getState().status).toBe('planning');

    // Start
    const agents = createRedTeamAgents();
    const r2 = orchestrator.startSweep(mockPlan, agents);
    expect(r2.ok).toBe(true);
    expect(orchestrator.getState().status).toBe('executing');

    // Record findings
    const finding: Finding = {
      id: 'f1',
      teamRole: 'red',
      severity: 'high',
      category: 'xss',
      title: 'Reflected XSS in search param',
      description: 'User input not sanitized',
      filePath: 'src/api/search.ts',
      lineNumber: 42,
      agentId: 'red-scanner',
      confidence: 0.95,
    };
    orchestrator.recordFinding(finding);
    expect(orchestrator.getFindings()).toHaveLength(1);

    // Complete
    const r3 = orchestrator.completeSweep(['output-1'], 0.85, 3000);
    expect(r3.ok).toBe(true);
    if (r3.ok) {
      expect(r3.value.status).toBe('complete');
      expect(r3.value.findings).toHaveLength(1);
      expect(r3.value.qualityScore).toBe(0.85);
    }
    expect(orchestrator.getState().status).toBe('complete');
  });

  it('failSweep transitions to error with context', () => {
    orchestrator.planSweep({
      role: 'blue',
      model: 'sonnet',
      agentCount: 2,
      targetUrls: ['https://example.com'],
      targetPaths: [],
      sweepConfig: {},
    });

    const result = orchestrator.failSweep('timeout');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('error');
    }
  });

  it('blocks invalid state transitions', () => {
    // Can't start sweep without planning first
    const agents = createRedTeamAgents();
    const r = orchestrator.startSweep(mockPlan, agents);
    expect(r.ok).toBe(false);
  });
});
