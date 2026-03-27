import type {
  DispatchId,
  ModelId,
  USD,
  TokenUsage,
  AgentId,
} from './core.js';
import { assertNever } from './core.js';

// ─── DispatchTask Discriminated Union ────────────────────────────────────────

export type DispatchTask =
  | SimpleTask
  | ParallelTask
  | SequentialTask
  | ConditionalTask;

export interface SimpleTask {
  readonly type: 'simple';
  readonly objective: string;
  readonly model: ModelId;
}

export interface ParallelTask {
  readonly type: 'parallel';
  readonly tasks: readonly DispatchTask[];
}

export interface SequentialTask {
  readonly type: 'sequential';
  readonly tasks: readonly DispatchTask[];
}

export interface ConditionalTask {
  readonly type: 'conditional';
  readonly condition: string;
  readonly ifTrue: DispatchTask;
  readonly ifFalse: DispatchTask;
}

// ─── DispatchPlan ────────────────────────────────────────────────────────────

export interface DispatchPlan {
  readonly id: DispatchId;
  readonly tasks: readonly DispatchTask[];
  readonly budget: USD;
  readonly maxAgents: number;
  readonly timeline: {
    readonly estimatedDurationMs: number;
    readonly createdAt: Date;
    readonly deadline?: Date;
  };
}

// ─── DispatchResult ──────────────────────────────────────────────────────────

export interface DispatchResult {
  readonly id: DispatchId;
  readonly outputs: readonly string[];
  readonly qualityScore: number;
  readonly usage: TokenUsage;
  readonly duration: number;
}

// ─── DispatchState Machine ───────────────────────────────────────────────────

export type DispatchState =
  | { readonly status: 'idle' }
  | { readonly status: 'planning'; readonly planStartedAt: Date }
  | { readonly status: 'dispatching'; readonly plan: DispatchPlan }
  | { readonly status: 'executing'; readonly plan: DispatchPlan; readonly activeAgents: readonly AgentId[] }
  | { readonly status: 'scoring'; readonly plan: DispatchPlan; readonly rawOutputs: readonly string[] }
  | { readonly status: 'complete'; readonly result: DispatchResult }
  | { readonly status: 'error'; readonly error: string; readonly failedAt: DispatchState['status'] };

/**
 * Exhaustive handler for all dispatch states.
 * Uses assertNever to guarantee compile-time exhaustiveness.
 */
export function handleDispatchState(state: DispatchState): string {
  switch (state.status) {
    case 'idle':
      return 'Dispatch is idle, awaiting tasks.';
    case 'planning':
      return `Planning started at ${state.planStartedAt.toISOString()}.`;
    case 'dispatching':
      return `Dispatching plan ${state.plan.id} with ${state.plan.tasks.length} tasks.`;
    case 'executing':
      return `Executing with ${state.activeAgents.length} active agents.`;
    case 'scoring':
      return `Scoring ${state.rawOutputs.length} outputs.`;
    case 'complete':
      return `Complete. Quality: ${state.result.qualityScore.toFixed(2)}, Duration: ${state.result.duration}ms.`;
    case 'error':
      return `Error during ${state.failedAt}: ${state.error}`;
    default:
      return assertNever(state);
  }
}

// ─── Platform Target ─────────────────────────────────────────────────────────

export type PlatformTarget = 'cli' | 'github_actions' | 'chrome' | 'slack';
