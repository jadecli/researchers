import { describe, it, expect } from 'vitest';
import {
  toAgentId,
  toSessionId,
  toTokenCount,
  toUSD,
  Ok,
  Err,
  map,
  flatMap,
  unwrap,
  unwrapOr,
  handleAgentState,
  resolveModel,
  type AgentState,
  type Result,
} from '../src/types/core.js';

describe('Branded Types', () => {
  it('creates branded types that are string/number at runtime', () => {
    const agentId = toAgentId('agent-1');
    const sessionId = toSessionId('session-1');
    const tokens = toTokenCount(1000);
    const cost = toUSD(0.05);

    // Runtime values
    expect(agentId).toBe('agent-1');
    expect(sessionId).toBe('session-1');
    expect(tokens).toBe(1000);
    expect(cost).toBe(0.05);
  });
});

describe('Result Type', () => {
  it('Ok wraps a value', () => {
    const result = Ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(42);
  });

  it('Err wraps an error', () => {
    const result = Err(new Error('fail'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('fail');
  });

  it('map transforms Ok values', () => {
    const result = map(Ok(10), (x) => x * 2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(20);
  });

  it('map passes through Err', () => {
    const err: Result<number> = Err(new Error('oops'));
    const result = map(err, (x) => x * 2);
    expect(result.ok).toBe(false);
  });

  it('flatMap chains Result operations', () => {
    const divide = (a: number, b: number): Result<number> =>
      b === 0 ? Err(new Error('div by zero')) : Ok(a / b);

    const result = flatMap(Ok(10), (x) => divide(x, 2));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(5);

    const errResult = flatMap(Ok(10), (x) => divide(x, 0));
    expect(errResult.ok).toBe(false);
  });

  it('unwrap returns value or throws', () => {
    expect(unwrap(Ok(42))).toBe(42);
    expect(() => unwrap(Err(new Error('fail')))).toThrow('fail');
  });

  it('unwrapOr returns value or fallback', () => {
    expect(unwrapOr(Ok(42), 0)).toBe(42);
    expect(unwrapOr(Err(new Error('fail')), 0)).toBe(0);
  });
});

describe('Agent State Machine', () => {
  it('handles all states exhaustively', () => {
    const states: AgentState[] = [
      { status: 'idle' },
      { status: 'gathering_context', sources: ['web', 'docs'] },
      { status: 'executing_tools', pendingCalls: [] },
      { status: 'verifying', output: 'test' },
      { status: 'delegating', subagentIds: [toAgentId('a1')] },
      { status: 'synthesizing', results: [] },
      {
        status: 'complete',
        finalOutput: 'done',
        usage: {
          inputTokens: toTokenCount(100),
          outputTokens: toTokenCount(50),
          cacheCreationTokens: toTokenCount(0),
          cacheReadTokens: toTokenCount(0),
          cost: toUSD(0.01),
        },
      },
      { status: 'error', error: new Error('oops'), recoverable: true },
    ];

    for (const state of states) {
      const description = handleAgentState(state);
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
    }
  });

  it('reports correct descriptions', () => {
    expect(handleAgentState({ status: 'idle' })).toBe('Agent ready');
    expect(
      handleAgentState({
        status: 'delegating',
        subagentIds: [toAgentId('a'), toAgentId('b')],
      }),
    ).toContain('2 subagents');
  });
});

describe('Model Resolution', () => {
  it('resolves aliases to full model IDs', () => {
    expect(resolveModel('opus')).toBe('claude-opus-4-6');
    expect(resolveModel('sonnet')).toBe('claude-sonnet-4-6');
    expect(resolveModel('haiku')).toBe('claude-haiku-4-5-20251001');
  });
});
