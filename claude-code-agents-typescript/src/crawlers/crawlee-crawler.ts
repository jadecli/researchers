/**
 * Refactored crawler using:
 * - Crawlee (CheerioCrawler) for Scrapy-like architecture
 * - mnemonist BloomFilter for URL deduplication
 * - BAML-style typed extraction for structured output
 */

import { CheerioCrawler, Configuration, log, LogLevel, Dataset, type CheerioCrawlingContext } from "crawlee";
import mnemonist from "mnemonist";
const { BloomFilter } = mnemonist;
import TurndownService from "turndown";
import type { CrawlResult, CrawlStats, CustomerData } from "../models/types.js";
import { scoreQuality } from "../extractors/quality-scorer.js";
import { extractPage, extractCustomers } from "../extractors/html-extractor.js";
import { extractCustomerTyped, extractProductTyped, type TypedCustomer, type TypedProduct } from "./baml-extractor.js";

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });

export interface CrawleeCrawlerOptions {
  maxPages: number;
  maxConcurrency: number;
  requestTimeout: number;
  bloomFilterSize: number;
  bloomFilterErrorRate: number;
  storageDir?: string;
}

const DEFAULT_OPTIONS: CrawleeCrawlerOptions = {
  maxPages: 50,
  maxConcurrency: 5,
  requestTimeout: 30,
  bloomFilterSize: 10_000,
  bloomFilterErrorRate: 0.01,
};

export class CrawleeMnemonistCrawler {
  private options: CrawleeCrawlerOptions;
  private bloomFilter: BloomFilter;
  private results: CrawlResult[] = [];
  private typedCustomers: TypedCustomer[] = [];
  private typedProducts: TypedProduct[] = [];
  private stats: CrawlStats;
  private config: Configuration;
  private static instanceCounter = 0;

  constructor(options: Partial<CrawleeCrawlerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    // mnemonist BloomFilter for probabilistic URL dedup
    this.bloomFilter = new BloomFilter(this.options.bloomFilterSize);
    // Each instance gets a unique storage directory to prevent Crawlee state conflicts
    const storageDir = this.options.storageDir || `/tmp/crawlee_storage_${Date.now()}_${CrawleeMnemonistCrawler.instanceCounter++}`;
    this.config = new Configuration({ storageClientOptions: { localDataDirectory: storageDir } });
    Configuration.getGlobalConfig().set("storageClientOptions", { localDataDirectory: storageDir });
    this.stats = {
      pagesRequested: 0,
      pagesCrawled: 0,
      errors: 0,
      startTime: 0,
      endTime: 0,
      elapsedMs: 0,
      items: 0,
      avgQuality: 0,
    };
  }

  /** Check if a URL has been seen (probabilistic). */
  private isUrlSeen(url: string): boolean {
    return this.bloomFilter.test(url);
  }

  /** Mark a URL as seen. */
  private markUrlSeen(url: string): void {
    this.bloomFilter.add(url);
  }

  /** Crawl a customers page using Crawlee CheerioCrawler. */
  async crawlCustomers(startUrl: string): Promise<CrawlResult[]> {
    this.stats.startTime = performance.now();
    const self = this;

    const crawler = new CheerioCrawler({
      maxConcurrency: this.options.maxConcurrency,
      maxRequestRetries: 1,
      requestHandlerTimeoutSecs: this.options.requestTimeout,
      maxRequestsPerCrawl: this.options.maxPages,

      async requestHandler({ request, $, body }) {
        const url = request.url;

        // Bloom filter dedup check
        if (self.isUrlSeen(url)) {
          log.debug(`Skipping duplicate URL: ${url}`);
          return;
        }
        self.markUrlSeen(url);
        self.stats.pagesRequested++;

        const html = typeof body === "string" ? body : body.toString();
        const extracted = extractPage(html, url);
        const quality = scoreQuality(extracted);

        // BAML-style typed extraction for customer pages
        const isCustomerPage =
          url.includes("/customers") ||
          $(".customer-card").length > 0;

        if (isCustomerPage) {
          const cards = extractCustomers(html, url);
          for (const card of cards) {
            const typed = extractCustomerTyped(card);
            self.typedCustomers.push(typed);
          }
        }

        const result: CrawlResult = {
          url,
          title: extracted.title,
          description: extracted.description,
          contentMarkdown: extracted.contentMarkdown,
          contentHtml: html,
          metadata: extracted.metadata,
          links: extracted.links,
          extractionTimestamp: new Date().toISOString(),
          qualityScore: quality.overall,
          pageType: isCustomerPage ? "customers" : "page",
        };

        self.results.push(result);
        self.stats.pagesCrawled++;

        // Enqueue same-domain links (one level)
        const baseHost = new URL(url).hostname;
        for (const link of extracted.links) {
          try {
            const linkHost = new URL(link).hostname;
            if (linkHost === baseHost && !self.isUrlSeen(link)) {
              await crawler.addRequests([{ url: link }]);
            }
          } catch {
            // Invalid URL, skip
          }
        }
      },

      failedRequestHandler({ request }) {
        self.stats.errors++;
        log.debug(`Request failed: ${request.url}`);
      },
    });

    await crawler.run([startUrl]);
    this.finalize();
    return this.results;
  }

  /** Crawl a sitemap and extract product pages. */
  async crawlSitemap(sitemapUrl: string): Promise<CrawlResult[]> {
    this.stats.startTime = performance.now();
    const self = this;

    // First, fetch and parse the sitemap
    const sitemapUrls: string[] = [];

    const sitemapCrawler = new CheerioCrawler({
      maxConcurrency: 1,
      maxRequestRetries: 1,
      maxRequestsPerCrawl: 1,

      async requestHandler({ body }) {
        const xml = typeof body === "string" ? body : body.toString();
        const locRegex = /<loc>\s*(.*?)\s*<\/loc>/g;
        let match: RegExpExecArray | null;
        while ((match = locRegex.exec(xml)) !== null) {
          const loc = match[1].trim();
          if (!loc.endsWith(".xml")) {
            sitemapUrls.push(loc);
          }
        }
      },
    });

    await sitemapCrawler.run([sitemapUrl]);
    console.log(`  Sitemap parsed: ${sitemapUrls.length} URLs`);

    // Now crawl each product page
    const productCrawler = new CheerioCrawler({
      maxConcurrency: this.options.maxConcurrency,
      maxRequestRetries: 1,
      requestHandlerTimeoutSecs: this.options.requestTimeout,
      maxRequestsPerCrawl: this.options.maxPages,

      async requestHandler({ request, $, body }) {
        const url = request.url;
        if (self.isUrlSeen(url)) return;
        self.markUrlSeen(url);
        self.stats.pagesRequested++;

        const html = typeof body === "string" ? body : body.toString();
        const extracted = extractPage(html, url);
        const quality = scoreQuality(extracted);

        // BAML-style typed extraction for product pages
        const typed = extractProductTyped(extracted, url);
        self.typedProducts.push(typed);

        const result: CrawlResult = {
          url,
          title: extracted.title,
          description: extracted.description,
          contentMarkdown: extracted.contentMarkdown,
          contentHtml: html,
          metadata: extracted.metadata,
          links: extracted.links,
          extractionTimestamp: new Date().toISOString(),
          qualityScore: quality.overall,
          pageType: "product",
        };

        self.results.push(result);
        self.stats.pagesCrawled++;
      },

      failedRequestHandler({ request }) {
        self.stats.errors++;
      },
    });

    await productCrawler.run(sitemapUrls.slice(0, this.options.maxPages));
    this.finalize();
    return this.results;
  }

  private finalize(): void {
    this.stats.endTime = performance.now();
    this.stats.elapsedMs = this.stats.endTime - this.stats.startTime;
    this.stats.items = this.results.length;
    this.stats.avgQuality =
      this.results.length > 0
        ? this.results.reduce((sum, r) => sum + r.qualityScore, 0) / this.results.length
        : 0;
  }

  getResults(): CrawlResult[] { return this.results; }
  getTypedCustomers(): TypedCustomer[] { return this.typedCustomers; }
  getTypedProducts(): TypedProduct[] { return this.typedProducts; }
  getStats(): CrawlStats { return { ...this.stats }; }

  /** Print BAML-style typed output summary. */
  printTypedSummary(): void {
    if (this.typedCustomers.length > 0) {
      console.log("\n=== BAML Typed Customers ===");
      for (const c of this.typedCustomers) {
        console.log(`  ${c.name} [${c.industryCategory}]`);
        console.log(`    Tier: ${c.tier}, Metrics: ${c.keyMetrics.length}`);
        for (const m of c.keyMetrics) {
          console.log(`      - ${m.label}: ${m.value} (${m.unit})`);
        }
      }
    }
    if (this.typedProducts.length > 0) {
      console.log("\n=== BAML Typed Products ===");
      for (const p of this.typedProducts) {
        console.log(`  ${p.name} [${p.category}]`);
        console.log(`    Features: ${p.features.length}, Price tiers: ${p.priceTiers.length}`);
        for (const t of p.priceTiers) {
          console.log(`      - ${t.name}: ${t.price}`);
        }
      }
    }
  }

  /** Get bloom filter stats. */
  getBloomFilterStats(): { size: number; itemCount: number } {
    return {
      size: this.options.bloomFilterSize,
      itemCount: this.stats.pagesCrawled + this.stats.errors,
    };
  }
}
