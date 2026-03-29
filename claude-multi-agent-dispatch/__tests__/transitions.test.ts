import { describe, it, expect } from 'vitest';
import {
  isValidTransition,
  transitionToPlanning,
  transitionToDispatching,
  transitionToExecuting,
  transitionToScoring,
  transitionToComplete,
  transitionToError,
  transitionToIdle,
  runSentinelGate,
  type SentinelCheck,
} from '../src/orchestrator/transitions.js';
import type { DispatchState, DispatchPlan, DispatchResult } from '../src/types/dispatch.js';
import { toDispatchId, toUSD, toTokenCount, toAgentId } from '../src/types/core.js';

// ── Helpers ──────────────────────────────────────────────────────

const mockPlan: DispatchPlan = {
  id: toDispatchId('plan-1'),
  tasks: [{ type: 'simple', objective: 'test', model: 'claude-sonnet-4-20250514' }],
  budget: toUSD(1.0),
  maxAgents: 3,
  timeline: {
    estimatedDurationMs: 5000,
    createdAt: new Date(),
  },
};

const mockResult: DispatchResult = {
  id: toDispatchId('plan-1'),
  outputs: ['output-1'],
  qualityScore: 0.85,
  usage: {
    inputTokens: toTokenCount(100),
    outputTokens: toTokenCount(50),
    cacheReadTokens: toTokenCount(0),
    cacheWriteTokens: toTokenCount(0),
    totalCost: toUSD(0.01),
  },
  duration: 3000,
};

// ── Transition Validation ────────────────────────────────────────

describe('isValidTransition', () => {
  it('allows idle → planning', () => {
    expect(isValidTransition('idle', 'planning')).toBe(true);
  });

  it('allows planning → dispatching', () => {
    expect(isValidTransition('planning', 'dispatching')).toBe(true);
  });

  it('allows any non-complete → error', () => {
    expect(isValidTransition('idle', 'error')).toBe(true);
    expect(isValidTransition('planning', 'error')).toBe(true);
    expect(isValidTransition('executing', 'error')).toBe(true);
  });

  it('blocks complete → anything', () => {
    expect(isValidTransition('complete', 'idle')).toBe(false);
    expect(isValidTransition('complete', 'error')).toBe(false);
  });

  it('blocks idle → complete (skip states)', () => {
    expect(isValidTransition('idle', 'complete')).toBe(false);
  });

  it('blocks idle → executing (skip states)', () => {
    expect(isValidTransition('idle', 'executing')).toBe(false);
  });

  it('allows error → idle (retry)', () => {
    expect(isValidTransition('error', 'idle')).toBe(true);
  });
});

// ── Guarded Transitions ──────────────────────────────────────────

describe('Guarded Transitions', () => {
  it('transitionToPlanning succeeds from idle', () => {
    const state: DispatchState = { status: 'idle' };
    const result = transitionToPlanning(state);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe('planning');
  });

  it('transitionToPlanning fails from executing', () => {
    const state: DispatchState = { status: 'executing', plan: mockPlan, activeAgents: [] };
    const result = transitionToPlanning(state);
    expect(result.ok).toBe(false);
  });

  it('transitionToDispatching succeeds from planning', () => {
    const state: DispatchState = { status: 'planning', planStartedAt: new Date() };
    const result = transitionToDispatching(state, mockPlan);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe('dispatching');
  });

  it('transitionToExecuting succeeds from dispatching', () => {
    const state: DispatchState = { status: 'dispatching', plan: mockPlan };
    const agents = [toAgentId('agent-1')];
    const result = transitionToExecuting(state, agents);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('executing');
    }
  });

  it('transitionToScoring succeeds from executing', () => {
    const state: DispatchState = { status: 'executing', plan: mockPlan, activeAgents: [] };
    const result = transitionToScoring(state, ['output-1']);
    expect(result.ok).toBe(true);
  });

  it('transitionToComplete succeeds from scoring', () => {
    const state: DispatchState = { status: 'scoring', plan: mockPlan, rawOutputs: ['x'] };
    const result = transitionToComplete(state, mockResult);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe('complete');
  });

  it('transitionToError fails from complete (terminal)', () => {
    const state: DispatchState = { status: 'complete', result: mockResult };
    const result = transitionToError(state, 'late error');
    expect(result.ok).toBe(false);
  });

  it('transitionToError succeeds from executing', () => {
    const state: DispatchState = { status: 'executing', plan: mockPlan, activeAgents: [] };
    const result = transitionToError(state, 'timeout');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('error');
      if (result.value.status === 'error') {
        expect(result.value.failedAt).toBe('executing');
      }
    }
  });

  it('transitionToIdle succeeds from error', () => {
    const state: DispatchState = { status: 'error', error: 'oops', failedAt: 'planning' };
    const result = transitionToIdle(state);
    expect(result.ok).toBe(true);
  });

  it('transitionToIdle fails from idle (already idle)', () => {
    const state: DispatchState = { status: 'idle' };
    const result = transitionToIdle(state);
    expect(result.ok).toBe(false);
  });

  it('full lifecycle: idle → planning → dispatching → executing → scoring → complete', () => {
    let state: DispatchState = { status: 'idle' };

    const r1 = transitionToPlanning(state);
    expect(r1.ok).toBe(true);
    if (r1.ok) state = r1.value;

    const r2 = transitionToDispatching(state, mockPlan);
    expect(r2.ok).toBe(true);
    if (r2.ok) state = r2.value;

    const r3 = transitionToExecuting(state, [toAgentId('a1')]);
    expect(r3.ok).toBe(true);
    if (r3.ok) state = r3.value;

    const r4 = transitionToScoring(state, ['out']);
    expect(r4.ok).toBe(true);
    if (r4.ok) state = r4.value;

    const r5 = transitionToComplete(state, mockResult);
    expect(r5.ok).toBe(true);
    if (r5.ok) expect(r5.value.status).toBe('complete');
  });
});

// ── Sentinel Gate ────────────────────────────────────────────────

describe('Sentinel Gate', () => {
  it('passes when all checks pass', () => {
    const checks: SentinelCheck[] = [
      { name: 'budget', check: () => true },
      { name: 'safety', check: () => true },
    ];
    const result = runSentinelGate(checks);
    expect(result.passed).toBe(true);
    expect(result.checks).toHaveLength(2);
  });

  it('fails when any check fails', () => {
    const checks: SentinelCheck[] = [
      { name: 'budget', check: () => true },
      { name: 'safety', check: () => false },
    ];
    const result = runSentinelGate(checks);
    expect(result.passed).toBe(false);
    expect(result.failedAt).toBe('safety');
  });

  it('fail-closed: exception counts as failure', () => {
    const checks: SentinelCheck[] = [
      { name: 'unstable', check: () => { throw new Error('boom'); } },
    ];
    const result = runSentinelGate(checks);
    expect(result.passed).toBe(false);
    expect(result.failedAt).toBe('unstable');
  });

  it('short-circuits on first failure', () => {
    let secondRan = false;
    const checks: SentinelCheck[] = [
      { name: 'first', check: () => false },
      { name: 'second', check: () => { secondRan = true; return true; } },
    ];
    runSentinelGate(checks);
    expect(secondRan).toBe(false);
  });

  it('passes with empty checks', () => {
    const result = runSentinelGate([]);
    expect(result.passed).toBe(true);
  });
});
