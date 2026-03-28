// src/agent/bloom-filter.ts — Probabilistic tool routing via bloom filters
//
// Boris Cherny patterns: Branded types, Result<T,E>, exhaustive unions.
// Ralph Kimball patterns: Additive metrics, grain-per-row, no leaky abstractions.
//
// Purpose: Haiku pre-checks whether a tool call is likely to succeed before
// dispatching to Sonnet for execution. Reduces wasted tokens on failed lookups.
//
// Usage:
//   const filter = createToolBloomFilter(registeredTools);
//   const check = mightHaveTool(filter, 'Read');
//   if (check.ok && check.value) { /* dispatch to Sonnet */ }

import {
  type AgentId,
  type Result,
  Ok,
  Err,
  assertNever,
} from '../types/core';

// ── Branded Types ──────────────────────────────────────────────
type Brand<K, T> = K & { readonly __brand: T };

/** Bloom filter bit array index — prevents confusion with other numbers */
export type BitIndex = Brand<number, 'BitIndex'>;
/** Hash seed — branded to prevent mixing with other integers */
export type HashSeed = Brand<number, 'HashSeed'>;
/** False positive rate as a bounded decimal */
export type FalsePositiveRate = Brand<number, 'FalsePositiveRate'>;

function toBitIndex(n: number): BitIndex { return n as BitIndex; }
function toHashSeed(n: number): HashSeed { return n as HashSeed; }

export function toFalsePositiveRate(n: number): Result<FalsePositiveRate> {
  if (n <= 0 || n >= 1) {
    return Err(new Error(`FalsePositiveRate must be in (0, 1), got ${n}`));
  }
  return Ok(n as FalsePositiveRate);
}

// ── Bloom Filter Types ─────────────────────────────────────────

/** Configuration for bloom filter construction */
export interface BloomFilterConfig {
  readonly expectedItems: number;
  readonly falsePositiveRate: FalsePositiveRate;
}

/** Immutable bloom filter state */
export interface BloomFilter {
  readonly bits: Uint8Array;
  readonly bitCount: number;
  readonly hashCount: number;
  readonly itemCount: number;
  readonly config: BloomFilterConfig;
}

/** Tool routing decision — discriminated union */
export type ToolRoutingDecision =
  | { readonly type: 'probably_exists'; readonly tool: string; readonly confidence: number }
  | { readonly type: 'definitely_missing'; readonly tool: string }
  | { readonly type: 'error'; readonly tool: string; readonly reason: string };

// ── Hash Functions ─────────────────────────────────────────────
// Double hashing: h(i) = h1(x) + i * h2(x)
// FNV-1a for h1, DJB2 for h2 — fast, well-distributed for strings.

function fnv1a(input: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // FNV prime, unsigned
  }
  return hash;
}

function djb2(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getHashValues(item: string, hashCount: number, bitCount: number): BitIndex[] {
  const h1 = fnv1a(item);
  const h2 = djb2(item);
  const indices: BitIndex[] = [];
  for (let i = 0; i < hashCount; i++) {
    const combined = (h1 + i * h2) >>> 0;
    indices.push(toBitIndex(combined % bitCount));
  }
  return indices;
}

// ── Optimal Parameters ─────────────────────────────────────────
// m = -(n * ln(p)) / (ln(2))^2  (bit count)
// k = (m / n) * ln(2)           (hash count)

function optimalBitCount(expectedItems: number, fpRate: FalsePositiveRate): number {
  const m = Math.ceil(-(expectedItems * Math.log(fpRate)) / (Math.LN2 ** 2));
  return Math.max(m, 64); // minimum 64 bits
}

function optimalHashCount(bitCount: number, expectedItems: number): number {
  const k = Math.round((bitCount / expectedItems) * Math.LN2);
  return Math.max(k, 1); // minimum 1 hash
}

// ── Factory ────────────────────────────────────────────────────

/** Create an empty bloom filter optimized for the expected item count */
export function createBloomFilter(config: BloomFilterConfig): BloomFilter {
  const bitCount = optimalBitCount(config.expectedItems, config.falsePositiveRate);
  const hashCount = optimalHashCount(bitCount, config.expectedItems);
  const byteCount = Math.ceil(bitCount / 8);

  return {
    bits: new Uint8Array(byteCount),
    bitCount,
    hashCount,
    itemCount: 0,
    config,
  };
}

/** Add an item to the bloom filter (returns new filter — immutable) */
export function addItem(filter: BloomFilter, item: string): BloomFilter {
  const newBits = new Uint8Array(filter.bits);
  const indices = getHashValues(item, filter.hashCount, filter.bitCount);

  for (const idx of indices) {
    const bytePos = Math.floor(idx / 8);
    const bitPos = idx % 8;
    newBits[bytePos]! |= 1 << bitPos;
  }

  return {
    ...filter,
    bits: newBits,
    itemCount: filter.itemCount + 1,
  };
}

/** Check if an item might be in the filter */
export function mightContain(filter: BloomFilter, item: string): boolean {
  const indices = getHashValues(item, filter.hashCount, filter.bitCount);

  for (const idx of indices) {
    const bytePos = Math.floor(idx / 8);
    const bitPos = idx % 8;
    if ((filter.bits[bytePos]! & (1 << bitPos)) === 0) {
      return false; // definitely not present
    }
  }

  return true; // probably present
}

// ── Tool Routing ───────────────────────────────────────────────

/** Build a bloom filter pre-loaded with registered tool names */
export function createToolBloomFilter(
  tools: readonly string[],
  fpRate?: FalsePositiveRate,
): Result<BloomFilter> {
  const rate = fpRate ?? (0.01 as FalsePositiveRate);
  const config: BloomFilterConfig = {
    expectedItems: Math.max(tools.length, 1),
    falsePositiveRate: rate,
  };

  let filter = createBloomFilter(config);
  for (const tool of tools) {
    filter = addItem(filter, tool.toLowerCase());
  }

  return Ok(filter);
}

/** Route a tool call through the bloom filter pre-check */
export function routeToolCall(
  filter: BloomFilter,
  tool: string,
): ToolRoutingDecision {
  const normalized = tool.toLowerCase();
  const exists = mightContain(filter, normalized);

  if (exists) {
    // Confidence = 1 - false positive rate (adjusted by fill ratio)
    const fillRatio = filter.itemCount / filter.config.expectedItems;
    const confidence = Math.max(0, 1 - filter.config.falsePositiveRate * fillRatio);
    return {
      type: 'probably_exists',
      tool,
      confidence,
    };
  }

  return {
    type: 'definitely_missing',
    tool,
  };
}

/** Batch route multiple tool calls — returns decisions preserving order */
export function routeToolCalls(
  filter: BloomFilter,
  tools: readonly string[],
): ToolRoutingDecision[] {
  return tools.map(tool => routeToolCall(filter, tool));
}

// ── Metrics (Kimball-style additive) ───────────────────────────

export interface BloomFilterMetrics {
  readonly bitCount: number;
  readonly hashCount: number;
  readonly itemCount: number;
  readonly fillRatio: number;          // additive: items / expected
  readonly estimatedFpRate: number;    // non-additive: (1 - e^(-kn/m))^k
  readonly bytesUsed: number;          // additive: memory footprint
  readonly checksPerformed: number;    // additive: total routing decisions
  readonly definiteMisses: number;     // additive: confirmed negatives
  readonly probableHits: number;       // additive: possible positives
}

/** Compute current filter metrics */
export function getMetrics(
  filter: BloomFilter,
  stats?: { checks: number; misses: number; hits: number },
): BloomFilterMetrics {
  const { bitCount, hashCount, itemCount } = filter;
  const fillRatio = itemCount / filter.config.expectedItems;

  // Actual false positive rate: (1 - e^(-k*n/m))^k
  const exponent = -(hashCount * itemCount) / bitCount;
  const estimatedFpRate = Math.pow(1 - Math.exp(exponent), hashCount);

  return {
    bitCount,
    hashCount,
    itemCount,
    fillRatio,
    estimatedFpRate,
    bytesUsed: filter.bits.byteLength,
    checksPerformed: stats?.checks ?? 0,
    definiteMisses: stats?.misses ?? 0,
    probableHits: stats?.hits ?? 0,
  };
}

// ── Serialization (for Neon persistence) ───────────────────────

/** Serialize bloom filter to JSON-safe format for storage */
export function serialize(filter: BloomFilter): string {
  return JSON.stringify({
    bits: Buffer.from(filter.bits).toString('base64'),
    bitCount: filter.bitCount,
    hashCount: filter.hashCount,
    itemCount: filter.itemCount,
    config: filter.config,
  });
}

/** Deserialize bloom filter from stored JSON */
export function deserialize(json: string): Result<BloomFilter> {
  try {
    const data = JSON.parse(json) as {
      bits: string;
      bitCount: number;
      hashCount: number;
      itemCount: number;
      config: BloomFilterConfig;
    };

    return Ok({
      bits: new Uint8Array(Buffer.from(data.bits, 'base64')),
      bitCount: data.bitCount,
      hashCount: data.hashCount,
      itemCount: data.itemCount,
      config: data.config,
    });
  } catch (e) {
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
}
