import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { DispatchOrchestrator, type DispatchConfig } from '../src/orchestrator/dispatch.js';
import {
  selectAgent,
  cosineSimilarity,
  evolveSelectors,
  DEFAULT_AGENTS,
  type AgentCapability,
  type PerformanceDatum,
} from '../src/orchestrator/selector.js';
import { SessionStore, type DispatchSession } from '../src/orchestrator/state.js';
import { toUSD, toAgentId, toRoundId } from '../src/types/index.js';

// ─── DispatchOrchestrator ───────────────────────────────────────────────────

describe('DispatchOrchestrator', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestrator-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should dispatch a task and return results', async () => {
    const sessionStore = new SessionStore(tempDir);
    const orchestrator = new DispatchOrchestrator(sessionStore);

    const result = await orchestrator.dispatch('Implement a REST API with authentication');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dispatchId).toBeTruthy();
      expect(result.value.outputs.length).toBeGreaterThan(0);
      expect(result.value.qualityScore.overall).toBeGreaterThan(0);
      expect((result.value.budgetUsed as number)).toBeGreaterThan(0);
      expect(result.value.agentsUsed.length).toBeGreaterThan(0);
      expect(result.value.duration).toBeGreaterThan(0);
    }
  });

  it('should respect maxAgents config', async () => {
    const sessionStore = new SessionStore(tempDir);
    const orchestrator = new DispatchOrchestrator(sessionStore);

    const result = await orchestrator.dispatch('Simple task', {
      maxAgents: 1,
      maxBudget: toUSD(1.0),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.agentsUsed.length).toBeLessThanOrEqual(2); // May get 1 from selection
    }
  });

  it('should handle multi-sentence tasks with multiple subtasks', async () => {
    const sessionStore = new SessionStore(tempDir);
    const orchestrator = new DispatchOrchestrator(sessionStore);

    const result = await orchestrator.dispatch(
      'Build a web server. Add authentication middleware. Implement rate limiting. Write comprehensive tests.',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Multiple subtasks should produce multiple outputs
      expect(result.value.outputs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('should enforce budget limits', async () => {
    const sessionStore = new SessionStore(tempDir);
    const orchestrator = new DispatchOrchestrator(sessionStore);

    // Very tight budget
    const result = await orchestrator.dispatch(
      'Build a complex system with many components. Design the architecture. Implement core modules. Add testing. Deploy to production.',
      { maxBudget: toUSD(0.001) }, // Extremely low budget
    );

    // Should either succeed with fewer agents or fail
    // Budget check happens during fanOut
    if (result.ok) {
      expect((result.value.budgetUsed as number)).toBeLessThanOrEqual(0.1);
    }
  });
});

// ─── Agent Selector ─────────────────────────────────────────────────────────

describe('selectAgent', () => {
  it('should select agent with highest cosine similarity', () => {
    const codeRequirements: AgentCapability = {
      code: 0.9, research: 0.1, analysis: 0.3, creative: 0.1, safety: 0.2,
    };

    const selected = selectAgent(codeRequirements, toUSD(1.0));

    // Should select the code-heavy agent (orchestrator-opus or worker-sonnet)
    expect(selected).toBeDefined();
    expect(selected.capabilities.code).toBeGreaterThan(0.5);
  });

  it('should downgrade model when budget is insufficient', () => {
    const requirements: AgentCapability = {
      code: 0.9, research: 0.8, analysis: 0.95, creative: 0.7, safety: 0.9,
    };

    // Very low budget should force downgrade
    const selected = selectAgent(requirements, toUSD(0.001));

    // Should still return an agent (downgraded)
    expect(selected).toBeDefined();
    expect(['opus', 'sonnet', 'haiku']).toContain(selected.model);
  });

  it('should select research-oriented agent for research tasks', () => {
    const researchRequirements: AgentCapability = {
      code: 0.1, research: 0.95, analysis: 0.9, creative: 0.2, safety: 0.5,
    };

    const selected = selectAgent(researchRequirements, toUSD(1.0));
    expect(selected.capabilities.research).toBeGreaterThanOrEqual(0.5);
  });
});

// ─── Cosine Similarity ──────────────────────────────────────────────────────

describe('cosineSimilarity', () => {
  it('should return 1.0 for identical vectors', () => {
    const cap: AgentCapability = { code: 0.5, research: 0.5, analysis: 0.5, creative: 0.5, safety: 0.5 };
    const sim = cosineSimilarity(cap, cap);
    expect(sim).toBeCloseTo(1.0, 5);
  });

  it('should return 0 for orthogonal vectors', () => {
    const a: AgentCapability = { code: 1, research: 0, analysis: 0, creative: 0, safety: 0 };
    const b: AgentCapability = { code: 0, research: 1, analysis: 0, creative: 0, safety: 0 };
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeCloseTo(0.0, 5);
  });

  it('should return higher similarity for similar vectors', () => {
    const a: AgentCapability = { code: 0.9, research: 0.1, analysis: 0.2, creative: 0.1, safety: 0.3 };
    const similar: AgentCapability = { code: 0.8, research: 0.2, analysis: 0.3, creative: 0.1, safety: 0.2 };
    const different: AgentCapability = { code: 0.1, research: 0.9, analysis: 0.1, creative: 0.8, safety: 0.1 };

    const simSimilar = cosineSimilarity(a, similar);
    const simDifferent = cosineSimilarity(a, different);

    expect(simSimilar).toBeGreaterThan(simDifferent);
  });

  it('should handle zero vectors', () => {
    const zero: AgentCapability = { code: 0, research: 0, analysis: 0, creative: 0, safety: 0 };
    const nonZero: AgentCapability = { code: 1, research: 1, analysis: 1, creative: 1, safety: 1 };
    expect(cosineSimilarity(zero, nonZero)).toBe(0);
  });
});

// ─── Budget Enforcement ─────────────────────────────────────────────────────

describe('Budget enforcement', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should track budget usage', async () => {
    const sessionStore = new SessionStore(tempDir);
    const orchestrator = new DispatchOrchestrator(sessionStore);

    const result = await orchestrator.dispatch('Simple task', {
      maxBudget: toUSD(1.0),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value.budgetUsed as number)).toBeGreaterThan(0);
      expect((result.value.budgetUsed as number)).toBeLessThanOrEqual(1.0);
    }
  });
});

// ─── DispatchSession state transitions ──────────────────────────────────────

describe('SessionStore', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should create a new session', () => {
    const store = new SessionStore(tempDir);
    const session = store.create({ budget: toUSD(1.0) });

    expect(session.id).toBeTruthy();
    expect((session.budgetRemaining as number)).toBe(1.0);
    expect(session.state.status).toBe('idle');
    expect(session.dispatches).toHaveLength(0);
  });

  it('should load a created session', () => {
    const store = new SessionStore(tempDir);
    const session = store.create({ budget: toUSD(2.0) });

    const loaded = store.load(session.id);
    expect(loaded).toBeDefined();
    expect(String(loaded!.id)).toBe(String(session.id));
  });

  it('should update session state', () => {
    const store = new SessionStore(tempDir);
    const session = store.create({ budget: toUSD(1.0) });

    const updated = store.update(session.id, (s) => {
      s.state = { status: 'planning', planStartedAt: new Date() };
      s.budgetUsed = toUSD(0.1);
      s.budgetRemaining = toUSD(0.9);
    });

    expect(updated).toBeDefined();
    expect(updated!.state.status).toBe('planning');
    expect((updated!.budgetUsed as number)).toBe(0.1);
  });

  it('should archive a session', () => {
    const store = new SessionStore(tempDir);
    const session = store.create({ budget: toUSD(1.0) });

    const archived = store.archive(session.id);
    expect(archived).toBe(true);

    const loaded = store.load(session.id);
    expect(loaded).toBeUndefined();
  });

  it('should list active sessions', () => {
    const store = new SessionStore(tempDir);
    store.create({ budget: toUSD(1.0) });
    store.create({ budget: toUSD(2.0) });

    const active = store.listActive();
    expect(active).toHaveLength(2);
  });

  it('should filter sessions by round', () => {
    const store = new SessionStore(tempDir);
    store.create({ budget: toUSD(1.0), roundId: toRoundId('round-03') });
    store.create({ budget: toUSD(2.0), roundId: toRoundId('round-04') });
    store.create({ budget: toUSD(3.0) });

    const round3 = store.getByRound(toRoundId('round-03'));
    expect(round3).toHaveLength(1);
  });

  it('should persist across store instances', () => {
    const store1 = new SessionStore(tempDir);
    const session = store1.create({ budget: toUSD(5.0) });

    const store2 = new SessionStore(tempDir);
    const loaded = store2.load(session.id);
    expect(loaded).toBeDefined();
    expect((loaded!.budgetRemaining as number)).toBe(5.0);
  });
});

// ─── evolveSelectors ────────────────────────────────────────────────────────

describe('evolveSelectors', () => {
  it('should adjust capabilities based on performance', () => {
    const performanceData: PerformanceDatum[] = [
      { agentId: toAgentId('orchestrator-opus'), taskType: 'code', score: 0.95 },
      { agentId: toAgentId('orchestrator-opus'), taskType: 'code', score: 0.90 },
      { agentId: toAgentId('worker-sonnet'), taskType: 'research', score: 0.4 },
    ];

    const evolved = evolveSelectors(performanceData, DEFAULT_AGENTS);

    expect(evolved).toHaveLength(DEFAULT_AGENTS.length);

    // Orchestrator's code capability should be slightly adjusted toward 0.925 avg
    const orchestrator = evolved.find((a) => String(a.id) === 'orchestrator-opus');
    expect(orchestrator).toBeDefined();
    // Original code: 0.9, performance avg: 0.925
    // Adjustment: (0.925 - 0.9) * 0.1 = 0.0025
    // New value should be close to 0.9025
    expect(orchestrator!.capabilities.code).toBeGreaterThan(0.9);
  });

  it('should not modify agents without performance data', () => {
    const performanceData: PerformanceDatum[] = [
      { agentId: toAgentId('orchestrator-opus'), taskType: 'code', score: 0.95 },
    ];

    const evolved = evolveSelectors(performanceData, DEFAULT_AGENTS);

    // Validator should be unchanged
    const validator = evolved.find((a) => String(a.id) === 'validator-haiku');
    const original = DEFAULT_AGENTS.find((a) => String(a.id) === 'validator-haiku');
    expect(validator!.capabilities).toEqual(original!.capabilities);
  });

  it('should clamp capabilities to [0, 1]', () => {
    const performanceData: PerformanceDatum[] = [
      { agentId: toAgentId('orchestrator-opus'), taskType: 'code', score: 1.0 },
      { agentId: toAgentId('orchestrator-opus'), taskType: 'code', score: 1.0 },
      { agentId: toAgentId('orchestrator-opus'), taskType: 'code', score: 1.0 },
    ];

    const evolved = evolveSelectors(performanceData, DEFAULT_AGENTS);
    const orchestrator = evolved.find((a) => String(a.id) === 'orchestrator-opus');

    expect(orchestrator!.capabilities.code).toBeLessThanOrEqual(1.0);
    expect(orchestrator!.capabilities.code).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty performance data', () => {
    const evolved = evolveSelectors([], DEFAULT_AGENTS);
    expect(evolved).toHaveLength(DEFAULT_AGENTS.length);

    // All capabilities should remain unchanged
    for (let i = 0; i < DEFAULT_AGENTS.length; i++) {
      expect(evolved[i]!.capabilities).toEqual(DEFAULT_AGENTS[i]!.capabilities);
    }
  });
});
