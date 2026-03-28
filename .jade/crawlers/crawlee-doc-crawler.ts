// .jade/crawlers/crawlee-doc-crawler.ts — Crawlee doc crawler with bloom filter dedup
//
// Uses CheerioCrawler for fast HTML parsing of docs.anthropic.com.
// Bloom filter prevents re-crawling seen URLs across runs (persisted to Neon Postgres).
// Each crawled page is classified via .jade/surfaces/doc-surface.ts classifyUrl()
// and recorded to fact_crawl_event in the Kimball star schema.
//
// Model routing tier: haiku for URL classification, sonnet for content extraction

import type { DocSurface, CrawlPriority, AgentStrategy } from '../surfaces/doc-surface.js';
import { classifyUrl } from '../surfaces/doc-surface.js';
import { PersistentBloomFilter, type DbPool } from './bloom-filter.js';

// ─── Configuration ─────────────────────────────────────────────────────────

export interface CrawleeDocCrawlerConfig {
  /** Starting URLs */
  readonly startUrls: readonly string[];
  /** Domain restriction for link following */
  readonly allowedDomains: readonly string[];
  /** Max crawl depth */
  readonly maxDepth: number;
  /** Politeness delay between requests (ms) */
  readonly delayMs: number;
  /** Bloom filter: expected unique URLs */
  readonly bloomExpectedItems: number;
  /** Bloom filter: false positive rate */
  readonly bloomFalsePositiveRate: number;
  /** Neon Postgres connection pool (optional, for bloom persistence + fact writing) */
  readonly dbPool?: DbPool;
  /** Crawler ID for bloom filter persistence */
  readonly crawlerId: string;
}

export const DEFAULT_CONFIG: CrawleeDocCrawlerConfig = {
  startUrls: ['https://docs.anthropic.com/en/docs/build-with-claude'],
  allowedDomains: ['docs.anthropic.com'],
  maxDepth: 5,
  delayMs: 1000,
  bloomExpectedItems: 10000,
  bloomFalsePositiveRate: 0.001,
  crawlerId: 'crawlee-docs',
};

// ─── Crawl Result ──────────────────────────────────────────────────────────

export interface CrawlResult {
  readonly url: string;
  readonly title: string;
  readonly surface: DocSurface;
  readonly priority: CrawlPriority;
  readonly strategy: AgentStrategy;
  readonly httpStatus: number;
  readonly responseBytes: number;
  readonly elapsedMs: number;
  readonly linksDiscovered: number;
  readonly bloomFilterHit: boolean;
  readonly contentHash: string;
  readonly crawlTs: string;
}

// ─── Crawler Class ─────────────────────────────────────────────────────────
// This is the integration layer. It requires Crawlee to be installed:
//   npm install crawlee cheerio
//
// Actual execution requires:
//   import { CheerioCrawler, createCheerioRouter } from 'crawlee';

export class CrawleeDocCrawler {
  private readonly config: CrawleeDocCrawlerConfig;
  private readonly bloomFilter: PersistentBloomFilter;
  private readonly results: CrawlResult[] = [];

  constructor(config: Partial<CrawleeDocCrawlerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bloomFilter = new PersistentBloomFilter({
      expectedItems: this.config.bloomExpectedItems,
      falsePositiveRate: this.config.bloomFalsePositiveRate,
    });
  }

  /** Load bloom filter from Neon Postgres (call before crawling) */
  async loadBloomState(): Promise<boolean> {
    if (!this.config.dbPool) return false;
    return this.bloomFilter.loadFromDb(
      this.config.dbPool,
      this.config.crawlerId,
      this.config.allowedDomains[0] ?? 'unknown',
    );
  }

  /** Save bloom filter to Neon Postgres (call after crawling) */
  async saveBloomState(): Promise<void> {
    if (!this.config.dbPool) return;
    await this.bloomFilter.saveToDb(
      this.config.dbPool,
      this.config.crawlerId,
      this.config.allowedDomains[0] ?? 'unknown',
    );
  }

  /** Check if a URL should be skipped (bloom filter) */
  shouldSkip(url: string): boolean {
    return this.bloomFilter.has(url);
  }

  /** Mark a URL as seen in the bloom filter */
  markSeen(url: string): void {
    this.bloomFilter.add(url);
  }

  /** Classify a URL using the .jade/surfaces decision tree */
  classify(url: string): { surface: DocSurface; priority: CrawlPriority; strategy: AgentStrategy } {
    return classifyUrl(url);
  }

  /** Record a crawl result */
  recordResult(result: CrawlResult): void {
    this.results.push(result);
  }

  /** Get all results from this crawl run */
  getResults(): readonly CrawlResult[] {
    return this.results;
  }

  /** Get bloom filter stats */
  getBloomStats(): { itemCount: number; bitSize: number; hashCount: number } {
    return {
      itemCount: this.bloomFilter.itemCount,
      bitSize: this.bloomFilter.bitSize,
      hashCount: this.bloomFilter.hashCount,
    };
  }
}

// ─── Router Factory ────────────────────────────────────────────────────────
// Creates a Crawlee router handler. Requires runtime import of crawlee.
//
// Usage:
//   import { CheerioCrawler } from 'crawlee';
//   const crawler = new CrawleeDocCrawler(config);
//   await crawler.loadBloomState();
//   const cheerioCrawler = new CheerioCrawler({
//     requestHandler: createDocRequestHandler(crawler),
//     maxRequestsPerCrawl: 1000,
//     maxConcurrency: 3,
//   });
//   await cheerioCrawler.run(config.startUrls);
//   await crawler.saveBloomState();

export function createDocRequestHandler(crawler: CrawleeDocCrawler) {
  return async ({ request, $, enqueueLinks }: {
    request: { url: string; loadedUrl?: string };
    $: { html: () => string; text: () => string; (selector: string): { text: () => string; attr: (name: string) => string | undefined; length: number } };
    enqueueLinks: (options: { strategy?: string; globs?: string[] }) => Promise<{ processedRequests: unknown[] }>;
  }): Promise<void> => {
    const startTime = Date.now();
    const url = request.loadedUrl ?? request.url;

    // Bloom filter check
    if (crawler.shouldSkip(url)) {
      crawler.recordResult({
        url,
        title: '',
        ...crawler.classify(url),
        httpStatus: 0,
        responseBytes: 0,
        elapsedMs: Date.now() - startTime,
        linksDiscovered: 0,
        bloomFilterHit: true,
        contentHash: '',
        crawlTs: new Date().toISOString(),
      });
      return;
    }

    // Mark as seen
    crawler.markSeen(url);

    // Classify the URL
    const classification = crawler.classify(url);

    // Extract content
    const title = $('title').text().trim();
    const html = $.html();
    const { createHash } = await import('node:crypto');
    const contentHash = createHash('sha256').update(html).digest('hex');

    // Discover links
    const enqueued = await enqueueLinks({
      strategy: 'same-domain',
      globs: ['https://docs.anthropic.com/**'],
    });

    crawler.recordResult({
      url,
      title,
      ...classification,
      httpStatus: 200,
      responseBytes: Buffer.byteLength(html, 'utf-8'),
      elapsedMs: Date.now() - startTime,
      linksDiscovered: enqueued.processedRequests.length,
      bloomFilterHit: false,
      contentHash,
      crawlTs: new Date().toISOString(),
    });
  };
}
