/**
 * Cheerio-based crawler — pure Node.js HTTP + cheerio extraction.
 * Analogous to the Python Scrapy spider but using native fetch + cheerio.
 */

import { extractPage, extractCustomers, type CustomerCard, type ExtractedPage } from "../extractors/html-extractor.js";
import { scoreQuality, type QualityBreakdown } from "../extractors/quality-scorer.js";
import type { CrawlResult, CrawlStats, SitemapEntry } from "../models/types.js";

export interface CrawlerOptions {
  maxPages: number;
  delayMs: number;
  timeout: number;
  userAgent: string;
}

const DEFAULT_OPTIONS: CrawlerOptions = {
  maxPages: 50,
  delayMs: 200,
  timeout: 30_000,
  userAgent: "CrawlerTS/0.1 (+https://github.com/researchers/claude-code-agents-typescript)",
};

export class CheerioCrawler {
  private options: CrawlerOptions;
  private results: CrawlResult[] = [];
  private customers: CustomerCard[] = [];
  private stats: CrawlStats;

  constructor(options: Partial<CrawlerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
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

  /** Fetch a URL and return the HTML text. */
  private async fetchPage(url: string): Promise<string> {
    this.stats.pagesRequested++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": this.options.userAgent },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }

  /** Parse a sitemap XML and return URL entries. */
  async parseSitemap(sitemapUrl: string): Promise<SitemapEntry[]> {
    const html = await this.fetchPage(sitemapUrl);
    return this.parseSitemapXml(html);
  }

  /** Parse sitemap XML string into entries. */
  parseSitemapXml(xml: string): SitemapEntry[] {
    const entries: SitemapEntry[] = [];
    // Simple regex parsing for sitemap XML (avoid heavy XML parser dep)
    const locRegex = /<loc>\s*(.*?)\s*<\/loc>/g;
    const lastmodRegex = /<lastmod>\s*(.*?)\s*<\/lastmod>/g;

    let match: RegExpExecArray | null;
    const locs: string[] = [];
    while ((match = locRegex.exec(xml)) !== null) {
      locs.push(match[1].trim());
    }
    const lastmods: string[] = [];
    while ((match = lastmodRegex.exec(xml)) !== null) {
      lastmods.push(match[1].trim());
    }

    for (let i = 0; i < locs.length; i++) {
      entries.push({
        loc: locs[i],
        lastmod: lastmods[i] || undefined,
      });
    }

    return entries;
  }

  /** Crawl a single page and produce a CrawlResult. */
  async crawlPage(url: string, pageType = "page"): Promise<CrawlResult> {
    const html = await this.fetchPage(url);
    const extracted = extractPage(html, url);
    const quality = scoreQuality(extracted);

    // If this is a customers page, also extract customer cards
    if (pageType === "customers" || url.includes("/customers")) {
      const cards = extractCustomers(html, url);
      this.customers.push(...cards);
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
      pageType,
    };

    this.results.push(result);
    this.stats.pagesCrawled++;
    return result;
  }

  /** Crawl from a sitemap, following all URLs. */
  async crawlSitemap(sitemapUrl: string): Promise<CrawlResult[]> {
    this.stats.startTime = performance.now();

    try {
      const entries = await this.parseSitemap(sitemapUrl);
      console.log(`  Found ${entries.length} URLs in sitemap`);

      const pagesToCrawl = entries.slice(0, this.options.maxPages);
      for (const entry of pagesToCrawl) {
        try {
          await this.crawlPage(entry.loc, "product");
          if (this.options.delayMs > 0) {
            await new Promise((r) => setTimeout(r, this.options.delayMs));
          }
        } catch (err) {
          this.stats.errors++;
          console.error(`  Error crawling ${entry.loc}: ${err}`);
        }
      }
    } catch (err) {
      this.stats.errors++;
      console.error(`  Error fetching sitemap: ${err}`);
    }

    this.finalize();
    return this.results;
  }

  /** Crawl a single page URL (e.g., anthropic.com/customers). */
  async crawlUrl(url: string, pageType = "page"): Promise<CrawlResult[]> {
    this.stats.startTime = performance.now();

    try {
      const result = await this.crawlPage(url, pageType);

      // Follow links on the page (one level deep)
      const sameDomainLinks = result.links
        .filter((link) => {
          try {
            const u = new URL(link);
            const base = new URL(url);
            return u.hostname === base.hostname;
          } catch {
            return false;
          }
        })
        .slice(0, this.options.maxPages - 1);

      for (const link of sameDomainLinks) {
        try {
          await this.crawlPage(link);
          if (this.options.delayMs > 0) {
            await new Promise((r) => setTimeout(r, this.options.delayMs));
          }
        } catch (err) {
          this.stats.errors++;
        }
      }
    } catch (err) {
      this.stats.errors++;
      console.error(`  Error crawling ${url}: ${err}`);
    }

    this.finalize();
    return this.results;
  }

  private finalize(): void {
    this.stats.endTime = performance.now();
    this.stats.elapsedMs = this.stats.endTime - this.stats.startTime;
    this.stats.items = this.results.length;
    this.stats.avgQuality =
      this.results.length > 0
        ? this.results.reduce((sum, r) => sum + r.qualityScore, 0) /
          this.results.length
        : 0;
  }

  getResults(): CrawlResult[] {
    return this.results;
  }

  getCustomers(): CustomerCard[] {
    return this.customers;
  }

  getStats(): CrawlStats {
    return { ...this.stats };
  }
}
