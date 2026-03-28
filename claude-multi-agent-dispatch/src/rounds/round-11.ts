import { toRoundId } from '../types/core.js';
import type { RoundDefinition } from './types.js';

// ─── Round 11: Modern Stat/Measurement Packages (Spotify) ───────────────────
// Crawls Spotify's GitHub org for statistical and measurement libraries.
// A/B experiments compare tool calling strategies: standard, extended thinking,
// tool search with embeddings, and programmatic tool calling (PTC).

export const ROUND_11: RoundDefinition = {
  number: 11,
  id: toRoundId('round-11'),
  name: 'Modern Stat/Measurement Packages',
  goal: 'Extract statistical library patterns, experimentation frameworks, metric collection APIs, and data quality tooling from Spotify GitHub org. Compare tool calling strategies via A/B experiments.',
  targetRepos: [
    'spotify/confidence',
    'spotify/luigi',
    'spotify/feathr',
    'spotify/pedalboard',
    'spotify/voyager',
    'spotify/annoy',
    'spotify/heroic',
    'spotify/scio',
    'spotify/dbeam',
    'spotify/spark-bigquery-connector',
  ],
  qualityThreshold: 0.65,
  prerequisites: [toRoundId('round-10')],
  contextDeltaTemplate: {
    steerDirection: 'Focus on statistical library APIs, experimentation frameworks, metric collection patterns, and data quality tooling. Compare efficiency across tool calling strategies.',
    discoveredTypes: [
      'experiment_framework',
      'metric_collector',
      'statistical_test',
      'data_quality_check',
      'feature_store_api',
      'streaming_pipeline',
      'ab_test_config',
    ],
  },
};
