// src/crawl/runner.ts — Crawl runner using Agent SDK v2 session patterns
//
// Executes crawl plans built by the Shannon thinking planner.
// Each round is a session: send(plan) → stream(results) → delta.
// Uses subprocess spawning for Scrapy spiders (not direct SDK calls).

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  CrawlPlan,
  CrawlRoundResult,
  CrawlPageResult,
  ContextDelta,
  RoundId,
  PageId,
} from '../types/core.js';
import { Ok, Err, toRoundId, toPageId, type Result } from '../types/core.js';
import { buildCrawlPlan, summarizePlan } from '../thinking/planner.js';

// ── Crawl Configuration ─────────────────────────────────────

const SCRAPY_PROJECT = join(process.cwd(), '..', 'claude-code');
const DATA_DIR = join(SCRAPY_PROJECT, 'data');

type RunnerConfig = {
  readonly maxPagesPerRun: number;
  readonly spider: string;
  readonly logLevel: string;
};

const DEFAULT_CONFIG: RunnerConfig = {
  maxPagesPerRun: 30,
  spider: 'platform_spider',
  logLevel: 'WARNING',
};

// ── Execute a Crawl Round ───────────────────────────────────

export function executeCrawlRound(
  plan: CrawlPlan,
  config: Partial<RunnerConfig> = {},
): Result<CrawlRoundResult, Error> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const roundDir = join(DATA_DIR, `round${plan.round}`);
  const outFile = join(roundDir, 'platform_docs.jsonl');

  // Ensure output directory exists
  mkdirSync(roundDir, { recursive: true });

  // Log plan
  const planLog = join(roundDir, 'plan.json');
  writeFileSync(planLog, JSON.stringify({
    id: plan.id,
    name: plan.name,
    round: plan.round,
    targetCount: plan.targets.length,
    thoughts: plan.thoughts.map(t => ({
      type: t.type,
      confidence: t.confidence,
      content: t.content.slice(0, 200),
    })),
    steeringContext: plan.steeringContext,
    createdAt: plan.createdAt.toISOString(),
  }, null, 2));

  console.log(summarizePlan(plan));
  console.log(`\nExecuting crawl: ${cfg.spider} → ${outFile}`);

  const startTime = Date.now();

  try {
    // Run Scrapy spider
    const cmd = [
      `cd "${SCRAPY_PROJECT}"`,
      `PYTHONPATH=. python3 -m scrapy crawl ${cfg.spider}`,
      `-s CLOSESPIDER_PAGECOUNT=${cfg.maxPagesPerRun}`,
      `-s LOG_LEVEL=${cfg.logLevel}`,
      `-s DELTAFETCH_ENABLED=False`,
      `-o "${outFile}"`,
    ].join(' && ');

    execSync(cmd, {
      stdio: 'pipe',
      timeout: 300_000, // 5 min max
      encoding: 'utf-8',
    });
  } catch (err) {
    // Scrapy may exit non-zero but still produce output
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`Spider warning: ${msg.slice(0, 200)}`);
  }

  const duration = Date.now() - startTime;

  // Parse results
  if (!existsSync(outFile)) {
    return Err(new Error(`No output file: ${outFile}`));
  }

  const lines = readFileSync(outFile, 'utf-8').split('\n').filter(Boolean);
  if (lines.length === 0) {
    return Err(new Error('Crawl produced zero items'));
  }

  const pages: CrawlPageResult[] = [];
  let totalQuality = 0;

  for (const line of lines) {
    try {
      const item = JSON.parse(line) as Record<string, unknown>;
      const url = String(item['url'] ?? '');
      const title = String(item['title'] ?? '');
      const content = String(item['content_markdown'] ?? item['content'] ?? '');
      const quality = Number(item['quality_score'] ?? 0);

      pages.push({
        pageId: toPageId(`page-${pages.length}`),
        url,
        title,
        contentLength: content.length,
        qualityScore: quality,
        category: categorizeUrl(url),
      });
      totalQuality += quality;
    } catch {
      // Skip malformed lines
    }
  }

  const avgQuality = pages.length > 0 ? totalQuality / pages.length : 0;
  const passed = avgQuality >= plan.overallThreshold;

  // Generate context delta for next round
  const contextDelta: ContextDelta = {
    round: plan.round,
    newPatterns: extractPatterns(pages),
    failingTargets: pages
      .filter(p => p.qualityScore < plan.overallThreshold)
      .map(p => p.url),
    qualityBefore: 0, // Would come from previous round
    qualityAfter: avgQuality,
    steerDirection: passed
      ? `Quality ${avgQuality.toFixed(2)} exceeds threshold. Expand to lower-priority pages.`
      : `Quality ${avgQuality.toFixed(2)} below threshold. Focus on improving extraction for failing pages.`,
  };

  // Write results
  const resultFile = join(roundDir, 'result.json');
  const roundResult: CrawlRoundResult = {
    roundId: toRoundId(`round-${plan.round}`),
    plan,
    pages,
    avgQuality,
    passed,
    duration,
    contextDelta,
  };

  writeFileSync(resultFile, JSON.stringify({
    roundId: roundResult.roundId,
    pagesCount: pages.length,
    avgQuality: avgQuality.toFixed(3),
    passed,
    duration,
    contextDelta,
    pages: pages.map(p => ({
      url: p.url,
      title: p.title,
      contentLength: p.contentLength,
      qualityScore: p.qualityScore.toFixed(3),
      category: p.category,
    })),
  }, null, 2));

  // Write delta for next round
  writeFileSync(join(roundDir, 'delta.json'), JSON.stringify(contextDelta, null, 2));

  console.log(`\n=== Round ${plan.round} Results ===`);
  console.log(`Pages: ${pages.length} | Avg quality: ${avgQuality.toFixed(3)} | ${passed ? 'PASS' : 'FAIL'}`);
  console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
  console.log(`Steer: ${contextDelta.steerDirection}`);

  return Ok(roundResult);
}

// ── URL Categorization ──────────────────────────────────────

function categorizeUrl(url: string): CrawlPageResult['category'] {
  const path = url.toLowerCase();
  if (path.includes('tool')) return 'tools';
  if (path.includes('agent-sdk') || path.includes('agent_sdk')) return 'agent_sdk';
  if (path.includes('skill')) return 'agent_skills';
  if (path.includes('mcp') || path.includes('connector')) return 'mcp_api';
  if (path.includes('context') || path.includes('compact') || path.includes('cache')) return 'context_management';
  if (path.includes('prompt')) return 'prompt_engineering';
  if (path.includes('model') || path.includes('pricing')) return 'models_pricing';
  if (path.includes('stream') || path.includes('batch') || path.includes('vision')) return 'model_capabilities';
  if (path.includes('eval') || path.includes('guardrail') || path.includes('halluc')) return 'test_evaluate';
  if (path.includes('admin') || path.includes('usage') || path.includes('workspace')) return 'admin_monitoring';
  if (path.includes('bedrock') || path.includes('vertex') || path.includes('foundry')) return 'third_party';
  if (path.includes('file')) return 'files_assets';
  return 'build_with_claude';
}

// ── Pattern Extraction ──────────────────────────────────────

function extractPatterns(pages: CrawlPageResult[]): string[] {
  const patterns: string[] = [];
  const categories = new Set(pages.map(p => p.category));
  patterns.push(`Covered ${categories.size} doc categories`);

  const highQuality = pages.filter(p => p.qualityScore >= 0.8);
  if (highQuality.length > 0) {
    patterns.push(`${highQuality.length} pages scored 0.80+`);
  }

  const largePages = pages.filter(p => p.contentLength > 20000);
  if (largePages.length > 0) {
    patterns.push(`${largePages.length} pages with 20K+ chars content`);
  }

  return patterns;
}

// ── Iterative Multi-Round Runner ────────────────────────────

export function runIterativeCrawl(
  rounds: number,
  config: Partial<RunnerConfig> = {},
): CrawlRoundResult[] {
  const results: CrawlRoundResult[] = [];
  let previousDelta: ContextDelta | undefined;

  for (let round = 1; round <= rounds; round++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`ROUND ${round} of ${rounds}`);
    console.log('='.repeat(60));

    const plan = buildCrawlPlan(round, previousDelta);
    const result = executeCrawlRound(plan, config);

    if (result.ok) {
      results.push(result.value);
      previousDelta = result.value.contextDelta;

      // Check for convergence
      if (results.length >= 2) {
        const prev = results[results.length - 2]!;
        const improvement = result.value.avgQuality - prev.avgQuality;
        if (Math.abs(improvement) < 0.001) {
          console.log(`\nConverged: quality improvement ${improvement.toFixed(4)} < 0.001. Stopping.`);
          break;
        }
      }
    } else {
      console.error(`Round ${round} FAILED: ${result.error.message}`);
      // Don't break — try next round with adjusted strategy
    }
  }

  return results;
}

// ── CLI ─────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const rounds = parseInt(process.argv[2] ?? '1', 10);
  const maxPages = parseInt(process.argv[3] ?? '30', 10);
  console.log(`Starting iterative crawl: ${rounds} rounds, max ${maxPages} pages/round`);
  const results = runIterativeCrawl(rounds, { maxPagesPerRun: maxPages });
  console.log(`\n=== FINAL: ${results.length} rounds completed ===`);
  for (const r of results) {
    console.log(`  Round ${r.plan.round}: ${r.pages.length} pages, quality ${r.avgQuality.toFixed(3)}, ${r.passed ? 'PASS' : 'FAIL'}`);
  }
}
