// src/agent/signal-router.ts — Signal-based model routing complementing bloom filter
//
// Extracted patterns from oh-my-claudecode (Yeachan Heo):
//   - three-layer-signal-extraction: lexical + structural + contextual
//   - weighted-additive-scoring-with-negative-weights: simple tasks score DOWN
//   - priority-ordered-rules-dsl: first-match-wins override system
//   - scorer-rules-divergence-guard: confidence reduction on disagreement
//
// Integrates with bloom-filter.ts: bloom is the fast first gate (lexical),
// this module provides the weighted second gate (structural + contextual).
//
// Boris Cherny patterns: Branded types, Result<T,E>, discriminated unions.

import type { Result, ModelAlias } from '../types/core';
import { Ok, Err, assertNever } from '../types/core';

// ── Signal Types ───────────────────────────────────────────────

/** Complexity tier — maps to model selection */
export type ComplexityTier = 'low' | 'medium' | 'high';

/** Routing confidence as bounded decimal */
export type RoutingConfidence = number & { readonly __brand: 'RoutingConfidence' };

function toRoutingConfidence(n: number): RoutingConfidence {
  return Math.max(0, Math.min(1, n)) as RoutingConfidence;
}

/** Reversibility of the operation — affects risk scoring */
export type Reversibility = 'easy' | 'moderate' | 'difficult';

/** Impact scope — local changes are safer than system-wide */
export type ImpactScope = 'local' | 'module' | 'system_wide';

// ── Extracted Signals ──────────────────────────────────────────

export interface RoutingSignals {
  // Lexical signals (regex, no model calls)
  readonly questionDepth: number;           // 0=none, 1=where, 2=what, 3=how, 4=why
  readonly hasCodeBlock: boolean;
  readonly hasMultipleSteps: boolean;
  readonly tokenEstimate: number;
  readonly mentionsArchitecture: boolean;

  // Structural signals (parsing-based)
  readonly fileCount: number;               // number of files referenced
  readonly reversibility: Reversibility;
  readonly impactScope: ImpactScope;

  // Contextual signals
  readonly isExploratoryTask: boolean;
  readonly requiresSynthesis: boolean;
  readonly hasPriorContext: boolean;
}

// ── Signal Extraction ──────────────────────────────────────────

const QUESTION_DEPTH: Record<string, number> = {
  why: 4, how: 3, what: 2, where: 1, when: 1, which: 1,
};

const ARCHITECTURE_KEYWORDS = /\b(architect|design|refactor|system|infrastructure|migration|schema)\b/i;
const MULTI_STEP_MARKERS = /\b(then|after|next|finally|step\s+\d|phase\s+\d|first.*second|1\).*2\))\b/i;
const CODE_BLOCK = /```[\s\S]*?```/;

/**
 * Extract routing signals from a task description.
 * Layer 1 (lexical): regex only, no model calls, sub-millisecond.
 */
export function extractSignals(
  task: string,
  context?: { fileCount?: number; hasPriorContext?: boolean },
): RoutingSignals {
  const lower = task.toLowerCase();

  // Question depth hierarchy: why > how > what > where
  const firstWord = lower.trim().split(/\s+/)[0] ?? '';
  const questionDepth = QUESTION_DEPTH[firstWord] ?? 0;

  // Token estimate (rough: ~4 chars per token)
  const tokenEstimate = Math.ceil(task.length / 4);

  return {
    questionDepth,
    hasCodeBlock: CODE_BLOCK.test(task),
    hasMultipleSteps: MULTI_STEP_MARKERS.test(task),
    tokenEstimate,
    mentionsArchitecture: ARCHITECTURE_KEYWORDS.test(task),
    fileCount: context?.fileCount ?? 0,
    reversibility: inferReversibility(task),
    impactScope: inferImpactScope(task),
    isExploratoryTask: /\b(explore|investigate|research|find|search|look)\b/i.test(task),
    requiresSynthesis: /\b(synthesize|combine|merge|summarize|compare|analyze)\b/i.test(task),
    hasPriorContext: context?.hasPriorContext ?? false,
  };
}

function inferReversibility(task: string): Reversibility {
  if (/\b(delete|drop|remove|destroy|overwrite|force)\b/i.test(task)) return 'difficult';
  if (/\b(modify|update|change|edit|refactor)\b/i.test(task)) return 'moderate';
  return 'easy';
}

function inferImpactScope(task: string): ImpactScope {
  if (/\b(system.wide|infrastructure|migration|all files|entire|global)\b/i.test(task)) return 'system_wide';
  if (/\b(module|package|component|service|directory)\b/i.test(task)) return 'module';
  return 'local';
}

// ── Weighted Additive Scoring ──────────────────────────────────
// Crucially, simple task signals have NEGATIVE weights to push
// lightweight tasks toward Haiku, saving budget for complex work.

interface WeightedSignal {
  readonly name: string;
  readonly weight: number;
  readonly value: boolean | number;
}

function computeComplexityScore(signals: RoutingSignals): number {
  const weighted: WeightedSignal[] = [
    // Positive: push toward higher tier
    { name: 'questionDepth',       weight: 0.15, value: signals.questionDepth / 4 },
    { name: 'multipleSteps',       weight: 0.15, value: signals.hasMultipleSteps },
    { name: 'architecture',        weight: 0.12, value: signals.mentionsArchitecture },
    { name: 'synthesis',           weight: 0.12, value: signals.requiresSynthesis },
    { name: 'impactScope',         weight: 0.10, value: signals.impactScope === 'system_wide' ? 1 : signals.impactScope === 'module' ? 0.5 : 0 },
    { name: 'reversibility',       weight: 0.08, value: signals.reversibility === 'difficult' ? 1 : signals.reversibility === 'moderate' ? 0.5 : 0 },
    { name: 'fileCount',           weight: 0.06, value: Math.min(signals.fileCount / 10, 1) },
    { name: 'tokenLength',         weight: 0.04, value: Math.min(signals.tokenEstimate / 1000, 1) },

    // Negative: push toward lower tier (saves budget)
    { name: 'exploratory',         weight: -0.10, value: signals.isExploratoryTask },
    { name: 'noContext',           weight: -0.05, value: !signals.hasPriorContext },
    { name: 'simpleScope',         weight: -0.08, value: signals.impactScope === 'local' && !signals.hasMultipleSteps },
  ];

  let score = 0;
  for (const signal of weighted) {
    const numericValue = typeof signal.value === 'boolean' ? (signal.value ? 1 : 0) : signal.value;
    score += signal.weight * numericValue;
  }

  return Math.max(0, Math.min(1, score));
}

function scoreTier(score: number): ComplexityTier {
  if (score >= 0.55) return 'high';
  if (score >= 0.25) return 'medium';
  return 'low';
}

// ── Routing Rules DSL ──────────────────────────────────────────
// Priority-ordered, first-match-wins. Overrides the additive scorer
// for known patterns.

interface RoutingRule {
  readonly name: string;
  readonly priority: number;
  readonly condition: (signals: RoutingSignals) => boolean;
  readonly tier: ComplexityTier;
  readonly reason: string;
}

const RULES: readonly RoutingRule[] = [
  {
    name: 'architecture-change',
    priority: 10,
    condition: (s) => s.mentionsArchitecture && s.impactScope === 'system_wide',
    tier: 'high',
    reason: 'System-wide architectural change requires Opus reasoning',
  },
  {
    name: 'multi-step-synthesis',
    priority: 20,
    condition: (s) => s.hasMultipleSteps && s.requiresSynthesis,
    tier: 'high',
    reason: 'Multi-step synthesis requires deep reasoning',
  },
  {
    name: 'destructive-operation',
    priority: 30,
    condition: (s) => s.reversibility === 'difficult' && s.impactScope !== 'local',
    tier: 'high',
    reason: 'Non-local destructive operations need careful oversight',
  },
  {
    name: 'simple-exploration',
    priority: 40,
    condition: (s) => s.isExploratoryTask && s.impactScope === 'local' && !s.hasMultipleSteps,
    tier: 'low',
    reason: 'Simple local exploration is Haiku-appropriate',
  },
  {
    name: 'single-file-edit',
    priority: 50,
    condition: (s) => s.fileCount <= 1 && s.reversibility === 'easy' && !s.mentionsArchitecture,
    tier: 'low',
    reason: 'Single-file easy edits route to Haiku for cost efficiency',
  },
].sort((a, b) => a.priority - b.priority);

function applyRules(signals: RoutingSignals): { tier: ComplexityTier; rule: string } | null {
  for (const rule of RULES) {
    if (rule.condition(signals)) {
      return { tier: rule.tier, rule: rule.name };
    }
  }
  return null;
}

// ── Model Mapping ──────────────────────────────────────────────

const TIER_TO_MODEL: Record<ComplexityTier, ModelAlias> = {
  low: 'haiku',
  medium: 'sonnet',
  high: 'opus',
};

// ── Routing Decision ───────────────────────────────────────────

export interface RoutingDecision {
  readonly model: ModelAlias;
  readonly tier: ComplexityTier;
  readonly confidence: RoutingConfidence;
  readonly score: number;
  readonly matchedRule: string | null;
  readonly signals: RoutingSignals;
}

/**
 * Route a task to the appropriate model tier using signal extraction
 * and weighted scoring. Designed to run AFTER the bloom filter pre-check.
 *
 * Usage:
 *   const bloomCheck = routeToolCall(filter, toolName);
 *   if (bloomCheck.type === 'probably_exists') {
 *     const routing = routeTask(taskDescription);
 *     // use routing.model for dispatch
 *   }
 */
export function routeTask(
  task: string,
  context?: { fileCount?: number; hasPriorContext?: boolean },
): RoutingDecision {
  const signals = extractSignals(task, context);
  const score = computeComplexityScore(signals);
  const scoredTier = scoreTier(score);

  // Apply rules DSL (first-match-wins)
  const ruleMatch = applyRules(signals);

  let finalTier: ComplexityTier;
  let confidence: RoutingConfidence;
  let matchedRule: string | null;

  if (ruleMatch) {
    finalTier = ruleMatch.tier;
    matchedRule = ruleMatch.rule;

    // Divergence guard: if rules and scorer disagree, reduce confidence
    if (ruleMatch.tier !== scoredTier) {
      confidence = toRoutingConfidence(0.6);
    } else {
      confidence = toRoutingConfidence(0.9);
    }
  } else {
    finalTier = scoredTier;
    matchedRule = null;
    confidence = toRoutingConfidence(0.75); // no rule match = moderate confidence
  }

  return {
    model: TIER_TO_MODEL[finalTier],
    tier: finalTier,
    confidence,
    score,
    matchedRule,
    signals,
  };
}
