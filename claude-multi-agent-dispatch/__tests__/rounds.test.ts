import { describe, it, expect, beforeEach } from 'vitest';
import { toRoundId } from '../src/types/core.js';
import { ROUND_07, ROUND_08, ROUND_09, ROUND_10 } from '../src/rounds/index.js';
import { RoundRunner, type AuditStore } from '../src/rounds/runner.js';
import { ContextDeltaAccumulator } from '../src/refinement/context-delta.js';
import type { RoundResult } from '../src/rounds/types.js';

// ─── Round Definitions tests ────────────────────────────────────────────────

describe('Round Definitions', () => {
  it('should define round 7 with correct prerequisites', () => {
    expect(ROUND_07.number).toBe(7);
    expect(ROUND_07.name).toBe('Quality Scoring');
    expect(ROUND_07.qualityThreshold).toBe(0.75);
    expect(ROUND_07.prerequisites).toContain(toRoundId('round-06'));
  });

  it('should define round 8 depending on round 7', () => {
    expect(ROUND_08.number).toBe(8);
    expect(ROUND_08.prerequisites).toContain(toRoundId('round-07'));
    expect(ROUND_08.qualityThreshold).toBe(0.80);
  });

  it('should define round 9 depending on round 8', () => {
    expect(ROUND_09.number).toBe(9);
    expect(ROUND_09.prerequisites).toContain(toRoundId('round-08'));
    expect(ROUND_09.qualityThreshold).toBe(0.80);
  });

  it('should define round 10 depending on round 9', () => {
    expect(ROUND_10.number).toBe(10);
    expect(ROUND_10.prerequisites).toContain(toRoundId('round-09'));
    expect(ROUND_10.qualityThreshold).toBe(0.85);
  });

  it('should have sequential prerequisites (N requires N-1)', () => {
    const rounds = [ROUND_07, ROUND_08, ROUND_09, ROUND_10];
    for (let i = 1; i < rounds.length; i++) {
      const current = rounds[i]!;
      const previous = rounds[i - 1]!;
      expect(current.prerequisites).toContain(previous.id);
    }
  });

  it('should have increasing quality thresholds', () => {
    const rounds = [ROUND_07, ROUND_08, ROUND_09, ROUND_10];
    for (let i = 1; i < rounds.length; i++) {
      expect(rounds[i]!.qualityThreshold).toBeGreaterThanOrEqual(
        rounds[i - 1]!.qualityThreshold,
      );
    }
  });
});

// ─── RoundRunner tests ──────────────────────────────────────────────────────

describe('RoundRunner', () => {
  let store: AuditStore;
  let savedResults: Map<string, RoundResult>;
  let accumulator: ContextDeltaAccumulator;

  beforeEach(() => {
    savedResults = new Map();
    store = {
      getRoundResult(roundId: string): RoundResult | undefined {
        return savedResults.get(roundId);
      },
      saveRoundResult(result: RoundResult): void {
        savedResults.set(result.roundId as string, result);
      },
    };
    accumulator = new ContextDeltaAccumulator(0.85);
  });

  it('should fail if prerequisites are not met', async () => {
    const runner = new RoundRunner(store, accumulator, '/tmp/test-rounds');
    const result = await runner.executeRound(ROUND_07);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('round-06');
    }
  });

  it('should execute round when prerequisites are met', async () => {
    // Mock prerequisite result
    const prereqResult: RoundResult = {
      roundId: toRoundId('round-06'),
      qualityScore: {
        dimensions: [
          { dimension: 'completeness', value: 0.8, confidence: 0.7, weight: 0.3 },
        ],
        overall: 0.8,
        overallConfidence: 0.7,
      },
      extractedPatterns: ['pattern-1'],
      contextDelta: {
        iteration: 6,
        newPatterns: [],
        failingStrategies: [],
        qualityBefore: 0.6,
        qualityAfter: 0.8,
        steerDirection: 'continue',
        discoveredTypes: [],
      },
      duration: 5000,
      eventsLogPath: '/tmp/events.jsonl',
    };

    savedResults.set('round-06', prereqResult);

    const tmpDir = `/tmp/test-rounds-${Date.now()}`;
    const runner = new RoundRunner(store, accumulator, tmpDir);
    const result = await runner.executeRound(ROUND_07);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.roundId).toBe(ROUND_07.id);
      expect(result.value.qualityScore.overall).toBeGreaterThan(0);
      expect(result.value.duration).toBeGreaterThanOrEqual(0);
      expect(result.value.extractedPatterns.length).toBeGreaterThan(0);
      expect(result.value.contextDelta).toBeDefined();
    }

    // Cleanup
    const fs = await import('node:fs');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should add context delta to accumulator after round', async () => {
    const prereqResult: RoundResult = {
      roundId: toRoundId('round-06'),
      qualityScore: {
        dimensions: [],
        overall: 0.8,
        overallConfidence: 0.7,
      },
      extractedPatterns: [],
      contextDelta: {
        iteration: 6,
        newPatterns: [],
        failingStrategies: [],
        qualityBefore: 0.6,
        qualityAfter: 0.8,
        steerDirection: 'continue',
        discoveredTypes: [],
      },
      duration: 5000,
      eventsLogPath: '/tmp/events.jsonl',
    };

    savedResults.set('round-06', prereqResult);

    const tmpDir = `/tmp/test-rounds-acc-${Date.now()}`;
    const runner = new RoundRunner(store, accumulator, tmpDir);
    await runner.executeRound(ROUND_07);

    expect(accumulator.getHistory().length).toBe(1);

    // Cleanup
    const fs = await import('node:fs');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
