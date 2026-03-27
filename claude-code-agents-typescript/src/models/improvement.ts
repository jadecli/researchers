// src/models/improvement.ts — Improvement suggestion and selector patch models
import type { Confidence, SpiderName } from '../types.js';
import { toSpiderName } from '../types.js';
import type { PageType } from './crawl-target.js';

// ── Improvement Suggestion ──────────────────────────────────────
export interface ImprovementSuggestion {
  readonly spider: SpiderName;
  readonly selector: string;
  readonly issue: string;
  readonly proposedFix: string;
  readonly confidence: Confidence;
  readonly pageType: PageType | undefined;
  readonly impact: 'low' | 'medium' | 'high';
}

export function isHighConfidence(suggestion: ImprovementSuggestion): boolean {
  return (suggestion.confidence as number) >= 0.8;
}

export function toSelectorPatch(suggestion: ImprovementSuggestion): SelectorPatch {
  return createSelectorPatch({
    spider: suggestion.spider as string,
    oldSelector: suggestion.selector,
    newSelector: suggestion.proposedFix,
    rationale: suggestion.issue,
  });
}

// ── Selector Patch ──────────────────────────────────────────────
export interface SelectorPatch {
  readonly spider: SpiderName;
  readonly oldSelector: string;
  readonly newSelector: string;
  readonly rationale: string;
  readonly validated: boolean;
}

export function createSelectorPatch(input: {
  readonly spider: string;
  readonly oldSelector: string;
  readonly newSelector: string;
  readonly rationale?: string;
  readonly validated?: boolean;
}): SelectorPatch {
  return {
    spider: toSpiderName(input.spider),
    oldSelector: input.oldSelector,
    newSelector: input.newSelector,
    rationale: input.rationale ?? '',
    validated: input.validated ?? false,
  };
}

export function applyToSource(patch: SelectorPatch, source: string): string {
  if (!source.includes(patch.oldSelector)) {
    throw new Error(
      `Old selector '${patch.oldSelector}' not found in source for spider '${patch.spider}'`,
    );
  }
  return source.replace(patch.oldSelector, patch.newSelector);
}

export function asDiffLine(patch: SelectorPatch): string {
  return `- ${patch.oldSelector}\n+ ${patch.newSelector}`;
}
