import type { ContextDeltaPayload } from '../types/quality.js';

// ─── ContextDeltaAccumulator ────────────────────────────────────────────────
// Accumulates context deltas across refinement iterations.

export class ContextDeltaAccumulator {
  private deltas: ContextDeltaPayload[] = [];
  private qualityThreshold: number;

  constructor(qualityThreshold: number = 0.85) {
    this.qualityThreshold = qualityThreshold;
  }

  /** Add a delta from a refinement iteration. */
  add(delta: ContextDeltaPayload): void {
    this.deltas.push(delta);
  }

  /**
   * Merge all deltas into a single cumulative delta:
   * - Combines all newPatterns (deduplicated)
   * - Combines all failingStrategies (deduplicated)
   * - Takes the first qualityBefore and last qualityAfter
   * - Averages quality trajectory
   */
  getCumulativeDelta(): ContextDeltaPayload {
    if (this.deltas.length === 0) {
      return {
        iteration: 0,
        newPatterns: [],
        failingStrategies: [],
        qualityBefore: 0,
        qualityAfter: 0,
        steerDirection: 'No iterations completed',
        discoveredTypes: [],
      };
    }

    const allPatterns = new Set<string>();
    const allFailing = new Set<string>();
    const allTypes = new Set<string>();

    for (const delta of this.deltas) {
      for (const p of delta.newPatterns) allPatterns.add(p);
      for (const f of delta.failingStrategies) allFailing.add(f);
      for (const t of delta.discoveredTypes) allTypes.add(t);
    }

    const first = this.deltas[0]!;
    const last = this.deltas[this.deltas.length - 1]!;

    return {
      iteration: this.deltas.length,
      newPatterns: Array.from(allPatterns),
      failingStrategies: Array.from(allFailing),
      qualityBefore: first.qualityBefore,
      qualityAfter: last.qualityAfter,
      steerDirection: last.steerDirection,
      discoveredTypes: Array.from(allTypes),
    };
  }

  /**
   * Should we continue iterating?
   * Returns false if:
   * - Quality is stagnant (< 0.001 improvement for 3 consecutive iterations)
   * - Quality has met or exceeded the threshold
   */
  shouldContinue(): boolean {
    if (this.deltas.length === 0) return true;

    const last = this.deltas[this.deltas.length - 1]!;

    // Quality threshold met
    if (last.qualityAfter >= this.qualityThreshold) return false;

    // Check stagnation over last 3 iterations
    if (this.deltas.length >= 3) {
      const recent = this.deltas.slice(-3);
      const maxImprovement = Math.max(
        ...recent.map((d) => Math.abs(d.qualityAfter - d.qualityBefore)),
      );
      if (maxImprovement < 0.001) return false;
    }

    return true;
  }

  /**
   * Build a prompt fragment to inject context from accumulated iterations.
   */
  injectContext(iteration: number): string {
    const cumulative = this.getCumulativeDelta();

    const parts: string[] = [];
    parts.push(`Context from round ${iteration}:`);

    if (cumulative.newPatterns.length > 0) {
      parts.push(`  discovered ${cumulative.newPatterns.join(', ')}`);
    }

    parts.push(
      `  quality ${cumulative.qualityBefore.toFixed(2)} → ${cumulative.qualityAfter.toFixed(2)}`,
    );

    if (cumulative.steerDirection) {
      parts.push(`  focus on ${cumulative.steerDirection}`);
    }

    if (cumulative.failingStrategies.length > 0) {
      parts.push(
        `  avoid: ${cumulative.failingStrategies.join(', ')}`,
      );
    }

    return parts.join('\n');
  }

  /** Get the full history of deltas. */
  getHistory(): ContextDeltaPayload[] {
    return [...this.deltas];
  }

  /** Reset accumulated deltas. */
  reset(): void {
    this.deltas = [];
  }
}
