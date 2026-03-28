// src/orchestrator/crawl-metrics.ts — Quantifiable crawl metrics collector
//
// Tracks per-page, per-approach, and per-round metrics with JSONL persistence.
// Every number is a measurable quantity — no qualitative descriptions.

import { JSONLWriter } from '../logging/jsonl.js';

// ─── Per-Page Metrics ───────────────────────────────────────────────────────

export interface PageMetrics {
  readonly url: string;
  readonly approach: CrawlApproach;
  readonly fetchLatencyMs: number;
  readonly extractLatencyMs: number;
  readonly totalLatencyMs: number;
  readonly httpStatus: number;
  readonly contentLengthBytes: number;
  readonly extractedChars: number;
  readonly headingsCount: number;
  readonly codeBlocksCount: number;
  readonly linksCount: number;
  readonly qualityScore: number;
  readonly timestamp: string;
  readonly error: string | null;
}

// ─── Approach Identifier ────────────────────────────────────────────────────

export type CrawlApproach =
  | 'direct-fetch'      // HTTP fetch + inline extraction
  | 'spider-subprocess' // Scrapy via execSync
  | 'agent-sdk-stream'; // Agent SDK v2 session.stream()

// ─── Approach Summary ───────────────────────────────────────────────────────

export interface ApproachSummary {
  readonly approach: CrawlApproach;
  readonly pagesAttempted: number;
  readonly pagesSucceeded: number;
  readonly pagesFailed: number;
  readonly successRate: number;
  readonly totalDurationMs: number;
  readonly avgFetchLatencyMs: number;
  readonly avgExtractLatencyMs: number;
  readonly avgTotalLatencyMs: number;
  readonly p50LatencyMs: number;
  readonly p95LatencyMs: number;
  readonly p99LatencyMs: number;
  readonly totalBytesDownloaded: number;
  readonly totalCharsExtracted: number;
  readonly avgQualityScore: number;
  readonly minQualityScore: number;
  readonly maxQualityScore: number;
  readonly throughputPagesPerSec: number;
  readonly throughputBytesPerSec: number;
}

// ─── Round Metrics ──────────────────────────────────────────────────────────

export interface RoundMetrics {
  readonly roundId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly approaches: readonly ApproachSummary[];
  readonly totalPages: number;
  readonly avgQualityAcrossApproaches: number;
  readonly bestApproach: CrawlApproach;
  readonly bestApproachScore: number;
}

// ─── CrawlMetricsCollector ──────────────────────────────────────────────────

export class CrawlMetricsCollector {
  private readonly pages: PageMetrics[] = [];
  private readonly roundId: string;
  private readonly startedAt: Date;
  private writer: JSONLWriter | null = null;

  constructor(roundId: string, logPath?: string) {
    this.roundId = roundId;
    this.startedAt = new Date();
    if (logPath) {
      this.writer = new JSONLWriter(logPath);
    }
  }

  /** Record metrics for a single page crawl. */
  recordPage(metrics: PageMetrics): void {
    this.pages.push(metrics);
    if (this.writer) {
      this.writer.append({
        type: 'crawl_page_metric',
        roundId: this.roundId,
        ...metrics,
        timestamp: new Date(metrics.timestamp),
      } as any);
    }
  }

  /** Get all recorded page metrics. */
  getPages(): readonly PageMetrics[] {
    return this.pages;
  }

  /** Get pages filtered by approach. */
  getPagesByApproach(approach: CrawlApproach): PageMetrics[] {
    return this.pages.filter((p) => p.approach === approach);
  }

  /** Compute summary for a specific approach. */
  summarizeApproach(approach: CrawlApproach): ApproachSummary {
    const pages = this.getPagesByApproach(approach);
    const succeeded = pages.filter((p) => p.error === null);
    const failed = pages.filter((p) => p.error !== null);

    const latencies = succeeded.map((p) => p.totalLatencyMs).sort((a, b) => a - b);
    const totalDuration = pages.reduce((s, p) => s + p.totalLatencyMs, 0);

    return {
      approach,
      pagesAttempted: pages.length,
      pagesSucceeded: succeeded.length,
      pagesFailed: failed.length,
      successRate: pages.length > 0 ? succeeded.length / pages.length : 0,
      totalDurationMs: totalDuration,
      avgFetchLatencyMs: avg(succeeded.map((p) => p.fetchLatencyMs)),
      avgExtractLatencyMs: avg(succeeded.map((p) => p.extractLatencyMs)),
      avgTotalLatencyMs: avg(latencies),
      p50LatencyMs: percentile(latencies, 0.50),
      p95LatencyMs: percentile(latencies, 0.95),
      p99LatencyMs: percentile(latencies, 0.99),
      totalBytesDownloaded: succeeded.reduce((s, p) => s + p.contentLengthBytes, 0),
      totalCharsExtracted: succeeded.reduce((s, p) => s + p.extractedChars, 0),
      avgQualityScore: avg(succeeded.map((p) => p.qualityScore)),
      minQualityScore: succeeded.length > 0 ? Math.min(...succeeded.map((p) => p.qualityScore)) : 0,
      maxQualityScore: succeeded.length > 0 ? Math.max(...succeeded.map((p) => p.qualityScore)) : 0,
      throughputPagesPerSec: totalDuration > 0 ? (succeeded.length / totalDuration) * 1000 : 0,
      throughputBytesPerSec: totalDuration > 0
        ? (succeeded.reduce((s, p) => s + p.contentLengthBytes, 0) / totalDuration) * 1000
        : 0,
    };
  }

  /** Compute full round metrics comparing all approaches used. */
  summarizeRound(): RoundMetrics {
    const now = new Date();
    const approachesUsed = [...new Set(this.pages.map((p) => p.approach))];
    const summaries = approachesUsed.map((a) => this.summarizeApproach(a));

    let bestApproach: CrawlApproach = 'direct-fetch';
    let bestScore = 0;
    for (const s of summaries) {
      // Composite score: 40% quality + 30% success rate + 30% throughput (normalized)
      const maxThroughput = Math.max(...summaries.map((x) => x.throughputPagesPerSec), 0.001);
      const composite =
        s.avgQualityScore * 0.4 +
        s.successRate * 0.3 +
        (s.throughputPagesPerSec / maxThroughput) * 0.3;
      if (composite > bestScore) {
        bestScore = composite;
        bestApproach = s.approach;
      }
    }

    const durationMs = now.getTime() - this.startedAt.getTime();

    return {
      roundId: this.roundId,
      startedAt: this.startedAt.toISOString(),
      completedAt: now.toISOString(),
      durationMs,
      approaches: summaries,
      totalPages: this.pages.length,
      avgQualityAcrossApproaches: avg(summaries.map((s) => s.avgQualityScore)),
      bestApproach,
      bestApproachScore: bestScore,
    };
  }

  /** Format a human-readable comparison table. */
  formatComparison(): string {
    const round = this.summarizeRound();
    const lines: string[] = [];

    lines.push(`\n${'═'.repeat(80)}`);
    lines.push(`  CRAWL METRICS — Round: ${round.roundId}`);
    lines.push(`  Duration: ${(round.durationMs / 1000).toFixed(1)}s | Pages: ${round.totalPages}`);
    lines.push(`${'═'.repeat(80)}`);

    for (const a of round.approaches) {
      lines.push(`\n  ┌─ ${a.approach.toUpperCase()} ${'─'.repeat(60 - a.approach.length)}`);
      lines.push(`  │ Pages:     ${a.pagesSucceeded}/${a.pagesAttempted} succeeded (${(a.successRate * 100).toFixed(1)}%)`);
      lines.push(`  │ Latency:   avg=${a.avgTotalLatencyMs.toFixed(0)}ms  p50=${a.p50LatencyMs.toFixed(0)}ms  p95=${a.p95LatencyMs.toFixed(0)}ms  p99=${a.p99LatencyMs.toFixed(0)}ms`);
      lines.push(`  │ Fetch:     avg=${a.avgFetchLatencyMs.toFixed(0)}ms`);
      lines.push(`  │ Extract:   avg=${a.avgExtractLatencyMs.toFixed(0)}ms`);
      lines.push(`  │ Quality:   avg=${a.avgQualityScore.toFixed(3)}  min=${a.minQualityScore.toFixed(3)}  max=${a.maxQualityScore.toFixed(3)}`);
      lines.push(`  │ Bytes:     ${formatBytes(a.totalBytesDownloaded)} downloaded → ${formatBytes(a.totalCharsExtracted)} extracted`);
      lines.push(`  │ Throughput: ${a.throughputPagesPerSec.toFixed(2)} pages/s  ${formatBytes(a.throughputBytesPerSec)}/s`);
      lines.push(`  └${'─'.repeat(70)}`);
    }

    lines.push(`\n  ★ Best approach: ${round.bestApproach} (composite score: ${round.bestApproachScore.toFixed(3)})`);
    lines.push(`${'═'.repeat(80)}\n`);

    return lines.join('\n');
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]!;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
