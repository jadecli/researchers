import { toRoundId } from '../types/core.js';
import type { RoundDefinition } from './types.js';

// ─── Round 10: Safety + Validation ──────────────────────────────────────────
// Extracts safety validation patterns: SSRF prevention, PII detection,
// injection scanning, and pre/post dispatch validation.

export const ROUND_10: RoundDefinition = {
  number: 10,
  id: toRoundId('round-10'),
  name: 'Safety + Validation',
  goal: 'Extract safety validation patterns: SSRF scanning with private range detection, PII scanning with Luhn validation, injection pattern matching, and comprehensive pre/post dispatch validation.',
  targetRepos: [
    'anthropics/anthropic-cookbook',
    'modelcontextprotocol/servers',
    'anthropics/courses',
  ],
  qualityThreshold: 0.85,
  prerequisites: [toRoundId('round-09')],
  contextDeltaTemplate: {
    steerDirection: 'Focus on security scanning patterns, PII detection, SSRF prevention, and validation pipelines',
    discoveredTypes: ['security_scanner', 'pii_pattern', 'ssrf_rule', 'validation_pipeline'],
  },
};
