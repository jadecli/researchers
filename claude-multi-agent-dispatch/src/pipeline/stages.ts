import type {
  Result,
  QualityScore,
  QualityFeedback,
  ContextDeltaPayload,
  DispatchPlan,
} from '../types/index.js';

// ─── ApproachCandidate ──────────────────────────────────────────────────────
export interface ApproachCandidate {
  readonly description: string;
  readonly estimatedCost: number;
  readonly confidence: number;
  readonly tradeoffs: readonly string[];
}

// ─── PipelineStage discriminated union ──────────────────────────────────────
export type PipelineStage =
  | { readonly stage: 'analyze'; readonly input: string; readonly requirements: readonly string[] }
  | { readonly stage: 'approach'; readonly analysis: string; readonly candidates: readonly ApproachCandidate[] }
  | { readonly stage: 'execute'; readonly selectedApproach: string; readonly plan: DispatchPlan }
  | { readonly stage: 'evaluate'; readonly outputs: readonly string[]; readonly scores: QualityScore }
  | {
      readonly stage: 'refine';
      readonly evaluation: QualityScore;
      readonly feedback: readonly QualityFeedback[];
      readonly nextDelta: ContextDeltaPayload;
    };

// ─── StageResult ────────────────────────────────────────────────────────────
export type StageResult<T> = Result<
  { readonly output: T; readonly duration: number; readonly tokensUsed: number },
  Error
>;

// ─── PipelineState ──────────────────────────────────────────────────────────
export interface PipelineState {
  currentStage: PipelineStage['stage'];
  stageHistory: PipelineStage[];
  accumulatedContext: string;
  startTime: Date;
}

// ─── Stage name constants ───────────────────────────────────────────────────
export const STAGE_ORDER = [
  'analyze',
  'approach',
  'execute',
  'evaluate',
  'refine',
] as const;

export type StageName = (typeof STAGE_ORDER)[number];
