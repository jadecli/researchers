import { toRoundId } from '../types/index.js';

// ─── Round 4: Petri Auditing ────────────────────────────────────────────────

export const ROUND_04 = {
  id: toRoundId('round-04'),
  number: 4,
  goal: 'Dispatch audit system',
  targetRepos: ['petri'],
  qualityThreshold: 0.70,
  prerequisites: ['round-03'],
  tasks: [
    {
      name: 'alignment-judge',
      description: 'Implement alignmentJudge that scores agent outputs on relevance, completeness, accuracy, and safety dimensions using a structured rubric',
      agentRequirements: { analysis: 0.9, safety: 0.8 },
    },
    {
      name: 'realism-approver',
      description: 'Build realismApprover that detects hallucinations, fabricated URLs, impossible dates, unsupported claims, and logical inconsistencies',
      agentRequirements: { analysis: 0.8, safety: 0.9 },
    },
    {
      name: 'auditor-agent',
      description: 'Create AuditorAgent that iterates transcript events, calls alignmentJudge and realismApprover, and produces AuditReport with flagged issues',
      agentRequirements: { code: 0.8, analysis: 0.8, safety: 0.7 },
    },
    {
      name: 'audit-store',
      description: 'Implement JSONL-backed AuditStore with transcript and audit report persistence, in-memory indexing, and quality history tracking',
      agentRequirements: { code: 0.8, analysis: 0.5 },
    },
    {
      name: 'audit-tools',
      description: 'Define audit tool definitions (read_transcript, score_output, check_realism, generate_feedback) following ToolDefinition pattern',
      agentRequirements: { code: 0.7, analysis: 0.6 },
    },
  ],
} as const;
