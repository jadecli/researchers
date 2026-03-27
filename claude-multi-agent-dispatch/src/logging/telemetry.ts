import type { ModelId, USD, TokenCount } from '../types/core.js';
import { toUSD, toTokenCount } from '../types/core.js';

// ─── Model Pricing ──────────────────────────────────────────────────────────
// Prices per million tokens.

export const MODEL_PRICING: Record<
  ModelId,
  {
    inputPerMillion: number;
    outputPerMillion: number;
    cacheReadPerMillion: number;
    cacheWritePerMillion: number;
  }
> = {
  'claude-opus-4-20250514': {
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
    cacheReadPerMillion: 1.5,
    cacheWritePerMillion: 18.75,
  },
  'claude-sonnet-4-20250514': {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheReadPerMillion: 0.3,
    cacheWritePerMillion: 3.75,
  },
  'claude-haiku-3-20250307': {
    inputPerMillion: 0.25,
    outputPerMillion: 1.25,
    cacheReadPerMillion: 0.03,
    cacheWritePerMillion: 0.3,
  },
};

// ─── Cost calculation ───────────────────────────────────────────────────────

export function calculateCost(
  model: ModelId,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number = 0,
  cacheWriteTokens: number = 0,
): USD {
  const pricing = MODEL_PRICING[model];
  const cost =
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion +
    (cacheReadTokens / 1_000_000) * pricing.cacheReadPerMillion +
    (cacheWriteTokens / 1_000_000) * pricing.cacheWritePerMillion;
  return toUSD(cost);
}

// ─── Dispatch record types ──────────────────────────────────────────────────

interface DispatchRecord {
  dispatchId: string;
  taskSummary: string;
  agentCount: number;
  startedAt: Date;
  costs: USD[];
}

interface RoundRecord {
  roundId: string;
  roundName: string;
  startedAt: Date;
  completedAt?: Date;
  qualityScore?: number;
  costs: USD[];
}

interface UsageRecord {
  model: ModelId;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost: USD;
  timestamp: Date;
  dispatchId?: string;
  roundId?: string;
}

// ─── SessionTracker base ────────────────────────────────────────────────────

export class SessionTracker {
  protected readonly usageRecords: UsageRecord[] = [];
  private readonly sessionStart: Date;

  constructor() {
    this.sessionStart = new Date();
  }

  recordUsage(
    model: ModelId,
    inputTokens: number,
    outputTokens: number,
    cacheReadTokens: number = 0,
    cacheWriteTokens: number = 0,
    context?: { dispatchId?: string; roundId?: string },
  ): void {
    const cost = calculateCost(
      model,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
    );
    this.usageRecords.push({
      model,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      cost,
      timestamp: new Date(),
      dispatchId: context?.dispatchId,
      roundId: context?.roundId,
    });
  }

  getTotalCost(): USD {
    const total = this.usageRecords.reduce(
      (sum, r) => sum + (r.cost as number),
      0,
    );
    return toUSD(total);
  }

  getTotalTokens(): {
    input: TokenCount;
    output: TokenCount;
    cacheRead: TokenCount;
    cacheWrite: TokenCount;
  } {
    const input = this.usageRecords.reduce((s, r) => s + r.inputTokens, 0);
    const output = this.usageRecords.reduce((s, r) => s + r.outputTokens, 0);
    const cacheRead = this.usageRecords.reduce(
      (s, r) => s + r.cacheReadTokens,
      0,
    );
    const cacheWrite = this.usageRecords.reduce(
      (s, r) => s + r.cacheWriteTokens,
      0,
    );
    return {
      input: toTokenCount(input),
      output: toTokenCount(output),
      cacheRead: toTokenCount(cacheRead),
      cacheWrite: toTokenCount(cacheWrite),
    };
  }

  getSessionDuration(): number {
    return Date.now() - this.sessionStart.getTime();
  }
}

// ─── DispatchTracker ────────────────────────────────────────────────────────

export class DispatchTracker extends SessionTracker {
  private readonly dispatches: Map<string, DispatchRecord> = new Map();
  private readonly rounds: Map<string, RoundRecord> = new Map();

  /** Record a new dispatch being started. */
  recordDispatch(
    dispatchId: string,
    taskSummary: string,
    agentCount: number,
  ): void {
    this.dispatches.set(dispatchId, {
      dispatchId,
      taskSummary,
      agentCount,
      startedAt: new Date(),
      costs: [],
    });
  }

  /** Record a round starting. */
  recordRoundStart(roundId: string, roundName: string): void {
    this.rounds.set(roundId, {
      roundId,
      roundName,
      startedAt: new Date(),
      costs: [],
    });
  }

  /** Record a round completing with a quality score. */
  recordRoundComplete(roundId: string, qualityScore: number): void {
    const round = this.rounds.get(roundId);
    if (round) {
      round.completedAt = new Date();
      round.qualityScore = qualityScore;
    }
  }

  /** Get costs for a specific dispatch or all dispatches. */
  getDispatchCosts(dispatchId?: string): {
    dispatchId: string;
    totalCost: USD;
    recordCount: number;
  }[] {
    if (dispatchId) {
      const records = this.usageRecords.filter(
        (r) => r.dispatchId === dispatchId,
      );
      const total = records.reduce((s, r) => s + (r.cost as number), 0);
      return [
        {
          dispatchId,
          totalCost: toUSD(total),
          recordCount: records.length,
        },
      ];
    }

    // Group by dispatch
    const groups = new Map<string, UsageRecord[]>();
    for (const record of this.usageRecords) {
      if (record.dispatchId) {
        const existing = groups.get(record.dispatchId) ?? [];
        existing.push(record);
        groups.set(record.dispatchId, existing);
      }
    }

    return Array.from(groups.entries()).map(([id, records]) => ({
      dispatchId: id,
      totalCost: toUSD(records.reduce((s, r) => s + (r.cost as number), 0)),
      recordCount: records.length,
    }));
  }

  /** Get summary for a specific round. */
  getRoundSummary(roundId: string): {
    roundId: string;
    roundName: string;
    duration: number;
    qualityScore: number | undefined;
    totalCost: USD;
  } | undefined {
    const round = this.rounds.get(roundId);
    if (!round) return undefined;

    const records = this.usageRecords.filter((r) => r.roundId === roundId);
    const totalCost = records.reduce((s, r) => s + (r.cost as number), 0);
    const duration = round.completedAt
      ? round.completedAt.getTime() - round.startedAt.getTime()
      : Date.now() - round.startedAt.getTime();

    return {
      roundId,
      roundName: round.roundName,
      duration,
      qualityScore: round.qualityScore,
      totalCost: toUSD(totalCost),
    };
  }
}
