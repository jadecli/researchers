import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  atomicWriteSync,
  atomicWriteJsonSync,
  acquireLock,
  releaseLock,
  withLock,
  checkSessionAccess,
  atomicStateUpdate,
} from '../src/agent/concurrency.js';
import { toSessionId } from '../src/types/core.js';

describe('Atomic Writes', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atomic-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('atomicWriteSync writes data without partial state', () => {
    const filePath = path.join(tmpDir, 'test.txt');
    const result = atomicWriteSync(filePath, 'hello world');

    expect(result.ok).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('hello world');
  });

  it('atomicWriteJsonSync writes valid JSON', () => {
    const filePath = path.join(tmpDir, 'test.json');
    const data = { name: 'test', count: 42, nested: { a: true } };
    const result = atomicWriteJsonSync(filePath, data);

    expect(result.ok).toBe(true);
    const read = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(read).toEqual(data);
  });

  it('atomicWriteSync creates nested directories', () => {
    const filePath = path.join(tmpDir, 'a', 'b', 'c', 'test.txt');
    const result = atomicWriteSync(filePath, 'deep write');

    expect(result.ok).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('deep write');
  });

  it('atomicWriteSync overwrites existing file', () => {
    const filePath = path.join(tmpDir, 'overwrite.txt');
    atomicWriteSync(filePath, 'first');
    atomicWriteSync(filePath, 'second');

    expect(fs.readFileSync(filePath, 'utf-8')).toBe('second');
  });
});

describe('File Locking', () => {
  let tmpDir: string;
  let lockPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-test-'));
    lockPath = path.join(tmpDir, 'test.lock');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('acquireLock succeeds when no lock exists', () => {
    const result = acquireLock(lockPath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.value).toBe('string');
      releaseLock(lockPath, result.value);
    }
  });

  it('acquireLock fails when lock is already held', () => {
    const first = acquireLock(lockPath);
    expect(first.ok).toBe(true);

    const second = acquireLock(lockPath);
    expect(second.ok).toBe(false);

    if (first.ok) releaseLock(lockPath, first.value);
  });

  it('releaseLock removes the lock file', () => {
    const result = acquireLock(lockPath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      releaseLock(lockPath, result.value);
      expect(fs.existsSync(lockPath)).toBe(false);
    }
  });

  it('releaseLock fails with wrong token', () => {
    const result = acquireLock(lockPath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const bad = releaseLock(lockPath, 'wrong-token' as any);
      expect(bad.ok).toBe(false);
      releaseLock(lockPath, result.value);
    }
  });

  it('withLock executes function under lock', () => {
    const result = withLock(lockPath, () => 42);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(42);
    // Lock should be released
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('withLock releases lock on error', () => {
    const result = withLock(lockPath, () => {
      throw new Error('boom');
    });
    expect(result.ok).toBe(false);
    expect(fs.existsSync(lockPath)).toBe(false);
  });
});

describe('Session Isolation', () => {
  it('allows access when no owner', () => {
    const check = checkSessionAccess(undefined, toSessionId('session-1'));
    expect(check.type).toBe('allowed');
    if (check.type === 'allowed') expect(check.reason).toBe('no_session');
  });

  it('allows access when owner matches', () => {
    const session = toSessionId('session-1');
    const check = checkSessionAccess(session, session);
    expect(check.type).toBe('allowed');
    if (check.type === 'allowed') expect(check.reason).toBe('owner_match');
  });

  it('denies access when owner mismatches', () => {
    const check = checkSessionAccess(
      toSessionId('session-1'),
      toSessionId('session-2'),
    );
    expect(check.type).toBe('denied');
  });
});

describe('Atomic State Update', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates state when none exists', () => {
    const statePath = path.join(tmpDir, 'state.json');
    const lockPath = path.join(tmpDir, 'state.lock');

    const result = atomicStateUpdate<{ count: number }>(
      statePath,
      lockPath,
      (current) => current ?? { count: 0 },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ count: 0 });
  });

  it('updates existing state atomically', () => {
    const statePath = path.join(tmpDir, 'state.json');
    const lockPath = path.join(tmpDir, 'state.lock');

    atomicStateUpdate<{ count: number }>(
      statePath, lockPath,
      () => ({ count: 1 }),
    );

    const result = atomicStateUpdate<{ count: number }>(
      statePath, lockPath,
      (current) => ({ count: (current?.count ?? 0) + 1 }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ count: 2 });
  });
});
