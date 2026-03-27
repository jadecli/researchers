import { describe, it, expect } from 'vitest';
import { SeedImprover } from '../src/refinement/seed-improver.js';
import { SelectorEvolver } from '../src/refinement/selector-evolution.js';
import { ContextDeltaAccumulator } from '../src/refinement/context-delta.js';

// ─── SeedImprover tests ─────────────────────────────────────────────────────

describe('SeedImprover', () => {
  it('should improve seed score over iterations', async () => {
    // Mock evaluator that rewards longer, more structured content
    const evaluator = async (seed: string): Promise<number> => {
      const length = Math.min(1, seed.length / 500);
      const hasHeadings = /^##/m.test(seed) ? 0.2 : 0;
      const hasList = /^-/m.test(seed) ? 0.1 : 0;
      return Math.min(1, length * 0.5 + hasHeadings + hasList + 0.2);
    };

    const improver = new SeedImprover(evaluator, 0.9);
    const result = await improver.improve('Hello world', 5);

    expect(result.improvedScore).toBeGreaterThanOrEqual(result.originalScore);
    expect(result.iterationsUsed).toBeGreaterThan(0);
    expect(result.iterationsUsed).toBeLessThanOrEqual(5);
    expect(result.originalSeed).toBe('Hello world');
    expect(['target_met', 'stagnant', 'max_iterations']).toContain(
      result.convergenceReason,
    );
  });

  it('should detect stagnation and stop early', async () => {
    // Evaluator that always returns the same score
    const evaluator = async (_seed: string): Promise<number> => 0.5;

    const improver = new SeedImprover(evaluator, 0.9);
    const result = await improver.improve('test', 20);

    expect(result.convergenceReason).toBe('stagnant');
    expect(result.iterationsUsed).toBeLessThan(20);
  });

  it('should detect regression', () => {
    const improver = new SeedImprover(async () => 0.5);
    // Descending history
    expect(improver.detectRegression([0.8, 0.7, 0.6])).toBe(true);
    // Non-descending
    expect(improver.detectRegression([0.6, 0.7, 0.8])).toBe(false);
    // Too short
    expect(improver.detectRegression([0.8, 0.7])).toBe(false);
  });

  it('should generate candidate variations', () => {
    const improver = new SeedImprover(async () => 0.5);
    const candidates = improver.generateCandidates('test seed', 5);
    expect(candidates).toHaveLength(5);
    expect(candidates.every((c) => c.length > 0)).toBe(true);
  });
});

// ─── SelectorEvolver tests ──────────────────────────────────────────────────

describe('SelectorEvolver', () => {
  it('should record and evolve weights', () => {
    const evolver = new SelectorEvolver();
    evolver.record('agent-1', 'research', 0.9);
    evolver.record('agent-1', 'research', 0.85);
    evolver.record('agent-1', 'coding', 0.4);
    evolver.record('agent-2', 'research', 0.6);

    const patches = evolver.evolve();
    expect(patches.length).toBeGreaterThan(0);

    // Agent-1 should have a positive patch for research
    const researchPatch = patches.find(
      (p) => p.agentId === 'agent-1' && p.dimension === 'research',
    );
    expect(researchPatch).toBeDefined();
    expect(researchPatch!.newWeight).toBeGreaterThan(researchPatch!.oldWeight);
  });

  it('should find best agent for task type', () => {
    const evolver = new SelectorEvolver();
    evolver.record('agent-1', 'research', 0.9);
    evolver.record('agent-2', 'research', 0.7);
    evolver.record('agent-3', 'research', 0.5);

    expect(evolver.getBestAgent('research')).toBe('agent-1');
  });

  it('should find worst dimension for agent', () => {
    const evolver = new SelectorEvolver();
    evolver.record('agent-1', 'research', 0.9);
    evolver.record('agent-1', 'coding', 0.3);
    evolver.record('agent-1', 'writing', 0.6);

    expect(evolver.getWorstDimension('agent-1')).toBe('coding');
  });

  it('should apply patches to profiles', () => {
    const evolver = new SelectorEvolver();
    const profiles = [
      {
        agentId: 'agent-1',
        capabilities: { research: 0.5, coding: 0.5 },
        taskTypes: ['research', 'coding'],
      },
    ];

    const patches = [
      {
        agentId: 'agent-1',
        dimension: 'research',
        oldWeight: 0.5,
        newWeight: 0.8,
        reason: 'Strong performance',
      },
    ];

    const updated = evolver.applyPatches(profiles, patches);
    expect(updated[0]!.capabilities['research']).toBe(0.8);
    expect(updated[0]!.capabilities['coding']).toBe(0.5); // unchanged
  });
});

// ─── ContextDeltaAccumulator tests ──────────────────────────────────────────

describe('ContextDeltaAccumulator', () => {
  it('should accumulate deltas and produce cumulative', () => {
    const acc = new ContextDeltaAccumulator(0.85);

    acc.add({
      iteration: 1,
      newPatterns: ['pattern-1'],
      failingStrategies: ['strategy-A'],
      qualityBefore: 0.3,
      qualityAfter: 0.5,
      steerDirection: 'improve completeness',
      discoveredTypes: ['type-A'],
    });

    acc.add({
      iteration: 2,
      newPatterns: ['pattern-2'],
      failingStrategies: ['strategy-B'],
      qualityBefore: 0.5,
      qualityAfter: 0.7,
      steerDirection: 'improve accuracy',
      discoveredTypes: ['type-B'],
    });

    const cumulative = acc.getCumulativeDelta();
    expect(cumulative.iteration).toBe(2);
    expect(cumulative.newPatterns).toContain('pattern-1');
    expect(cumulative.newPatterns).toContain('pattern-2');
    expect(cumulative.qualityBefore).toBe(0.3);
    expect(cumulative.qualityAfter).toBe(0.7);
    expect(cumulative.steerDirection).toBe('improve accuracy');
  });

  it('should detect when to stop (threshold met)', () => {
    const acc = new ContextDeltaAccumulator(0.8);
    acc.add({
      iteration: 1,
      newPatterns: [],
      failingStrategies: [],
      qualityBefore: 0.5,
      qualityAfter: 0.85,
      steerDirection: 'done',
      discoveredTypes: [],
    });

    expect(acc.shouldContinue()).toBe(false);
  });

  it('should detect stagnation', () => {
    const acc = new ContextDeltaAccumulator(0.9);

    for (let i = 0; i < 3; i++) {
      acc.add({
        iteration: i + 1,
        newPatterns: [],
        failingStrategies: [],
        qualityBefore: 0.5,
        qualityAfter: 0.5,
        steerDirection: 'stuck',
        discoveredTypes: [],
      });
    }

    expect(acc.shouldContinue()).toBe(false);
  });

  it('should continue when improving', () => {
    const acc = new ContextDeltaAccumulator(0.9);
    acc.add({
      iteration: 1,
      newPatterns: [],
      failingStrategies: [],
      qualityBefore: 0.3,
      qualityAfter: 0.5,
      steerDirection: 'improving',
      discoveredTypes: [],
    });

    expect(acc.shouldContinue()).toBe(true);
  });

  it('should inject context as prompt fragment', () => {
    const acc = new ContextDeltaAccumulator(0.9);
    acc.add({
      iteration: 1,
      newPatterns: ['found type system'],
      failingStrategies: ['naive parsing'],
      qualityBefore: 0.3,
      qualityAfter: 0.5,
      steerDirection: 'improve completeness',
      discoveredTypes: [],
    });

    const context = acc.injectContext(2);
    expect(context).toContain('Context from round 2');
    expect(context).toContain('found type system');
    expect(context).toContain('0.30');
    expect(context).toContain('0.50');
    expect(context).toContain('improve completeness');
    expect(context).toContain('naive parsing');
  });

  it('should reset accumulated state', () => {
    const acc = new ContextDeltaAccumulator(0.9);
    acc.add({
      iteration: 1,
      newPatterns: [],
      failingStrategies: [],
      qualityBefore: 0,
      qualityAfter: 0.5,
      steerDirection: '',
      discoveredTypes: [],
    });

    acc.reset();
    expect(acc.getHistory()).toHaveLength(0);
    expect(acc.getCumulativeDelta().iteration).toBe(0);
  });
});
