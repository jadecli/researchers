// src/types.ts — Foundation types following Boris Cherny's strict patterns
//
// Three non-negotiable patterns:
// 1. Branded types prevent ID confusion at compile time
// 2. Result<T, E> replaces try/catch with exhaustive handling
// 3. Discriminated unions model every state transition

// ── Branded Types (Nominal Typing) ──────────────────────────────
export type Brand<K, T> = K & { readonly __brand: T };

export type CampaignId = Brand<string, 'CampaignId'>;
export type SpiderName = Brand<string, 'SpiderName'>;
export type Url = Brand<string, 'Url'>;
export type QualityValue = Brand<number, 'QualityValue'>;
export type USD = Brand<number, 'USD'>;
export type Iteration = Brand<number, 'Iteration'>;
export type PluginName = Brand<string, 'PluginName'>;
export type LanguageId = Brand<string, 'LanguageId'>;
export type DomainId = Brand<string, 'DomainId'>;
export type Confidence = Brand<number, 'Confidence'>;

export function toCampaignId(id: string): CampaignId {
  return id as CampaignId;
}
export function toSpiderName(name: string): SpiderName {
  return name as SpiderName;
}
export function toUrl(url: string): Url {
  return url as Url;
}
export function toQualityValue(n: number): QualityValue {
  return Math.max(0, Math.min(1, n)) as QualityValue;
}
export function toUSD(n: number): USD {
  return n as USD;
}
export function toIteration(n: number): Iteration {
  return n as Iteration;
}
export function toPluginName(name: string): PluginName {
  return name as PluginName;
}
export function toLanguageId(id: string): LanguageId {
  return id as LanguageId;
}
export function toDomainId(id: string): DomainId {
  return id as DomainId;
}
export function toConfidence(n: number): Confidence {
  return Math.max(0, Math.min(1, n)) as Confidence;
}

// ── Result Type (Exceptions are side effects) ───────────────────
export type Result<T, E extends Error = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function Err<E extends Error>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function map<T, U, E extends Error>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  return result.ok ? Ok(fn(result.value)) : result;
}

export function flatMap<T, U, E extends Error>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}

export function unwrap<T, E extends Error>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw result.error;
}

export function unwrapOr<T, E extends Error>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

// ── Exhaustive Pattern Matching ─────────────────────────────────
export function assertNever(value: never): never {
  throw new Error(`Unhandled discriminant: ${JSON.stringify(value)}`);
}
