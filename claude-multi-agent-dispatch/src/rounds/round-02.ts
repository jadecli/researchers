import { toRoundId } from '../types/core.js';
import type { RoundDefinition } from './round-01.js';

// ─── Round 02: Shannon Thinking ──────────────────────────────────────────────

export const round02: RoundDefinition = {
  id: toRoundId('round-02'),
  name: 'shannon-thinking',
  goal: 'Build structured thinking MCP server for dispatch decisions',
  targetRepos: [
    'shannon-thinking',
  ],
  qualityThreshold: 0.65,
  minPerDimension: {
    completeness: 0.60,
    structure: 0.65,
    accuracy: 0.65,
    coherence: 0.60,
    safety: 0.60,
  },
  prerequisites: [
    toRoundId('round-01'),
  ],
  contextDeltaTemplate: {
    focusPatterns: [
      'ThinkingEngine',
      'ShannonThought',
      'ThoughtChain',
      'Assumption',
      'ThoughtType',
      'calibrateConfidence',
      'resolveOrder',
      'topological',
      'MCP tool',
      'MCP resource',
    ],
    extractionTargets: [
      'Thought dependency graph management patterns',
      'Topological sort implementation for thought ordering',
      'Confidence calibration algorithms',
      'Assumption lifecycle management (active/challenged/invalidated)',
      'MCP server tool registration patterns',
      'MCP resource exposure for methodology documentation',
      'Revision tracking and thought chain synthesis',
      'Structured thinking report generation',
    ],
    antiPatterns: [
      'Hardcoded confidence values without calibration',
      'Thoughts without explicit dependency declarations',
      'Assumptions without status tracking',
      'Circular dependency creation in thought chains',
      'MCP tools without proper error handling',
      'Unvalidated confidence/uncertainty bounds',
    ],
  },
};
