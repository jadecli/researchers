import { describe, it, expect } from 'vitest';
import {
  toDispatchId,
  toRoundId,
  toAgentId,
  toSessionId,
  toToolCallId,
  toTokenCount,
  toUSD,
  toTranscriptId,
  toAuditId,
  Ok,
  Err,
  map,
  flatMap,
  unwrap,
  unwrapOr,
  assertNever,
  resolveModel,
  handleDispatchState,
} from '../src/types/index.js';
import type {
  DispatchTask,
  DispatchState,
  Event,
  ModelAlias,
} from '../src/types/index.js';

// ─── Branded Type Constructors ───────────────────────────────────────────────

describe('Branded type constructors', () => {
  it('toDispatchId creates a valid DispatchId', () => {
    const id = toDispatchId('dispatch-001');
    expect(id).toBe('dispatch-001');
  });

  it('toDispatchId rejects empty strings', () => {
    expect(() => toDispatchId('')).toThrow('DispatchId cannot be empty');
    expect(() => toDispatchId('   ')).toThrow('DispatchId cannot be empty');
  });

  it('toRoundId creates a valid RoundId', () => {
    const id = toRoundId('round-01');
    expect(id).toBe('round-01');
  });

  it('toRoundId rejects empty strings', () => {
    expect(() => toRoundId('')).toThrow('RoundId cannot be empty');
  });

  it('toAgentId creates a valid AgentId', () => {
    const id = toAgentId('agent-alpha');
    expect(id).toBe('agent-alpha');
  });

  it('toAgentId rejects empty strings', () => {
    expect(() => toAgentId('')).toThrow('AgentId cannot be empty');
  });

  it('toSessionId creates a valid SessionId', () => {
    const id = toSessionId('session-xyz');
    expect(id).toBe('session-xyz');
  });

  it('toSessionId rejects empty strings', () => {
    expect(() => toSessionId('')).toThrow('SessionId cannot be empty');
  });

  it('toToolCallId creates a valid ToolCallId', () => {
    const id = toToolCallId('tc-001');
    expect(id).toBe('tc-001');
  });

  it('toToolCallId rejects empty strings', () => {
    expect(() => toToolCallId('')).toThrow('ToolCallId cannot be empty');
  });

  it('toTokenCount creates a valid TokenCount', () => {
    expect(toTokenCount(0)).toBe(0);
    expect(toTokenCount(1500)).toBe(1500);
  });

  it('toTokenCount rejects negative numbers', () => {
    expect(() => toTokenCount(-1)).toThrow('non-negative integer');
  });

  it('toTokenCount rejects non-integers', () => {
    expect(() => toTokenCount(1.5)).toThrow('non-negative integer');
  });

  it('toUSD creates a valid USD amount', () => {
    expect(toUSD(0)).toBe(0);
    expect(toUSD(9.99)).toBe(9.99);
  });

  it('toUSD rejects negative amounts', () => {
    expect(() => toUSD(-0.01)).toThrow('cannot be negative');
  });

  it('toTranscriptId creates a valid TranscriptId', () => {
    expect(toTranscriptId('tr-001')).toBe('tr-001');
  });

  it('toTranscriptId rejects empty strings', () => {
    expect(() => toTranscriptId('')).toThrow('TranscriptId cannot be empty');
  });

  it('toAuditId creates a valid AuditId', () => {
    expect(toAuditId('audit-001')).toBe('audit-001');
  });

  it('toAuditId rejects empty strings', () => {
    expect(() => toAuditId('')).toThrow('AuditId cannot be empty');
  });
});

// ─── Result Type ─────────────────────────────────────────────────────────────

describe('Result type', () => {
  it('Ok creates a successful result', () => {
    const result = Ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it('Err creates a failure result', () => {
    const result = Err('something failed');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('something failed');
    }
  });

  it('map transforms Ok values', () => {
    const result = Ok(10);
    const mapped = map(result, (v) => v * 2);
    expect(mapped.ok).toBe(true);
    if (mapped.ok) {
      expect(mapped.value).toBe(20);
    }
  });

  it('map passes through Err values', () => {
    const result = Err('fail');
    const mapped = map(result, (v: number) => v * 2);
    expect(mapped.ok).toBe(false);
    if (!mapped.ok) {
      expect(mapped.error).toBe('fail');
    }
  });

  it('flatMap chains successful operations', () => {
    const result = Ok(10);
    const chained = flatMap(result, (v) => (v > 5 ? Ok(v * 3) : Err('too small')));
    expect(chained.ok).toBe(true);
    if (chained.ok) {
      expect(chained.value).toBe(30);
    }
  });

  it('flatMap short-circuits on Err', () => {
    const result = Err('initial error');
    const chained = flatMap(result, (v: number) => Ok(v * 3));
    expect(chained.ok).toBe(false);
    if (!chained.ok) {
      expect(chained.error).toBe('initial error');
    }
  });

  it('flatMap returns Err from the function', () => {
    const result = Ok(3);
    const chained = flatMap(result, (v) => (v > 5 ? Ok(v * 3) : Err('too small')));
    expect(chained.ok).toBe(false);
    if (!chained.ok) {
      expect(chained.error).toBe('too small');
    }
  });

  it('unwrap extracts Ok values', () => {
    expect(unwrap(Ok('hello'))).toBe('hello');
  });

  it('unwrap throws on Err', () => {
    expect(() => unwrap(Err('boom'))).toThrow('Attempted to unwrap an Err result');
  });

  it('unwrapOr returns Ok value when present', () => {
    expect(unwrapOr(Ok(42), 0)).toBe(42);
  });

  it('unwrapOr returns default value on Err', () => {
    expect(unwrapOr(Err('fail'), 99)).toBe(99);
  });
});

// ─── assertNever ─────────────────────────────────────────────────────────────

describe('assertNever', () => {
  it('throws for any value passed to it', () => {
    expect(() => assertNever('oops' as never)).toThrow('Unexpected value');
  });
});

// ─── ModelAlias resolveModel ─────────────────────────────────────────────────

describe('resolveModel', () => {
  it('resolves opus alias', () => {
    expect(resolveModel('opus')).toBe('claude-opus-4-6');
  });

  it('resolves sonnet alias', () => {
    expect(resolveModel('sonnet')).toBe('claude-sonnet-4-6');
  });

  it('resolves haiku alias', () => {
    expect(resolveModel('haiku')).toBe('claude-haiku-3-20250307');
  });
});

// ─── DispatchState handleDispatchState ───────────────────────────────────────

describe('handleDispatchState', () => {
  it('handles idle state', () => {
    const state: DispatchState = { status: 'idle' };
    expect(handleDispatchState(state)).toContain('idle');
  });

  it('handles planning state', () => {
    const state: DispatchState = { status: 'planning', planStartedAt: new Date() };
    expect(handleDispatchState(state)).toContain('Planning');
  });

  it('handles dispatching state', () => {
    const state: DispatchState = {
      status: 'dispatching',
      plan: {
        id: toDispatchId('d-1'),
        tasks: [],
        budget: toUSD(5),
        maxAgents: 3,
        timeline: { estimatedDurationMs: 1000, createdAt: new Date() },
      },
    };
    expect(handleDispatchState(state)).toContain('Dispatching');
  });

  it('handles executing state', () => {
    const state: DispatchState = {
      status: 'executing',
      plan: {
        id: toDispatchId('d-1'),
        tasks: [],
        budget: toUSD(5),
        maxAgents: 3,
        timeline: { estimatedDurationMs: 1000, createdAt: new Date() },
      },
      activeAgents: [toAgentId('a-1'), toAgentId('a-2')],
    };
    expect(handleDispatchState(state)).toContain('2 active agents');
  });

  it('handles scoring state', () => {
    const state: DispatchState = {
      status: 'scoring',
      plan: {
        id: toDispatchId('d-1'),
        tasks: [],
        budget: toUSD(5),
        maxAgents: 3,
        timeline: { estimatedDurationMs: 1000, createdAt: new Date() },
      },
      rawOutputs: ['output1', 'output2'],
    };
    expect(handleDispatchState(state)).toContain('2 outputs');
  });

  it('handles complete state', () => {
    const state: DispatchState = {
      status: 'complete',
      result: {
        id: toDispatchId('d-1'),
        outputs: ['result'],
        qualityScore: 0.85,
        usage: {
          inputTokens: toTokenCount(100),
          outputTokens: toTokenCount(200),
          cacheReadTokens: toTokenCount(0),
          cacheWriteTokens: toTokenCount(0),
          totalCost: toUSD(0.01),
        },
        duration: 5000,
      },
    };
    const msg = handleDispatchState(state);
    expect(msg).toContain('Complete');
    expect(msg).toContain('0.85');
  });

  it('handles error state', () => {
    const state: DispatchState = {
      status: 'error',
      error: 'Budget exceeded',
      failedAt: 'executing',
    };
    expect(handleDispatchState(state)).toContain('Budget exceeded');
  });
});

// ─── DispatchTask discriminated union ────────────────────────────────────────

describe('DispatchTask discriminated union', () => {
  it('creates a simple task', () => {
    const task: DispatchTask = {
      type: 'simple',
      objective: 'Extract types from repo',
      model: 'claude-sonnet-4-6',
    };
    expect(task.type).toBe('simple');
    expect(task.objective).toBe('Extract types from repo');
  });

  it('creates a parallel task', () => {
    const task: DispatchTask = {
      type: 'parallel',
      tasks: [
        { type: 'simple', objective: 'Task A', model: 'claude-haiku-3-20250307' },
        { type: 'simple', objective: 'Task B', model: 'claude-haiku-3-20250307' },
      ],
    };
    expect(task.type).toBe('parallel');
    expect(task.tasks).toHaveLength(2);
  });

  it('creates a sequential task', () => {
    const task: DispatchTask = {
      type: 'sequential',
      tasks: [
        { type: 'simple', objective: 'Step 1', model: 'claude-sonnet-4-6' },
        { type: 'simple', objective: 'Step 2', model: 'claude-sonnet-4-6' },
      ],
    };
    expect(task.type).toBe('sequential');
  });

  it('creates a conditional task', () => {
    const task: DispatchTask = {
      type: 'conditional',
      condition: 'budget > $1.00',
      ifTrue: { type: 'simple', objective: 'Deep analysis', model: 'claude-opus-4-6' },
      ifFalse: { type: 'simple', objective: 'Quick scan', model: 'claude-haiku-3-20250307' },
    };
    expect(task.type).toBe('conditional');
    expect(task.ifTrue.type).toBe('simple');
    expect(task.ifFalse.type).toBe('simple');
  });

  it('supports nested task trees', () => {
    const task: DispatchTask = {
      type: 'sequential',
      tasks: [
        {
          type: 'parallel',
          tasks: [
            { type: 'simple', objective: 'Parallel A', model: 'claude-haiku-3-20250307' },
            { type: 'simple', objective: 'Parallel B', model: 'claude-haiku-3-20250307' },
          ],
        },
        {
          type: 'conditional',
          condition: 'quality > 0.7',
          ifTrue: { type: 'simple', objective: 'Done', model: 'claude-haiku-3-20250307' },
          ifFalse: { type: 'simple', objective: 'Retry', model: 'claude-sonnet-4-6' },
        },
      ],
    };
    expect(task.type).toBe('sequential');
    expect(task.tasks[0]!.type).toBe('parallel');
    expect(task.tasks[1]!.type).toBe('conditional');
  });
});

// ─── Event discriminated union ───────────────────────────────────────────────

describe('Event discriminated union', () => {
  const now = new Date();

  it('creates a tool_call event', () => {
    const event: Event = {
      type: 'tool_call',
      toolName: 'read_file',
      input: { path: '/src/index.ts' },
      timestamp: now,
    };
    expect(event.type).toBe('tool_call');
    expect(event.toolName).toBe('read_file');
  });

  it('creates a tool_result event', () => {
    const event: Event = {
      type: 'tool_result',
      toolCallId: toToolCallId('tc-001'),
      content: 'file contents here',
      isError: false,
      timestamp: now,
    };
    expect(event.type).toBe('tool_result');
    expect(event.isError).toBe(false);
  });

  it('creates a decision event', () => {
    const event: Event = {
      type: 'decision',
      rationale: 'Chose Sonnet for moderate complexity',
      confidence: 0.9,
      alternatives: ['Haiku', 'Opus'],
      timestamp: now,
    };
    expect(event.type).toBe('decision');
    expect(event.confidence).toBe(0.9);
    expect(event.alternatives).toHaveLength(2);
  });

  it('creates a quality_score event', () => {
    const event: Event = {
      type: 'quality_score',
      scores: { completeness: 0.8, accuracy: 0.9 },
      overall: 0.85,
      timestamp: now,
    };
    expect(event.type).toBe('quality_score');
    expect(event.overall).toBe(0.85);
  });

  it('creates a context_delta event', () => {
    const event: Event = {
      type: 'context_delta',
      delta: {
        iteration: 2,
        newPatterns: ['singleton', 'factory'],
        failingStrategies: ['brute-force'],
        qualityBefore: 0.5,
        qualityAfter: 0.7,
        steerDirection: 'increase completeness',
        discoveredTypes: ['InferenceConfig', 'ChatMessage'],
      },
      timestamp: now,
    };
    expect(event.type).toBe('context_delta');
    expect(event.delta.iteration).toBe(2);
    expect(event.delta.newPatterns).toContain('singleton');
  });

  it('creates a dispatch event', () => {
    const event: Event = {
      type: 'dispatch',
      dispatchId: toDispatchId('d-001'),
      taskSummary: 'Extract types from 3 repos',
      agentIds: [toAgentId('a-1'), toAgentId('a-2')],
      timestamp: now,
    };
    expect(event.type).toBe('dispatch');
    expect(event.agentIds).toHaveLength(2);
  });

  it('creates an audit event', () => {
    const event: Event = {
      type: 'audit',
      auditId: toAuditId('audit-001'),
      findings: ['Missing error handling', 'Incomplete type coverage'],
      score: 0.72,
      timestamp: now,
    };
    expect(event.type).toBe('audit');
    expect(event.findings).toHaveLength(2);
    expect(event.score).toBe(0.72);
  });
});
