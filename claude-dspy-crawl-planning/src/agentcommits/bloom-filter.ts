// src/agentcommits/bloom-filter.ts — TypeScript bloom filter for agent commit routing
//
// Boris-style branded types + Ralph-style pragmatic implementation.
// Provides O(1) probabilistic pre-check for agent trailer presence in commits.

import { createHash } from 'crypto';

// ── Branded Types (Boris Cherny pattern) ─────────────────────
type Brand<K, T> = K & { readonly __brand: T };

export type CommitHash = Brand<string, 'CommitHash'>;
export type BloomBits = Brand<Uint8Array, 'BloomBits'>;

export function toCommitHash(s: string): CommitHash { return s as CommitHash; }

// ── Configuration ────────────────────────────────────────────
export type BloomFilterConfig = {
  readonly expectedItems: number;
  readonly falsePositiveRate: number;
  readonly bitArraySize: number;
  readonly numHashFunctions: number;
};

export function createConfig(
  expectedItems: number = 10000,
  falsePositiveRate: number = 0.01,
): BloomFilterConfig {
  // Optimal bit array size: m = -(n * ln(p)) / (ln(2)^2)
  const bitArraySize = Math.ceil(
    -(expectedItems * Math.log(falsePositiveRate)) / (Math.log(2) ** 2)
  );
  // Optimal hash count: k = (m/n) * ln(2)
  const numHashFunctions = Math.max(
    1,
    Math.round((bitArraySize / expectedItems) * Math.log(2))
  );
  return { expectedItems, falsePositiveRate, bitArraySize, numHashFunctions };
}

// ── Bloom Filter ─────────────────────────────────────────────
export type AgentCommitBloomFilter = {
  readonly config: BloomFilterConfig;
  readonly bits: Uint8Array;
  count: number;
};

export function createBloomFilter(
  config?: BloomFilterConfig,
): AgentCommitBloomFilter {
  const cfg = config ?? createConfig();
  return {
    config: cfg,
    bits: new Uint8Array(Math.ceil(cfg.bitArraySize / 8)),
    count: 0,
  };
}

function hashPositions(
  item: string,
  config: BloomFilterConfig,
): number[] {
  const h1 = parseInt(
    createHash('md5').update(item).digest('hex').slice(0, 8), 16
  );
  const h2 = parseInt(
    createHash('sha256').update(item).digest('hex').slice(0, 8), 16
  );
  const positions: number[] = [];
  for (let i = 0; i < config.numHashFunctions; i++) {
    positions.push((h1 + i * h2) % config.bitArraySize);
  }
  return positions;
}

export function add(
  filter: AgentCommitBloomFilter,
  commitHash: CommitHash,
): void {
  for (const pos of hashPositions(commitHash, filter.config)) {
    const byteIdx = Math.floor(pos / 8);
    const bitIdx = pos % 8;
    filter.bits[byteIdx] |= (1 << bitIdx);
  }
  filter.count++;
}

export function mightContain(
  filter: AgentCommitBloomFilter,
  commitHash: CommitHash,
): boolean {
  for (const pos of hashPositions(commitHash, filter.config)) {
    const byteIdx = Math.floor(pos / 8);
    const bitIdx = pos % 8;
    if (!(filter.bits[byteIdx] & (1 << bitIdx))) {
      return false;
    }
  }
  return true;
}

export function estimatedFalsePositiveRate(
  filter: AgentCommitBloomFilter,
): number {
  if (filter.count === 0) return 0;
  const { numHashFunctions: k, bitArraySize: m } = filter.config;
  const n = filter.count;
  return (1 - Math.exp(-k * n / m)) ** k;
}

// ── Serialization ────────────────────────────────────────────
export function toBytes(filter: AgentCommitBloomFilter): Buffer {
  return Buffer.from(filter.bits);
}

export function fromBytes(
  data: Buffer,
  config?: BloomFilterConfig,
): AgentCommitBloomFilter {
  const cfg = config ?? createConfig();
  const filter = createBloomFilter(cfg);
  filter.bits.set(new Uint8Array(data));
  return filter;
}

// ── Builder: Index commits with agent trailers ───────────────
export type CommitRecord = {
  readonly sha: string;
  readonly message: string;
};

const AGENT_TRAILER_MARKER = 'Agent-Id:';

export function buildFromCommits(
  commits: ReadonlyArray<CommitRecord>,
): AgentCommitBloomFilter {
  const config = createConfig(Math.max(commits.length, 100));
  const filter = createBloomFilter(config);

  for (const commit of commits) {
    if (commit.message.includes(AGENT_TRAILER_MARKER)) {
      add(filter, toCommitHash(commit.sha));
    }
  }

  return filter;
}
