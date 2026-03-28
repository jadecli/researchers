// src/orchestrator/improvement-chain.ts — Tracks quality deltas across campaign iterations
import type { ContextDelta } from '../models/extraction-result.js';
import {
  isRegression,
} from '../models/extraction-result.js';
import { toIteration } from '../types.js';

// ── Improvement Chain ───────────────────────────────────────────
export class ImprovementChain {
  private readonly history: ContextDelta[] = [];
  private readonly maxStagnant: number;
  private readonly regressionTolerance: number;
  private readonly minImprovement: number;

  constructor(config?: {
    readonly maxStagnant?: number;
    readonly regressionTolerance?: number;
    readonly minImprovement?: number;
  }) {
    this.maxStagnant = config?.maxStagnant ?? 2;
    this.regressionTolerance = config?.regressionTolerance ?? 1;
    this.minImprovement = config?.minImprovement ?? 0.01;
  }

  addIteration(delta: ContextDelta): void {
    this.history.push(delta);
  }

  getCumulativeDelta(): ContextDelta | undefined {
    if (this.history.length === 0) return undefined;

    const allPatterns = new Set<string>();
    const allFailing = new Set<string>();
    const allPageTypes = new Set<string>();

    for (const delta of this.history) {
      for (const p of delta.newPatterns) allPatterns.add(p);
      for (const f of delta.failingSelectors) allFailing.add(f);
      for (const t of delta.discoveredPageTypes) allPageTypes.add(t);
    }

    const first = this.history[0]!;
    const last = this.history[this.history.length - 1]!;

    return {
      iteration: toIteration(this.history.length),
      newPatterns: [...allPatterns],
      failingSelectors: [...allFailing],
      qualityBefore: first.qualityBefore,
      qualityAfter: last.qualityAfter,
      steerDirection: last.steerDirection,
      discoveredPageTypes: [...allPageTypes],
    };
  }

  shouldContinue(): boolean {
    if (this.history.length === 0) return true;

    let consecutiveStagnant = 0;
    for (let i = this.history.length - 1; i >= 0; i--) {
      const delta = this.history[i]!;
      const improvement =
        (delta.qualityAfter as number) - (delta.qualityBefore as number);
      if (improvement < this.minImprovement) {
        consecutiveStagnant++;
      } else {
        break;
      }
    }

    let consecutiveRegressions = 0;
    for (let i = this.history.length - 1; i >= 0; i--) {
      const delta = this.history[i]!;
      if (isRegression(delta)) {
        consecutiveRegressions++;
      } else {
        break;
      }
    }

    if (consecutiveStagnant >= this.maxStagnant) return false;
    if (consecutiveRegressions >= this.regressionTolerance) return false;

    return true;
  }

  getHistory(): readonly ContextDelta[] {
    return [...this.history];
  }

  get iterationCount(): number {
    return this.history.length;
  }

  get totalImprovement(): number {
    if (this.history.length === 0) return 0;
    const first = this.history[0]!;
    const last = this.history[this.history.length - 1]!;
    return (last.qualityAfter as number) - (first.qualityBefore as number);
  }

  get allDiscoveredPatterns(): readonly string[] {
    const patterns = new Set<string>();
    for (const delta of this.history) {
      for (const p of delta.newPatterns) patterns.add(p);
    }
    return [...patterns].sort();
  }
}
