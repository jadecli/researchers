/** Core types for the TypeScript crawler. */

export interface CrawlResult {
  url: string;
  title: string;
  description: string;
  contentMarkdown: string;
  contentHtml: string;
  metadata: Record<string, string>;
  links: string[];
  extractionTimestamp: string;
  qualityScore: number;
  pageType: string;
}

export interface CustomerData {
  name: string;
  industry: string;
  description: string;
  metrics: string[];
  url: string;
}

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

export interface CrawlStats {
  pagesRequested: number;
  pagesCrawled: number;
  errors: number;
  startTime: number;
  endTime: number;
  elapsedMs: number;
  items: number;
  avgQuality: number;
}

export interface BenchmarkResult {
  crawler: string;
  target: string;
  fixtureMode: boolean;
  elapsedSeconds: number;
  stats: CrawlStats;
  timestamp: string;
}
