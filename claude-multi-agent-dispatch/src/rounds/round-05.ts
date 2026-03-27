import { toRoundId } from '../types/index.js';

// ─── Round 5: Orchestrator ──────────────────────────────────────────────────

export const ROUND_05 = {
  id: toRoundId('round-05'),
  number: 5,
  goal: 'Core DispatchOrchestrator',
  targetRepos: ['bloom', 'petri', 'shannon-thinking'],
  qualityThreshold: 0.70,
  prerequisites: ['round-04'],
  tasks: [
    {
      name: 'agent-selector',
      description: 'Build agent selection with cosine similarity matching between task requirements and agent capabilities, with budget-aware model downgrading',
      agentRequirements: { code: 0.8, analysis: 0.9 },
    },
    {
      name: 'dispatch-orchestrator',
      description: 'Implement DispatchOrchestrator with full pipeline: classifyTask, selectAgents, buildPlan, fanOut (parallel), collectResults, synthesize, scoreQuality',
      agentRequirements: { code: 0.9, analysis: 0.8 },
    },
    {
      name: 'session-state',
      description: 'Create SessionStore with JSONL persistence, session lifecycle (create/load/update/archive), and budget tracking',
      agentRequirements: { code: 0.8, analysis: 0.5 },
    },
    {
      name: 'selector-evolution',
      description: 'Implement evolveSelectors that adjusts agent capability weights based on historical performance data with learning rate damping',
      agentRequirements: { code: 0.7, analysis: 0.8, research: 0.6 },
    },
  ],
} as const;
