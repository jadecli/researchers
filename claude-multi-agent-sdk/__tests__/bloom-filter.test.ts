import { describe, it, expect } from 'vitest';
import {
  createBloomFilter,
  addItem,
  mightContain,
  createToolBloomFilter,
  routeToolCall,
  routeToolCalls,
  getMetrics,
  serialize,
  deserialize,
  toFalsePositiveRate,
  type BloomFilter,
  type BloomFilterConfig,
  type FalsePositiveRate,
} from '../src/agent/bloom-filter.js';

// ── Helper ──────────────────────────────────────────────────────
function makeFpRate(n: number): FalsePositiveRate {
  const result = toFalsePositiveRate(n);
  if (!result.ok) throw result.error;
  return result.value;
}

function makeFilter(items: number = 100, fp: number = 0.01): BloomFilter {
  return createBloomFilter({
    expectedItems: items,
    falsePositiveRate: makeFpRate(fp),
  });
}

// ── FalsePositiveRate Branded Type ──────────────────────────────
describe('toFalsePositiveRate', () => {
  it('accepts valid rates in (0, 1)', () => {
    expect(toFalsePositiveRate(0.01).ok).toBe(true);
    expect(toFalsePositiveRate(0.5).ok).toBe(true);
    expect(toFalsePositiveRate(0.001).ok).toBe(true);
  });

  it('rejects zero', () => {
    const result = toFalsePositiveRate(0);
    expect(result.ok).toBe(false);
  });

  it('rejects one', () => {
    const result = toFalsePositiveRate(1);
    expect(result.ok).toBe(false);
  });

  it('rejects negative values', () => {
    const result = toFalsePositiveRate(-0.1);
    expect(result.ok).toBe(false);
  });
});

// ── createBloomFilter ───────────────────────────────────────────
describe('createBloomFilter', () => {
  it('creates empty filter with correct properties', () => {
    const filter = makeFilter(100, 0.01);

    expect(filter.itemCount).toBe(0);
    expect(filter.bitCount).toBeGreaterThan(0);
    expect(filter.hashCount).toBeGreaterThan(0);
    expect(filter.bits).toBeInstanceOf(Uint8Array);
    expect(filter.config.expectedItems).toBe(100);
  });

  it('computes optimal bit count (m = -(n * ln(p)) / (ln(2))^2)', () => {
    const filter = makeFilter(1000, 0.01);
    // For n=1000, p=0.01: m ≈ 9585
    expect(filter.bitCount).toBeGreaterThanOrEqual(9000);
    expect(filter.bitCount).toBeLessThanOrEqual(10000);
  });

  it('computes optimal hash count (k = (m/n) * ln(2))', () => {
    const filter = makeFilter(1000, 0.01);
    // For n=1000, p=0.01: k ≈ 7
    expect(filter.hashCount).toBeGreaterThanOrEqual(5);
    expect(filter.hashCount).toBeLessThanOrEqual(10);
  });

  it('enforces minimum 64 bits', () => {
    const filter = makeFilter(1, 0.99);
    expect(filter.bitCount).toBeGreaterThanOrEqual(64);
  });

  it('enforces minimum 1 hash function', () => {
    const filter = makeFilter(1, 0.5);
    expect(filter.hashCount).toBeGreaterThanOrEqual(1);
  });

  it('starts with all bits zeroed', () => {
    const filter = makeFilter();
    const allZero = filter.bits.every(byte => byte === 0);
    expect(allZero).toBe(true);
  });
});

// ── addItem + mightContain ──────────────────────────────────────
describe('addItem and mightContain', () => {
  it('returns true for added items (no false negatives)', () => {
    let filter = makeFilter();
    filter = addItem(filter, 'Read');
    filter = addItem(filter, 'Write');
    filter = addItem(filter, 'Bash');

    expect(mightContain(filter, 'Read')).toBe(true);
    expect(mightContain(filter, 'Write')).toBe(true);
    expect(mightContain(filter, 'Bash')).toBe(true);
  });

  it('returns new filter instance (immutability)', () => {
    const original = makeFilter();
    const modified = addItem(original, 'Read');

    expect(modified).not.toBe(original);
    expect(modified.itemCount).toBe(1);
    expect(original.itemCount).toBe(0);
  });

  it('preserves original bits on add (does not mutate)', () => {
    const original = makeFilter();
    const originalBitsCopy = new Uint8Array(original.bits);
    addItem(original, 'Read');

    expect(original.bits).toEqual(originalBitsCopy);
  });

  it('increments itemCount on each add', () => {
    let filter = makeFilter();
    expect(filter.itemCount).toBe(0);

    filter = addItem(filter, 'a');
    expect(filter.itemCount).toBe(1);

    filter = addItem(filter, 'b');
    expect(filter.itemCount).toBe(2);
  });

  it('empty filter returns false for all queries', () => {
    const filter = makeFilter();
    expect(mightContain(filter, 'Read')).toBe(false);
    expect(mightContain(filter, 'anything')).toBe(false);
    expect(mightContain(filter, '')).toBe(false);
  });

  it('guarantees zero false negatives across many items', () => {
    let filter = makeFilter(500);
    const items: string[] = [];
    for (let i = 0; i < 200; i++) {
      const item = `tool-${i}-${Math.random().toString(36).slice(2)}`;
      items.push(item);
      filter = addItem(filter, item);
    }

    // Every single added item MUST be found — zero false negatives
    for (const item of items) {
      expect(mightContain(filter, item)).toBe(true);
    }
  });

  it('false positive rate stays within theoretical bounds', () => {
    const expectedItems = 200;
    let filter = makeFilter(expectedItems, 0.05);

    // Add the expected number of items
    for (let i = 0; i < expectedItems; i++) {
      filter = addItem(filter, `item-${i}`);
    }

    // Test with items that were NOT added
    let falsePositives = 0;
    const testCount = 10000;
    for (let i = 0; i < testCount; i++) {
      if (mightContain(filter, `not-added-${i}-${Math.random()}`)) {
        falsePositives++;
      }
    }

    const observedRate = falsePositives / testCount;
    // Allow 3x tolerance (statistical variance)
    expect(observedRate).toBeLessThan(0.05 * 3);
  });
});

// ── createToolBloomFilter ───────────────────────────────────────
describe('createToolBloomFilter', () => {
  it('creates filter pre-loaded with tools', () => {
    const tools = ['Read', 'Write', 'Bash', 'Glob', 'Grep'];
    const result = createToolBloomFilter(tools);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.itemCount).toBe(5);
      // Tools are lowercased internally
      expect(mightContain(result.value, 'read')).toBe(true);
      expect(mightContain(result.value, 'write')).toBe(true);
      expect(mightContain(result.value, 'bash')).toBe(true);
    }
  });

  it('handles empty tool list', () => {
    const result = createToolBloomFilter([]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.itemCount).toBe(0);
    }
  });

  it('normalizes tool names to lowercase', () => {
    const result = createToolBloomFilter(['READ', 'Write', 'bAsH']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(mightContain(result.value, 'read')).toBe(true);
      expect(mightContain(result.value, 'write')).toBe(true);
      expect(mightContain(result.value, 'bash')).toBe(true);
    }
  });

  it('accepts custom false positive rate', () => {
    const result = createToolBloomFilter(['Read'], makeFpRate(0.001));
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Lower FP rate → more bits (minimum is 64)
      expect(result.value.bitCount).toBeGreaterThanOrEqual(64);
    }
  });
});

// ── routeToolCall ───────────────────────────────────────────────
describe('routeToolCall', () => {
  it('returns probably_exists for known tools', () => {
    const result = createToolBloomFilter(['Read', 'Write', 'Bash']);
    if (!result.ok) throw result.error;

    const decision = routeToolCall(result.value, 'read');
    expect(decision.type).toBe('probably_exists');
    expect(decision.tool).toBe('read');
    if (decision.type === 'probably_exists') {
      expect(decision.confidence).toBeGreaterThan(0.9);
    }
  });

  it('returns definitely_missing for unknown tools', () => {
    const result = createToolBloomFilter(['Read', 'Write']);
    if (!result.ok) throw result.error;

    const decision = routeToolCall(result.value, 'nonexistent');
    expect(decision.type).toBe('definitely_missing');
    expect(decision.tool).toBe('nonexistent');
  });

  it('confidence decreases as fill ratio increases', () => {
    const result1 = createToolBloomFilter(['Read']);
    const result2 = createToolBloomFilter(
      Array.from({ length: 50 }, (_, i) => `tool-${i}`),
    );
    if (!result1.ok || !result2.ok) throw new Error('failed');

    const d1 = routeToolCall(result1.value, 'read');
    const d2 = routeToolCall(result2.value, 'tool-0');

    if (d1.type === 'probably_exists' && d2.type === 'probably_exists') {
      expect(d1.confidence).toBeGreaterThanOrEqual(d2.confidence);
    }
  });
});

// ── routeToolCalls (batch) ──────────────────────────────────────
describe('routeToolCalls', () => {
  it('returns decisions preserving input order', () => {
    const result = createToolBloomFilter(['Read', 'Write']);
    if (!result.ok) throw result.error;

    const decisions = routeToolCalls(result.value, ['read', 'nonexistent', 'write']);
    expect(decisions).toHaveLength(3);
    expect(decisions[0]!.type).toBe('probably_exists');
    expect(decisions[1]!.type).toBe('definitely_missing');
    expect(decisions[2]!.type).toBe('probably_exists');
  });
});

// ── getMetrics ──────────────────────────────────────────────────
describe('getMetrics', () => {
  it('computes fill ratio correctly', () => {
    const filter = makeFilter(100);
    const withItems = addItem(addItem(filter, 'a'), 'b');
    const metrics = getMetrics(withItems);

    expect(metrics.fillRatio).toBeCloseTo(0.02, 5);
    expect(metrics.itemCount).toBe(2);
  });

  it('computes estimated false positive rate', () => {
    let filter = makeFilter(100, 0.01);
    for (let i = 0; i < 100; i++) {
      filter = addItem(filter, `item-${i}`);
    }
    const metrics = getMetrics(filter);

    // Should be close to configured 0.01
    expect(metrics.estimatedFpRate).toBeGreaterThan(0);
    expect(metrics.estimatedFpRate).toBeLessThan(0.1);
  });

  it('reports bytes used', () => {
    const filter = makeFilter(1000);
    const metrics = getMetrics(filter);
    expect(metrics.bytesUsed).toBeGreaterThan(0);
    expect(metrics.bytesUsed).toBe(filter.bits.byteLength);
  });

  it('includes stats when provided', () => {
    const filter = makeFilter();
    const metrics = getMetrics(filter, { checks: 50, misses: 30, hits: 20 });
    expect(metrics.checksPerformed).toBe(50);
    expect(metrics.definiteMisses).toBe(30);
    expect(metrics.probableHits).toBe(20);
  });

  it('defaults stats to zero', () => {
    const metrics = getMetrics(makeFilter());
    expect(metrics.checksPerformed).toBe(0);
    expect(metrics.definiteMisses).toBe(0);
    expect(metrics.probableHits).toBe(0);
  });
});

// ── serialize / deserialize ─────────────────────────────────────
describe('serialize and deserialize', () => {
  it('round-trips filter state correctly', () => {
    let filter = makeFilter(50);
    filter = addItem(filter, 'Read');
    filter = addItem(filter, 'Write');
    filter = addItem(filter, 'Bash');

    const json = serialize(filter);
    const restored = deserialize(json);

    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.value.bitCount).toBe(filter.bitCount);
      expect(restored.value.hashCount).toBe(filter.hashCount);
      expect(restored.value.itemCount).toBe(filter.itemCount);
      expect(restored.value.bits).toEqual(filter.bits);
      // Verify queries still work on deserialized filter
      expect(mightContain(restored.value, 'Read')).toBe(true);
      expect(mightContain(restored.value, 'Write')).toBe(true);
      expect(mightContain(restored.value, 'Bash')).toBe(true);
      expect(mightContain(restored.value, 'nonexistent')).toBe(false);
    }
  });

  it('serializes to valid JSON', () => {
    const filter = addItem(makeFilter(), 'test');
    const json = serialize(filter);

    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed).toHaveProperty('bits');
    expect(parsed).toHaveProperty('bitCount');
    expect(parsed).toHaveProperty('hashCount');
    expect(parsed).toHaveProperty('itemCount');
    expect(parsed).toHaveProperty('config');
  });

  it('returns Err on invalid JSON', () => {
    const result = deserialize('not-valid-json');
    expect(result.ok).toBe(false);
  });

  it('preserves config through round-trip', () => {
    const filter = makeFilter(200, 0.001);
    const restored = deserialize(serialize(filter));
    if (restored.ok) {
      expect(restored.value.config.expectedItems).toBe(200);
    }
  });
});
