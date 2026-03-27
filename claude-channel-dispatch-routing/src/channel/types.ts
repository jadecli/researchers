// src/channel/types.ts — Channel-specific types
//
// Boris Cherny: branded types, readonly everything, no `any`.

// ── Branded ID Types ──────────────────────────────────────────
type Brand<K, T> = K & { readonly __brand: T };

export type ChatId = Brand<string, 'ChatId'>;
export type RequestId = Brand<string, 'RequestId'>;
export type SenderId = Brand<string, 'SenderId'>;

export function toChatId(id: string): ChatId {
  return id as ChatId;
}

export function toRequestId(id: string): RequestId {
  return id as RequestId;
}

export function toSenderId(id: string): SenderId {
  return id as SenderId;
}

// ── Channel Event ─────────────────────────────────────────────
// Inbound message from an external sender, relayed to Claude.

export type ChannelEvent = {
  readonly source: SenderId;
  readonly content: string;
  readonly meta: Readonly<Record<string, string>>;
};

// ── Permission Request ────────────────────────────────────────
// Claude asks the channel for human approval before running a tool.

export type PermissionRequest = {
  readonly requestId: RequestId;
  readonly toolName: string;
  readonly description: string;
  readonly inputPreview: string;
};

// ── Permission Verdict ────────────────────────────────────────
// The human's yes/no response, parsed from chat text.

export type PermissionBehavior = 'allow' | 'deny';

export type PermissionVerdict = {
  readonly requestId: RequestId;
  readonly behavior: PermissionBehavior;
};

// ── Channel Config ────────────────────────────────────────────

export type ChannelConfig = {
  readonly port: number;
  readonly hostname: string;
  readonly allowlist: ReadonlyArray<string>;
};

// ── Result Type (Boris Cherny — no thrown exceptions) ─────────

export type Result<T, E extends Error = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// ── Permission Verdict Regex ──────────────────────────────────
// Matches "yes abcde" / "no abcde" where the ID is exactly 5
// lowercase letters excluding 'l' (to avoid ambiguity with '1').

export const VERDICT_REGEX = /^\s*(y|yes|n|no)\s+([a-km-z]{5})\s*$/i;

// ── Parse Verdict ─────────────────────────────────────────────

export function parseVerdict(text: string): Result<PermissionVerdict> {
  const match = VERDICT_REGEX.exec(text);
  if (match === null) {
    return { ok: false, error: new Error(`Invalid verdict format: "${text}"`) };
  }

  const affirmative = match[1]!.toLowerCase();
  const id = match[2]!.toLowerCase();

  return {
    ok: true,
    value: {
      requestId: toRequestId(id),
      behavior: affirmative === 'y' || affirmative === 'yes' ? 'allow' : 'deny',
    },
  };
}
