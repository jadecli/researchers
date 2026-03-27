import { toRoundId } from '../types/core.js';
import type { RoundDefinition } from './types.js';

// ─── Round 8: Refinement Engine ─────────────────────────────────────────────
// Extracts refinement and iterative improvement patterns.
// Builds the seed improvement and selector evolution systems.

export const ROUND_08: RoundDefinition = {
  number: 8,
  id: toRoundId('round-08'),
  name: 'Refinement Engine',
  goal: 'Extract iterative refinement patterns: seed improvement strategies, selector evolution heuristics, context delta accumulation, and convergence detection.',
  targetRepos: [
    'anthropics/anthropic-cookbook',
    'modelcontextprotocol/servers',
    'anthropics/courses',
  ],
  qualityThreshold: 0.80,
  prerequisites: [toRoundId('round-07')],
  contextDeltaTemplate: {
    steerDirection: 'Focus on iterative improvement loops, convergence criteria, and feedback integration',
    discoveredTypes: ['refinement_strategy', 'convergence_pattern', 'feedback_loop'],
  },
};
