/**
 * Official Vendor Skills Crawler for skills.sh
 *
 * Architecture:
 * - CheerioCrawler pattern (cheerio-crawler.ts) for HTTP + cheerio extraction
 * - mnemonist BloomFilter (crawlee-crawler.ts) for URL deduplication
 * - BAML-style typed extraction (skills-extractor.ts) for structured output
 *
 * SECURITY: Only crawls official/verified publishers. Non-official skills
 * introduce supply chain risk:
 * - Adversarial context injection via SKILL.md
 * - Phantom dependency attacks (non-existent npm packages)
 * - No version pinning (main branch, no lockfile)
 *
 * Entry points:
 *   https://skills.sh/official     — Official skills listing
 *   https://skills.sh/audits       — Security audit info
 *   https://skills.sh/docs/cli     — CLI documentation
 *   https://skills.sh/docs/faq     — FAQ
 *   https://skills.sh/docs         — Main docs
 *
 * URL pattern: skills.sh/{publisher}/{repo}/{skill-name}
 * Only follows links matching allowlisted publishers.
 */

import * as cheerio from "cheerio";
import TurndownService from "turndown";
import mnemonist from "mnemonist";
const { BloomFilter } = mnemonist;

import { extractPage } from "../extractors/html-extractor.js";
import { scoreQuality } from "../extractors/quality-scorer.js";
import type { CrawlResult, CrawlStats } from "../models/types.js";
import {
  OFFICIAL_PUBLISHERS,
  isOfficialPublisher,
  extractSkillTyped,
  parseInstallCount,
  printTypedSkills,
  type TypedSkill,
  type SkillCatalogEntry,
} from "./skills-extractor.js";

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });

// ── Configuration ──────────────────────────────────────────────────

export interface SkillsCrawlerOptions {
  readonly maxPages: number;
  readonly maxConcurrency: number;
  readonly requestTimeout: number;
  readonly delayMs: number;
  readonly bloomFilterSize: number;
  readonly bloomFilterErrorRate: number;
  readonly userAgent: string;
}

const DEFAULT_OPTIONS: SkillsCrawlerOptions = {
  maxPages: 200,
  maxConcurrency: 3,
  requestTimeout: 30_000,
  delayMs: 300,
  bloomFilterSize: 10_000,
  bloomFilterErrorRate: 0.01,
  userAgent: "SkillsCrawlerTS/0.1 (+https://github.com/jadecli/researchers)",
};

// ── Seed URLs ──────────────────────────────────────────────────────

const SEED_URLS: ReadonlyArray<string> = [
  'https://skills.sh/official',
  'https://skills.sh/audits',
  'https://skills.sh/docs/cli',
  'https://skills.sh/docs/faq',
  'https://skills.sh/docs',
];

// Official publisher listing pages
const PUBLISHER_URLS: ReadonlyArray<string> = OFFICIAL_PUBLISHERS.map(
  (p) => `https://skills.sh/${p}`,
);

// ── URL Safety ─────────────────────────────────────────────────────

const SKILLS_SH_ORIGIN = 'https://skills.sh';

/** Check if a URL is safe to crawl (skills.sh domain, official publisher). */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== SKILLS_SH_ORIGIN) return false;

    const pathParts = parsed.pathname.split('/').filter(Boolean);

    // Allow seed pages: /official, /audits, /docs, /docs/cli, /docs/faq
    if (pathParts.length <= 2 && ['official', 'audits', 'docs'].includes(pathParts[0] ?? '')) {
      return true;
    }

    // Allow official publisher listing pages: /{publisher}
    if (pathParts.length === 1 && isOfficialPublisher(pathParts[0]!)) {
      return true;
    }

    // Allow official publisher repo pages: /{publisher}/{repo}
    if (pathParts.length === 2 && isOfficialPublisher(pathParts[0]!)) {
      return true;
    }

    // Allow official skill detail pages: /{publisher}/{repo}/{skill}
    if (pathParts.length === 3 && isOfficialPublisher(pathParts[0]!)) {
      return true;
    }

    // Reject everything else (non-official publishers, unknown paths)
    return false;
  } catch {
    return false;
  }
}

/** Parse a skills.sh URL into publisher/repo/skill components. */
function parseSkillUrl(url: string): { publisher: string; repo: string; skill?: string } | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && isOfficialPublisher(parts[0]!)) {
      return {
        publisher: parts[0]!,
        repo: parts[1]!,
        skill: parts[2],
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Crawler ────────────────────────────────────────────────────────

export class SkillsCrawler {
  private readonly options: SkillsCrawlerOptions;
  private readonly bloomFilter: InstanceType<typeof BloomFilter>;
  private readonly results: CrawlResult[] = [];
  private readonly typedSkills: TypedSkill[] = [];
  private readonly catalogEntries: SkillCatalogEntry[] = [];
  private stats: CrawlStats;

  constructor(options: Partial<SkillsCrawlerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    // mnemonist BloomFilter — same pattern as crawlee-crawler.ts
    this.bloomFilter = new BloomFilter(this.options.bloomFilterSize);
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

  // ── BloomFilter dedup (mirrors crawlee-crawler.ts) ───────────────

  /** Check if URL has been seen (probabilistic). */
  private isUrlSeen(url: string): boolean {
    return this.bloomFilter.test(url);
  }

  /** Mark URL as seen. */
  private markUrlSeen(url: string): void {
    this.bloomFilter.add(url);
  }

  // ── HTTP fetch ───────────────────────────────────────────────────

  private async fetchPage(url: string): Promise<string> {
    this.stats.pagesRequested++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.requestTimeout);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": this.options.userAgent,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
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

  // ── Link extraction with safety filter ───────────────────────────

  /** Extract all safe links from a page. Only official publisher links pass. */
  private extractSafeLinks(html: string, baseUrl: string): string[] {
    const $ = cheerio.load(html);
    const links: string[] = [];

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

      try {
        const resolved = new URL(href, baseUrl).href;
        if (isSafeUrl(resolved) && !this.isUrlSeen(resolved)) {
          links.push(resolved);
        }
      } catch {
        // Invalid URL — skip
      }
    });

    return [...new Set(links)];
  }

  // ── Catalog entry extraction ─────────────────────────────────────

  /** Extract skill catalog entries from a listing page (e.g., /official, /{publisher}). */
  private extractCatalogEntries(html: string, baseUrl: string): SkillCatalogEntry[] {
    const $ = cheerio.load(html);
    const entries: SkillCatalogEntry[] = [];

    // Try common patterns for skill listing cards/items
    // Pattern 1: Links with skill path pattern /{publisher}/{repo}/{skill}
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? '';
      const text = $(el).text().trim();

      try {
        const resolved = new URL(href, baseUrl).href;
        const parsed = parseSkillUrl(resolved);
        if (parsed && parsed.skill) {
          // Look for install count near this element
          const parent = $(el).parent();
          const siblingText = parent.text();
          const installMatch = siblingText.match(/([\d,.]+[kKmM]?)\s*(?:installs?|downloads?)/i);
          const installCount = installMatch ? parseInstallCount(installMatch[1]!) : null;

          // Get description from nearby text
          const desc = parent.find('p, .description, [class*=desc]').first().text().trim()
            || text.replace(parsed.skill, '').trim();

          entries.push({
            name: parsed.skill,
            publisher: parsed.publisher,
            repo: parsed.repo,
            url: resolved,
            installCount,
            description: desc || `${parsed.skill} skill by ${parsed.publisher}/${parsed.repo}`,
          });
        }
      } catch {
        // Invalid URL — skip
      }
    });

    return entries;
  }

  // ── Crawl a single page ──────────────────────────────────────────

  /** Crawl a single URL, extract content, and produce CrawlResult. */
  async crawlPage(url: string, pageType = "skill"): Promise<CrawlResult | null> {
    if (!isSafeUrl(url)) {
      console.error(`  [skills] BLOCKED unsafe URL: ${url}`);
      return null;
    }

    if (this.isUrlSeen(url)) {
      return null; // Already crawled (BloomFilter)
    }
    this.markUrlSeen(url);

    try {
      const html = await this.fetchPage(url);
      const extracted = extractPage(html, url);
      const quality = scoreQuality(extracted);

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

      // Extract catalog entries if this is a listing page
      const catalogEntries = this.extractCatalogEntries(html, url);
      this.catalogEntries.push(...catalogEntries);

      // Extract typed skill if this is a skill detail page
      const parsed = parseSkillUrl(url);
      if (parsed?.skill) {
        const entry: SkillCatalogEntry = {
          name: parsed.skill,
          publisher: parsed.publisher,
          repo: parsed.repo,
          url,
          installCount: null, // Will be enriched from catalog
          description: extracted.description || extracted.title,
        };
        const typed = extractSkillTyped(entry, extracted.contentMarkdown);
        this.typedSkills.push(typed);
      }

      return result;
    } catch (err) {
      this.stats.errors++;
      console.error(`  [skills] Error crawling ${url}: ${err}`);
      return null;
    }
  }

  // ── Main crawl orchestration ─────────────────────────────────────

  /** Crawl all official skills starting from seed URLs.
   *
   *  Flow:
   *  1. Crawl seed URLs (official, audits, docs)
   *  2. Crawl official publisher listing pages
   *  3. Follow links to individual skill pages (official only)
   *  4. Extract typed skill data from each skill page
   */
  async crawl(): Promise<CrawlResult[]> {
    this.stats.startTime = performance.now();
    console.log(`[skills] Starting official vendor skills crawl`);
    console.log(`[skills] Official publishers: ${OFFICIAL_PUBLISHERS.join(', ')}`);
    console.log(`[skills] Max pages: ${this.options.maxPages}`);

    // Phase 1: Seed URLs
    console.log(`\n[skills] Phase 1: Crawling ${SEED_URLS.length} seed URLs`);
    for (const url of SEED_URLS) {
      if (this.results.length >= this.options.maxPages) break;
      await this.crawlPage(url, 'docs');
      await this.delay();
    }

    // Phase 2: Publisher listing pages
    console.log(`\n[skills] Phase 2: Crawling ${PUBLISHER_URLS.length} publisher pages`);
    for (const url of PUBLISHER_URLS) {
      if (this.results.length >= this.options.maxPages) break;
      await this.crawlPage(url, 'publisher');
      await this.delay();
    }

    // Phase 3: Follow links to individual skills (breadth-first, official only)
    console.log(`\n[skills] Phase 3: Following links to skill detail pages`);
    const discoveredLinks: string[] = [];

    // Collect all safe links from pages crawled so far
    for (const result of this.results) {
      const safeLinks = result.links.filter((link) => isSafeUrl(link) && !this.isUrlSeen(link));
      discoveredLinks.push(...safeLinks);
    }

    // Also add links from catalog entries
    for (const entry of this.catalogEntries) {
      if (isSafeUrl(entry.url) && !this.isUrlSeen(entry.url)) {
        discoveredLinks.push(entry.url);
      }
    }

    const uniqueLinks = [...new Set(discoveredLinks)];
    console.log(`[skills] Discovered ${uniqueLinks.length} safe links to follow`);

    for (const link of uniqueLinks) {
      if (this.results.length >= this.options.maxPages) break;
      await this.crawlPage(link, 'skill');
      await this.delay();
    }

    // Phase 4: Enrich typed skills with catalog install counts
    for (const skill of this.typedSkills) {
      const catalogEntry = this.catalogEntries.find(
        (e) => e.name === skill.name && e.publisher === skill.publisher,
      );
      if (catalogEntry?.installCount && skill.installCount === null) {
        // Re-extract with enriched data
        const idx = this.typedSkills.indexOf(skill);
        if (idx >= 0) {
          const enriched = extractSkillTyped(
            { ...catalogEntry },
            this.results.find((r) => r.url === skill.url)?.contentMarkdown ?? '',
          );
          this.typedSkills[idx] = enriched;
        }
      }
    }

    this.finalize();

    console.log(`\n[skills] Crawl complete:`);
    console.log(`  Pages crawled: ${this.stats.pagesCrawled}`);
    console.log(`  Typed skills: ${this.typedSkills.length}`);
    console.log(`  Catalog entries: ${this.catalogEntries.length}`);
    console.log(`  Errors: ${this.stats.errors}`);
    console.log(`  Avg quality: ${this.stats.avgQuality.toFixed(4)}`);
    console.log(`  Elapsed: ${(this.stats.elapsedMs / 1000).toFixed(1)}s`);

    return this.results;
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private async delay(): Promise<void> {
    if (this.options.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.options.delayMs));
    }
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

  // ── Public accessors ─────────────────────────────────────────────

  getResults(): ReadonlyArray<CrawlResult> { return this.results; }
  getTypedSkills(): ReadonlyArray<TypedSkill> { return this.typedSkills; }
  getCatalogEntries(): ReadonlyArray<SkillCatalogEntry> { return this.catalogEntries; }
  getStats(): CrawlStats { return { ...this.stats }; }

  getBloomFilterStats(): { urlsSeen: number; errors: number } {
    return {
      urlsSeen: this.stats.pagesCrawled + this.stats.errors,
      errors: this.stats.errors,
    };
  }

  /** Print formatted summary of typed skills. */
  printSummary(): string {
    return printTypedSkills(this.typedSkills);
  }
}

// ── Exported safety functions for testing ──────────────────────────

export { isSafeUrl, parseSkillUrl, SEED_URLS, PUBLISHER_URLS };
