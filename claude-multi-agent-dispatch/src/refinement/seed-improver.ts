// ─── ImprovementResult ──────────────────────────────────────────────────────

export interface ImprovementResult {
  originalSeed: string;
  improvedSeed: string;
  originalScore: number;
  improvedScore: number;
  iterationsUsed: number;
  convergenceReason: 'target_met' | 'stagnant' | 'max_iterations';
}

// ─── SeedImprover ───────────────────────────────────────────────────────────
// Iteratively improves a seed string using an evaluator function.

export class SeedImprover {
  private readonly evaluator: (seed: string) => Promise<number>;
  private readonly targetScore: number;

  constructor(
    evaluator: (seed: string) => Promise<number>,
    targetScore: number = 0.9,
  ) {
    this.evaluator = evaluator;
    this.targetScore = targetScore;
  }

  /**
   * Improve a seed string iteratively.
   * Generates candidates, scores them, and selects the best.
   */
  async improve(
    currentSeed: string,
    iterations: number = 10,
  ): Promise<ImprovementResult> {
    const originalScore = await this.evaluator(currentSeed);
    let bestSeed = currentSeed;
    let bestScore = originalScore;
    const history: number[] = [originalScore];

    let iterationsUsed = 0;
    let convergenceReason: ImprovementResult['convergenceReason'] = 'max_iterations';

    for (let i = 0; i < iterations; i++) {
      iterationsUsed = i + 1;

      // Generate candidate variations
      const candidates = this.generateCandidates(bestSeed, 5);

      // Score all candidates
      const scored = await this.scoreCandidates(candidates);

      // Select the best candidate
      const topCandidate = scored.sort((a, b) => b.score - a.score)[0];

      if (topCandidate && topCandidate.score > bestScore) {
        bestSeed = topCandidate.seed;
        bestScore = topCandidate.score;
      }

      history.push(bestScore);

      // Check target met
      if (bestScore >= this.targetScore) {
        convergenceReason = 'target_met';
        break;
      }

      // Check stagnation
      if (this.detectStagnation(history)) {
        convergenceReason = 'stagnant';
        break;
      }

      // Check regression
      if (this.detectRegression(history)) {
        // Regression detected but we keep the best seen so far
        // Continue trying unless stagnant
      }
    }

    return {
      originalSeed: currentSeed,
      improvedSeed: bestSeed,
      originalScore,
      improvedScore: bestScore,
      iterationsUsed,
      convergenceReason,
    };
  }

  // ─── Internal methods ───────────────────────────────────────────────────

  /** Generate n candidate variations of the seed. */
  generateCandidates(seed: string, n: number = 5): string[] {
    const candidates: string[] = [];
    const words = seed.split(/\s+/);

    for (let i = 0; i < n; i++) {
      switch (i % 5) {
        case 0:
          // Expand: add clarifying detail
          candidates.push(seed + '\n\nAdditional detail: provide comprehensive coverage.');
          break;
        case 1:
          // Restructure: add structure markers
          candidates.push(
            `## Overview\n${seed}\n\n## Key Points\n- Point 1\n- Point 2`,
          );
          break;
        case 2:
          // Condense: keep first 80% of words
          candidates.push(
            words.slice(0, Math.ceil(words.length * 0.8)).join(' '),
          );
          break;
        case 3:
          // Rephrase opening
          candidates.push(
            `Specifically, ${seed.charAt(0).toLowerCase()}${seed.slice(1)}`,
          );
          break;
        case 4:
          // Add emphasis on accuracy
          candidates.push(
            seed +
              '\n\nNote: All claims should be verified against primary sources.',
          );
          break;
      }
    }

    return candidates;
  }

  /** Score an array of candidate seeds. */
  async scoreCandidates(
    candidates: string[],
  ): Promise<{ seed: string; score: number }[]> {
    const results: { seed: string; score: number }[] = [];
    for (const seed of candidates) {
      const score = await this.evaluator(seed);
      results.push({ seed, score });
    }
    return results;
  }

  /**
   * Detect stagnation: less than 0.001 improvement over the last 3 iterations.
   */
  detectStagnation(history: number[]): boolean {
    if (history.length < 4) return false;
    const recent = history.slice(-4);
    const maxDelta = Math.max(
      ...recent.slice(1).map((v, i) => Math.abs(v - recent[i]!)),
    );
    return maxDelta < 0.001;
  }

  /**
   * Detect regression: score decreased for the last 2 iterations.
   */
  detectRegression(history: number[]): boolean {
    if (history.length < 3) return false;
    const len = history.length;
    return (
      history[len - 1]! < history[len - 2]! &&
      history[len - 2]! < history[len - 3]!
    );
  }
}
