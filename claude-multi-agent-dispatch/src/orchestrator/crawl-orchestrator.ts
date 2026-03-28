// src/orchestrator/crawl-orchestrator.ts — Direct crawl orchestration per agent command
//
// Replaces the "rat" approach (Scrapy subprocess via execSync) with inline
// HTTP fetch → extract → score → log for each target URL. Every agent command
// owns its crawl execution end-to-end with quantifiable metrics.

import type { Result } from '../types/core.js';
import { Ok, Err } from '../types/core.js';
import type { QualityScore } from '../types/quality.js';
import { scoreOutput } from '../quality/scorer.js';
import {
  CrawlMetricsCollector,
  type PageMetrics,
  type CrawlApproach,
  type RoundMetrics,
} from './crawl-metrics.js';

// ─── Crawl Target ───────────────────────────────────────────────────────────

export interface CrawlTarget {
  readonly url: string;
  readonly category: string;
  readonly priority: 'critical' | 'high' | 'medium' | 'low';
  readonly expectedPatterns?: readonly string[];
}

// ─── Crawl Page Result ──────────────────────────────────────────────────────

export interface CrawlPageOutput {
  readonly url: string;
  readonly title: string;
  readonly content: string;
  readonly contentLength: number;
  readonly headings: readonly string[];
  readonly codeBlocks: readonly string[];
  readonly links: readonly string[];
  readonly qualityScore: QualityScore;
  readonly metrics: PageMetrics;
}

// ─── Orchestrated Crawl Result ──────────────────────────────────────────────

export interface OrchestratedCrawlResult {
  readonly roundId: string;
  readonly approach: CrawlApproach;
  readonly pages: readonly CrawlPageOutput[];
  readonly succeeded: number;
  readonly failed: number;
  readonly avgQuality: number;
  readonly totalContentChars: number;
  readonly totalDurationMs: number;
  readonly roundMetrics: RoundMetrics;
  readonly extractedOutput: string;
}

// ─── Crawl Configuration ────────────────────────────────────────────────────

export interface CrawlOrchestratorConfig {
  readonly concurrency: number;
  readonly fetchTimeoutMs: number;
  readonly delayBetweenRequestsMs: number;
  readonly approach: CrawlApproach;
  readonly userAgent: string;
  readonly respectRobotsTxt: boolean;
  readonly metricsLogPath?: string;
}

const DEFAULT_CONFIG: CrawlOrchestratorConfig = {
  concurrency: 3,
  fetchTimeoutMs: 15_000,
  delayBetweenRequestsMs: 1_000,
  approach: 'direct-fetch',
  userAgent: 'ClaudeResearcher/1.0 (+https://github.com/jadecli/researchers)',
  respectRobotsTxt: true,
};

// ─── Platform Documentation Targets ─────────────────────────────────────────
// The complete Anthropic docs surface area the user listed as capabilities.

export const ANTHROPIC_DOC_TARGETS: readonly CrawlTarget[] = [
  // Extended thinking
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking', category: 'model_capabilities', priority: 'high' },
  // Streaming
  { url: 'https://docs.anthropic.com/en/api/streaming', category: 'model_capabilities', priority: 'high' },
  // Batch processing
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/message-batches', category: 'model_capabilities', priority: 'medium' },
  // PDF support
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/pdf-support', category: 'model_capabilities', priority: 'medium' },
  // Citations
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/citations', category: 'model_capabilities', priority: 'medium' },
  // Vision
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/vision', category: 'model_capabilities', priority: 'high' },
  // Embeddings
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/embeddings', category: 'model_capabilities', priority: 'medium' },

  // Tools — Overview
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/tool-use/overview', category: 'tools', priority: 'critical' },
  // Tools — How tool use works
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/tool-use', category: 'tools', priority: 'critical' },
  // Tools — Define tools
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/tool-use/define-tools', category: 'tools', priority: 'critical' },
  // Tools — Handle tool calls
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/tool-use/handle-tool-calls', category: 'tools', priority: 'critical' },
  // Tools — Parallel tool use
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/tool-use/parallel-tool-use', category: 'tools', priority: 'high' },
  // Tools — Strict tool use
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/tool-use/strict-tool-use', category: 'tools', priority: 'high' },
  // Tools — Prompt caching with tools
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/tool-use/tool-use-with-prompt-caching', category: 'tools', priority: 'medium' },
  // Tools — Server tools
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/tool-use/server-tools', category: 'tools', priority: 'high' },
  // Tools — Troubleshooting
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/tool-use/troubleshooting', category: 'tools', priority: 'medium' },
  // Tools — Tool reference
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/tool-use/tool-reference', category: 'tools', priority: 'high' },

  // Built-in tools
  { url: 'https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search-tool', category: 'tools', priority: 'high' },
  { url: 'https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-fetch-tool', category: 'tools', priority: 'high' },
  { url: 'https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/code-execution-tool', category: 'tools', priority: 'high' },
  { url: 'https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/memory-tool', category: 'tools', priority: 'medium' },
  { url: 'https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/bash-tool', category: 'tools', priority: 'high' },
  { url: 'https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/computer-use-tool', category: 'tools', priority: 'medium' },
  { url: 'https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/text-editor-tool', category: 'tools', priority: 'medium' },

  // Tool infrastructure
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/tool-use/manage-tool-context', category: 'tools', priority: 'medium' },
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/tool-use/tool-combinations', category: 'tools', priority: 'medium' },
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/tool-use/tool-search', category: 'tools', priority: 'medium' },

  // Context management
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/context-windows', category: 'context_management', priority: 'high' },
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching', category: 'context_management', priority: 'high' },
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/token-counting', category: 'context_management', priority: 'medium' },

  // Files & assets
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/files', category: 'files_assets', priority: 'medium' },

  // Agent Skills
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/agent-skills/overview', category: 'agent_skills', priority: 'high' },
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/agent-skills/quickstart', category: 'agent_skills', priority: 'high' },
  { url: 'https://docs.anthropic.com/en/docs/build-with-claude/agent-skills/best-practices', category: 'agent_skills', priority: 'high' },
];

// ─── CrawlOrchestrator ─────────────────────────────────────────────────────

export class CrawlOrchestrator {
  private readonly config: CrawlOrchestratorConfig;

  constructor(config?: Partial<CrawlOrchestratorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a full orchestrated crawl for the given targets.
   * Each target is fetched, extracted, scored, and logged inline —
   * no subprocess delegation.
   */
  async executeCrawl(
    roundId: string,
    targets: readonly CrawlTarget[],
    goal: string,
  ): Promise<Result<OrchestratedCrawlResult, Error>> {
    const metrics = new CrawlMetricsCollector(roundId, this.config.metricsLogPath);
    const pages: CrawlPageOutput[] = [];
    const errors: string[] = [];
    const startTime = Date.now();

    // Process in batches of `concurrency`
    for (let i = 0; i < targets.length; i += this.config.concurrency) {
      const batch = targets.slice(i, i + this.config.concurrency);
      const results = await Promise.allSettled(
        batch.map((target) => this.fetchAndExtract(target, goal, metrics)),
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.ok) {
          pages.push(result.value.value);
        } else {
          const reason =
            result.status === 'rejected'
              ? String(result.reason)
              : result.status === 'fulfilled' && !result.value.ok
                ? result.value.error.message
                : 'Unknown error';
          errors.push(reason);
        }
      }

      // Respect delay between batches
      if (i + this.config.concurrency < targets.length) {
        await sleep(this.config.delayBetweenRequestsMs);
      }
    }

    const totalDurationMs = Date.now() - startTime;
    const avgQuality =
      pages.length > 0
        ? pages.reduce((s, p) => s + p.qualityScore.overall, 0) / pages.length
        : 0;

    // Build the combined extracted output for quality scoring
    const extractedOutput = pages
      .map(
        (p) =>
          `# ${p.title}\nURL: ${p.url}\n\n${p.content}\n\n---\n`,
      )
      .join('\n');

    const roundMetrics = metrics.summarizeRound();

    return Ok({
      roundId,
      approach: this.config.approach,
      pages,
      succeeded: pages.length,
      failed: errors.length,
      avgQuality,
      totalContentChars: pages.reduce((s, p) => s + p.contentLength, 0),
      totalDurationMs,
      roundMetrics,
      extractedOutput,
    });
  }

  /**
   * Fetch a single target, extract content, score quality, record metrics.
   * This is the core unit of work — one agent command per page.
   */
  private async fetchAndExtract(
    target: CrawlTarget,
    goal: string,
    metrics: CrawlMetricsCollector,
  ): Promise<Result<CrawlPageOutput, Error>> {
    const fetchStart = Date.now();
    let httpStatus = 0;
    let rawContent = '';
    let contentLengthBytes = 0;

    try {
      // ── Phase 1: Fetch ──
      const response = await fetchWithTimeout(
        target.url,
        this.config.fetchTimeoutMs,
        this.config.userAgent,
      );
      httpStatus = response.status;

      if (!response.ok) {
        const pageMetrics = buildErrorMetrics(
          target.url,
          this.config.approach,
          Date.now() - fetchStart,
          httpStatus,
          `HTTP ${httpStatus}`,
        );
        metrics.recordPage(pageMetrics);
        return Err(new Error(`HTTP ${httpStatus} for ${target.url}`));
      }

      rawContent = await response.text();
      contentLengthBytes = new TextEncoder().encode(rawContent).length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const pageMetrics = buildErrorMetrics(
        target.url,
        this.config.approach,
        Date.now() - fetchStart,
        0,
        msg,
      );
      metrics.recordPage(pageMetrics);
      return Err(new Error(`Fetch failed for ${target.url}: ${msg}`));
    }

    const fetchLatencyMs = Date.now() - fetchStart;

    // ── Phase 2: Extract ──
    const extractStart = Date.now();
    const extracted = extractContent(rawContent, target.url);
    const extractLatencyMs = Date.now() - extractStart;

    // ── Phase 3: Score Quality ──
    const qualityScore = await scoreOutput(extracted.content, goal);

    const totalLatencyMs = Date.now() - fetchStart;

    // ── Phase 4: Record Metrics ──
    const pageMetrics: PageMetrics = {
      url: target.url,
      approach: this.config.approach,
      fetchLatencyMs,
      extractLatencyMs,
      totalLatencyMs,
      httpStatus,
      contentLengthBytes,
      extractedChars: extracted.content.length,
      headingsCount: extracted.headings.length,
      codeBlocksCount: extracted.codeBlocks.length,
      linksCount: extracted.links.length,
      qualityScore: qualityScore.overall,
      timestamp: new Date().toISOString(),
      error: null,
    };
    metrics.recordPage(pageMetrics);

    return Ok({
      url: target.url,
      title: extracted.title,
      content: extracted.content,
      contentLength: extracted.content.length,
      headings: extracted.headings,
      codeBlocks: extracted.codeBlocks,
      links: extracted.links,
      qualityScore,
      metrics: pageMetrics,
    });
  }
}

// ─── Content Extraction ─────────────────────────────────────────────────────
// Lightweight HTML → structured content extraction without external dependencies.

interface ExtractedContent {
  readonly title: string;
  readonly content: string;
  readonly headings: readonly string[];
  readonly codeBlocks: readonly string[];
  readonly links: readonly string[];
}

export function extractContent(html: string, url: string): ExtractedContent {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const title = (h1Match?.[1] ?? titleMatch?.[1] ?? url).trim();

  // Extract headings
  const headings: string[] = [];
  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(html)) !== null) {
    headings.push(stripTags(match[2] ?? '').trim());
  }

  // Extract code blocks
  const codeBlocks: string[] = [];
  const codeRegex = /<(?:pre|code)[^>]*>([\s\S]*?)<\/(?:pre|code)>/gi;
  while ((match = codeRegex.exec(html)) !== null) {
    const code = decodeHtmlEntities(stripTags(match[1] ?? '')).trim();
    if (code.length > 10) {
      codeBlocks.push(code);
    }
  }

  // Extract links
  const links: string[] = [];
  const linkRegex = /href=["']([^"']+)["']/gi;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1] ?? '';
    if (href.startsWith('http') || href.startsWith('/')) {
      links.push(href);
    }
  }

  // Extract main content — strip nav, header, footer, script, style
  let contentHtml = html;
  // Remove non-content elements
  contentHtml = contentHtml.replace(/<(script|style|nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Remove HTML tags but keep text
  const text = stripTags(contentHtml);
  // Clean up whitespace
  const content = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');

  return { title, content, headings, codeBlocks, links };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  userAgent: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,text/plain,*/*',
      },
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildErrorMetrics(
  url: string,
  approach: CrawlApproach,
  latencyMs: number,
  httpStatus: number,
  error: string,
): PageMetrics {
  return {
    url,
    approach,
    fetchLatencyMs: latencyMs,
    extractLatencyMs: 0,
    totalLatencyMs: latencyMs,
    httpStatus,
    contentLengthBytes: 0,
    extractedChars: 0,
    headingsCount: 0,
    codeBlocksCount: 0,
    linksCount: 0,
    qualityScore: 0,
    timestamp: new Date().toISOString(),
    error,
  };
}
