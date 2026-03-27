// ─── Types ──────────────────────────────────────────────────────────────────

export interface SelectorPatch {
  agentId: string;
  dimension: string;
  oldWeight: number;
  newWeight: number;
  reason: string;
}

export interface AgentProfile {
  agentId: string;
  capabilities: Record<string, number>; // dimension → weight
  taskTypes: string[];
}

interface HistoryEntry {
  agentId: string;
  taskType: string;
  score: number;
}

// ─── SelectorEvolver ────────────────────────────────────────────────────────
// Evolves agent selection weights based on historical performance.

export class SelectorEvolver {
  private history: HistoryEntry[] = [];

  /** Record a scored task execution by an agent. */
  record(agentId: string, taskType: string, score: number): void {
    this.history.push({ agentId, taskType, score });
  }

  /**
   * Evolve selector weights: produce patches that adjust agent capabilities
   * based on observed performance.
   */
  evolve(): SelectorPatch[] {
    const patches: SelectorPatch[] = [];

    // Group by agent
    const byAgent = new Map<string, HistoryEntry[]>();
    for (const entry of this.history) {
      const existing = byAgent.get(entry.agentId) ?? [];
      existing.push(entry);
      byAgent.set(entry.agentId, existing);
    }

    for (const [agentId, entries] of byAgent.entries()) {
      // Group by task type for this agent
      const byTask = new Map<string, number[]>();
      for (const entry of entries) {
        const scores = byTask.get(entry.taskType) ?? [];
        scores.push(entry.score);
        byTask.set(entry.taskType, scores);
      }

      for (const [taskType, scores] of byTask.entries()) {
        const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length;
        // Current weight is assumed 0.5 (neutral) if not specified
        const currentWeight = 0.5;

        // Adjust weight toward performance
        const newWeight = currentWeight + (avgScore - 0.5) * 0.3;
        const clampedWeight = Math.min(1, Math.max(0, newWeight));

        if (Math.abs(clampedWeight - currentWeight) > 0.01) {
          let reason: string;
          if (avgScore >= 0.8) {
            reason = `Strong performance on ${taskType} (avg ${avgScore.toFixed(2)})`;
          } else if (avgScore >= 0.6) {
            reason = `Adequate performance on ${taskType} (avg ${avgScore.toFixed(2)})`;
          } else {
            reason = `Weak performance on ${taskType} (avg ${avgScore.toFixed(2)}), reducing weight`;
          }

          patches.push({
            agentId,
            dimension: taskType,
            oldWeight: currentWeight,
            newWeight: clampedWeight,
            reason,
          });
        }
      }
    }

    return patches;
  }

  /** Get the agent with the highest average score for a task type. */
  getBestAgent(taskType: string): string {
    const byAgent = new Map<string, number[]>();
    for (const entry of this.history) {
      if (entry.taskType === taskType) {
        const scores = byAgent.get(entry.agentId) ?? [];
        scores.push(entry.score);
        byAgent.set(entry.agentId, scores);
      }
    }

    let bestAgent = '';
    let bestAvg = -Infinity;
    for (const [agentId, scores] of byAgent.entries()) {
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestAgent = agentId;
      }
    }

    return bestAgent;
  }

  /** Identify the weakest capability dimension for an agent. */
  getWorstDimension(agentId: string): string {
    const byTask = new Map<string, number[]>();
    for (const entry of this.history) {
      if (entry.agentId === agentId) {
        const scores = byTask.get(entry.taskType) ?? [];
        scores.push(entry.score);
        byTask.set(entry.taskType, scores);
      }
    }

    let worstDim = '';
    let worstAvg = Infinity;
    for (const [taskType, scores] of byTask.entries()) {
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      if (avg < worstAvg) {
        worstAvg = avg;
        worstDim = taskType;
      }
    }

    return worstDim;
  }

  /** Apply patches to agent profiles, updating capability weights. */
  applyPatches(
    profiles: AgentProfile[],
    patches: SelectorPatch[],
  ): AgentProfile[] {
    return profiles.map((profile) => {
      const agentPatches = patches.filter(
        (p) => p.agentId === profile.agentId,
      );
      if (agentPatches.length === 0) return profile;

      const updatedCapabilities = { ...profile.capabilities };
      for (const patch of agentPatches) {
        updatedCapabilities[patch.dimension] = patch.newWeight;
      }

      return {
        ...profile,
        capabilities: updatedCapabilities,
      };
    });
  }
}
