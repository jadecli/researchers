import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { JSONLWriter } from '../src/logging/jsonl.js';
import { TranscriptBuilder } from '../src/logging/transcript.js';
import { DispatchTracker, calculateCost } from '../src/logging/telemetry.js';
import type { Event } from '../src/types/transcript.js';
import { toSessionId, toAgentId } from '../src/types/core.js';

// ─── JSONLWriter tests ──────────────────────────────────────────────────────

describe('JSONLWriter', () => {
  let tmpDir: string;
  let filePath: string;
  let writer: JSONLWriter;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonl-test-'));
    filePath = path.join(tmpDir, 'test.jsonl');
    writer = new JSONLWriter(filePath);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should append events and read them back', () => {
    const event: Event = {
      type: 'tool_call',
      toolName: 'Read',
      input: { path: '/tmp/test.ts' },
      timestamp: new Date(),
    };

    writer.append(event);
    writer.append(event);

    const events = writer.read();
    expect(events).toHaveLength(2);
    expect(events[0]!.type).toBe('tool_call');
  });

  it('should filter by type', () => {
    writer.append({
      type: 'tool_call',
      toolName: 'Read',
      input: {},
      timestamp: new Date(),
    });
    writer.append({
      type: 'decision',
      rationale: 'test',
      confidence: 0.8,
      alternatives: [],
      timestamp: new Date(),
    });

    const toolCalls = writer.read({ type: 'tool_call' });
    expect(toolCalls).toHaveLength(1);

    const decisions = writer.read({ type: 'decision' });
    expect(decisions).toHaveLength(1);
  });

  it('should filter by after date', () => {
    const pastDate = new Date('2020-01-01');
    writer.append({
      type: 'tool_call',
      toolName: 'Read',
      input: {},
      timestamp: new Date(),
    });

    const events = writer.read({ after: pastDate });
    expect(events).toHaveLength(1);

    const futureDate = new Date('2099-01-01');
    const none = writer.read({ after: futureDate });
    expect(none).toHaveLength(0);
  });

  it('should rotate when exceeding maxLines', () => {
    for (let i = 0; i < 10; i++) {
      writer.append({
        type: 'tool_call',
        toolName: `Tool${i}`,
        input: {},
        timestamp: new Date(),
      });
    }

    writer.rotate(5);

    const events = writer.read();
    expect(events).toHaveLength(5);

    // Check .1 file exists
    expect(fs.existsSync(filePath + '.1')).toBe(true);
  });

  it('should return correct path', () => {
    expect(writer.getPath()).toBe(filePath);
  });

  it('should return empty array for non-existent file', () => {
    const missing = new JSONLWriter(path.join(tmpDir, 'missing.jsonl'));
    expect(missing.read()).toEqual([]);
  });
});

// ─── TranscriptBuilder tests ────────────────────────────────────────────────

describe('TranscriptBuilder', () => {
  const metadata = {
    sessionId: toSessionId('test-session'),
    agentAssignments: new Map([[toAgentId('agent-1'), 'researcher']]),
  };

  it('should build a transcript with messages and events', () => {
    const builder = new TranscriptBuilder(metadata);
    builder.addMessage('user', 'Hello');
    builder.addMessage('assistant', 'Hi there');
    builder.addEvent({
      type: 'tool_call',
      toolName: 'Read',
      input: { path: '/test' },
      timestamp: new Date(),
    });

    const transcript = builder.build();
    expect(transcript.messages).toHaveLength(2);
    expect(transcript.events).toHaveLength(1);
    expect(transcript.metadata.sessionId).toBe('test-session');
  });

  it('should add decisions as events', () => {
    const builder = new TranscriptBuilder(metadata);
    builder.addDecision('chose A', 0.9, ['B', 'C']);

    const decisions = builder.getDecisions();
    expect(decisions).toHaveLength(1);
    expect(decisions[0]!.type).toBe('decision');
  });

  it('should add quality scores as events', () => {
    const builder = new TranscriptBuilder(metadata);
    builder.addQualityScore({ completeness: 0.8, accuracy: 0.9 }, 0.85);

    const transcript = builder.build();
    expect(transcript.events).toHaveLength(1);
    expect(transcript.events[0]!.type).toBe('quality_score');
  });

  it('should filter tool calls', () => {
    const builder = new TranscriptBuilder(metadata);
    builder.addEvent({
      type: 'tool_call',
      toolName: 'Read',
      input: {},
      timestamp: new Date(),
    });
    builder.addDecision('test', 0.5, []);

    expect(builder.getToolCalls()).toHaveLength(1);
    expect(builder.getDecisions()).toHaveLength(1);
  });

  it('should summarize the transcript', () => {
    const builder = new TranscriptBuilder(metadata);
    builder.addMessage('user', 'test');
    builder.addDecision('decided', 0.8, []);
    builder.addQualityScore({ completeness: 0.7 }, 0.7);

    const summary = builder.summarize();
    expect(summary).toContain('test-session');
    expect(summary).toContain('Messages: 1');
    expect(summary).toContain('Decisions: 1');
    expect(summary).toContain('Latest quality: 0.70');
  });

  it('should serialize and deserialize round-trip', () => {
    const builder = new TranscriptBuilder(metadata);
    builder.addMessage('user', 'Hello world');
    builder.addDecision('picked A', 0.9, ['B']);
    builder.addQualityScore({ completeness: 0.8 }, 0.8);

    const jsonl = builder.serialize();
    const restored = TranscriptBuilder.deserialize(jsonl);

    expect(restored.messages).toHaveLength(1);
    expect(restored.messages[0]!.content).toBe('Hello world');
    expect(restored.events).toHaveLength(2);
    expect(restored.metadata.sessionId).toBe('test-session');
  });
});

// ─── DispatchTracker tests ──────────────────────────────────────────────────

describe('DispatchTracker', () => {
  it('should track usage and calculate costs', () => {
    const tracker = new DispatchTracker();

    tracker.recordUsage(
      'claude-sonnet-4-6',
      1000,
      500,
      200,
      100,
    );

    const total = tracker.getTotalCost();
    expect(total).toBeGreaterThan(0);

    const tokens = tracker.getTotalTokens();
    expect(tokens.input).toBe(1000);
    expect(tokens.output).toBe(500);
  });

  it('should track dispatch costs', () => {
    const tracker = new DispatchTracker();
    tracker.recordDispatch('d-1', 'Test task', 2);
    tracker.recordUsage(
      'claude-haiku-3-20250307',
      5000,
      1000,
      0,
      0,
      { dispatchId: 'd-1' },
    );

    const costs = tracker.getDispatchCosts('d-1');
    expect(costs).toHaveLength(1);
    expect(costs[0]!.dispatchId).toBe('d-1');
    expect(costs[0]!.totalCost).toBeGreaterThan(0);
  });

  it('should track round summaries', () => {
    const tracker = new DispatchTracker();
    tracker.recordRoundStart('r-1', 'Quality Scoring');
    tracker.recordUsage(
      'claude-opus-4-6',
      2000,
      1000,
      0,
      0,
      { roundId: 'r-1' },
    );
    tracker.recordRoundComplete('r-1', 0.82);

    const summary = tracker.getRoundSummary('r-1');
    expect(summary).toBeDefined();
    expect(summary!.roundName).toBe('Quality Scoring');
    expect(summary!.qualityScore).toBe(0.82);
    expect(summary!.totalCost).toBeGreaterThan(0);
  });

  it('should calculate costs correctly for all models', () => {
    // Opus: $15/M input, $75/M output
    const opusCost = calculateCost('claude-opus-4-6', 1_000_000, 1_000_000);
    expect(opusCost).toBeCloseTo(90, 0);

    // Sonnet: $3/M input, $15/M output
    const sonnetCost = calculateCost('claude-sonnet-4-6', 1_000_000, 1_000_000);
    expect(sonnetCost).toBeCloseTo(18, 0);

    // Haiku: $0.25/M input, $1.25/M output
    const haikuCost = calculateCost('claude-haiku-3-20250307', 1_000_000, 1_000_000);
    expect(haikuCost).toBeCloseTo(1.5, 0);
  });

  it('should include cache pricing', () => {
    const costWithCache = calculateCost(
      'claude-sonnet-4-6',
      0,
      0,
      1_000_000,
      1_000_000,
    );
    // cache read: $0.3/M, cache write: $3.75/M
    expect(costWithCache).toBeCloseTo(4.05, 1);
  });
});
