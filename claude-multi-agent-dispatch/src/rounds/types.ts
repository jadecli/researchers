import type { RoundId } from '../types/core.js';
import type { QualityScore, ContextDeltaPayload } from '../types/quality.js';

// ─── RoundDefinition ────────────────────────────────────────────────────────

export interface RoundDefinition {
  number: number;
  id: RoundId;
  name: string;
  goal: string;
  targetRepos: string[];
  qualityThreshold: number;
  prerequisites: RoundId[];
  contextDeltaTemplate: Partial<ContextDeltaPayload>;
}

// ─── RoundResult ────────────────────────────────────────────────────────────

export interface RoundResult {
  roundId: RoundId;
  qualityScore: QualityScore;
  extractedPatterns: string[];
  contextDelta: ContextDeltaPayload;
  duration: number;
  eventsLogPath: string;
}
