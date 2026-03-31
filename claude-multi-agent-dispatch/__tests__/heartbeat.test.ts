import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  HeartbeatWriter,
  checkWorkerLiveness,
  checkAllWorkers,
  sendShutdownSignal,
  sendDrainSignal,
} from '../src/orchestrator/heartbeat.js';

describe('HeartbeatWriter', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'heartbeat-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes heartbeat file on start', () => {
    const writer = new HeartbeatWriter(tmpDir, 'agent-1');
    writer.start(60_000); // long interval so it doesn't fire again during test

    const filePath = path.join(tmpDir, 'agent-1.heartbeat.json');
    expect(fs.existsSync(filePath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(data.agentId).toBe('agent-1');
    expect(data.pid).toBe(process.pid);
    expect(data.status).toBe('idle');

    writer.stop();
  });

  it('recordWork updates status and iteration', () => {
    const writer = new HeartbeatWriter(tmpDir, 'agent-2');
    writer.start(60_000);
    writer.recordWork('crawl-docs');

    const filePath = path.join(tmpDir, 'agent-2.heartbeat.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(data.status).toBe('working');
    expect(data.currentTask).toBe('crawl-docs');
    expect(data.iterationCount).toBe(1);

    writer.stop();
  });

  it('stop removes heartbeat file', () => {
    const writer = new HeartbeatWriter(tmpDir, 'agent-3');
    writer.start(60_000);

    const filePath = path.join(tmpDir, 'agent-3.heartbeat.json');
    expect(fs.existsSync(filePath)).toBe(true);

    writer.stop();
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('checkSignals detects shutdown signal', () => {
    const writer = new HeartbeatWriter(tmpDir, 'agent-4');
    writer.start(60_000);

    sendShutdownSignal(tmpDir, 'agent-4');
    expect(writer.checkSignals(tmpDir)).toBe('shutdown');

    writer.stop();
  });

  it('checkSignals detects drain signal', () => {
    const writer = new HeartbeatWriter(tmpDir, 'agent-5');
    writer.start(60_000);

    sendDrainSignal(tmpDir, 'agent-5');
    expect(writer.checkSignals(tmpDir)).toBe('draining');

    writer.stop();
  });
});

describe('checkWorkerLiveness', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'liveness-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports alive for fresh heartbeat', () => {
    const writer = new HeartbeatWriter(tmpDir, 'worker-1');
    writer.start(60_000);

    const liveness = checkWorkerLiveness(tmpDir, 'worker-1');
    expect(liveness.alive).toBe(true);
    if (liveness.alive) {
      expect(liveness.status).toBe('idle');
    }

    writer.stop();
  });

  it('reports missing for non-existent worker', () => {
    const liveness = checkWorkerLiveness(tmpDir, 'ghost');
    expect(liveness.alive).toBe(false);
    if (!liveness.alive) {
      expect(liveness.reason).toBe('missing');
    }
  });

  it('reports stale for old heartbeat', () => {
    // Write a heartbeat with old timestamps
    const filePath = path.join(tmpDir, 'old-worker.heartbeat.json');
    const oldData = {
      agentId: 'old-worker',
      pid: process.pid, // alive PID but stale timestamps
      heartbeatAt: Date.now() - 60_000,
      updatedAt: Date.now() - 60_000,
      status: 'working',
      iterationCount: 5,
    };
    fs.writeFileSync(filePath, JSON.stringify(oldData));

    const liveness = checkWorkerLiveness(tmpDir, 'old-worker', 30_000);
    expect(liveness.alive).toBe(false);
    if (!liveness.alive) {
      expect(liveness.reason).toBe('stale');
    }
  });
});

describe('checkAllWorkers', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'all-workers-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns alive and dead workers', () => {
    const w1 = new HeartbeatWriter(tmpDir, 'alive-1');
    w1.start(60_000);

    // Write a stale heartbeat
    const stalePath = path.join(tmpDir, 'dead-1.heartbeat.json');
    fs.writeFileSync(stalePath, JSON.stringify({
      agentId: 'dead-1',
      pid: 99999999, // unlikely to be alive
      heartbeatAt: Date.now() - 60_000,
      updatedAt: Date.now() - 60_000,
      status: 'working',
      iterationCount: 1,
    }));

    const { alive, dead } = checkAllWorkers(tmpDir);
    expect(alive.length).toBeGreaterThanOrEqual(1);
    expect(dead.length).toBeGreaterThanOrEqual(1);

    w1.stop();
  });

  it('returns empty for non-existent directory', () => {
    const { alive, dead } = checkAllWorkers('/tmp/nonexistent-dir-xyz');
    expect(alive).toHaveLength(0);
    expect(dead).toHaveLength(0);
  });
});

describe('Signal Files', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'signal-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('sendShutdownSignal creates signal file', () => {
    const result = sendShutdownSignal(tmpDir, 'agent-x');
    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'agent-x.shutdown'))).toBe(true);
  });

  it('sendDrainSignal creates signal file', () => {
    const result = sendDrainSignal(tmpDir, 'agent-y');
    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'agent-y.drain'))).toBe(true);
  });
});
