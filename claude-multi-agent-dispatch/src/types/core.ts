// ─── Branded Types ───────────────────────────────────────────────────────────
// Branded types prevent accidental misuse of string/number IDs across domains.

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type DispatchId = Brand<string, 'DispatchId'>;
export type RoundId = Brand<string, 'RoundId'>;
export type AgentId = Brand<string, 'AgentId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type ToolCallId = Brand<string, 'ToolCallId'>;
export type TokenCount = Brand<number, 'TokenCount'>;
export type USD = Brand<number, 'USD'>;
export type TranscriptId = Brand<string, 'TranscriptId'>;
export type AuditId = Brand<string, 'AuditId'>;

// ─── Branded Type Constructors ───────────────────────────────────────────────

export function toDispatchId(raw: string): DispatchId {
  if (!raw || raw.trim().length === 0) {
    throw new Error('DispatchId cannot be empty');
  }
  return raw as DispatchId;
}

export function toRoundId(raw: string): RoundId {
  if (!raw || raw.trim().length === 0) {
    throw new Error('RoundId cannot be empty');
  }
  return raw as RoundId;
}

export function toAgentId(raw: string): AgentId {
  if (!raw || raw.trim().length === 0) {
    throw new Error('AgentId cannot be empty');
  }
  return raw as AgentId;
}

export function toSessionId(raw: string): SessionId {
  if (!raw || raw.trim().length === 0) {
    throw new Error('SessionId cannot be empty');
  }
  return raw as SessionId;
}

export function toToolCallId(raw: string): ToolCallId {
  if (!raw || raw.trim().length === 0) {
    throw new Error('ToolCallId cannot be empty');
  }
  return raw as ToolCallId;
}

export function toTokenCount(raw: number): TokenCount {
  if (!Number.isInteger(raw) || raw < 0) {
    throw new Error(`TokenCount must be a non-negative integer, got ${raw}`);
  }
  return raw as TokenCount;
}

export function toUSD(raw: number): USD {
  if (raw < 0) {
    throw new Error(`USD cannot be negative, got ${raw}`);
  }
  return raw as USD;
}

export function toTranscriptId(raw: string): TranscriptId {
  if (!raw || raw.trim().length === 0) {
    throw new Error('TranscriptId cannot be empty');
  }
  return raw as TranscriptId;
}

export function toAuditId(raw: string): AuditId {
  if (!raw || raw.trim().length === 0) {
    throw new Error('AuditId cannot be empty');
  }
  return raw as AuditId;
}

// ─── Result Type ─────────────────────────────────────────────────────────────
// A discriminated union for error handling without exceptions.

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (result.ok) {
    return Ok(fn(result.value));
  }
  return result;
}

export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}

export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw new Error(`Attempted to unwrap an Err result: ${String(result.error)}`);
}

export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result.ok) {
    return result.value;
  }
  return defaultValue;
}

// ─── assertNever ─────────────────────────────────────────────────────────────
// Exhaustiveness check helper for discriminated unions.

export function assertNever(value: never): never {
  throw new Error(`Unexpected value in assertNever: ${JSON.stringify(value)}`);
}

// ─── Model Types ─────────────────────────────────────────────────────────────

export type ModelId =
  | 'claude-opus-4-20250514'
  | 'claude-sonnet-4-20250514'
  | 'claude-haiku-3-20250307';

export type ModelAlias = 'opus' | 'sonnet' | 'haiku';

const MODEL_ALIAS_MAP: Record<ModelAlias, ModelId> = {
  opus: 'claude-opus-4-20250514',
  sonnet: 'claude-sonnet-4-20250514',
  haiku: 'claude-haiku-3-20250307',
};

export function resolveModel(alias: ModelAlias): ModelId {
  return MODEL_ALIAS_MAP[alias];
}

// ─── Token Usage ─────────────────────────────────────────────────────────────

export interface TokenUsage {
  inputTokens: TokenCount;
  outputTokens: TokenCount;
  cacheReadTokens: TokenCount;
  cacheWriteTokens: TokenCount;
  totalCost: USD;
}
