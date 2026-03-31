// src/agent/concurrency.ts — Atomic writes, file locks, and session isolation
//
// Extracted patterns from oh-my-claudecode (Yeachan Heo):
//   - temp-file-plus-atomic-rename: prevents corruption on crash
//   - advisory-file-lock-o-excl: kernel-guaranteed mutual exclusion
//   - session-ownership-guards: prevents cross-agent contamination
//
// Boris Cherny patterns: Branded types, Result<T,E>, exhaustive unions.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import {
  type Result,
  type SessionId,
  Ok,
  Err,
} from '../types/core';

// ── Branded Types ──────────────────────────────────────────────
type Brand<K, T> = K & { readonly __brand: T };

/** Lock file descriptor — prevents confusion with other numbers */
export type LockFd = Brand<number, 'LockFd'>;
/** Lock token — unique identifier for the lock holder */
export type LockToken = Brand<string, 'LockToken'>;

// ── Atomic Write ───────────────────────────────────────────────
// Pattern: write to temp file with UUID suffix → fsync → atomic rename.
// Guarantees: either the old file or the new file exists, never partial.

/**
 * Atomically write data to a file using temp-file + rename.
 * Safe for concurrent multi-agent writes to different files.
 */
export function atomicWriteSync(filePath: string, data: string): Result<void> {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.tmp-${crypto.randomUUID()}`);

  try {
    fs.mkdirSync(dir, { recursive: true });
    const fd = fs.openSync(tmpPath, 'w');
    fs.writeSync(fd, data, 0, 'utf-8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fs.renameSync(tmpPath, filePath);
    return Ok(undefined);
  } catch (e) {
    // Clean up temp file on failure
    try { fs.unlinkSync(tmpPath); } catch { /* best effort */ }
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Atomically write JSON data to a file.
 */
export function atomicWriteJsonSync(filePath: string, data: unknown): Result<void> {
  return atomicWriteSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

// ── File Lock (O_EXCL advisory) ────────────────────────────────
// Pattern: O_CREAT|O_EXCL guarantees only one process creates the lock file.
// Lock file contains PID + timestamp for stale detection.

export interface LockInfo {
  readonly pid: number;
  readonly timestamp: number;
  readonly token: LockToken;
}

/** Default TTL for stale lock detection: 30 seconds */
const DEFAULT_STALE_MS = 30_000;

function toLockToken(s: string): LockToken { return s as LockToken; }

/**
 * Acquire an exclusive advisory file lock.
 * Returns a LockToken on success for use with unlock().
 *
 * @param lockPath — path to the lock file (e.g., "/tmp/dispatch.lock")
 * @param staleTtlMs — if an existing lock is older than this, force-break it
 */
export function acquireLock(
  lockPath: string,
  staleTtlMs: number = DEFAULT_STALE_MS,
): Result<LockToken> {
  const token = toLockToken(`${process.pid}.${Date.now()}.${crypto.randomUUID().slice(0, 8)}`);
  const info: LockInfo = {
    pid: process.pid,
    timestamp: Date.now(),
    token,
  };

  try {
    // O_CREAT | O_EXCL — atomic "create if not exists"
    const fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
    fs.writeSync(fd, JSON.stringify(info));
    fs.closeSync(fd);
    return Ok(token);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') {
      return Err(e instanceof Error ? e : new Error(String(e)));
    }

    // Lock file exists — check if it's stale
    const staleResult = breakStaleLock(lockPath, staleTtlMs);
    if (!staleResult.ok) {
      return Err(new Error(`Lock held by another process: ${lockPath}`));
    }

    // Stale lock was broken — retry once
    try {
      const fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
      fs.writeSync(fd, JSON.stringify(info));
      fs.closeSync(fd);
      return Ok(token);
    } catch {
      return Err(new Error(`Lock contention after stale break: ${lockPath}`));
    }
  }
}

/**
 * Release a file lock. Only succeeds if the token matches.
 */
export function releaseLock(lockPath: string, token: LockToken): Result<void> {
  try {
    if (!fs.existsSync(lockPath)) return Ok(undefined);

    const raw = fs.readFileSync(lockPath, 'utf-8');
    const info = JSON.parse(raw) as LockInfo;

    if (info.token !== token) {
      return Err(new Error(`Lock token mismatch: expected ${token}, got ${info.token}`));
    }

    fs.unlinkSync(lockPath);
    return Ok(undefined);
  } catch (e) {
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Execute a function while holding an exclusive file lock.
 * Lock is always released, even on error.
 */
export function withLock<T>(
  lockPath: string,
  fn: () => T,
  staleTtlMs?: number,
): Result<T> {
  const lockResult = acquireLock(lockPath, staleTtlMs);
  if (!lockResult.ok) return lockResult;

  try {
    const result = fn();
    releaseLock(lockPath, lockResult.value);
    return Ok(result);
  } catch (e) {
    releaseLock(lockPath, lockResult.value);
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Break a stale lock if the holding process is dead or TTL expired.
 */
function breakStaleLock(lockPath: string, staleTtlMs: number): Result<void> {
  try {
    const raw = fs.readFileSync(lockPath, 'utf-8');
    const info = JSON.parse(raw) as LockInfo;
    const age = Date.now() - info.timestamp;

    // Check if PID is still alive
    let pidAlive = false;
    try {
      process.kill(info.pid, 0); // signal 0 = check existence
      pidAlive = true;
    } catch {
      pidAlive = false;
    }

    if (!pidAlive || age > staleTtlMs) {
      fs.unlinkSync(lockPath);
      return Ok(undefined);
    }

    return Err(new Error(`Lock is fresh (age=${age}ms, pid=${info.pid} alive)`));
  } catch (e) {
    // If we can't read the lock file, treat as breakable
    try { fs.unlinkSync(lockPath); } catch { /* best effort */ }
    return Ok(undefined);
  }
}

// ── Session Isolation ──────────────────────────────────────────
// Pattern: verify ownership before reading/modifying shared state.
// Three modes: no session (allow all), matching (allow), mismatch (deny).

export type SessionCheck =
  | { readonly type: 'allowed'; readonly reason: 'no_session' | 'owner_match' }
  | { readonly type: 'denied'; readonly reason: 'session_mismatch'; readonly owner: SessionId; readonly caller: SessionId };

/**
 * Check if a session is allowed to access a resource.
 * Prevents cross-agent state contamination in multi-agent dispatch.
 */
export function checkSessionAccess(
  resourceOwner: SessionId | undefined,
  callerSession: SessionId,
): SessionCheck {
  if (!resourceOwner) {
    return { type: 'allowed', reason: 'no_session' };
  }

  if (String(resourceOwner) === String(callerSession)) {
    return { type: 'allowed', reason: 'owner_match' };
  }

  return {
    type: 'denied',
    reason: 'session_mismatch',
    owner: resourceOwner,
    caller: callerSession,
  };
}

// ── Locked Atomic State Update ─────────────────────────────────
// Pattern: read-modify-write under exclusive lock with cache invalidation.
// Combines atomic write + file lock for safe concurrent state mutations.

/**
 * Atomically update a JSON state file under exclusive lock.
 * Reads current state, applies updater, writes atomically.
 * Returns the new state on success.
 */
export function atomicStateUpdate<T>(
  statePath: string,
  lockPath: string,
  updater: (current: T | undefined) => T,
  staleTtlMs?: number,
): Result<T> {
  return withLock(
    lockPath,
    () => {
      // Read current state (may not exist)
      let current: T | undefined;
      try {
        const raw = fs.readFileSync(statePath, 'utf-8');
        current = JSON.parse(raw) as T;
      } catch {
        current = undefined;
      }

      // Apply update
      const next = updater(current);

      // Write atomically
      const writeResult = atomicWriteJsonSync(statePath, next);
      if (!writeResult.ok) throw writeResult.error;

      return next;
    },
    staleTtlMs,
  );
}
