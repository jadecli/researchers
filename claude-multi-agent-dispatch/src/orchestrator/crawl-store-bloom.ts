// src/orchestrator/crawl-store-bloom.ts — Crawl→Store→Bloom pipeline
//
// Connects crawlee/scrapy output to Neon PG18 tables, then indexes
// stored pages in bloom filters for probabilistic pre-routing.
//
// Pipeline stages:
//   1. CRAWL: CrawleeMnemonistCrawler or Scrapy spider produces CrawlResult[]
//   2. STORE: Results stored in teams.crawl_store (Neon PG18)
//   3. BLOOM: Stored URLs indexed in bloom filter for fast routing
//   4. ROUTE: Bloom filter + signal router decide model tier for processing
//
// Dogfoods: concurrency.ts (atomic writes), cursor.ts (JSONL reads),
//   bloom-filter.ts (probabilistic routing), signal-router.ts (weighted scoring)
//
// Boris Cherny patterns: Branded types, Result<T,E>, discriminated unions.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { Ok, Err, type Result } from '../types/core.js';
import { CursorReader, rotateJsonl } from '../logging/cursor.js';

// ── Pipeline Types ─────────────────────────────────────────

/** Crawl result from crawlee/scrapy — matches existing CrawlResult interface */
export interface CrawlOutput {
  readonly url: string;
  readonly title: string;
  readonly contentMarkdown: string;
  readonly contentHtml: string;
  readonly qualityScore: number;
  readonly pageType: string;
  readonly metadata: Record<string, unknown>;
  readonly extractionTimestamp: string;
}

/** Neon PG18 row for teams.crawl_store */
export interface CrawlStoreRow {
  readonly crawl_id: string;
  readonly sweep_id: string | null;
  readonly url: string;
  readonly content_hash: string;      // hex-encoded SHA-256
  readonly title: string;
  readonly content_markdown: string;
  readonly content_length: number;
  readonly page_type: string;
  readonly quality_score: number;
  readonly extraction_data: Record<string, unknown>;
  readonly crawler_type: 'scrapy' | 'crawlee' | 'cheerio';
  readonly bloom_indexed: boolean;
  readonly created_at: string;
}

/** Bloom filter index entry */
export interface BloomIndexEntry {
  readonly url: string;
  readonly contentHash: string;
  readonly pageType: string;
  readonly indexedAt: number;
}

/** Pipeline stage result — discriminated union */
export type PipelineStageResult =
  | { readonly stage: 'crawl'; readonly items: readonly CrawlOutput[]; readonly durationMs: number }
  | { readonly stage: 'store'; readonly rows: readonly CrawlStoreRow[]; readonly durationMs: number }
  | { readonly stage: 'bloom'; readonly indexed: number; readonly skipped: number; readonly durationMs: number }
  | { readonly stage: 'error'; readonly error: string; readonly failedStage: string };

// ── Content Hashing ────────────────────────────────────────

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

// ── Crawl→Store Transform ──────────────────────────────────

/**
 * Transform crawl output into Neon-ready rows.
 * Computes content hash for change detection.
 */
export function transformToStoreRows(
  outputs: readonly CrawlOutput[],
  sweepId: string | null,
  crawlerType: 'scrapy' | 'crawlee' | 'cheerio',
): CrawlStoreRow[] {
  return outputs.map((output) => ({
    crawl_id: crypto.randomUUID(),
    sweep_id: sweepId,
    url: output.url,
    content_hash: hashContent(output.contentMarkdown),
    title: output.title,
    content_markdown: output.contentMarkdown,
    content_length: output.contentMarkdown.length,
    page_type: output.pageType,
    quality_score: output.qualityScore,
    extraction_data: output.metadata,
    crawler_type: crawlerType,
    bloom_indexed: false,
    created_at: new Date().toISOString(),
  }));
}

// ── Store→Bloom Index ──────────────────────────────────────

/**
 * Build bloom index entries from stored rows.
 * Only indexes rows that haven't been bloom_indexed yet.
 */
export function buildBloomEntries(
  rows: readonly CrawlStoreRow[],
): { entries: BloomIndexEntry[]; skipped: number } {
  const entries: BloomIndexEntry[] = [];
  let skipped = 0;

  for (const row of rows) {
    if (row.bloom_indexed) {
      skipped++;
      continue;
    }
    entries.push({
      url: row.url,
      contentHash: row.content_hash,
      pageType: row.page_type,
      indexedAt: Date.now(),
    });
  }

  return { entries, skipped };
}

// ── JSONL-backed Local Store ───────────────────────────────
// When Neon is unavailable, store crawl results in JSONL files
// using our cursor reader for efficient incremental reads.

export class LocalCrawlStore {
  private readonly storePath: string;
  private readonly bloomIndexPath: string;
  private readonly reader: CursorReader<CrawlStoreRow>;

  constructor(baseDir: string) {
    fs.mkdirSync(baseDir, { recursive: true });
    this.storePath = path.join(baseDir, 'crawl-store.jsonl');
    this.bloomIndexPath = path.join(baseDir, 'bloom-index.jsonl');
    this.reader = new CursorReader<CrawlStoreRow>(this.storePath, baseDir);
  }

  /**
   * Store crawl results as JSONL rows.
   * Uses append for atomicity on Linux (lines < PIPE_BUF).
   */
  store(rows: readonly CrawlStoreRow[]): Result<number, Error> {
    try {
      const lines = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
      fs.appendFileSync(this.storePath, lines);
      return Ok(rows.length);
    } catch (e) {
      return Err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Read only new rows since last read (cursor-based).
   */
  readNew(): CrawlStoreRow[] {
    return this.reader.readNew();
  }

  /**
   * Read all rows (resets cursor).
   */
  readAll(): CrawlStoreRow[] {
    this.reader.reset();
    return this.reader.readNew();
  }

  /**
   * Append bloom index entries.
   */
  appendBloomIndex(entries: readonly BloomIndexEntry[]): Result<number, Error> {
    try {
      const lines = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
      fs.appendFileSync(this.bloomIndexPath, lines);
      return Ok(entries.length);
    } catch (e) {
      return Err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Read bloom index entries.
   */
  readBloomIndex(): BloomIndexEntry[] {
    const indexReader = new CursorReader<BloomIndexEntry>(this.bloomIndexPath);
    indexReader.reset();
    return indexReader.readNew();
  }

  /**
   * Get store file path.
   */
  getStorePath(): string {
    return this.storePath;
  }

  /**
   * Rotate store file when it exceeds maxBytes.
   */
  rotate(maxBytes: number): Result<boolean, Error> {
    return rotateJsonl(this.storePath, maxBytes);
  }
}

// ── Neon SQL Generators ────────────────────────────────────
// Generate SQL for Neon PG18 operations.
// Used when DATABASE_URL is set for remote persistence.

/**
 * Generate INSERT SQL for teams.crawl_store rows.
 * Parameterized to prevent SQL injection.
 */
export function generateInsertSQL(rows: readonly CrawlStoreRow[]): {
  sql: string;
  values: unknown[][];
} {
  const sql = `
    INSERT INTO teams.crawl_store (
      crawl_id, sweep_id, url, content_hash, title,
      content_markdown, content_length, page_type,
      quality_score, extraction_data, crawler_type,
      bloom_indexed, created_at
    ) VALUES ($1, $2, $3, decode($4, 'hex'), $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13::timestamptz)
    ON CONFLICT (url, content_hash) DO NOTHING
  `;

  const values = rows.map((r) => [
    r.crawl_id,
    r.sweep_id,
    r.url,
    r.content_hash,
    r.title,
    r.content_markdown,
    r.content_length,
    r.page_type,
    r.quality_score,
    JSON.stringify(r.extraction_data),
    r.crawler_type,
    r.bloom_indexed,
    r.created_at,
  ]);

  return { sql, values };
}

/**
 * Generate UPDATE SQL to mark rows as bloom-indexed.
 */
export function generateBloomIndexedSQL(urls: readonly string[]): {
  sql: string;
  values: string[];
} {
  const placeholders = urls.map((_, i) => `$${i + 1}`).join(', ');
  return {
    sql: `UPDATE teams.crawl_store SET bloom_indexed = true WHERE url IN (${placeholders})`,
    values: [...urls],
  };
}

/**
 * Generate SELECT SQL for unindexed rows.
 */
export function generateUnindexedSQL(limit: number = 100): {
  sql: string;
  values: number[];
} {
  return {
    sql: `
      SELECT url, content_hash, page_type, created_at
      FROM teams.crawl_store
      WHERE bloom_indexed = false
      ORDER BY created_at ASC
      LIMIT $1
    `,
    values: [limit],
  };
}

// ── Pipeline Runner ────────────────────────────────────────

export interface PipelineConfig {
  readonly storeDir: string;
  readonly sweepId: string | null;
  readonly crawlerType: 'scrapy' | 'crawlee' | 'cheerio';
  readonly maxStoreBytes: number;       // rotation threshold
  readonly useNeon: boolean;            // true when DATABASE_URL is set
}

const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  storeDir: '/tmp/crawl-pipeline',
  sweepId: null,
  crawlerType: 'crawlee',
  maxStoreBytes: 50 * 1024 * 1024,    // 50MB
  useNeon: false,
};

/**
 * Run the full crawl→store→bloom pipeline on a batch of crawl outputs.
 * Returns stage results for monitoring.
 */
export function runPipeline(
  outputs: readonly CrawlOutput[],
  config: Partial<PipelineConfig> = {},
): PipelineStageResult[] {
  const cfg = { ...DEFAULT_PIPELINE_CONFIG, ...config };
  const results: PipelineStageResult[] = [];

  // Stage 1: Transform
  const storeStart = Date.now();
  const rows = transformToStoreRows(outputs, cfg.sweepId, cfg.crawlerType);
  results.push({
    stage: 'crawl',
    items: outputs,
    durationMs: Date.now() - storeStart,
  });

  // Stage 2: Store
  const writeStart = Date.now();
  const store = new LocalCrawlStore(cfg.storeDir);
  const storeResult = store.store(rows);
  if (!storeResult.ok) {
    results.push({
      stage: 'error',
      error: storeResult.error.message,
      failedStage: 'store',
    });
    return results;
  }

  // Rotate if needed
  store.rotate(cfg.maxStoreBytes);

  results.push({
    stage: 'store',
    rows,
    durationMs: Date.now() - writeStart,
  });

  // Stage 3: Bloom index
  const bloomStart = Date.now();
  const { entries, skipped } = buildBloomEntries(rows);
  const indexResult = store.appendBloomIndex(entries);
  if (!indexResult.ok) {
    results.push({
      stage: 'error',
      error: indexResult.error.message,
      failedStage: 'bloom',
    });
    return results;
  }

  results.push({
    stage: 'bloom',
    indexed: entries.length,
    skipped,
    durationMs: Date.now() - bloomStart,
  });

  return results;
}
