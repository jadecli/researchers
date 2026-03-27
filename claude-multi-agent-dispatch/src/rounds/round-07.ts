import { toRoundId } from '../types/core.js';
import type { RoundDefinition } from './types.js';

// ─── Round 7: Quality Scoring ───────────────────────────────────────────────
// Extracts quality scoring patterns from target repos.
// Builds the quality assessment pipeline.

export const ROUND_07: RoundDefinition = {
  number: 7,
  id: toRoundId('round-07'),
  name: 'Quality Scoring',
  goal: 'Extract quality scoring patterns, build per-dimension scoring heuristics, calibrate confidence levels, and establish quality thresholds for each round.',
  targetRepos: [
    'anthropics/anthropic-cookbook',
    'modelcontextprotocol/servers',
    'anthropics/courses',
  ],
  qualityThreshold: 0.75,
  prerequisites: [toRoundId('round-06')],
  contextDeltaTemplate: {
    steerDirection: 'Focus on quality dimension weights, scoring heuristics, and threshold calibration',
    discoveredTypes: ['quality_dimension', 'scoring_heuristic', 'threshold_config'],
  },
};
