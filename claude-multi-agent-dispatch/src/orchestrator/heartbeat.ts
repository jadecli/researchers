// src/orchestrator/heartbeat.ts — Worker heartbeat and liveness detection
//
// Extracted patterns from oh-my-claudecode (Yeachan Heo):
//   - file-based-heartbeat-liveness: atomic heartbeat files per worker
//   - stale-state-detection: dual timestamp (updatedAt + heartbeatAt)
//   - drain-shutdown-signal-files: graceful teardown via signal files
//
// Each dispatch worker atomically writes a heartbeat JSON file.
// The orchestrator checks freshness to detect hung workers.
//
// Boris Cherny patterns: Branded types, Result<T,E>, discriminated unions.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AgentId } from '../types/core.js';
import { Ok, Err, type Result } from '../types/core.js';

// ── Configuration ──────────────────────────────────────────────

/** Default heartbeat interval: 5 seconds */
export const HEARTBEAT_INTERVAL_MS = 5_000;

/** Default max age before a worker is considered dead: 30 seconds */
export const MAX_HEARTBEAT_AGE_MS = 30_000;

// ── Heartbeat Types ────────────────────────────────────────────

export interface HeartbeatData {
  readonly agentId: string;
  readonly pid: number;
  readonly heartbeatAt: number;     // epoch ms — updated every beat
  readonly updatedAt: number;       // epoch ms — updated on real work
  readonly status: WorkerStatus;
  readonly currentTask?: string;
  readonly iterationCount: number;
}

export type WorkerStatus = 'idle' | 'working' | 'draining' | 'shutdown';

export type WorkerLiveness =
  | { readonly alive: true; readonly agentId: string; readonly age: number; readonly status: WorkerStatus }
  | { readonly alive: false; readonly agentId: string; readonly age: number; readonly reason: 'stale' | 'missing' | 'dead_pid' };

// ── Signal Files ───────────────────────────────────────────────
// Graceful shutdown uses dedicated signal files instead of in-band messages.

function signalPath(baseDir: string, agentId: string, signal: string): string {
  return path.join(baseDir, `${agentId}.${signal}`);
}

// ── Heartbeat Writer (worker side) ─────────────────────────────

export class HeartbeatWriter {
  private readonly filePath: string;
  private timer: ReturnType<typeof setInterval> | null = null;
  private data: HeartbeatData;

  constructor(baseDir: string, agentId: string) {
    fs.mkdirSync(baseDir, { recursive: true });
    this.filePath = path.join(baseDir, `${agentId}.heartbeat.json`);
    this.data = {
      agentId,
      pid: process.pid,
      heartbeatAt: Date.now(),
      updatedAt: Date.now(),
      status: 'idle',
      iterationCount: 0,
    };
  }

  /** Start periodic heartbeat writes. */
  start(intervalMs: number = HEARTBEAT_INTERVAL_MS): void {
    this.beat();
    this.timer = setInterval(() => this.beat(), intervalMs);
    // Unref so heartbeat doesn't prevent process exit
    if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
      this.timer.unref();
    }
  }

  /** Stop heartbeat writes and clean up. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Remove heartbeat file on clean shutdown
    try { fs.unlinkSync(this.filePath); } catch { /* best effort */ }
  }

  /** Mark real work being done (updates both timestamps). */
  recordWork(task?: string): void {
    this.data = {
      ...this.data,
      updatedAt: Date.now(),
      status: 'working',
      currentTask: task,
      iterationCount: this.data.iterationCount + 1,
    };
    this.beat();
  }

  /** Mark worker as idle. */
  markIdle(): void {
    this.data = { ...this.data, status: 'idle', currentTask: undefined };
    this.beat();
  }

  /** Check if a shutdown or drain signal has been sent. */
  checkSignals(baseDir: string): WorkerStatus {
    if (fs.existsSync(signalPath(baseDir, this.data.agentId, 'shutdown'))) {
      return 'shutdown';
    }
    if (fs.existsSync(signalPath(baseDir, this.data.agentId, 'drain'))) {
      return 'draining';
    }
    return this.data.status;
  }

  private beat(): void {
    this.data = { ...this.data, heartbeatAt: Date.now() };
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data) + '\n');
    } catch {
      // Non-fatal: next beat will retry
    }
  }
}

// ── Heartbeat Reader (orchestrator side) ───────────────────────

/**
 * Check if a specific worker is alive by reading its heartbeat file.
 */
export function checkWorkerLiveness(
  baseDir: string,
  agentId: string,
  maxAgeMs: number = MAX_HEARTBEAT_AGE_MS,
): WorkerLiveness {
  const filePath = path.join(baseDir, `${agentId}.heartbeat.json`);

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as HeartbeatData;
    const now = Date.now();

    // Dual timestamp: state is NOT stale if EITHER timestamp is recent
    const heartbeatAge = now - data.heartbeatAt;
    const updateAge = now - data.updatedAt;
    const effectiveAge = Math.min(heartbeatAge, updateAge);

    // Check if PID is still alive
    let pidAlive = false;
    try {
      process.kill(data.pid, 0);
      pidAlive = true;
    } catch {
      pidAlive = false;
    }

    if (!pidAlive) {
      return { alive: false, agentId, age: effectiveAge, reason: 'dead_pid' };
    }

    if (effectiveAge > maxAgeMs) {
      return { alive: false, agentId, age: effectiveAge, reason: 'stale' };
    }

    return { alive: true, agentId, age: effectiveAge, status: data.status };
  } catch {
    return { alive: false, agentId, age: Infinity, reason: 'missing' };
  }
}

/**
 * Check liveness for all workers in a directory.
 * Returns a summary of alive/dead workers.
 */
export function checkAllWorkers(
  baseDir: string,
  maxAgeMs: number = MAX_HEARTBEAT_AGE_MS,
): { alive: WorkerLiveness[]; dead: WorkerLiveness[] } {
  const alive: WorkerLiveness[] = [];
  const dead: WorkerLiveness[] = [];

  try {
    const files = fs.readdirSync(baseDir).filter((f) => f.endsWith('.heartbeat.json'));

    for (const file of files) {
      const agentId = file.replace('.heartbeat.json', '');
      const liveness = checkWorkerLiveness(baseDir, agentId, maxAgeMs);

      if (liveness.alive) {
        alive.push(liveness);
      } else {
        dead.push(liveness);
      }
    }
  } catch {
    // Directory doesn't exist yet — no workers
  }

  return { alive, dead };
}

/**
 * Send a graceful shutdown signal to a worker.
 */
export function sendShutdownSignal(baseDir: string, agentId: string): Result<void, Error> {
  try {
    fs.mkdirSync(baseDir, { recursive: true });
    fs.writeFileSync(signalPath(baseDir, agentId, 'shutdown'), `${Date.now()}\n`);
    return Ok(undefined);
  } catch (e) {
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Send a drain signal to a worker (finish current task, then stop).
 */
export function sendDrainSignal(baseDir: string, agentId: string): Result<void, Error> {
  try {
    fs.mkdirSync(baseDir, { recursive: true });
    fs.writeFileSync(signalPath(baseDir, agentId, 'drain'), `${Date.now()}\n`);
    return Ok(undefined);
  } catch (e) {
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
}
