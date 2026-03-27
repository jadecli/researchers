// src/types/core.ts — Foundation types following Boris Cherny's strict patterns
//
// Three non-negotiable patterns:
// 1. Branded types prevent ID confusion at compile time
// 2. Result<T, E> replaces try/catch with exhaustive handling
// 3. Discriminated unions model every state transition

// ── Branded Types (Nominal Typing) ──────────────────────────────
type Brand<K, T> = K & { readonly __brand: T };

export type AgentId = Brand<string, 'AgentId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type ToolCallId = Brand<string, 'ToolCallId'>;
export type TokenCount = Brand<number, 'TokenCount'>;
export type USD = Brand<number, 'USD'>;

export function toAgentId(id: string): AgentId {
  return id as AgentId;
}
export function toSessionId(id: string): SessionId {
  return id as SessionId;
}
export function toToolCallId(id: string): ToolCallId {
  return id as ToolCallId;
}
export function toTokenCount(n: number): TokenCount {
  return n as TokenCount;
}
export function toUSD(n: number): USD {
  return n as USD;
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

// ── Agent Message Types (Discriminated Union) ───────────────────
export type AgentMessage =
  | {
      readonly type: 'system';
      readonly subtype: 'init' | 'compact_boundary';
      readonly content: string;
    }
  | {
      readonly type: 'assistant';
      readonly content: ContentBlock[];
      readonly toolCalls: ToolCall[];
    }
  | { readonly type: 'user'; readonly content: string }
  | {
      readonly type: 'tool_result';
      readonly toolUseId: ToolCallId;
      readonly content: string;
      readonly isError?: boolean;
    }
  | {
      readonly type: 'result';
      readonly text: string;
      readonly sessionId: SessionId;
      readonly usage: TokenUsage;
    };

export type ContentBlock =
  | { readonly type: 'text'; readonly text: string }
  | {
      readonly type: 'tool_use';
      readonly id: ToolCallId;
      readonly name: string;
      readonly input: Record<string, unknown>;
    };

export type ToolCall = {
  readonly id: ToolCallId;
  readonly name: string;
  readonly input: Record<string, unknown>;
};

export type TokenUsage = {
  readonly inputTokens: TokenCount;
  readonly outputTokens: TokenCount;
  readonly cacheCreationTokens: TokenCount;
  readonly cacheReadTokens: TokenCount;
  readonly cost: USD;
};

// ── Agent State Machine ─────────────────────────────────────────
export type AgentState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'gathering_context';
      readonly sources: ReadonlyArray<string>;
    }
  | {
      readonly status: 'executing_tools';
      readonly pendingCalls: ReadonlyArray<ToolCall>;
    }
  | { readonly status: 'verifying'; readonly output: string }
  | {
      readonly status: 'delegating';
      readonly subagentIds: ReadonlyArray<AgentId>;
    }
  | {
      readonly status: 'synthesizing';
      readonly results: ReadonlyArray<SubagentResult>;
    }
  | {
      readonly status: 'complete';
      readonly finalOutput: string;
      readonly usage: TokenUsage;
    }
  | {
      readonly status: 'error';
      readonly error: Error;
      readonly recoverable: boolean;
    };

export type SubagentResult = {
  readonly agentId: AgentId;
  readonly summary: string;
  readonly tokenUsage: TokenUsage;
  readonly duration: number;
};

export function handleAgentState(state: AgentState): string {
  switch (state.status) {
    case 'idle':
      return 'Agent ready';
    case 'gathering_context':
      return `Gathering from ${state.sources.length} sources`;
    case 'executing_tools':
      return `Executing ${state.pendingCalls.length} tool calls`;
    case 'verifying':
      return 'Verifying output';
    case 'delegating':
      return `Delegated to ${state.subagentIds.length} subagents`;
    case 'synthesizing':
      return `Synthesizing ${state.results.length} results`;
    case 'complete':
      return `Done: $${(state.usage.cost as number).toFixed(4)}`;
    case 'error':
      return `Error (${state.recoverable ? 'recoverable' : 'fatal'}): ${state.error.message}`;
    default:
      return assertNever(state);
  }
}

// ── Model Configuration ─────────────────────────────────────────
export type ModelId =
  | 'claude-opus-4-20250514'
  | 'claude-sonnet-4-20250514'
  | 'claude-haiku-3-5-20241022';

export type ModelAlias = 'opus' | 'sonnet' | 'haiku';

export function resolveModel(alias: ModelAlias): ModelId {
  switch (alias) {
    case 'opus':
      return 'claude-opus-4-20250514';
    case 'sonnet':
      return 'claude-sonnet-4-20250514';
    case 'haiku':
      return 'claude-haiku-3-5-20241022';
    default:
      return assertNever(alias);
  }
}
