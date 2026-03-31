import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  transformToStoreRows,
  buildBloomEntries,
  LocalCrawlStore,
  generateInsertSQL,
  generateBloomIndexedSQL,
  generateUnindexedSQL,
  runPipeline,
  type CrawlOutput,
  type CrawlStoreRow,
} from '../src/orchestrator/crawl-store-bloom.js';

// ── Test Fixtures ──────────────────────────────────────────

const mockCrawlOutput: CrawlOutput = {
  url: 'https://docs.anthropic.com/en/docs/agents',
  title: 'Building Agents',
  contentMarkdown: '# Building Agents\n\nLearn how to build agents with Claude.',
  contentHtml: '<h1>Building Agents</h1><p>Learn how to build agents with Claude.</p>',
  qualityScore: 0.85,
  pageType: 'doc',
  metadata: { author: 'Anthropic', section: 'docs' },
  extractionTimestamp: '2026-03-29T12:00:00Z',
};

const mockCrawlOutputs: CrawlOutput[] = [
  mockCrawlOutput,
  {
    ...mockCrawlOutput,
    url: 'https://docs.anthropic.com/en/docs/tool-use',
    title: 'Tool Use',
    contentMarkdown: '# Tool Use\n\nConnect Claude to external tools.',
  },
  {
    ...mockCrawlOutput,
    url: 'https://arxiv.org/abs/2511.02823',
    title: 'Red Teaming Paper',
    contentMarkdown: '# Optimizing AI Agent Attacks\n\nAbstract...',
    pageType: 'research',
  },
];

// ── Transform Tests ────────────────────────────────────────

describe('transformToStoreRows', () => {
  it('transforms crawl outputs to store rows', () => {
    const rows = transformToStoreRows(mockCrawlOutputs, 'sweep-1', 'crawlee');

    expect(rows).toHaveLength(3);
    expect(rows[0]!.url).toBe('https://docs.anthropic.com/en/docs/agents');
    expect(rows[0]!.crawler_type).toBe('crawlee');
    expect(rows[0]!.sweep_id).toBe('sweep-1');
    expect(rows[0]!.bloom_indexed).toBe(false);
  });

  it('computes content hash from markdown', () => {
    const rows = transformToStoreRows([mockCrawlOutput], null, 'scrapy');
    expect(rows[0]!.content_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('sets content_length from markdown', () => {
    const rows = transformToStoreRows([mockCrawlOutput], null, 'cheerio');
    expect(rows[0]!.content_length).toBe(mockCrawlOutput.contentMarkdown.length);
  });

  it('preserves metadata as extraction_data', () => {
    const rows = transformToStoreRows([mockCrawlOutput], null, 'crawlee');
    expect(rows[0]!.extraction_data).toEqual({ author: 'Anthropic', section: 'docs' });
  });

  it('same content produces same hash', () => {
    const rows1 = transformToStoreRows([mockCrawlOutput], null, 'crawlee');
    const rows2 = transformToStoreRows([mockCrawlOutput], null, 'crawlee');
    expect(rows1[0]!.content_hash).toBe(rows2[0]!.content_hash);
  });
});

// ── Bloom Entries Tests ────────────────────────────────────

describe('buildBloomEntries', () => {
  it('creates entries for non-indexed rows', () => {
    const rows = transformToStoreRows(mockCrawlOutputs, null, 'crawlee');
    const { entries, skipped } = buildBloomEntries(rows);

    expect(entries).toHaveLength(3);
    expect(skipped).toBe(0);
    expect(entries[0]!.url).toBe(mockCrawlOutputs[0]!.url);
  });

  it('skips already-indexed rows', () => {
    const rows: CrawlStoreRow[] = transformToStoreRows(mockCrawlOutputs, null, 'crawlee').map(
      (r, i) => ({ ...r, bloom_indexed: i === 0 }),
    );
    const { entries, skipped } = buildBloomEntries(rows);

    expect(entries).toHaveLength(2);
    expect(skipped).toBe(1);
  });
});

// ── LocalCrawlStore Tests ──────────────────────────────────

describe('LocalCrawlStore', () => {
  let tmpDir: string;
  let store: LocalCrawlStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crawl-store-test-'));
    store = new LocalCrawlStore(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('stores and reads back crawl rows', () => {
    const rows = transformToStoreRows(mockCrawlOutputs, null, 'crawlee');
    const storeResult = store.store(rows);
    expect(storeResult.ok).toBe(true);

    const read = store.readAll();
    expect(read).toHaveLength(3);
    expect(read[0]!.url).toBe(mockCrawlOutputs[0]!.url);
  });

  it('readNew returns only new rows since last read', () => {
    const rows1 = transformToStoreRows([mockCrawlOutputs[0]!], null, 'crawlee');
    store.store(rows1);
    const first = store.readNew();
    expect(first).toHaveLength(1);

    const rows2 = transformToStoreRows([mockCrawlOutputs[1]!], null, 'crawlee');
    store.store(rows2);
    const second = store.readNew();
    expect(second).toHaveLength(1);
    expect(second[0]!.url).toBe(mockCrawlOutputs[1]!.url);
  });

  it('appends and reads bloom index entries', () => {
    const rows = transformToStoreRows(mockCrawlOutputs, null, 'crawlee');
    const { entries } = buildBloomEntries(rows);

    const result = store.appendBloomIndex(entries);
    expect(result.ok).toBe(true);

    const index = store.readBloomIndex();
    expect(index).toHaveLength(3);
  });

  it('rotates when store exceeds threshold', () => {
    // Write enough data to exceed a tiny threshold
    for (let i = 0; i < 50; i++) {
      const rows = transformToStoreRows(
        [{ ...mockCrawlOutput, url: `https://example.com/page-${i}` }],
        null,
        'crawlee',
      );
      store.store(rows);
    }

    const result = store.rotate(100); // tiny threshold
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(true);

    // Rotated file should exist
    expect(fs.existsSync(store.getStorePath() + '.1')).toBe(true);
  });
});

// ── SQL Generator Tests ────────────────────────────────────

describe('SQL Generators', () => {
  it('generateInsertSQL produces parameterized SQL', () => {
    const rows = transformToStoreRows([mockCrawlOutput], 'sweep-1', 'crawlee');
    const { sql, values } = generateInsertSQL(rows);

    expect(sql).toContain('INSERT INTO teams.crawl_store');
    expect(sql).toContain('$1');
    expect(sql).toContain('ON CONFLICT');
    expect(values).toHaveLength(1);
    expect(values[0]).toHaveLength(13);
  });

  it('generateBloomIndexedSQL produces parameterized UPDATE', () => {
    const { sql, values } = generateBloomIndexedSQL([
      'https://example.com/a',
      'https://example.com/b',
    ]);

    expect(sql).toContain('UPDATE teams.crawl_store');
    expect(sql).toContain('$1, $2');
    expect(values).toHaveLength(2);
  });

  it('generateUnindexedSQL produces parameterized SELECT', () => {
    const { sql, values } = generateUnindexedSQL(50);

    expect(sql).toContain('SELECT url');
    expect(sql).toContain('bloom_indexed = false');
    expect(values).toEqual([50]);
  });
});

// ── Pipeline Runner Tests ──────────────────────────────────

describe('runPipeline', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runs full crawl→store→bloom pipeline', () => {
    const results = runPipeline(mockCrawlOutputs, {
      storeDir: tmpDir,
      crawlerType: 'crawlee',
    });

    expect(results).toHaveLength(3); // crawl, store, bloom
    expect(results[0]!.stage).toBe('crawl');
    expect(results[1]!.stage).toBe('store');
    expect(results[2]!.stage).toBe('bloom');

    if (results[0]!.stage === 'crawl') {
      expect(results[0]!.items).toHaveLength(3);
    }
    if (results[1]!.stage === 'store') {
      expect(results[1]!.rows).toHaveLength(3);
    }
    if (results[2]!.stage === 'bloom') {
      expect(results[2]!.indexed).toBe(3);
      expect(results[2]!.skipped).toBe(0);
    }
  });

  it('pipeline stores data that can be read back', () => {
    runPipeline(mockCrawlOutputs, { storeDir: tmpDir });

    const store = new LocalCrawlStore(tmpDir);
    const rows = store.readAll();
    expect(rows).toHaveLength(3);

    const index = store.readBloomIndex();
    expect(index).toHaveLength(3);
  });

  it('pipeline records timing for each stage', () => {
    const results = runPipeline(mockCrawlOutputs, { storeDir: tmpDir });

    for (const result of results) {
      if (result.stage !== 'error') {
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
