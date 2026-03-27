import type { AgentId, ModelAlias, USD } from '../types/index.js';
import { toAgentId, toUSD } from '../types/index.js';

// ─── Agent capability vector ────────────────────────────────────────────────

export interface AgentCapability {
  readonly code: number;
  readonly research: number;
  readonly analysis: number;
  readonly creative: number;
  readonly safety: number;
}

// ─── Agent profile ──────────────────────────────────────────────────────────

export interface AgentProfile {
  readonly id: AgentId;
  readonly name: string;
  readonly model: ModelAlias;
  readonly capabilities: AgentCapability;
}

// ─── Default agent roster ───────────────────────────────────────────────────

export const DEFAULT_AGENTS: readonly AgentProfile[] = [
  {
    id: toAgentId('orchestrator-opus'),
    name: 'Orchestrator',
    model: 'opus',
    capabilities: { code: 0.9, research: 0.8, analysis: 0.95, creative: 0.7, safety: 0.9 },
  },
  {
    id: toAgentId('worker-sonnet'),
    name: 'Worker',
    model: 'sonnet',
    capabilities: { code: 0.85, research: 0.7, analysis: 0.75, creative: 0.6, safety: 0.8 },
  },
  {
    id: toAgentId('analyst-sonnet'),
    name: 'Analyst',
    model: 'sonnet',
    capabilities: { code: 0.5, research: 0.9, analysis: 0.9, creative: 0.5, safety: 0.85 },
  },
  {
    id: toAgentId('validator-haiku'),
    name: 'Validator',
    model: 'haiku',
    capabilities: { code: 0.4, research: 0.5, analysis: 0.6, creative: 0.3, safety: 0.95 },
  },
];

// ─── Cost per model (approximate per-call USD) ──────────────────────────────

const MODEL_COST: Record<ModelAlias, number> = {
  opus: 0.10,
  sonnet: 0.02,
  haiku: 0.002,
};

// ─── Cosine similarity ──────────────────────────────────────────────────────

function capabilityVector(cap: AgentCapability): number[] {
  return [cap.code, cap.research, cap.analysis, cap.creative, cap.safety];
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return sum;
}

function magnitude(v: number[]): number {
  return Math.sqrt(dot(v, v));
}

export function cosineSimilarity(a: AgentCapability, b: AgentCapability): number {
  const va = capabilityVector(a);
  const vb = capabilityVector(b);
  const magA = magnitude(va);
  const magB = magnitude(vb);

  if (magA === 0 || magB === 0) return 0;
  return dot(va, vb) / (magA * magB);
}

// ─── Budget-aware model downgrading ─────────────────────────────────────────

function downgradeModel(model: ModelAlias): ModelAlias {
  switch (model) {
    case 'opus':
      return 'sonnet';
    case 'sonnet':
      return 'haiku';
    case 'haiku':
      return 'haiku'; // Cannot downgrade further
  }
}

// ─── selectAgent ────────────────────────────────────────────────────────────

/**
 * Select the best agent for given task requirements, respecting budget.
 * Uses cosine similarity between task requirements and agent capabilities.
 * Downgrades model if budget is insufficient for the best match.
 */
export function selectAgent(
  taskRequirements: AgentCapability,
  budget: USD,
  agents: readonly AgentProfile[] = DEFAULT_AGENTS,
): AgentProfile {
  // Score each agent by cosine similarity
  const scored = agents.map((agent) => ({
    agent,
    similarity: cosineSimilarity(taskRequirements, agent.capabilities),
    cost: MODEL_COST[agent.model],
  }));

  // Sort by similarity descending
  scored.sort((a, b) => b.similarity - a.similarity);

  // Find best agent within budget
  for (const { agent, cost } of scored) {
    if (cost <= (budget as number)) {
      return agent;
    }
  }

  // If no agent fits budget, try downgrading the best match
  const bestMatch = scored[0];
  if (bestMatch) {
    const downgraded: AgentProfile = {
      ...bestMatch.agent,
      model: downgradeModel(bestMatch.agent.model),
      id: toAgentId(`${bestMatch.agent.name.toLowerCase()}-${downgradeModel(bestMatch.agent.model)}`),
    };
    return downgraded;
  }

  // Fallback: return cheapest agent
  return agents[agents.length - 1] ?? DEFAULT_AGENTS[3]!;
}

// ─── evolveSelectors ────────────────────────────────────────────────────────

export interface PerformanceDatum {
  readonly agentId: AgentId;
  readonly taskType: string;
  readonly score: number;
}

/**
 * Adjust agent capability weights based on historical performance data.
 * Agents that score higher on certain task types get boosted capabilities
 * in the corresponding dimension.
 */
export function evolveSelectors(
  performanceData: readonly PerformanceDatum[],
  agents: readonly AgentProfile[] = DEFAULT_AGENTS,
): AgentProfile[] {
  // Aggregate performance by agent and task type
  const agentPerformance = new Map<string, Map<string, { total: number; count: number }>>();

  for (const datum of performanceData) {
    const agentKey = String(datum.agentId);
    if (!agentPerformance.has(agentKey)) {
      agentPerformance.set(agentKey, new Map());
    }
    const taskMap = agentPerformance.get(agentKey)!;
    const current = taskMap.get(datum.taskType) ?? { total: 0, count: 0 };
    current.total += datum.score;
    current.count += 1;
    taskMap.set(datum.taskType, current);
  }

  // Map task types to capability dimensions
  const taskToDimension: Record<string, keyof AgentCapability> = {
    code: 'code',
    coding: 'code',
    research: 'research',
    analysis: 'analysis',
    creative: 'creative',
    writing: 'creative',
    safety: 'safety',
    review: 'safety',
  };

  return agents.map((agent) => {
    const agentKey = String(agent.id);
    const perfMap = agentPerformance.get(agentKey);

    if (!perfMap) return agent;

    // Compute adjustment factors
    const adjustments: Partial<Record<keyof AgentCapability, number>> = {};

    for (const [taskType, { total, count }] of perfMap) {
      const avgScore = total / count;
      const dimension = taskToDimension[taskType];
      if (dimension) {
        // Adjust capability: move toward observed performance
        // Learning rate of 0.1 to prevent wild swings
        const currentValue = agent.capabilities[dimension];
        const adjustment = (avgScore - currentValue) * 0.1;
        adjustments[dimension] = (adjustments[dimension] ?? 0) + adjustment;
      }
    }

    // Apply adjustments, clamping to [0, 1]
    const newCapabilities: AgentCapability = {
      code: clamp(agent.capabilities.code + (adjustments.code ?? 0)),
      research: clamp(agent.capabilities.research + (adjustments.research ?? 0)),
      analysis: clamp(agent.capabilities.analysis + (adjustments.analysis ?? 0)),
      creative: clamp(agent.capabilities.creative + (adjustments.creative ?? 0)),
      safety: clamp(agent.capabilities.safety + (adjustments.safety ?? 0)),
    };

    return { ...agent, capabilities: newCapabilities };
  });
}

function clamp(value: number, min: number = 0, max: number = 1): number {
  return Math.max(min, Math.min(max, value));
}
