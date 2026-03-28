import type {
  SessionId,
  RoundId,
  DispatchId,
  ToolCallId,
  AgentId,
  AuditId,
} from './core.js';
import type { ContextDeltaPayload } from './quality.js';

// ─── Message ─────────────────────────────────────────────────────────────────

export interface Message {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly timestamp: Date;
}

// ─── Event Discriminated Union ───────────────────────────────────────────────

export type Event =
  | ToolCallEvent
  | ToolResultEvent
  | DecisionEvent
  | QualityScoreEvent
  | ContextDeltaEvent
  | DispatchEvent
  | AuditEvent
  | VariantCompletedEvent
  | ExperimentCompletedEvent;

export interface ToolCallEvent {
  readonly type: 'tool_call';
  readonly toolName: string;
  readonly input: Record<string, unknown>;
  readonly timestamp: Date;
}

export interface ToolResultEvent {
  readonly type: 'tool_result';
  readonly toolCallId: ToolCallId;
  readonly content: string;
  readonly isError: boolean;
  readonly timestamp: Date;
}

export interface DecisionEvent {
  readonly type: 'decision';
  readonly rationale: string;
  readonly confidence: number;
  readonly alternatives: readonly string[];
  readonly timestamp: Date;
}

export interface QualityScoreEvent {
  readonly type: 'quality_score';
  readonly scores: Record<string, number>;
  readonly overall: number;
  readonly timestamp: Date;
}

export interface ContextDeltaEvent {
  readonly type: 'context_delta';
  readonly delta: ContextDeltaPayload;
  readonly timestamp: Date;
}

export interface DispatchEvent {
  readonly type: 'dispatch';
  readonly dispatchId: DispatchId;
  readonly taskSummary: string;
  readonly agentIds: readonly AgentId[];
  readonly timestamp: Date;
}

export interface AuditEvent {
  readonly type: 'audit';
  readonly auditId: AuditId;
  readonly findings: readonly string[];
  readonly score: number;
  readonly timestamp: Date;
}

export interface VariantCompletedEvent {
  readonly type: 'variant_completed';
  readonly variantId: unknown;
  readonly strategy: string;
  readonly pagesCrawled: number;
  readonly toolCalls: number;
  readonly agentTurns: number;
  readonly qualityScore: unknown;
  readonly efficiencyRatio: number;
  readonly costUsd: number;
  readonly durationMs: number;
  readonly errors: readonly string[];
  readonly timestamp: Date;
}

export interface ExperimentCompletedEvent {
  readonly type: 'experiment_completed';
  readonly experimentId: unknown;
  readonly winner: unknown;
  readonly confidence: number;
  readonly variantCount: number;
  readonly timestamp: Date;
}

// ─── Transcript ──────────────────────────────────────────────────────────────

export interface TranscriptMetadata {
  readonly sessionId: SessionId;
  readonly roundId?: RoundId;
  readonly dispatchId?: DispatchId;
  readonly agentAssignments: ReadonlyMap<AgentId, string>;
}

export interface Transcript {
  readonly metadata: TranscriptMetadata;
  readonly messages: readonly Message[];
  readonly events: readonly Event[];
}
