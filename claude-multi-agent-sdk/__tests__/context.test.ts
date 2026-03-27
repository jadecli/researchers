import { describe, it, expect } from 'vitest';
import {
  calculateBudget,
  selectCompactionStrategy,
  createToolManifest,
  estimateToolTokenSavings,
  formatMemoryForContext,
  trimToolOutput,
  formatCaseFacts,
  type ToolManifestEntry,
  type AgentMemoryEntry,
  type CaseFacts,
} from '../src/context/manager.js';

describe('Context Budget', () => {
  it('calculates remaining tokens correctly', () => {
    const budget = calculateBudget(200_000, 5_000, 3_000, 50_000);
    expect(budget.remainingTokens).toBe(142_000);
    expect(budget.usageRatio).toBeCloseTo(0.29, 1);
  });

  it('floors remaining at zero', () => {
    const budget = calculateBudget(100_000, 50_000, 30_000, 30_000);
    expect(budget.remainingTokens).toBe(0);
    expect(budget.usageRatio).toBe(1);
  });
});

describe('Compaction Strategy', () => {
  it('selects tool_result_clearing when usage < 70%', () => {
    const budget = calculateBudget(200_000, 5_000, 3_000, 50_000);
    const strategy = selectCompactionStrategy(budget);
    expect(strategy.type).toBe('tool_result_clearing');
  });

  it('selects conversation_summary when usage 70-90%', () => {
    const budget = calculateBudget(100_000, 5_000, 3_000, 72_000);
    const strategy = selectCompactionStrategy(budget);
    expect(strategy.type).toBe('conversation_summary');
  });

  it('selects sub_agent_delegation when usage > 90%', () => {
    const budget = calculateBudget(100_000, 5_000, 3_000, 92_000);
    const strategy = selectCompactionStrategy(budget);
    expect(strategy.type).toBe('sub_agent_delegation');
  });
});

describe('Tool Manifest', () => {
  const tools: ToolManifestEntry[] = [
    {
      name: 'search',
      briefDescription: 'Search the web',
      fullDefinition: { name: 'search', description: 'Search the web for information', input_schema: { type: 'object', properties: { query: { type: 'string' } } } },
      deferLoading: false,
    },
    {
      name: 'analyze_document',
      briefDescription: 'Analyze a document',
      fullDefinition: { name: 'analyze_document', description: 'Deep analysis of a document with multiple parameters...', input_schema: { type: 'object', properties: { url: { type: 'string' }, depth: { type: 'number' }, format: { type: 'string' } } } },
      deferLoading: true,
    },
    {
      name: 'generate_chart',
      briefDescription: 'Generate charts',
      fullDefinition: { name: 'generate_chart', description: 'Generate various chart types from data...', input_schema: { type: 'object', properties: { data: { type: 'array' }, chartType: { type: 'string' }, options: { type: 'object' } } } },
      deferLoading: true,
    },
  ];

  it('separates deferred from immediate tools', () => {
    const manifest = createToolManifest(tools);
    expect(manifest.immediate).toHaveLength(1);
    expect(manifest.deferred).toHaveLength(2);
    expect(manifest.deferred[0]!.name).toBe('analyze_document');
  });

  it('estimates token savings', () => {
    const savings = estimateToolTokenSavings(tools);
    expect(savings.savedPercent).toBeGreaterThan(0);
    expect(savings.after).toBeLessThan(savings.before);
  });
});

describe('Agent Memory', () => {
  it('formats memory entries prioritized by category', () => {
    const entries: AgentMemoryEntry[] = [
      { timestamp: '2025-01-01', category: 'todo', content: 'Fix tests', source: 'test.ts' },
      { timestamp: '2025-01-01', category: 'key_finding', content: 'Auth uses JWT', source: 'auth.ts' },
      { timestamp: '2025-01-01', category: 'unresolved_bug', content: 'Race condition', source: 'queue.ts' },
    ];

    const output = formatMemoryForContext(entries, 500);
    expect(output).toContain('## Agent Memory');
    // Key findings should appear before todos
    const findingIdx = output.indexOf('Auth uses JWT');
    const todoIdx = output.indexOf('Fix tests');
    expect(findingIdx).toBeLessThan(todoIdx);
  });

  it('respects token budget', () => {
    const entries: AgentMemoryEntry[] = Array.from({ length: 100 }, (_, i) => ({
      timestamp: '2025-01-01',
      category: 'key_finding' as const,
      content: `Finding ${i}: `.padEnd(200, 'x'),
      source: `file${i}.ts`,
    }));

    const output = formatMemoryForContext(entries, 100);
    // Should be truncated
    expect(output.length).toBeLessThan(entries.reduce((s, e) => s + e.content.length, 0));
  });
});

describe('Tool Output Trimming', () => {
  it('trims JSON to relevant fields', () => {
    const verbose = JSON.stringify({
      id: 'order-123',
      customer_name: 'Alice',
      shipping_address: '123 Main St',
      billing_address: '456 Oak Ave',
      items: [{ sku: 'A1', qty: 2 }],
      internal_notes: 'bulk discount applied',
      audit_log: ['created', 'updated', 'shipped'],
      status: 'shipped',
      amount: 99.99,
    });

    const trimmed = trimToolOutput(verbose, ['id', 'status', 'amount']);
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(['id', 'status', 'amount']);
    expect(parsed['amount']).toBe(99.99);
  });

  it('truncates non-JSON content', () => {
    const longText = 'x'.repeat(5000);
    const trimmed = trimToolOutput(longText, []);
    expect(trimmed.length).toBeLessThan(longText.length);
    expect(trimmed).toContain('[truncated]');
  });
});

describe('Case Facts', () => {
  it('formats case facts as markdown', () => {
    const facts: CaseFacts = {
      customerId: 'cust-456',
      orderIds: ['order-123', 'order-789'],
      amounts: [{ orderId: 'order-123', amount: 99.99, currency: 'USD' }],
      dates: [{ event: 'Order placed', date: '2025-03-20' }],
      statuses: [{ entity: 'order-123', status: 'shipped' }],
    };

    const output = formatCaseFacts(facts);
    expect(output).toContain('Customer: cust-456');
    expect(output).toContain('Order: order-123');
    expect(output).toContain('USD 99.99');
    expect(output).toContain('shipped');
  });
});
