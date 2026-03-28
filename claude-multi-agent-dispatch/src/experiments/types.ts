// src/experiments/types.ts — A/B experiment type definitions
//
// Supports split-testing crawl strategies: different spider configs,
// extraction approaches, tool calling patterns (extended thinking vs PTC
// vs tool search), and quality scoring weights.

import type { RoundId } from '../types/core.js';
import type { QualityScore } from '../types/quality.js';

// ── Experiment Variant ──────────────────────────────────────────

export type VariantId = string & { readonly __brand: 'VariantId' };

export function toVariantId(raw: string): VariantId {
  if (!raw || raw.trim().length === 0) {
    throw new Error('VariantId cannot be empty');
  }
  return raw as VariantId;
}

export type ToolStrategy =
  | 'standard'            // Normal tool_use loop
  | 'extended_thinking'   // Extended thinking before tool calls
  | 'tool_search'         // Embedding-based tool discovery meta-tool
  | 'ptc';                // Programmatic tool calling

export interface VariantConfig {
  readonly id: VariantId;
  readonly name: string;
  readonly description: string;
  readonly toolStrategy: ToolStrategy;
  readonly spiderOverrides: Readonly<Record<string, string | number | boolean>>;
  readonly thinkingBudget?: number;  // For extended_thinking variant
  readonly weight: number;           // Traffic allocation (0-1)
}

// ── Experiment Definition ───────────────────────────────────────

export type ExperimentId = string & { readonly __brand: 'ExperimentId' };

export function toExperimentId(raw: string): ExperimentId {
  if (!raw || raw.trim().length === 0) {
    throw new Error('ExperimentId cannot be empty');
  }
  return raw as ExperimentId;
}

export type ExperimentStatus =
  | 'draft'
  | 'running'
  | 'completed'
  | 'cancelled';

export interface ExperimentDefinition {
  readonly id: ExperimentId;
  readonly name: string;
  readonly hypothesis: string;
  readonly variants: readonly VariantConfig[];
  readonly targetOrgs: readonly string[];
  readonly targetPackageCategories: readonly string[];
  readonly roundId: RoundId;
  readonly status: ExperimentStatus;
  readonly createdAt: string;
}

// ── Experiment Results ──────────────────────────────────────────

export interface VariantResult {
  readonly variantId: VariantId;
  readonly pagesCrawled: number;
  readonly toolCalls: number;
  readonly agentTurns: number;
  readonly qualityScore: QualityScore;
  readonly efficiencyRatio: number;  // tool_calls / pages_crawled
  readonly costUsd: number;
  readonly durationMs: number;
  readonly errors: readonly string[];
}

export interface ExperimentResult {
  readonly experimentId: ExperimentId;
  readonly variants: readonly VariantResult[];
  readonly winner: VariantId | null;
  readonly confidenceLevel: number;  // 0-1 statistical confidence
  readonly summary: string;
  readonly completedAt: string;
}
