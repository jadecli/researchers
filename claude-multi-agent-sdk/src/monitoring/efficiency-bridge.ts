// src/monitoring/efficiency-bridge.ts — Bridge between agent loop telemetry and crawl metrics
//
// Emits per-turn tool call counts as JSONL events that the Scrapy
// EfficiencyTracker reads to correlate agent overhead with pages crawled.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { USD } from '../types/core.js';
import { toUSD } from '../types/core.js';

// ── Efficiency Event Types ──────────────────────────────────────

export type EfficiencyEvent =
  | {
      readonly type: 'turn_completed';
      readonly sessionId: string;
      readonly turnNumber: number;
      readonly toolCallsThisTurn: number;
      readonly cumulativeToolCalls: number;
      readonly timestamp: string;
    }
  | {
      readonly type: 'session_efficiency';
      readonly sessionId: string;
      readonly totalTurns: number;
      readonly totalToolCalls: number;
      readonly toolCallsPerTurn: number;
      readonly costPerToolCall: number;
      readonly totalCost: number;
      readonly timestamp: string;
    };

// ── Efficiency Bridge ───────────────────────────────────────────

export class EfficiencyBridge {
  private readonly eventsDir: string;
  private events: EfficiencyEvent[] = [];
  private cumulativeToolCalls = 0;

  constructor(eventsDir: string = 'metrics') {
    this.eventsDir = eventsDir;
  }

  /**
   * Record tool calls from a single agent loop turn.
   * Called after each turn completes in runAgentLoop.
   */
  recordTurn(
    sessionId: string,
    turnNumber: number,
    toolCallsThisTurn: number,
  ): void {
    this.cumulativeToolCalls += toolCallsThisTurn;
    const event: EfficiencyEvent = {
      type: 'turn_completed',
      sessionId,
      turnNumber,
      toolCallsThisTurn,
      cumulativeToolCalls: this.cumulativeToolCalls,
      timestamp: new Date().toISOString(),
    };
    this.events.push(event);
  }

  /**
   * Emit session-level efficiency summary when the agent loop ends.
   */
  recordSessionEnd(
    sessionId: string,
    totalTurns: number,
    totalToolCalls: number,
    totalCostUsd: number,
  ): void {
    const event: EfficiencyEvent = {
      type: 'session_efficiency',
      sessionId,
      totalTurns,
      totalToolCalls,
      toolCallsPerTurn:
        totalTurns > 0 ? totalToolCalls / totalTurns : 0,
      costPerToolCall:
        totalToolCalls > 0 ? totalCostUsd / totalToolCalls : 0,
      totalCost: totalCostUsd,
      timestamp: new Date().toISOString(),
    };
    this.events.push(event);
  }

  /**
   * Flush all recorded events to disk as JSONL.
   */
  flush(filename?: string): string {
    if (!fs.existsSync(this.eventsDir)) {
      fs.mkdirSync(this.eventsDir, { recursive: true });
    }

    const fname =
      filename ?? `efficiency_${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`;
    const filepath = path.join(this.eventsDir, fname);

    const lines = this.events
      .map((e) => JSON.stringify(e))
      .join('\n');
    fs.writeFileSync(filepath, lines + '\n', 'utf-8');

    return filepath;
  }

  getEvents(): ReadonlyArray<EfficiencyEvent> {
    return this.events;
  }

  reset(): void {
    this.events = [];
    this.cumulativeToolCalls = 0;
  }
}

// ── Compute Efficiency Ratio ────────────────────────────────────

export interface EfficiencyRatio {
  readonly toolCallsPerPage: number;
  readonly pagesPerDollar: number;
  readonly turnsPerPage: number;
  readonly costPerPage: number;
}

export function computeEfficiencyRatio(
  totalToolCalls: number,
  totalPages: number,
  totalTurns: number,
  totalCostUsd: number,
): EfficiencyRatio {
  return {
    toolCallsPerPage:
      totalPages > 0 ? totalToolCalls / totalPages : 0,
    pagesPerDollar:
      totalCostUsd > 0 ? totalPages / totalCostUsd : 0,
    turnsPerPage:
      totalPages > 0 ? totalTurns / totalPages : 0,
    costPerPage:
      totalPages > 0 ? totalCostUsd / totalPages : 0,
  };
}
