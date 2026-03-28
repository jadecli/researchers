// src/storage/neon.ts — Neon PG18 persistence for changelog data
//
// Stores extracted changelog bullets and bloom filter state in
// the agentdata schema. Requires DATABASE_URL env var pointing
// to a Neon PG18 pooler endpoint.

import pg from 'pg';
import type { ChangelogBullet } from '../extractors/bullets.js';

const { Pool } = pg;

// ── Types ────────────────────────────────────────────────────────
export interface NeonStorage {
  /** Insert changelog bullets (upserts on repo+version+description) */
  insertBullets(bullets: ChangelogBullet[]): Promise<number>;
  /** Save bloom filter state */
  saveBloomState(filterName: string, filterData: Buffer, itemCount: number): Promise<void>;
  /** Load bloom filter state */
  loadBloomState(filterName: string): Promise<{ filterData: Buffer; itemCount: number } | null>;
  /** Get latest bullets for a repo */
  getLatestBullets(repo: string, limit?: number): Promise<ChangelogBullet[]>;
  /** Close the connection pool */
  close(): Promise<void>;
}

// ── Factory ──────────────────────────────────────────────────────
export function createNeonStorage(databaseUrl?: string): NeonStorage {
  const url = databaseUrl ?? process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is required for Neon storage');
  }

  const pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  });

  return {
    async insertBullets(bullets: ChangelogBullet[]): Promise<number> {
      if (bullets.length === 0) return 0;

      const client = await pool.connect();
      try {
        let inserted = 0;
        for (const b of bullets) {
          const result = await client.query(
            `INSERT INTO agentdata.changelog_bullets
               (source_repo, version, release_date, category, description, breaking, raw_markdown)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT DO NOTHING`,
            [
              b.sourceRepo,
              b.version,
              b.releaseDate ?? null,
              b.category,
              b.description,
              b.breaking,
              null, // raw_markdown stored at section level, not bullet level
            ],
          );
          inserted += result.rowCount ?? 0;
        }
        return inserted;
      } finally {
        client.release();
      }
    },

    async saveBloomState(filterName: string, filterData: Buffer, itemCount: number): Promise<void> {
      await pool.query(
        `INSERT INTO agentdata.bloom_state (filter_name, filter_data, item_count, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (filter_name) DO UPDATE SET
           filter_data = EXCLUDED.filter_data,
           item_count = EXCLUDED.item_count,
           updated_at = now()`,
        [filterName, filterData, itemCount],
      );
    },

    async loadBloomState(filterName: string): Promise<{ filterData: Buffer; itemCount: number } | null> {
      const result = await pool.query(
        `SELECT filter_data, item_count FROM agentdata.bloom_state WHERE filter_name = $1`,
        [filterName],
      );
      const row = result.rows[0] as { filter_data: Buffer; item_count: number } | undefined;
      if (!row) return null;
      return { filterData: row.filter_data, itemCount: row.item_count };
    },

    async getLatestBullets(repo: string, limit = 50): Promise<ChangelogBullet[]> {
      const result = await pool.query(
        `SELECT source_repo, version, release_date, category, description, breaking
         FROM agentdata.changelog_bullets
         WHERE source_repo = $1
         ORDER BY id DESC
         LIMIT $2`,
        [repo, limit],
      );
      return result.rows.map((row: Record<string, unknown>) => ({
        sourceRepo: row['source_repo'] as string,
        version: row['version'] as string,
        releaseDate: row['release_date'] as string | undefined,
        category: row['category'] as ChangelogBullet['category'],
        description: row['description'] as string,
        breaking: row['breaking'] as boolean,
      }));
    },

    async close(): Promise<void> {
      await pool.end();
    },
  };
}
