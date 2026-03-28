// tests/types.test.ts — Boris Cherny branded types and Result<T,E> tests
import { describe, it, expect } from 'vitest';
import {
  toCampaignId,
  toSpiderName,
  toUrl,
  toQualityValue,
  toUSD,
  toIteration,
  toPluginName,
  toLanguageId,
  toDomainId,
  toConfidence,
  Ok,
  Err,
  map,
  flatMap,
  unwrap,
  unwrapOr,
  assertNever,
} from '../src/types.js';
import type {
  CampaignId,
  SpiderName,
  Url,
  QualityValue,
  USD,
  Result,
} from '../src/types.js';

// ── Branded Types ───────────────────────────────────────────────
describe('Branded Types', () => {
  it('creates CampaignId with correct underlying value', () => {
    const id = toCampaignId('abc-123');
    expect(id as string).toBe('abc-123');
  });

  it('creates SpiderName with correct underlying value', () => {
    const name = toSpiderName('docs_spider');
    expect(name as string).toBe('docs_spider');
  });

  it('creates Url with correct underlying value', () => {
    const url = toUrl('https://example.com');
    expect(url as string).toBe('https://example.com');
  });

  it('clamps QualityValue to 0-1 range', () => {
    expect(toQualityValue(0.5) as number).toBe(0.5);
    expect(toQualityValue(-0.1) as number).toBe(0);
    expect(toQualityValue(1.5) as number).toBe(1);
  });

  it('creates USD with correct value', () => {
    const usd = toUSD(5.99);
    expect(usd as number).toBe(5.99);
  });

  it('creates Iteration with correct value', () => {
    const iter = toIteration(3);
    expect(iter as number).toBe(3);
  });

  it('creates PluginName with correct value', () => {
    const name = toPluginName('my-plugin');
    expect(name as string).toBe('my-plugin');
  });

  it('creates LanguageId with correct value', () => {
    const id = toLanguageId('typescript');
    expect(id as string).toBe('typescript');
  });

  it('creates DomainId with correct value', () => {
    const id = toDomainId('engineering');
    expect(id as string).toBe('engineering');
  });

  it('clamps Confidence to 0-1 range', () => {
    expect(toConfidence(0.8) as number).toBe(0.8);
    expect(toConfidence(-1) as number).toBe(0);
    expect(toConfidence(2) as number).toBe(1);
  });
});

// ── Result<T, E> ────────────────────────────────────────────────
describe('Result<T, E>', () => {
  it('creates Ok result', () => {
    const result = Ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(42);
  });

  it('creates Err result', () => {
    const result = Err(new Error('boom'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('boom');
  });

  it('maps Ok value', () => {
    const result = map(Ok(10), (x) => x * 2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(20);
  });

  it('passes through Err on map', () => {
    const result = map(Err(new Error('fail')) as Result<number>, (x) => x * 2);
    expect(result.ok).toBe(false);
  });

  it('flatMaps Ok value', () => {
    const result = flatMap(Ok(5), (x) => (x > 0 ? Ok(x * 3) : Err(new Error('negative'))));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(15);
  });

  it('flatMaps to Err on failure', () => {
    const result = flatMap(Ok(-1), (x) =>
      x > 0 ? Ok(x * 3) : Err(new Error('negative')),
    );
    expect(result.ok).toBe(false);
  });

  it('unwraps Ok value', () => {
    expect(unwrap(Ok('hello'))).toBe('hello');
  });

  it('throws on unwrap Err', () => {
    expect(() => unwrap(Err(new Error('nope')))).toThrow('nope');
  });

  it('returns value on unwrapOr with Ok', () => {
    expect(unwrapOr(Ok(42), 0)).toBe(42);
  });

  it('returns fallback on unwrapOr with Err', () => {
    expect(unwrapOr(Err(new Error('fail')) as Result<number>, 0)).toBe(0);
  });
});

// ── Exhaustive Matching ─────────────────────────────────────────
describe('assertNever', () => {
  it('throws on unhandled discriminant', () => {
    expect(() => assertNever('bad' as never)).toThrow('Unhandled discriminant');
  });
});
