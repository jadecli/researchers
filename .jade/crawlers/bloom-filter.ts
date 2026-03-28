// .jade/crawlers/bloom-filter.ts — Bloom filter for Crawlee URL deduplication
//
// Uses the `bloom-filters` npm package (most adopted JS bloom filter library,
// 50k+ weekly downloads, supports serialization via saveAsJSON/fromJSON).
//
// Integrates with Neon Postgres for cross-restart persistence via bloom_filter_state table.
//
// Usage with Crawlee:
//   const filter = new PersistentBloomFilter({ expectedItems: 10000, falsePositiveRate: 0.001 });
//   await filter.loadFromDb(pool, 'crawlee-docs', 'docs.anthropic.com');
//   // In router: if (filter.has(url)) skip; else filter.add(url);
//   await filter.saveToDb(pool, 'crawlee-docs', 'docs.anthropic.com');

// bloom-filters is a CJS module
import bloomFilters from 'bloom-filters';
const { BloomFilter: BF } = bloomFilters;

// Re-export the package's BloomFilter type for external use
export type BloomFilterInstance = InstanceType<typeof BF>;

// ─── Config ────────────────────────────────────────────────────────────────

export interface BloomFilterConfig {
  /** Expected number of items to insert */
  readonly expectedItems: number;
  /** Desired false positive rate (e.g. 0.001 = 0.1%) */
  readonly falsePositiveRate: number;
}

// ─── Persistent Bloom Filter (Neon Postgres backed) ────────────────────────

export interface DbPool {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export class PersistentBloomFilter {
  private filter: InstanceType<typeof BF>;
  private readonly config: BloomFilterConfig;

  constructor(config: BloomFilterConfig) {
    this.config = config;
    this.filter = BF.create(config.expectedItems, config.falsePositiveRate);
  }

  get size(): number { return this.filter.size; }
  get nbHashes(): number { return this.filter.nbHashes; }

  add(item: string): void { this.filter.add(item); }
  has(item: string): boolean { return this.filter.has(item); }

  /** Serialize to JSON (bloom-filters built-in serialization) */
  toJSON(): Record<string, unknown> {
    return this.filter.saveAsJSON() as Record<string, unknown>;
  }

  /** Restore from JSON */
  static fromJSON(json: Record<string, unknown>, config: BloomFilterConfig): PersistentBloomFilter {
    const instance = new PersistentBloomFilter(config);
    instance.filter = BF.fromJSON(json) as InstanceType<typeof BF>;
    return instance;
  }

  /** Load filter state from Neon Postgres bloom_filter_state table */
  async loadFromDb(pool: DbPool, crawlerId: string, domain: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT filter_bytes, bit_array_size, hash_functions, items_inserted
       FROM bloom_filter_state
       WHERE crawler_id = $1 AND domain = $2`,
      [crawlerId, domain],
    );

    if (result.rows.length === 0) return false;

    const row = result.rows[0]!;
    const jsonStr = (row['filter_bytes'] as Buffer).toString('utf-8');
    const json = JSON.parse(jsonStr) as Record<string, unknown>;
    this.filter = BF.fromJSON(json) as InstanceType<typeof BF>;
    return true;
  }

  /** Save filter state to Neon Postgres bloom_filter_state table */
  async saveToDb(pool: DbPool, crawlerId: string, domain: string): Promise<void> {
    const json = this.filter.saveAsJSON();
    const jsonBuf = Buffer.from(JSON.stringify(json), 'utf-8');

    await pool.query(
      `INSERT INTO bloom_filter_state
         (crawler_id, domain, expected_items, false_positive_rate,
          hash_functions, bit_array_size, items_inserted, filter_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (crawler_id, domain) DO UPDATE SET
         items_inserted = $7,
         filter_bytes = $8,
         updated_at = NOW()`,
      [
        crawlerId, domain,
        this.config.expectedItems, this.config.falsePositiveRate,
        this.filter.nbHashes, this.filter.size,
        0, jsonBuf,
      ],
    );
  }
}

// ─── Convenience: create a standalone filter without persistence ───────────

export function createBloomFilter(expectedItems: number, falsePositiveRate: number): InstanceType<typeof BF> {
  return BF.create(expectedItems, falsePositiveRate);
}
