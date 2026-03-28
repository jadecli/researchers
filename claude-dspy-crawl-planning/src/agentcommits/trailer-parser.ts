// src/agentcommits/trailer-parser.ts — Parse agent trailers from commit messages
//
// TypeScript equivalent of the Python trailer_extractor.py.
// Follows the agentcommits trailer specification from .claude/research/agentcommits.md.

import type { Result } from '../types/core';
import { Ok, Err } from '../types/core';

// ── Trailer Types ────────────────────────────────────────────
export type AgentConfidence = 'high' | 'medium' | 'low';
export type AgentAuthorship =
  | 'agent-only'
  | 'agent-primary'
  | 'collaborative'
  | 'human-primary';

export type AgentTrailers = {
  readonly agentId: string | null;
  readonly agentAuthorship: AgentAuthorship | null;
  readonly agentTools: ReadonlyArray<string>;
  readonly agentConfidence: AgentConfidence | null;
  readonly agentContextFiles: string | null;
  readonly agentSession: string | null;
  readonly agentCostUsd: number | null;
  readonly agentInputTokens: number | null;
  readonly agentOutputTokens: number | null;
  readonly agentTaskRef: string | null;
  readonly agentSkillRefs: ReadonlyArray<string>;
  readonly rawTrailers: ReadonlyMap<string, string>;
};

export type TrailerValidation = {
  readonly isValid: boolean;
  readonly hasRequired: boolean;
  readonly completenessScore: number;
  readonly errors: ReadonlyArray<string>;
};

// ── Constants ────────────────────────────────────────────────
const AGENT_TRAILER_REGEX = /^(Agent-[\w-]+):\s*(.+?)$/gm;

const VALID_CONFIDENCE = new Set<AgentConfidence>(['high', 'medium', 'low']);
const VALID_AUTHORSHIP = new Set<AgentAuthorship>([
  'agent-only', 'agent-primary', 'collaborative', 'human-primary',
]);

const KNOWN_TRAILERS = new Set([
  'Agent-Id', 'Agent-Tools', 'Agent-Context-Files', 'Agent-Confidence',
  'Agent-Authorship', 'Agent-Task-Ref', 'Agent-Skill-Ref', 'Agent-Session',
  'Agent-Cost-USD', 'Agent-Input-Tokens', 'Agent-Output-Tokens',
]);

// ── Parser ───────────────────────────────────────────────────
export function extractAgentTrailers(
  commitMessage: string,
): AgentTrailers {
  const raw = new Map<string, string>();
  let match: RegExpExecArray | null;
  const regex = new RegExp(AGENT_TRAILER_REGEX.source, 'gm');

  while ((match = regex.exec(commitMessage)) !== null) {
    raw.set(match[1], match[2].trim());
  }

  const toolsStr = raw.get('Agent-Tools') ?? '';
  const skillStr = raw.get('Agent-Skill-Ref') ?? '';
  const costStr = raw.get('Agent-Cost-USD');
  const inputStr = raw.get('Agent-Input-Tokens');
  const outputStr = raw.get('Agent-Output-Tokens');

  const authorship = raw.get('Agent-Authorship') as AgentAuthorship | undefined;
  const confidence = raw.get('Agent-Confidence') as AgentConfidence | undefined;

  return {
    agentId: raw.get('Agent-Id') ?? null,
    agentAuthorship: authorship && VALID_AUTHORSHIP.has(authorship) ? authorship : null,
    agentTools: toolsStr ? toolsStr.split(',').map(t => t.trim()) : [],
    agentConfidence: confidence && VALID_CONFIDENCE.has(confidence) ? confidence : null,
    agentContextFiles: raw.get('Agent-Context-Files') ?? null,
    agentSession: raw.get('Agent-Session') ?? null,
    agentCostUsd: costStr ? parseFloat(costStr) || null : null,
    agentInputTokens: inputStr ? parseInt(inputStr, 10) || null : null,
    agentOutputTokens: outputStr ? parseInt(outputStr, 10) || null : null,
    agentTaskRef: raw.get('Agent-Task-Ref') ?? null,
    agentSkillRefs: skillStr ? skillStr.split(',').map(s => s.trim()) : [],
    rawTrailers: raw,
  };
}

// ── Validation ───────────────────────────────────────────────
export function validateTrailers(
  trailers: AgentTrailers,
): TrailerValidation {
  const errors: string[] = [];

  const hasRequired = trailers.agentId !== null && trailers.agentAuthorship !== null;
  if (!trailers.agentId) errors.push('Missing required trailer: Agent-Id');
  if (!trailers.agentAuthorship) errors.push('Missing required trailer: Agent-Authorship');

  // Check for unknown trailers
  for (const key of trailers.rawTrailers.keys()) {
    if (!KNOWN_TRAILERS.has(key)) {
      errors.push(`Unknown trailer: ${key}`);
    }
  }

  // Completeness: count populated fields out of 10
  const fields = [
    trailers.agentId, trailers.agentAuthorship, trailers.agentTools.length > 0,
    trailers.agentConfidence, trailers.agentSession, trailers.agentCostUsd,
    trailers.agentInputTokens, trailers.agentOutputTokens,
    trailers.agentTaskRef, trailers.agentSkillRefs.length > 0,
  ];
  const populated = fields.filter(Boolean).length;
  const completenessScore = Math.round((populated / 10) * 100) / 100;

  return {
    isValid: hasRequired && errors.length === 0,
    hasRequired,
    completenessScore,
    errors,
  };
}

// ── Convenience ──────────────────────────────────────────────
export function parseAndValidate(
  commitMessage: string,
): Result<{ trailers: AgentTrailers; validation: TrailerValidation }> {
  try {
    const trailers = extractAgentTrailers(commitMessage);
    const validation = validateTrailers(trailers);
    return Ok({ trailers, validation });
  } catch (e) {
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
}

export function hasAgentTrailers(commitMessage: string): boolean {
  return commitMessage.includes('Agent-Id:');
}
