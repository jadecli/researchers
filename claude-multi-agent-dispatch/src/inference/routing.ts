import type { ModelId, USD } from '../types/core.js';
import { resolveModel, toUSD } from '../types/core.js';
import type { DecisionEvent } from '../types/transcript.js';

// ─── Task Complexity ─────────────────────────────────────────────────────────

export type TaskComplexity = 'simple' | 'moderate' | 'complex';

// ─── Cost Thresholds ─────────────────────────────────────────────────────────

const BUDGET_THRESHOLD_FOR_DOWNGRADE = 0.20; // 20% of budget remaining triggers downgrade
const MINIMUM_BUDGET_FOR_OPUS: USD = toUSD(1.00);
const MINIMUM_BUDGET_FOR_SONNET: USD = toUSD(0.10);

// ─── Routing Decision Log ────────────────────────────────────────────────────

const routingLog: DecisionEvent[] = [];

/**
 * Routes to the appropriate model based on task complexity.
 * Simple tasks get Haiku, moderate get Sonnet, complex get Opus.
 */
export function routeModel(
  taskComplexity: TaskComplexity,
  remainingBudget: USD,
): ModelId {
  const baseModel = getBaseModel(taskComplexity);
  const finalModel = costAwareRouting(baseModel, remainingBudget);

  logRoutingDecision(taskComplexity, baseModel, finalModel, remainingBudget);

  return finalModel;
}

/**
 * Maps task complexity to the ideal model.
 */
function getBaseModel(complexity: TaskComplexity): ModelId {
  switch (complexity) {
    case 'simple':
      return resolveModel('haiku');
    case 'moderate':
      return resolveModel('sonnet');
    case 'complex':
      return resolveModel('opus');
  }
}

/**
 * Downgrades the model if the remaining budget is too low.
 * Ensures we don't burn through budget on expensive models when funds are limited.
 */
export function costAwareRouting(
  preferredModel: ModelId,
  remainingBudget: USD,
): ModelId {
  // If budget is critically low, always use Haiku
  if ((remainingBudget as number) < (MINIMUM_BUDGET_FOR_SONNET as number)) {
    return resolveModel('haiku');
  }

  // If budget is low, cap at Sonnet
  if ((remainingBudget as number) < (MINIMUM_BUDGET_FOR_OPUS as number)) {
    if (preferredModel === resolveModel('opus')) {
      return resolveModel('sonnet');
    }
    return preferredModel;
  }

  // Budget is healthy, use preferred model
  return preferredModel;
}

/**
 * Records the routing decision as a DecisionEvent for auditing and transcript replay.
 */
export function logRoutingDecision(
  complexity: TaskComplexity,
  baseModel: ModelId,
  finalModel: ModelId,
  remainingBudget: USD,
): void {
  const wasDowngraded = baseModel !== finalModel;
  const alternatives: string[] = [];

  if (wasDowngraded) {
    alternatives.push(`Original model: ${baseModel} (downgraded due to budget)`);
  }

  // Include all models that were considered
  const allModels: ModelId[] = [
    resolveModel('haiku'),
    resolveModel('sonnet'),
    resolveModel('opus'),
  ];
  for (const model of allModels) {
    if (model !== finalModel) {
      alternatives.push(model);
    }
  }

  const event: DecisionEvent = {
    type: 'decision',
    rationale: wasDowngraded
      ? `Routed ${complexity} task to ${finalModel} (downgraded from ${baseModel} due to remaining budget $${(remainingBudget as number).toFixed(4)})`
      : `Routed ${complexity} task to ${finalModel} (budget: $${(remainingBudget as number).toFixed(4)})`,
    confidence: wasDowngraded ? 0.7 : 0.95,
    alternatives,
    timestamp: new Date(),
  };

  routingLog.push(event);
}

/**
 * Returns all routing decisions made during this session.
 * Useful for transcript generation and auditing.
 */
export function getRoutingLog(): readonly DecisionEvent[] {
  return routingLog;
}

/**
 * Clears the routing log. Primarily for testing.
 */
export function clearRoutingLog(): void {
  routingLog.length = 0;
}
