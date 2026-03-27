import type { RoundId } from './core.js';

// ─── Quality Dimensions ──────────────────────────────────────────────────────

export type QualityDimension =
  | 'completeness'
  | 'structure'
  | 'accuracy'
  | 'coherence'
  | 'safety';

// ─── DimensionScore ──────────────────────────────────────────────────────────

export interface DimensionScore {
  readonly dimension: QualityDimension;
  readonly value: number;
  readonly confidence: number;
  readonly weight: number;
}

// ─── QualityScore ────────────────────────────────────────────────────────────

export interface QualityScore {
  readonly dimensions: readonly DimensionScore[];
  readonly overall: number;
  readonly overallConfidence: number;
}

// ─── QualityThreshold ────────────────────────────────────────────────────────

export interface QualityThreshold {
  readonly roundId: RoundId;
  readonly minOverall: number;
  readonly minPerDimension: Record<QualityDimension, number>;
}

// ─── Context Delta Payload ───────────────────────────────────────────────────

export interface ContextDeltaPayload {
  readonly iteration: number;
  readonly newPatterns: readonly string[];
  readonly failingStrategies: readonly string[];
  readonly qualityBefore: number;
  readonly qualityAfter: number;
  readonly steerDirection: string;
  readonly discoveredTypes: readonly string[];
}

// ─── Quality Feedback ────────────────────────────────────────────────────────

export interface QualityFeedback {
  readonly dimension: QualityDimension;
  readonly score: number;
  readonly suggestion: string;
}
