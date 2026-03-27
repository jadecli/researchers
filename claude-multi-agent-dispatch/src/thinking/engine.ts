import type {
  ShannonThought,
  ThoughtType,
  Assumption,
  ThoughtChain,
  ThinkingReport,
} from '../types/thinking.js';

// ─── ThinkingEngine ──────────────────────────────────────────────────────────
// Implements Shannon-style structured thinking with dependency tracking,
// topological ordering, confidence calibration, and assumption management.

export class ThinkingEngine {
  private thoughts: Map<string, ShannonThought> = new Map();
  private revisionCounter = 0;

  /**
   * Add a thought to the engine.
   * Validates that all declared dependencies exist and checks for circular dependencies.
   */
  addThought(thought: ShannonThought): void {
    // Validate confidence bounds
    if (thought.confidence < 0 || thought.confidence > 1) {
      throw new Error(`Confidence must be in [0, 1], got ${thought.confidence}`);
    }
    if (thought.uncertainty < 0 || thought.uncertainty > 1) {
      throw new Error(`Uncertainty must be in [0, 1], got ${thought.uncertainty}`);
    }

    // Validate all dependencies exist
    for (const depId of thought.dependencies) {
      if (!this.thoughts.has(depId)) {
        throw new Error(
          `Dependency "${depId}" not found. Add it before adding thought "${thought.id}".`,
        );
      }
    }

    // Check for circular dependencies before inserting
    // Temporarily add the thought, check for cycles, remove if cyclic
    this.thoughts.set(thought.id, thought);
    if (this.hasCycle()) {
      this.thoughts.delete(thought.id);
      throw new Error(
        `Adding thought "${thought.id}" would create a circular dependency.`,
      );
    }
  }

  /**
   * Detects cycles using DFS with coloring.
   * WHITE (unvisited) -> GRAY (in progress) -> BLACK (complete)
   */
  private hasCycle(): boolean {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();

    for (const id of this.thoughts.keys()) {
      color.set(id, WHITE);
    }

    const dfs = (nodeId: string): boolean => {
      color.set(nodeId, GRAY);
      const thought = this.thoughts.get(nodeId);
      if (thought) {
        for (const depId of thought.dependencies) {
          const depColor = color.get(depId);
          if (depColor === GRAY) return true; // back edge = cycle
          if (depColor === WHITE && dfs(depId)) return true;
        }
      }
      color.set(nodeId, BLACK);
      return false;
    };

    for (const id of this.thoughts.keys()) {
      if (color.get(id) === WHITE) {
        if (dfs(id)) return true;
      }
    }
    return false;
  }

  /**
   * Topological sort of thought dependencies using Kahn's algorithm.
   * Returns thought IDs in dependency-resolved order (dependencies first).
   */
  resolveOrder(): string[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Initialize
    for (const [id, thought] of this.thoughts) {
      inDegree.set(id, thought.dependencies.length);
      // Each dependency has an edge pointing to this thought
      for (const depId of thought.dependencies) {
        const existing = adjacency.get(depId) ?? [];
        existing.push(id);
        adjacency.set(depId, existing);
      }
      if (!adjacency.has(id)) {
        adjacency.set(id, []);
      }
    }

    // Start with nodes that have no dependencies
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      const neighbors = adjacency.get(current) ?? [];
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (sorted.length !== this.thoughts.size) {
      throw new Error('Circular dependency detected during topological sort.');
    }

    return sorted;
  }

  /**
   * Calibrate the confidence of a thought based on:
   * 1. Its assumption statuses (challenged/invalidated assumptions reduce confidence)
   * 2. The confidence of its dependency thoughts
   */
  calibrateConfidence(thoughtId: string): number {
    const thought = this.thoughts.get(thoughtId);
    if (!thought) {
      throw new Error(`Thought "${thoughtId}" not found.`);
    }

    let baseConfidence = thought.confidence;

    // Factor 1: Assumption health
    const assumptions = thought.assumptions;
    if (assumptions.length > 0) {
      let assumptionPenalty = 0;
      for (const assumption of assumptions) {
        switch (assumption.status) {
          case 'active':
            // No penalty
            break;
          case 'challenged':
            assumptionPenalty += 0.15;
            break;
          case 'invalidated':
            assumptionPenalty += 0.35;
            break;
        }
      }
      // Normalize penalty by number of assumptions, cap at 0.8
      const normalizedPenalty = Math.min(assumptionPenalty / assumptions.length, 0.8);
      baseConfidence *= (1 - normalizedPenalty);
    }

    // Factor 2: Dependency confidence (geometric mean influence)
    if (thought.dependencies.length > 0) {
      let depConfidenceProduct = 1;
      for (const depId of thought.dependencies) {
        const dep = this.thoughts.get(depId);
        if (dep) {
          depConfidenceProduct *= dep.confidence;
        }
      }
      const depConfidenceMean = Math.pow(depConfidenceProduct, 1 / thought.dependencies.length);
      // Blend: 70% own confidence, 30% dependency confidence
      baseConfidence = baseConfidence * 0.7 + depConfidenceMean * 0.3;
    }

    // Clamp to [0, 1]
    const calibrated = Math.max(0, Math.min(1, baseConfidence));

    // Update the thought's confidence in place
    thought.confidence = calibrated;

    return calibrated;
  }

  /**
   * Generate a revision thought that is linked to the original.
   */
  generateRevision(
    thoughtId: string,
    newContent: string,
    confidence: number,
  ): ShannonThought {
    const original = this.thoughts.get(thoughtId);
    if (!original) {
      throw new Error(`Cannot revise: thought "${thoughtId}" not found.`);
    }

    this.revisionCounter++;
    const revisionId = `${thoughtId}-rev-${this.revisionCounter}`;

    const revision: ShannonThought = {
      id: revisionId,
      type: original.type,
      content: newContent,
      confidence,
      uncertainty: 1 - confidence,
      assumptions: [...original.assumptions],
      dependencies: [...original.dependencies, thoughtId],
      isRevision: true,
      revisesThoughtId: thoughtId,
      timestamp: new Date(),
    };

    this.addThought(revision);
    return revision;
  }

  /**
   * Compute the overall confidence of the entire thought chain.
   * Uses a weighted average where weights are based on the number of dependents
   * (thoughts that others depend on are weighted more heavily).
   */
  computeOverallConfidence(): number {
    if (this.thoughts.size === 0) return 0;

    // Count how many thoughts depend on each thought
    const dependentCount = new Map<string, number>();
    for (const id of this.thoughts.keys()) {
      dependentCount.set(id, 0);
    }

    for (const thought of this.thoughts.values()) {
      for (const depId of thought.dependencies) {
        dependentCount.set(depId, (dependentCount.get(depId) ?? 0) + 1);
      }
    }

    // Weight = 1 + number of dependents (so foundational thoughts matter more)
    let weightedSum = 0;
    let totalWeight = 0;
    for (const [id, thought] of this.thoughts) {
      const weight = 1 + (dependentCount.get(id) ?? 0);
      weightedSum += thought.confidence * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Collect all unique assumptions across all thoughts.
   */
  getAssumptions(): Assumption[] {
    const seen = new Set<string>();
    const result: Assumption[] = [];

    for (const thought of this.thoughts.values()) {
      for (const assumption of thought.assumptions) {
        if (!seen.has(assumption.id)) {
          seen.add(assumption.id);
          result.push(assumption);
        }
      }
    }

    return result;
  }

  /**
   * Challenge an assumption by ID.
   * Marks it as challenged (or invalidated if already challenged),
   * and reduces confidence of all thoughts that hold this assumption.
   */
  challengeAssumption(assumptionId: string, evidence: string): void {
    let found = false;

    for (const thought of this.thoughts.values()) {
      for (const assumption of thought.assumptions) {
        if (assumption.id === assumptionId) {
          found = true;
          if (assumption.status === 'active') {
            assumption.status = 'challenged';
          } else if (assumption.status === 'challenged') {
            assumption.status = 'invalidated';
          }
          assumption.evidence = evidence;

          // Recalibrate the thought's confidence
          this.calibrateConfidence(thought.id);
        }
      }
    }

    if (!found) {
      throw new Error(`Assumption "${assumptionId}" not found in any thought.`);
    }
  }

  /**
   * Generate the full thinking report.
   */
  getReport(): ThinkingReport {
    const resolvedOrder = this.resolveOrder();

    const chain: ThoughtChain = {
      thoughts: Array.from(this.thoughts.values()),
      resolvedOrder,
    };

    const overallConfidence = this.computeOverallConfidence();

    const unresolvedAssumptions = this.getAssumptions().filter(
      (a) => a.status !== 'active',
    );

    return {
      chain,
      overallConfidence,
      unresolvedAssumptions,
    };
  }

  /**
   * Get a thought by ID. Returns undefined if not found.
   */
  getThought(id: string): ShannonThought | undefined {
    return this.thoughts.get(id);
  }

  /**
   * Get the total number of thoughts.
   */
  get size(): number {
    return this.thoughts.size;
  }
}
