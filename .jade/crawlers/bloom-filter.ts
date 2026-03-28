// .jade/crawlers/bloom-filter.ts — Bloom filter for Crawlee URL deduplication
//
// Uses the deterministic bloom filter implementation to track seen URLs.
// Integrates with Neon Postgres for cross-restart persistence via bloom_filter_state table.
//
// Usage with Crawlee:
//   const filter = new PersistentBloomFilter({ expectedItems: 10000, falsePositiveRate: 0.001 });
//   await filter.loadFromDb(pool, 'crawlee-docs', 'docs.anthropic.com');
//   // In router: if (filter.has(url)) skip; else filter.add(url);
//   await filter.saveToDb(pool, 'crawlee-docs', 'docs.anthropic.com');

import { createHash } from 'node:crypto';

// ─── Core Bloom Filter ─────────────────────────────────────────────────────

export interface BloomFilterConfig {
  /** Expected number of items to insert */
  readonly expectedItems: number;
  /** Desired false positive rate (e.g. 0.001 = 0.1%) */
  readonly falsePositiveRate: number;
}

export class BloomFilter {
  readonly bitSize: number;
  readonly hashCount: number;
  private bits: Uint8Array;
  private _itemCount: number = 0;

  constructor(config: BloomFilterConfig) {
    // Optimal bit array size: m = -(n * ln(p)) / (ln(2)^2)
    this.bitSize = Math.ceil(
      -(config.expectedItems * Math.log(config.falsePositiveRate)) / (Math.LN2 * Math.LN2)
    );
    // Optimal hash count: k = (m/n) * ln(2)
    this.hashCount = Math.ceil((this.bitSize / config.expectedItems) * Math.LN2);
    this.bits = new Uint8Array(Math.ceil(this.bitSize / 8));
  }

  /** Number of items inserted */
  get itemCount(): number {
    return this._itemCount;
  }

  /** Add a URL/string to the filter */
  add(item: string): void {
    const hashes = this._getHashes(item);
    for (const h of hashes) {
      const idx = h % this.bitSize;
      this.bits[Math.floor(idx / 8)]! |= (1 << (idx % 8));
    }
    this._itemCount++;
  }

  /** Check if a URL/string might be in the filter (may have false positives) */
  has(item: string): boolean {
    const hashes = this._getHashes(item);
    for (const h of hashes) {
      const idx = h % this.bitSize;
      if (!(this.bits[Math.floor(idx / 8)]! & (1 << (idx % 8)))) {
        return false; // Definitely not in the set
      }
    }
    return true; // Probably in the set
  }

  /** Serialize the filter to a Buffer for persistence */
  serialize(): Buffer {
    return Buffer.from(this.bits);
  }

  /** Restore the filter from a serialized Buffer */
  static deserialize(
    buf: Buffer,
    bitSize: number,
    hashCount: number,
    itemCount: number,
  ): BloomFilter {
    const filter = Object.create(BloomFilter.prototype) as BloomFilter;
    (filter as { bitSize: number }).bitSize = bitSize;
    (filter as { hashCount: number }).hashCount = hashCount;
    filter.bits = new Uint8Array(buf);
    filter._itemCount = itemCount;
    return filter;
  }

  /** Generate k hash values using double hashing: h(i) = h1 + i*h2 */
  private _getHashes(item: string): number[] {
    const h1Buf = createHash('sha256').update(item).digest();
    const h2Buf = createHash('sha256').update(item + '\x00').digest();
    const h1 = h1Buf.readUInt32BE(0);
    const h2 = h2Buf.readUInt32BE(0);

    const hashes: number[] = [];
    for (let i = 0; i < this.hashCount; i++) {
      hashes.push(Math.abs((h1 + i * h2) >>> 0));
    }
    return hashes;
  }
}

// ─── Persistent Bloom Filter (Neon Postgres backed) ────────────────────────

export interface DbPool {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export class PersistentBloomFilter {
  private filter: BloomFilter;
  private readonly config: BloomFilterConfig;

  constructor(config: BloomFilterConfig) {
    this.config = config;
    this.filter = new BloomFilter(config);
  }

  get itemCount(): number { return this.filter.itemCount; }
  get bitSize(): number { return this.filter.bitSize; }
  get hashCount(): number { return this.filter.hashCount; }

  add(item: string): void { this.filter.add(item); }
  has(item: string): boolean { return this.filter.has(item); }

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
    this.filter = BloomFilter.deserialize(
      row['filter_bytes'] as Buffer,
      row['bit_array_size'] as number,
      row['hash_functions'] as number,
      row['items_inserted'] as number,
    );
    return true;
  }

  /** Save filter state to Neon Postgres bloom_filter_state table */
  async saveToDb(pool: DbPool, crawlerId: string, domain: string): Promise<void> {
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
        this.filter.hashCount, this.filter.bitSize,
        this.filter.itemCount, this.filter.serialize(),
      ],
    );
  }
}
