import { describe, it, expect } from 'vitest';
import {
  toVariantId,
  toExperimentId,
  type VariantConfig,
  type ExperimentDefinition,
} from '../src/experiments/types.js';
import { ExperimentRunner } from '../src/experiments/runner.js';
import {
  spotifyToolStrategyExperiment,
  spotifyPtcHeadToHead,
  spotifyQualityExperiment,
} from '../src/experiments/spotify-stats-experiment.js';
import { toRoundId } from '../src/types/core.js';
import { ROUND_11 } from '../src/rounds/round-11.js';

// ── Branded Type Tests ──────────────────────────────────────────

describe('Experiment Types', () => {
  it('should create valid VariantId', () => {
    const id = toVariantId('test-variant');
    expect(id).toBe('test-variant');
  });

  it('should reject empty VariantId', () => {
    expect(() => toVariantId('')).toThrow('VariantId cannot be empty');
  });

  it('should create valid ExperimentId', () => {
    const id = toExperimentId('test-experiment');
    expect(id).toBe('test-experiment');
  });

  it('should reject empty ExperimentId', () => {
    expect(() => toExperimentId('')).toThrow('ExperimentId cannot be empty');
  });
});

// ── Spotify Experiment Definitions ──────────────────────────────

describe('Spotify Tool Strategy Experiment', () => {
  it('should have 4 variants', () => {
    expect(spotifyToolStrategyExperiment.variants).toHaveLength(4);
  });

  it('should have variants with different strategies', () => {
    const strategies = spotifyToolStrategyExperiment.variants.map(
      (v) => v.toolStrategy,
    );
    expect(strategies).toContain('standard');
    expect(strategies).toContain('extended_thinking');
    expect(strategies).toContain('tool_search');
    expect(strategies).toContain('ptc');
  });

  it('should target spotify org', () => {
    expect(spotifyToolStrategyExperiment.targetOrgs).toContain('spotify');
  });

  it('should have valid experiment id', () => {
    expect(spotifyToolStrategyExperiment.id).toBe('spotify-tool-strategy-v1');
  });

  it('should have variant weights summing to 1.0', () => {
    const totalWeight = spotifyToolStrategyExperiment.variants.reduce(
      (sum, v) => sum + v.weight,
      0,
    );
    expect(totalWeight).toBe(1.0);
  });

  it('should include experimentation and metrics categories', () => {
    expect(
      spotifyToolStrategyExperiment.targetPackageCategories,
    ).toContain('experimentation');
    expect(
      spotifyToolStrategyExperiment.targetPackageCategories,
    ).toContain('metrics');
  });

  it('should have status draft', () => {
    expect(spotifyToolStrategyExperiment.status).toBe('draft');
  });
});

describe('Spotify PTC Head-to-Head', () => {
  it('should have exactly 2 variants', () => {
    expect(spotifyPtcHeadToHead.variants).toHaveLength(2);
  });

  it('should compare standard vs ptc', () => {
    const strategies = spotifyPtcHeadToHead.variants.map(
      (v) => v.toolStrategy,
    );
    expect(strategies).toContain('standard');
    expect(strategies).toContain('ptc');
  });
});

describe('Spotify Quality Experiment', () => {
  it('should compare thinking vs tool_search', () => {
    const strategies = spotifyQualityExperiment.variants.map(
      (v) => v.toolStrategy,
    );
    expect(strategies).toContain('extended_thinking');
    expect(strategies).toContain('tool_search');
  });

  it('should target quality-focused categories', () => {
    expect(spotifyQualityExperiment.targetPackageCategories).toContain(
      'statistics',
    );
    expect(spotifyQualityExperiment.targetPackageCategories).toContain(
      'data-quality',
    );
  });
});

// ── Experiment Runner ───────────────────────────────────────────

describe('ExperimentRunner', () => {
  const runner = new ExperimentRunner('/tmp/test-experiments');

  it('should run a 2-variant experiment', async () => {
    const result = await runner.runExperiment(spotifyPtcHeadToHead);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.variants).toHaveLength(2);
      expect(result.value.experimentId).toBe('spotify-ptc-h2h-v1');
      expect(result.value.completedAt).toBeTruthy();
    }
  });

  it('should determine a winner', async () => {
    const result = await runner.runExperiment(spotifyPtcHeadToHead);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.winner).toBeTruthy();
      expect(result.value.confidenceLevel).toBeGreaterThanOrEqual(0);
      expect(result.value.confidenceLevel).toBeLessThanOrEqual(1);
    }
  });

  it('should run a 4-variant experiment', async () => {
    const result = await runner.runExperiment(
      spotifyToolStrategyExperiment,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.variants).toHaveLength(4);
    }
  });

  it('should compute efficiency ratios for all variants', async () => {
    const result = await runner.runExperiment(
      spotifyToolStrategyExperiment,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      for (const v of result.value.variants) {
        expect(v.efficiencyRatio).toBeGreaterThanOrEqual(0);
        expect(v.pagesCrawled).toBeGreaterThan(0);
        expect(v.toolCalls).toBeGreaterThan(0);
      }
    }
  });

  it('should have PTC variant with lower efficiency ratio than standard', async () => {
    const result = await runner.runExperiment(spotifyPtcHeadToHead);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const standard = result.value.variants.find(
        (v) => v.variantId === 'spotify-control',
      );
      const ptc = result.value.variants.find(
        (v) => v.variantId === 'spotify-ptc',
      );
      expect(standard).toBeTruthy();
      expect(ptc).toBeTruthy();
      if (standard && ptc) {
        // PTC should have fewer tool calls per page
        expect(ptc.efficiencyRatio).toBeLessThan(
          standard.efficiencyRatio,
        );
      }
    }
  });

  it('should produce a summary string', async () => {
    const result = await runner.runExperiment(spotifyPtcHeadToHead);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.summary).toContain('completed');
      expect(result.value.summary).toContain('quality=');
    }
  });
});

// ── Round 11 Definition ─────────────────────────────────────────

describe('Round 11: Modern Stat Packages', () => {
  it('should have correct round number', () => {
    expect(ROUND_11.number).toBe(11);
  });

  it('should have round-10 as prerequisite', () => {
    expect(ROUND_11.prerequisites).toContain(toRoundId('round-10'));
  });

  it('should target spotify repos', () => {
    expect(ROUND_11.targetRepos.some((r) => r.includes('spotify'))).toBe(
      true,
    );
  });

  it('should have quality threshold of 0.65', () => {
    expect(ROUND_11.qualityThreshold).toBe(0.65);
  });

  it('should have discovered types for stat packages', () => {
    const types = ROUND_11.contextDeltaTemplate.discoveredTypes ?? [];
    expect(types).toContain('experiment_framework');
    expect(types).toContain('metric_collector');
    expect(types).toContain('statistical_test');
  });
});
