import { toRoundId } from '../types/index.js';

// ─── Round 6: Logging Infrastructure ────────────────────────────────────────

export const ROUND_06 = {
  id: toRoundId('round-06'),
  number: 6,
  goal: 'Full JSONL observability stack',
  targetRepos: ['petri'],
  qualityThreshold: 0.75,
  prerequisites: ['round-05'],
  tasks: [
    {
      name: 'structured-logger',
      description: 'Build JSONL structured logger with levels, context propagation, and automatic rotation by round/dispatch/session',
      agentRequirements: { code: 0.8, analysis: 0.5 },
    },
    {
      name: 'event-emitter',
      description: 'Implement typed event emitter for pipeline, audit, and dispatch events with JSONL persistence',
      agentRequirements: { code: 0.8, analysis: 0.6 },
    },
    {
      name: 'metrics-collector',
      description: 'Create metrics collector for token usage, cost tracking, latency, and quality scores with JSONL aggregation',
      agentRequirements: { code: 0.7, analysis: 0.7 },
    },
    {
      name: 'trace-viewer',
      description: 'Build trace viewer that reconstructs dispatch execution from JSONL logs with timeline and agent activity visualization data',
      agentRequirements: { code: 0.7, analysis: 0.6, creative: 0.5 },
    },
    {
      name: 'log-rotation',
      description: 'Implement log rotation and compaction for JSONL files with configurable retention policies and archival',
      agentRequirements: { code: 0.7, analysis: 0.4 },
    },
  ],
} as const;
