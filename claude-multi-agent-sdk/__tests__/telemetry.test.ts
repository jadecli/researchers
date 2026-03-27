import { describe, it, expect } from 'vitest';
import {
  calculateSessionCost,
  SessionTracker,
  MODEL_PRICING,
} from '../src/monitoring/telemetry.js';

describe('Cost Calculation', () => {
  it('calculates Opus costs correctly', () => {
    // 1M input + 500K output tokens at Opus rates
    const cost = calculateSessionCost(
      'claude-opus-4-20250514',
      1_000_000,
      500_000,
      0,
      0,
    );
    // $15 input + $37.50 output = $52.50
    expect(cost).toBeCloseTo(52.5, 1);
  });

  it('calculates Sonnet costs correctly', () => {
    const cost = calculateSessionCost(
      'claude-sonnet-4-20250514',
      1_000_000,
      500_000,
      0,
      0,
    );
    // $3 input + $7.50 output = $10.50
    expect(cost).toBeCloseTo(10.5, 1);
  });

  it('calculates Haiku costs correctly', () => {
    const cost = calculateSessionCost(
      'claude-haiku-3-5-20241022',
      1_000_000,
      500_000,
      0,
      0,
    );
    // $0.80 input + $2.00 output = $2.80
    expect(cost).toBeCloseTo(2.8, 1);
  });

  it('includes cache costs', () => {
    const withCache = calculateSessionCost(
      'claude-sonnet-4-20250514',
      100_000,
      50_000,
      200_000,
      150_000,
    );
    const withoutCache = calculateSessionCost(
      'claude-sonnet-4-20250514',
      100_000,
      50_000,
      0,
      0,
    );
    expect(withCache as number).toBeGreaterThan(withoutCache as number);
  });

  it('falls back to Sonnet pricing for unknown models', () => {
    const cost = calculateSessionCost('unknown-model', 1_000_000, 0, 0, 0);
    const sonnetCost = calculateSessionCost(
      'claude-sonnet-4-20250514',
      1_000_000,
      0,
      0,
      0,
    );
    expect(cost).toBe(sonnetCost);
  });
});

describe('Model Pricing', () => {
  it('has pricing for all three models', () => {
    expect(MODEL_PRICING).toHaveLength(3);
    const models = MODEL_PRICING.map((p) => p.model);
    expect(models).toContain('claude-opus-4-20250514');
    expect(models).toContain('claude-sonnet-4-20250514');
    expect(models).toContain('claude-haiku-3-5-20241022');
  });

  it('Opus is most expensive', () => {
    const opus = MODEL_PRICING.find((p) => p.model.includes('opus'))!;
    const sonnet = MODEL_PRICING.find((p) => p.model.includes('sonnet'))!;
    const haiku = MODEL_PRICING.find((p) => p.model.includes('haiku'))!;

    expect(opus.inputPerMillion).toBeGreaterThan(sonnet.inputPerMillion);
    expect(sonnet.inputPerMillion).toBeGreaterThan(haiku.inputPerMillion);
  });
});

describe('Session Tracker', () => {
  it('tracks token usage across turns', () => {
    const tracker = new SessionTracker('session-1', 'claude-sonnet-4-20250514');

    tracker.recordTokenUsage(1000, 500);
    tracker.recordTokenUsage(2000, 1000);

    const events = tracker.getEvents();
    expect(events).toHaveLength(3); // start + 2 usage
    expect(events[0]!.type).toBe('session_start');
    expect(events[1]!.type).toBe('token_usage');
    expect(events[2]!.type).toBe('token_usage');
  });

  it('tracks tool calls', () => {
    const tracker = new SessionTracker('session-2', 'claude-sonnet-4-20250514');

    tracker.recordToolCall('WebSearch', 150, true);
    tracker.recordToolCall('Read', 50, true);
    tracker.recordToolCall('WebFetch', 0, false);

    const events = tracker.getEvents();
    const toolEvents = events.filter((e) => e.type === 'tool_call');
    expect(toolEvents).toHaveLength(3);
  });

  it('calculates current cost', () => {
    const tracker = new SessionTracker('session-3', 'claude-sonnet-4-20250514');
    tracker.recordTokenUsage(100_000, 50_000); // $0.30 + $0.75 = $1.05

    const cost = tracker.getCurrentCost() as number;
    expect(cost).toBeCloseTo(1.05, 1);
  });

  it('produces end event with totals', () => {
    const tracker = new SessionTracker('session-4', 'claude-sonnet-4-20250514');
    tracker.recordTokenUsage(1000, 500);
    tracker.recordToolCall('Read', 10, true);

    const endEvent = tracker.end();
    expect(endEvent.type).toBe('session_end');
    if (endEvent.type === 'session_end') {
      expect(endEvent.totalTurns).toBe(1);
      expect(endEvent.totalToolCalls).toBe(1);
      expect((endEvent.totalCost as number)).toBeGreaterThan(0);
    }
  });

  it('tracks subagent spawns', () => {
    const tracker = new SessionTracker('session-5', 'claude-opus-4-20250514');
    tracker.recordSubagentSpawn('lead', 'worker-1', 'claude-sonnet-4-20250514');
    tracker.recordSubagentSpawn('lead', 'worker-2', 'claude-sonnet-4-20250514');

    const spawns = tracker.getEvents().filter((e) => e.type === 'subagent_spawn');
    expect(spawns).toHaveLength(2);
  });
});
