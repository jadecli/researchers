// src/experiments/spotify-stats-experiment.ts — Spotify stat packages A/B experiment
//
// Defines experiments comparing tool calling strategies when crawling
// Spotify's GitHub org for modern statistical and measurement packages.
// Based on cookbook patterns: extended thinking, tool search, PTC.

import { toRoundId } from '../types/core.js';
import {
  toExperimentId,
  toVariantId,
  type ExperimentDefinition,
  type VariantConfig,
} from './types.js';

// ── Variants ────────────────────────────────────────────────────

const controlVariant: VariantConfig = {
  id: toVariantId('spotify-control'),
  name: 'Standard Tool Loop',
  description:
    'Baseline: standard sequential tool_use loop. ' +
    'Agent reasons, calls one tool, waits for result, repeats.',
  toolStrategy: 'standard',
  spiderOverrides: {
    variant: 'control',
    max_files_per_repo: 10,
  },
  weight: 0.25,
};

const thinkingVariant: VariantConfig = {
  id: toVariantId('spotify-thinking'),
  name: 'Extended Thinking',
  description:
    'Extended thinking enabled with 2000 token budget before tool calls. ' +
    'Claude reasons about file relevance and extraction strategy before acting. ' +
    'Based on: platform.claude.com/cookbook/extended-thinking-with-tool-use',
  toolStrategy: 'extended_thinking',
  thinkingBudget: 2000,
  spiderOverrides: {
    variant: 'thinking',
    max_files_per_repo: 12,
  },
  weight: 0.25,
};

const toolSearchVariant: VariantConfig = {
  id: toVariantId('spotify-tool-search'),
  name: 'Tool Search with Embeddings',
  description:
    'Meta-tool discovers domain-specific extractors on demand via embeddings. ' +
    '90%+ context reduction for large extractor libraries. ' +
    'Based on: platform.claude.com/cookbook/tool-search-with-embeddings',
  toolStrategy: 'tool_search',
  spiderOverrides: {
    variant: 'tool_search',
    max_files_per_repo: 10,
  },
  weight: 0.25,
};

const ptcVariant: VariantConfig = {
  id: toVariantId('spotify-ptc'),
  name: 'Programmatic Tool Calling',
  description:
    'Claude writes async code that invokes tools directly in the execution env. ' +
    '85%+ token reduction for batch operations. Parallel URL fetching. ' +
    'Based on: platform.claude.com/cookbook/programmatic-tool-calling-ptc',
  toolStrategy: 'ptc',
  spiderOverrides: {
    variant: 'ptc',
    max_files_per_repo: 15,
  },
  weight: 0.25,
};

// ── Experiment Definitions ──────────────────────────────────────

/**
 * Experiment 1: Full 4-way comparison of tool strategies
 * on Spotify's statistical packages.
 */
export const spotifyToolStrategyExperiment: ExperimentDefinition = {
  id: toExperimentId('spotify-tool-strategy-v1'),
  name: 'Spotify Tool Strategy Comparison',
  hypothesis:
    'PTC and tool search strategies will achieve lower tool_calls/pages_crawled ratios ' +
    'than standard tool loop when crawling statistical packages, while maintaining ' +
    'equivalent or better extraction quality.',
  variants: [controlVariant, thinkingVariant, toolSearchVariant, ptcVariant],
  targetOrgs: ['spotify'],
  targetPackageCategories: [
    'experimentation',
    'metrics',
    'statistics',
    'data-quality',
    'feature-engineering',
    'ml-evaluation',
    'observability',
    'streaming',
  ],
  roundId: toRoundId('round-11'),
  status: 'draft',
  createdAt: new Date().toISOString(),
};

/**
 * Experiment 2: PTC vs Standard — focused head-to-head
 * on Spotify's top experimentation repos.
 */
export const spotifyPtcHeadToHead: ExperimentDefinition = {
  id: toExperimentId('spotify-ptc-h2h-v1'),
  name: 'PTC vs Standard Head-to-Head',
  hypothesis:
    'Programmatic tool calling will reduce tool call overhead by 60%+ ' +
    'compared to standard tool loop for batch GitHub API operations.',
  variants: [controlVariant, ptcVariant],
  targetOrgs: ['spotify'],
  targetPackageCategories: ['experimentation', 'metrics'],
  roundId: toRoundId('round-11'),
  status: 'draft',
  createdAt: new Date().toISOString(),
};

/**
 * Experiment 3: Extended thinking vs Tool search — quality-focused
 * comparison on deep extraction from complex repos.
 */
export const spotifyQualityExperiment: ExperimentDefinition = {
  id: toExperimentId('spotify-quality-v1'),
  name: 'Thinking vs Tool Search Quality',
  hypothesis:
    'Extended thinking will produce higher quality extractions (accuracy dimension) ' +
    'while tool search will be more efficient (lower cost per page).',
  variants: [thinkingVariant, toolSearchVariant],
  targetOrgs: ['spotify'],
  targetPackageCategories: ['statistics', 'data-quality', 'ml-evaluation'],
  roundId: toRoundId('round-11'),
  status: 'draft',
  createdAt: new Date().toISOString(),
};
