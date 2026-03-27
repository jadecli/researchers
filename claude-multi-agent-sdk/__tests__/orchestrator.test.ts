import { describe, it, expect } from 'vitest';
import {
  classifyQuery,
  determineScale,
  buildSubagentTasks,
  type QueryType,
} from '../src/agent/orchestrator.js';

describe('Query Classification', () => {
  it('classifies straightforward queries', () => {
    const result = classifyQuery('What is the Claude API pricing?');
    expect(result.type).toBe('straightforward');
  });

  it('classifies breadth-first queries', () => {
    const result = classifyQuery('Compare React vs Vue vs Svelte');
    expect(result.type).toBe('breadth_first');
    if (result.type === 'breadth_first') {
      expect(result.subtopics.length).toBeGreaterThan(0);
    }
  });

  it('classifies depth-first queries', () => {
    const result = classifyQuery('Why does the agent loop fail on complex tasks?');
    expect(result.type).toBe('depth_first');
    if (result.type === 'depth_first') {
      expect(result.perspectives).toContain('technical');
      expect(result.perspectives).toContain('empirical');
    }
  });

  it('handles ambiguous queries as straightforward', () => {
    const result = classifyQuery('Tell me about Claude');
    expect(result.type).toBe('straightforward');
  });

  it('detects comparison signals', () => {
    const queries = [
      'compare A and B',
      'list all frameworks',
      'differences between X and Y',
      'pros and cons of TypeScript',
    ];

    for (const q of queries) {
      const result = classifyQuery(q);
      expect(result.type).toBe('breadth_first');
    }
  });

  it('detects depth signals', () => {
    const queries = [
      'why does this happen',
      'how does the agent loop work',
      'analyze the performance impact',
      'deep dive into context engineering',
      'investigate the root cause',
    ];

    for (const q of queries) {
      const result = classifyQuery(q);
      expect(result.type).toBe('depth_first');
    }
  });
});

describe('Scaling Rules', () => {
  it('scales straightforward to 1 agent', () => {
    const scale = determineScale({ type: 'straightforward', approach: 'direct' });
    expect(scale.agentCount).toBe(1);
    expect(scale.toolCallsPerAgent).toBe(10);
  });

  it('scales depth-first to perspective count (max 5)', () => {
    const scale = determineScale({
      type: 'depth_first',
      perspectives: ['technical', 'strategic', 'empirical'],
    });
    expect(scale.agentCount).toBe(3);
    expect(scale.toolCallsPerAgent).toBe(15);
  });

  it('caps depth-first at 5 agents', () => {
    const scale = determineScale({
      type: 'depth_first',
      perspectives: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    });
    expect(scale.agentCount).toBe(5);
  });

  it('scales breadth-first to subtopic count (max 20)', () => {
    const subtopics = Array.from({ length: 25 }, (_, i) => `topic-${i}`);
    const scale = determineScale({ type: 'breadth_first', subtopics });
    expect(scale.agentCount).toBe(20);
  });
});

describe('Task Builder', () => {
  it('builds single task for straightforward queries', () => {
    const qt: QueryType = { type: 'straightforward', approach: 'direct search' };
    const tasks = buildSubagentTasks(qt, []);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.model).toBe('sonnet');
  });

  it('builds per-perspective tasks for depth-first', () => {
    const qt: QueryType = {
      type: 'depth_first',
      perspectives: ['technical', 'strategic'],
    };
    const tasks = buildSubagentTasks(qt, []);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]!.objective).toContain('technical');
    expect(tasks[1]!.objective).toContain('strategic');
  });

  it('builds per-subtopic tasks for breadth-first', () => {
    const qt: QueryType = {
      type: 'breadth_first',
      subtopics: ['React', 'Vue', 'Svelte'],
    };
    const tasks = buildSubagentTasks(qt, [], 'haiku', 10);
    expect(tasks).toHaveLength(3);
    expect(tasks[0]!.model).toBe('haiku');
    expect(tasks[0]!.maxTurns).toBe(10);
    expect(tasks[0]!.objective).toContain('React');
  });
});
