// src/channel/gating.ts — Sender Gating
//
// Allowlist-based access control for inbound channel messages.
// Loads from ~/.claude/channels/dispatch/access.json.
// Boris Cherny: Result<T,E>, readonly, branded SenderId.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { type SenderId, type Result, toSenderId } from './types.js';

// ── Access File Schema ────────────────────────────────────────

type AccessFile = {
  readonly allowedSenders: ReadonlyArray<string>;
};

// ── SenderGate ────────────────────────────────────────────────

export class SenderGate {
  private readonly allowed: Set<string>;
  private readonly filePath: string;

  private constructor(allowed: Set<string>, filePath: string) {
    this.allowed = allowed;
    this.filePath = filePath;
  }

  // ── Factory ───────────────────────────────────────────────

  static create(filePath: string): SenderGate {
    const allowed = SenderGate.loadAllowlist(filePath);
    return new SenderGate(allowed, filePath);
  }

  // ── Load ──────────────────────────────────────────────────

  static loadAllowlist(filePath: string): Set<string> {
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as AccessFile;

      if (!Array.isArray(parsed.allowedSenders)) {
        return new Set<string>();
      }

      return new Set<string>(
        parsed.allowedSenders.filter(
          (s): s is string => typeof s === 'string' && s.length > 0,
        ),
      );
    } catch {
      // File doesn't exist or is malformed — start with empty allowlist.
      return new Set<string>();
    }
  }

  // ── Query ─────────────────────────────────────────────────

  isAllowed(senderId: SenderId): boolean {
    return this.allowed.has(senderId as string);
  }

  getAllowed(): ReadonlySet<string> {
    return this.allowed;
  }

  // ── Mutate + Persist ──────────────────────────────────────

  addSender(senderId: SenderId): Result<void> {
    this.allowed.add(senderId as string);
    return this.persist();
  }

  removeSender(senderId: SenderId): Result<void> {
    this.allowed.delete(senderId as string);
    return this.persist();
  }

  // ── Private ───────────────────────────────────────────────

  private persist(): Result<void> {
    try {
      const dir = dirname(this.filePath);
      mkdirSync(dir, { recursive: true });

      const data: AccessFile = {
        allowedSenders: [...this.allowed].sort(),
      };

      writeFileSync(this.filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
      return { ok: true, value: undefined };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }
}
