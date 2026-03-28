import { describe, it, expect, beforeEach } from 'vitest';
import {
  CrawlMetricsCollector,
  type PageMetrics,
  type CrawlApproach,
} from '../src/orchestrator/crawl-metrics.js';
import {
  extractContent,
  CrawlOrchestrator,
  ANTHROPIC_DOC_TARGETS,
  type CrawlTarget,
} from '../src/orchestrator/crawl-orchestrator.js';
import {
  runBenchmark,
  formatBenchmarkReport,
} from '../src/orchestrator/approach-benchmark.js';
import { RoundRunner, type AuditStore } from '../src/rounds/runner.js';
import { ContextDeltaAccumulator } from '../src/refinement/context-delta.js';
import { toRoundId } from '../src/types/core.js';
import type { RoundResult } from '../src/rounds/types.js';
import { ROUND_07 } from '../src/rounds/index.js';

// ─── Helper: build a PageMetrics fixture ────────────────────────────────────

function makePageMetrics(
  overrides: Partial<PageMetrics> = {},
): PageMetrics {
  return {
    url: 'https://example.com/page',
    approach: 'direct-fetch' as CrawlApproach,
    fetchLatencyMs: 200,
    extractLatencyMs: 5,
    totalLatencyMs: 205,
    httpStatus: 200,
    contentLengthBytes: 15000,
    extractedChars: 8000,
    headingsCount: 5,
    codeBlocksCount: 2,
    linksCount: 12,
    qualityScore: 0.75,
    timestamp: new Date().toISOString(),
    error: null,
    ...overrides,
  };
}

// ─── CrawlMetricsCollector ──────────────────────────────────────────────────

describe('CrawlMetricsCollector', () => {
  let collector: CrawlMetricsCollector;

  beforeEach(() => {
    collector = new CrawlMetricsCollector('test-round');
  });

  it('should record and retrieve page metrics', () => {
    const m = makePageMetrics({ url: 'https://example.com/a' });
    collector.recordPage(m);

    expect(collector.getPages()).toHaveLength(1);
    expect(collector.getPages()[0]!.url).toBe('https://example.com/a');
  });

  it('should filter pages by approach', () => {
    collector.recordPage(makePageMetrics({ approach: 'direct-fetch' }));
    collector.recordPage(makePageMetrics({ approach: 'spider-subprocess' }));
    collector.recordPage(makePageMetrics({ approach: 'direct-fetch' }));

    expect(collector.getPagesByApproach('direct-fetch')).toHaveLength(2);
    expect(collector.getPagesByApproach('spider-subprocess')).toHaveLength(1);
  });

  it('should compute approach summary with correct counts', () => {
    collector.recordPage(makePageMetrics({ qualityScore: 0.8, error: null }));
    collector.recordPage(makePageMetrics({ qualityScore: 0.6, error: null }));
    collector.recordPage(makePageMetrics({ qualityScore: 0, error: 'timeout' }));

    const summary = collector.summarizeApproach('direct-fetch');

    expect(summary.pagesAttempted).toBe(3);
    expect(summary.pagesSucceeded).toBe(2);
    expect(summary.pagesFailed).toBe(1);
    expect(summary.successRate).toBeCloseTo(2 / 3, 2);
  });

  it('should compute average quality from succeeded pages only', () => {
    collector.recordPage(makePageMetrics({ qualityScore: 0.9, error: null }));
    collector.recordPage(makePageMetrics({ qualityScore: 0.7, error: null }));
    collector.recordPage(makePageMetrics({ qualityScore: 0, error: 'fail' }));

    const summary = collector.summarizeApproach('direct-fetch');

    expect(summary.avgQualityScore).toBeCloseTo(0.8, 2);
    expect(summary.minQualityScore).toBeCloseTo(0.7, 2);
    expect(summary.maxQualityScore).toBeCloseTo(0.9, 2);
  });

  it('should compute latency percentiles from sorted values', () => {
    // Add 10 pages with known latencies
    for (let i = 1; i <= 10; i++) {
      collector.recordPage(makePageMetrics({ totalLatencyMs: i * 100, error: null }));
    }

    const summary = collector.summarizeApproach('direct-fetch');

    expect(summary.p50LatencyMs).toBe(500);
    expect(summary.p95LatencyMs).toBe(1000);
    expect(summary.avgTotalLatencyMs).toBeCloseTo(550, 0);
  });

  it('should handle empty collector gracefully', () => {
    const summary = collector.summarizeApproach('direct-fetch');

    expect(summary.pagesAttempted).toBe(0);
    expect(summary.successRate).toBe(0);
    expect(summary.avgQualityScore).toBe(0);
    expect(summary.p50LatencyMs).toBe(0);
  });

  it('should compute throughput correctly', () => {
    collector.recordPage(makePageMetrics({
      totalLatencyMs: 500,
      contentLengthBytes: 10000,
      error: null,
    }));
    collector.recordPage(makePageMetrics({
      totalLatencyMs: 500,
      contentLengthBytes: 10000,
      error: null,
    }));

    const summary = collector.summarizeApproach('direct-fetch');

    // 2 pages over 1000ms total = 2 pages/sec
    expect(summary.throughputPagesPerSec).toBeCloseTo(2.0, 1);
    // 20000 bytes over 1000ms = 20000 bytes/sec
    expect(summary.throughputBytesPerSec).toBeCloseTo(20000, -1);
  });

  it('should summarize round with best approach selection', () => {
    // Direct fetch: high quality, low latency
    collector.recordPage(makePageMetrics({
      approach: 'direct-fetch',
      qualityScore: 0.85,
      totalLatencyMs: 200,
      error: null,
    }));

    // Spider: lower quality, higher latency
    collector.recordPage(makePageMetrics({
      approach: 'spider-subprocess',
      qualityScore: 0.60,
      totalLatencyMs: 3000,
      error: null,
    }));

    const round = collector.summarizeRound();

    expect(round.totalPages).toBe(2);
    expect(round.approaches).toHaveLength(2);
    expect(round.bestApproach).toBe('direct-fetch');
    expect(round.bestApproachScore).toBeGreaterThan(0);
  });

  it('should format comparison without throwing', () => {
    collector.recordPage(makePageMetrics({ approach: 'direct-fetch', error: null }));
    collector.recordPage(makePageMetrics({ approach: 'spider-subprocess', error: null }));

    const output = collector.formatComparison();

    expect(output).toContain('CRAWL METRICS');
    expect(output).toContain('DIRECT-FETCH');
    expect(output).toContain('SPIDER-SUBPROCESS');
    expect(output).toContain('Best approach');
  });
});

// ─── extractContent ─────────────────────────────────────────────────────────

describe('extractContent', () => {
  it('should extract title from h1', () => {
    const html = '<html><head><title>Page</title></head><body><h1>My Title</h1></body></html>';
    const result = extractContent(html, 'https://example.com');

    expect(result.title).toBe('My Title');
  });

  it('should fall back to <title> if no h1', () => {
    const html = '<html><head><title>Fallback Title</title></head><body><p>Hello</p></body></html>';
    const result = extractContent(html, 'https://example.com');

    expect(result.title).toBe('Fallback Title');
  });

  it('should fall back to URL if no title tags', () => {
    const html = '<html><body><p>Hello</p></body></html>';
    const result = extractContent(html, 'https://example.com/page');

    expect(result.title).toBe('https://example.com/page');
  });

  it('should extract headings', () => {
    const html = '<h1>One</h1><h2>Two</h2><h3>Three</h3>';
    const result = extractContent(html, 'https://example.com');

    expect(result.headings).toEqual(['One', 'Two', 'Three']);
  });

  it('should extract code blocks', () => {
    const html = '<pre><code>const x = 42;\nconsole.log(x);</code></pre>';
    const result = extractContent(html, 'https://example.com');

    expect(result.codeBlocks.length).toBeGreaterThan(0);
    expect(result.codeBlocks[0]).toContain('const x = 42');
  });

  it('should extract links', () => {
    const html = '<a href="https://example.com/a">A</a><a href="/b">B</a><a href="javascript:void(0)">Skip</a>';
    const result = extractContent(html, 'https://example.com');

    expect(result.links).toContain('https://example.com/a');
    expect(result.links).toContain('/b');
    expect(result.links).not.toContain('javascript:void(0)');
  });

  it('should strip script, style, nav, header, footer from content', () => {
    const html = `
      <nav>Navigation</nav>
      <header>Header</header>
      <main><p>Main content here</p></main>
      <footer>Footer</footer>
      <script>alert("hi")</script>
      <style>.x { color: red }</style>
    `;
    const result = extractContent(html, 'https://example.com');

    expect(result.content).toContain('Main content here');
    expect(result.content).not.toContain('alert');
    expect(result.content).not.toContain('color: red');
    expect(result.content).not.toContain('Navigation');
  });

  it('should decode HTML entities', () => {
    const html = '<pre><code>&lt;div&gt; &amp; &quot;hello&quot;</code></pre>';
    const result = extractContent(html, 'https://example.com');

    expect(result.codeBlocks[0]).toContain('<div>');
    expect(result.codeBlocks[0]).toContain('&');
    expect(result.codeBlocks[0]).toContain('"hello"');
  });
});

// ─── ANTHROPIC_DOC_TARGETS ─────────────────────────────────────────────────

describe('ANTHROPIC_DOC_TARGETS', () => {
  it('should have at least 30 targets', () => {
    expect(ANTHROPIC_DOC_TARGETS.length).toBeGreaterThanOrEqual(30);
  });

  it('should have valid priority values for all targets', () => {
    const validPriorities = ['critical', 'high', 'medium', 'low'];
    for (const target of ANTHROPIC_DOC_TARGETS) {
      expect(validPriorities).toContain(target.priority);
    }
  });

  it('should have URLs starting with https://', () => {
    for (const target of ANTHROPIC_DOC_TARGETS) {
      expect(target.url).toMatch(/^https:\/\//);
    }
  });

  it('should have non-empty categories', () => {
    for (const target of ANTHROPIC_DOC_TARGETS) {
      expect(target.category.length).toBeGreaterThan(0);
    }
  });

  it('should include critical tool documentation', () => {
    const criticalToolUrls = ANTHROPIC_DOC_TARGETS
      .filter((t) => t.priority === 'critical' && t.category === 'tools');
    expect(criticalToolUrls.length).toBeGreaterThanOrEqual(3);
  });

  it('should cover all major categories from the user spec', () => {
    const categories = new Set(ANTHROPIC_DOC_TARGETS.map((t) => t.category));
    expect(categories.has('tools')).toBe(true);
    expect(categories.has('capabilities')).toBe(true);
    expect(categories.has('context-management')).toBe(true);
    expect(categories.has('agent-skills')).toBe(true);
  });
});

// ─── CrawlOrchestrator (unit, no network) ───────────────────────────────────

describe('CrawlOrchestrator', () => {
  it('should construct with default config', () => {
    const orchestrator = new CrawlOrchestrator();
    expect(orchestrator).toBeDefined();
  });

  it('should accept custom config', () => {
    const orchestrator = new CrawlOrchestrator({
      concurrency: 5,
      fetchTimeoutMs: 30_000,
      approach: 'agent-sdk-stream',
    });
    expect(orchestrator).toBeDefined();
  });
});

// ─── RoundRunner with CrawlOrchestrator wiring ─────────────────────────────

describe('RoundRunner with CrawlOrchestrator', () => {
  let store: AuditStore;
  let savedResults: Map<string, RoundResult>;
  let accumulator: ContextDeltaAccumulator;

  beforeEach(() => {
    savedResults = new Map();
    store = {
      getRoundResult(roundId: string) {
        return savedResults.get(roundId);
      },
      saveRoundResult(result: RoundResult) {
        savedResults.set(result.roundId as string, result);
      },
    };
    accumulator = new ContextDeltaAccumulator(0.85);
  });

  it('should accept a CrawlOrchestrator in constructor', () => {
    const orchestrator = new CrawlOrchestrator();
    const runner = new RoundRunner(store, accumulator, '/tmp/test', orchestrator);
    expect(runner).toBeDefined();
  });

  it('should still work without CrawlOrchestrator (fallback)', async () => {
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

    const tmpDir = `/tmp/test-crawl-runner-${Date.now()}`;
    // No CrawlOrchestrator passed — should use fallback stub
    const runner = new RoundRunner(store, accumulator, tmpDir);
    const result = await runner.executeRound(ROUND_07);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.roundId).toBe(ROUND_07.id);
      expect(result.value.qualityScore.overall).toBeGreaterThan(0);
      expect(result.value.extractedPatterns.length).toBeGreaterThan(0);
    }

    // Cleanup
    const fs = await import('node:fs');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

// ─── Benchmark formatting ───────────────────────────────────────────────────

describe('formatBenchmarkReport', () => {
  it('should produce a formatted report from benchmark result', () => {
    const result = {
      runId: 'benchmark-test',
      timestamp: new Date().toISOString(),
      targetCount: 5,
      approaches: [
        {
          approach: 'direct-fetch' as CrawlApproach,
          crawlResult: null,
          summary: {
            approach: 'direct-fetch' as CrawlApproach,
            pagesAttempted: 5,
            pagesSucceeded: 4,
            pagesFailed: 1,
            successRate: 0.8,
            totalDurationMs: 2000,
            avgFetchLatencyMs: 300,
            avgExtractLatencyMs: 10,
            avgTotalLatencyMs: 310,
            p50LatencyMs: 280,
            p95LatencyMs: 500,
            p99LatencyMs: 600,
            totalBytesDownloaded: 60000,
            totalCharsExtracted: 30000,
            avgQualityScore: 0.78,
            minQualityScore: 0.65,
            maxQualityScore: 0.90,
            throughputPagesPerSec: 2.0,
            throughputBytesPerSec: 30000,
          },
          error: null,
        },
        {
          approach: 'spider-subprocess' as CrawlApproach,
          crawlResult: null,
          summary: {
            approach: 'spider-subprocess' as CrawlApproach,
            pagesAttempted: 5,
            pagesSucceeded: 4,
            pagesFailed: 1,
            successRate: 0.8,
            totalDurationMs: 15000,
            avgFetchLatencyMs: 3000,
            avgExtractLatencyMs: 50,
            avgTotalLatencyMs: 3050,
            p50LatencyMs: 2800,
            p95LatencyMs: 4000,
            p99LatencyMs: 4500,
            totalBytesDownloaded: 55000,
            totalCharsExtracted: 25000,
            avgQualityScore: 0.70,
            minQualityScore: 0.55,
            maxQualityScore: 0.85,
            throughputPagesPerSec: 0.27,
            throughputBytesPerSec: 3666,
          },
          error: null,
        },
      ],
      comparison: {
        qualityDelta: 0.08,
        latencyDelta: -2740,
        successRateDelta: 0,
        throughputDelta: 1.73,
        contentDelta: 5000,
        winner: 'direct-fetch' as CrawlApproach,
        winnerScore: 0.82,
        loserScore: 0.55,
      },
      recommendation: 'Winner: direct-fetch (score: 0.820 vs 0.550)',
    };

    const report = formatBenchmarkReport(result);

    expect(report).toContain('APPROACH BENCHMARK');
    expect(report).toContain('Direct Fetch');
    expect(report).toContain('Spider Subprocess');
    expect(report).toContain('Success Rate');
    expect(report).toContain('Avg Quality');
    expect(report).toContain('Avg Latency');
    expect(report).toContain('Throughput');
    expect(report).toContain('Winner');
  });
});
