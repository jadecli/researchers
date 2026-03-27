import { toRoundId } from '../types/index.js';

// ─── Round 3: Bloom Pipeline ────────────────────────────────────────────────

export const ROUND_03 = {
  id: toRoundId('round-03'),
  number: 3,
  goal: 'Multi-stage dispatch pipeline',
  targetRepos: ['bloom'],
  qualityThreshold: 0.65,
  prerequisites: ['round-02'],
  tasks: [
    {
      name: 'pipeline-stages',
      description: 'Implement PipelineStage discriminated union with all 5 stages (analyze, approach, execute, evaluate, refine)',
      agentRequirements: { code: 0.8, analysis: 0.7 },
    },
    {
      name: 'pipeline-runner',
      description: 'Build PipelineRunner that drives through stages sequentially with retry, timeout, and pause/resume support',
      agentRequirements: { code: 0.9, analysis: 0.6 },
    },
    {
      name: 'prompt-templates',
      description: 'Create PromptTemplate system with renderTemplate, validation, and built-in STAGE_TEMPLATES for all 5 stages',
      agentRequirements: { code: 0.7, creative: 0.6 },
    },
    {
      name: 'pipeline-integration',
      description: 'Wire pipeline stages end-to-end: analyze feeds approach, approach feeds execute, execute feeds evaluate, evaluate feeds refine',
      agentRequirements: { code: 0.8, analysis: 0.8 },
    },
  ],
} as const;
