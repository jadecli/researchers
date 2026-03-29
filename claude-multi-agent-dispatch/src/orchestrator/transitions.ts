// src/orchestrator/transitions.ts — Guarded dispatch state transitions
//
// Extracted patterns from oh-my-claudecode (Yeachan Heo):
//   - dispatch-status-state-machine: strict transition guards
//   - fail-closed-sentinel-gate: quality checks before dispatch
//
// Prevents illegal state jumps like idle→complete or scoring→planning.
// Boris Cherny patterns: discriminated unions, assertNever, Result<T,E>.

import type { DispatchState, DispatchPlan, DispatchResult } from '../types/dispatch.js';
import type { AgentId } from '../types/core.js';
import { Ok, Err, type Result } from '../types/core.js';

// ── Valid Transition Map ───────────────────────────────────────
// Each key is a current status; the value array lists valid next statuses.

type DispatchStatus = DispatchState['status'];

const VALID_TRANSITIONS: Record<DispatchStatus, readonly DispatchStatus[]> = {
  idle:        ['planning', 'error'],
  planning:    ['dispatching', 'error'],
  dispatching: ['executing', 'error'],
  executing:   ['scoring', 'error'],
  scoring:     ['complete', 'error'],
  complete:    [],           // terminal
  error:       ['idle'],     // can retry from error → idle
} as const;

/**
 * Check if a state transition is valid.
 */
export function isValidTransition(from: DispatchStatus, to: DispatchStatus): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed.includes(to);
}

// ── Guarded Transition Functions ───────────────────────────────
// Each returns Result<DispatchState> — no exceptions, no invalid jumps.

export function transitionToPlanning(current: DispatchState): Result<DispatchState, Error> {
  if (current.status !== 'idle') {
    return Err(new Error(
      `Cannot transition to planning from '${current.status}' (must be 'idle')`,
    ));
  }
  return Ok({ status: 'planning', planStartedAt: new Date() });
}

export function transitionToDispatching(
  current: DispatchState,
  plan: DispatchPlan,
): Result<DispatchState, Error> {
  if (current.status !== 'planning') {
    return Err(new Error(
      `Cannot transition to dispatching from '${current.status}' (must be 'planning')`,
    ));
  }
  return Ok({ status: 'dispatching', plan });
}

export function transitionToExecuting(
  current: DispatchState,
  activeAgents: readonly AgentId[],
): Result<DispatchState, Error> {
  if (current.status !== 'dispatching') {
    return Err(new Error(
      `Cannot transition to executing from '${current.status}' (must be 'dispatching')`,
    ));
  }
  return Ok({ status: 'executing', plan: current.plan, activeAgents });
}

export function transitionToScoring(
  current: DispatchState,
  rawOutputs: readonly string[],
): Result<DispatchState, Error> {
  if (current.status !== 'executing') {
    return Err(new Error(
      `Cannot transition to scoring from '${current.status}' (must be 'executing')`,
    ));
  }
  return Ok({ status: 'scoring', plan: current.plan, rawOutputs });
}

export function transitionToComplete(
  current: DispatchState,
  result: DispatchResult,
): Result<DispatchState, Error> {
  if (current.status !== 'scoring') {
    return Err(new Error(
      `Cannot transition to complete from '${current.status}' (must be 'scoring')`,
    ));
  }
  return Ok({ status: 'complete', result });
}

export function transitionToError(
  current: DispatchState,
  error: string,
): Result<DispatchState, Error> {
  if (current.status === 'complete') {
    return Err(new Error('Cannot transition to error from terminal state \'complete\''));
  }
  return Ok({ status: 'error', error, failedAt: current.status });
}

export function transitionToIdle(current: DispatchState): Result<DispatchState, Error> {
  if (current.status !== 'error') {
    return Err(new Error(
      `Cannot transition to idle from '${current.status}' (only error→idle allowed)`,
    ));
  }
  return Ok({ status: 'idle' });
}

// ── Sentinel Gate ──────────────────────────────────────────────
// Fail-closed quality check before dispatch. Must pass before
// transitioning from planning → dispatching.

export interface SentinelCheck {
  readonly name: string;
  readonly check: () => boolean;
}

export interface SentinelResult {
  readonly passed: boolean;
  readonly checks: ReadonlyArray<{ name: string; passed: boolean }>;
  readonly failedAt?: string;
}

/**
 * Run sentinel checks before allowing dispatch.
 * Fail-closed: if ANY check throws or returns false, dispatch is blocked.
 */
export function runSentinelGate(checks: readonly SentinelCheck[]): SentinelResult {
  const results: Array<{ name: string; passed: boolean }> = [];

  for (const check of checks) {
    let passed = false;
    try {
      passed = check.check();
    } catch {
      passed = false; // fail-closed
    }
    results.push({ name: check.name, passed });

    if (!passed) {
      return { passed: false, checks: results, failedAt: check.name };
    }
  }

  return { passed: true, checks: results };
}
