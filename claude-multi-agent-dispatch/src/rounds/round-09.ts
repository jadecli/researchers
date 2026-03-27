import { toRoundId } from '../types/core.js';
import type { RoundDefinition } from './types.js';

// ─── Round 9: Cross-Platform Dispatch ───────────────────────────────────────
// Extracts cross-platform dispatch patterns for CLI, Actions, Chrome, Slack.
// Builds platform-specific dispatchers and unified interfaces.

export const ROUND_09: RoundDefinition = {
  number: 9,
  id: toRoundId('round-09'),
  name: 'Cross-Platform Dispatch',
  goal: 'Extract cross-platform dispatch patterns: CLI subprocess management, GitHub Actions workflow triggers, Chrome MCP tool wrapping, and Slack webhook integration.',
  targetRepos: [
    'anthropics/anthropic-cookbook',
    'modelcontextprotocol/servers',
    'anthropics/courses',
  ],
  qualityThreshold: 0.80,
  prerequisites: [toRoundId('round-08')],
  contextDeltaTemplate: {
    steerDirection: 'Focus on platform adapters, subprocess lifecycle, webhook patterns, and MCP tool integration',
    discoveredTypes: ['platform_adapter', 'subprocess_pattern', 'webhook_integration', 'mcp_tool_wrapper'],
  },
};
