import { toRoundId } from '../types/core.js';
import type { RoundId } from '../types/core.js';
import type { QualityDimension } from '../types/quality.js';

// ─── Round Definition Interface ──────────────────────────────────────────────

export interface ContextDeltaTemplate {
  readonly focusPatterns: readonly string[];
  readonly extractionTargets: readonly string[];
  readonly antiPatterns: readonly string[];
}

export interface RoundDefinition {
  readonly id: RoundId;
  readonly name: string;
  readonly goal: string;
  readonly targetRepos: readonly string[];
  readonly qualityThreshold: number;
  readonly minPerDimension: Partial<Record<QualityDimension, number>>;
  readonly prerequisites: readonly RoundId[];
  readonly contextDeltaTemplate: ContextDeltaTemplate;
}

// ─── Round 01: Foundation ────────────────────────────────────────────────────

export const round01: RoundDefinition = {
  id: toRoundId('round-01'),
  name: 'foundation',
  goal: 'Extract base dispatch types and unified inference interface',
  targetRepos: [
    'safety-tooling',
    'mcp-python-sdk',
    'mcp-typescript-sdk',
  ],
  qualityThreshold: 0.60,
  minPerDimension: {
    completeness: 0.55,
    structure: 0.60,
    accuracy: 0.60,
    coherence: 0.50,
    safety: 0.65,
  },
  prerequisites: [],
  contextDeltaTemplate: {
    focusPatterns: [
      'InferenceAPI',
      'ChatMessage',
      'Prompt',
      'FastMCP',
      'handler',
      'Tool',
      'Resource',
      'MessageParam',
      'ContentBlock',
      'StopReason',
    ],
    extractionTargets: [
      'Type definitions for API request/response shapes',
      'Error handling patterns and error categories',
      'Token counting and cost tracking interfaces',
      'MCP tool and resource definition patterns',
      'Handler registration and dispatch patterns',
      'Prompt template structures',
      'Message role and content block types',
    ],
    antiPatterns: [
      'Internal implementation details not exposed via public API',
      'Test-only utilities and mock objects',
      'Deprecated or legacy type aliases',
      'Platform-specific transport implementations',
    ],
  },
};
