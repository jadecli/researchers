// __tests__/router.test.ts — Dispatch Router Tests
//
// vitest tests for event classification, agent routing, plugin matching,
// plugin index search, category listing, and decision logging.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  DispatchRouter,
  type TaskClassification,
  type RoutingDecision,
} from '../src/dispatch/router.js';
import { PluginIndex, BUILTIN_PLUGINS } from '../src/dispatch/plugin-index.js';
import { type ChannelEvent, toSenderId } from '../src/channel/types.js';

// ── Helpers ───────────────────────────────────────────────────

function makeEvent(content: string): ChannelEvent {
  return {
    source: toSenderId('test-user'),
    content,
    meta: {},
  };
}

function makeTmpDir(): string {
  const dir = join(tmpdir(), `router-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ── test_classify_codegen ───────────────────────────────────

describe('classifyEvent', () => {
  const router = new DispatchRouter();

  it('classifies "write a function" as codegen', () => {
    // Arrange
    const event = makeEvent('Please write a function that validates email addresses.');

    // Act
    const classification = router.classifyEvent(event);

    // Assert
    expect(classification.taskType).toBe('codegen');
    expect(classification.keywords).toContain('write');
    expect(classification.keywords).toContain('function');
    expect(classification.confidence).toBeGreaterThan(0.3);
  });

  // ── test_classify_research ──────────────────────────────────

  it('classifies "compare X vs Y" as research', () => {
    // Arrange
    const event = makeEvent('Compare React vs Vue for our next project and summarize the tradeoffs.');

    // Act
    const classification = router.classifyEvent(event);

    // Assert
    expect(classification.taskType).toBe('research');
    expect(classification.keywords).toContain('compare');
    expect(classification.confidence).toBeGreaterThan(0.3);
  });

  // ── test_classify_security ──────────────────────────────────

  it('classifies "scan for vulnerabilities" as security', () => {
    // Arrange
    const event = makeEvent('Scan the codebase for vulnerabilities and check for any injection risks.');

    // Act
    const classification = router.classifyEvent(event);

    // Assert
    expect(classification.taskType).toBe('security');
    expect(classification.keywords).toContain('scan');
    expect(classification.keywords).toContain('vulnerabilities');
    expect(classification.confidence).toBeGreaterThan(0.3);
  });

  it('defaults to general for unrecognized content', () => {
    // Arrange
    const event = makeEvent('Hello there.');

    // Act
    const classification = router.classifyEvent(event);

    // Assert
    expect(classification.taskType).toBe('general');
    expect(classification.confidence).toBeLessThan(0.3);
  });

  it('assesses complexity as simple for short prompts', () => {
    const event = makeEvent('Write a simple hello world function.');
    const classification = router.classifyEvent(event);

    expect(classification.complexity).toBe('simple');
  });

  it('assesses complexity as complex for architecture prompts', () => {
    const event = makeEvent(
      'Design the full system architecture for a microservices platform with event sourcing, CQRS, and multi-region deployment strategy.',
    );
    const classification = router.classifyEvent(event);

    expect(classification.complexity).toBe('complex');
  });
});

// ── test_route_to_agent_codegen ─────────────────────────────

describe('routeToAgent', () => {
  const router = new DispatchRouter();

  it('routes codegen to sonnet with Edit and Write tools', () => {
    // Arrange
    const classification: TaskClassification = {
      taskType: 'codegen',
      complexity: 'moderate',
      keywords: ['write', 'function'],
      confidence: 0.7,
    };

    // Act
    const recommendation = router.routeToAgent(classification);

    // Assert
    expect(recommendation.model).toBe('sonnet');
    expect(recommendation.tools).toContain('Edit');
    expect(recommendation.tools).toContain('Write');
    expect(recommendation.agentId).toBe('agent-codegen');
    expect(recommendation.rationale.length).toBeGreaterThan(0);
  });

  // ── test_route_to_agent_research ────────────────────────────

  it('routes research to opus with WebSearch tool', () => {
    // Arrange
    const classification: TaskClassification = {
      taskType: 'research',
      complexity: 'moderate',
      keywords: ['compare', 'analyze'],
      confidence: 0.8,
    };

    // Act
    const recommendation = router.routeToAgent(classification);

    // Assert
    expect(recommendation.model).toBe('opus');
    expect(recommendation.tools).toContain('WebSearch');
    expect(recommendation.agentId).toBe('agent-research');
  });

  it('upgrades model to opus for complex tasks', () => {
    const classification: TaskClassification = {
      taskType: 'codegen',
      complexity: 'complex',
      keywords: ['write', 'function'],
      confidence: 0.7,
    };

    const recommendation = router.routeToAgent(classification);

    expect(recommendation.model).toBe('opus');
  });

  it('routes security to opus with WebSearch and Grep', () => {
    const classification: TaskClassification = {
      taskType: 'security',
      complexity: 'moderate',
      keywords: ['scan', 'vulnerability'],
      confidence: 0.6,
    };

    const recommendation = router.routeToAgent(classification);

    expect(recommendation.model).toBe('opus');
    expect(recommendation.tools).toContain('WebSearch');
    expect(recommendation.tools).toContain('Grep');
  });
});

// ── test_route_to_plugin_matching ───────────────────────────

describe('routeToPlugin', () => {
  const router = new DispatchRouter();
  const pluginIndex = new PluginIndex();

  it('returns matching plugins for codegen classification', () => {
    // Arrange
    const classification: TaskClassification = {
      taskType: 'codegen',
      complexity: 'moderate',
      keywords: ['write', 'code'],
      confidence: 0.7,
    };

    // Act
    const recommendations = router.routeToPlugin(classification, pluginIndex);

    // Assert
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.length).toBeLessThanOrEqual(3);

    // All recommendations should be from codegen category
    for (const rec of recommendations) {
      expect(rec.pluginName).toBeTruthy();
      expect(rec.description.length).toBeGreaterThan(0);
      expect(rec.homepage.startsWith('https://')).toBe(true);
      expect(rec.matchScore).toBeGreaterThan(0);
      expect(rec.matchReason.length).toBeGreaterThan(0);
    }
  });

  it('returns security plugins for security classification', () => {
    const classification: TaskClassification = {
      taskType: 'security',
      complexity: 'moderate',
      keywords: ['scan', 'vulnerability'],
      confidence: 0.6,
    };

    const recommendations = router.routeToPlugin(classification, pluginIndex);

    expect(recommendations.length).toBeGreaterThan(0);

    const pluginNames = recommendations.map((r) => r.pluginName);
    const hasSecurityPlugin = pluginNames.some((name) =>
      ['aikido-security', 'ai-guard', 'railguard'].includes(name),
    );
    expect(hasSecurityPlugin).toBe(true);
  });
});

// ── test_plugin_index_search ────────────────────────────────

describe('PluginIndex.search', () => {
  const pluginIndex = new PluginIndex();

  it('returns ranked results for keyword search', () => {
    // Act
    const results = pluginIndex.search(['debug', 'trace']);

    // Assert
    expect(results.length).toBeGreaterThan(0);

    // First result should be the most relevant debugging plugin
    const firstResult = results[0]!;
    expect(firstResult.category).toBe('debugging');
  });

  it('filters by category when provided', () => {
    const results = pluginIndex.search(['test'], 'testing');

    expect(results.length).toBeGreaterThan(0);
    for (const entry of results) {
      expect(entry.category).toBe('testing');
    }
  });

  it('returns empty array for no matches', () => {
    const results = pluginIndex.search(['xyznonexistent']);

    expect(results.length).toBe(0);
  });

  it('getByName returns a known plugin', () => {
    const entry = pluginIndex.getByName('duckdb-skills');

    expect(entry).toBeDefined();
    expect(entry!.name).toBe('duckdb-skills');
    expect(entry!.category).toBe('data');
  });

  it('getByName returns undefined for unknown plugin', () => {
    const entry = pluginIndex.getByName('nonexistent-plugin');

    expect(entry).toBeUndefined();
  });

  it('size returns the correct count', () => {
    expect(pluginIndex.size()).toBe(20);
  });
});

// ── test_plugin_index_categories ────────────────────────────

describe('PluginIndex.getCategories', () => {
  const pluginIndex = new PluginIndex();

  it('returns unique sorted categories', () => {
    // Act
    const categories = pluginIndex.getCategories();

    // Assert
    expect(categories.length).toBeGreaterThan(0);

    // Check uniqueness
    const unique = new Set(categories);
    expect(unique.size).toBe(categories.length);

    // Check sorted
    const sorted = [...categories].sort();
    expect(categories).toEqual(sorted);

    // Verify expected categories are present
    expect(categories).toContain('codegen');
    expect(categories).toContain('security');
    expect(categories).toContain('testing');
    expect(categories).toContain('debugging');
    expect(categories).toContain('data');
    expect(categories).toContain('devops');
    expect(categories).toContain('memory');
    expect(categories).toContain('workflow');
  });
});

// ── test_routing_decision_logged ────────────────────────────

describe('logDecision', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('logs a routing decision with all fields to JSONL', () => {
    // Arrange
    const logPath = join(tmpDir, 'decisions.jsonl');
    const router = new DispatchRouter(logPath);
    const pluginIndex = new PluginIndex();

    const event = makeEvent('Write a function that sorts an array.');
    const classification = router.classifyEvent(event);
    const agentRecommendation = router.routeToAgent(classification);
    const pluginRecommendations = router.routeToPlugin(classification, pluginIndex);

    const decision: RoutingDecision = {
      event,
      classification,
      agentRecommendation,
      pluginRecommendations,
      timestamp: new Date().toISOString(),
    };

    // Act
    router.logDecision(decision);

    // Assert
    const raw = readFileSync(logPath, 'utf-8').trim();
    const lines = raw.split('\n');
    expect(lines.length).toBe(1);

    const parsed: unknown = JSON.parse(lines[0]!);
    const logged = parsed as Record<string, unknown>;

    expect(logged['timestamp']).toBeTruthy();
    expect(logged['taskType']).toBe('codegen');
    expect(logged['agentId']).toBe('agent-codegen');
    expect(typeof logged['confidence']).toBe('number');
    expect(typeof logged['pluginCount']).toBe('number');
    expect(logged['source']).toBe('test-user');
    expect(typeof logged['contentPreview']).toBe('string');
  });

  it('appends multiple decisions to the same log file', () => {
    const logPath = join(tmpDir, 'multi.jsonl');
    const router = new DispatchRouter(logPath);
    const pluginIndex = new PluginIndex();

    for (const content of ['Write code.', 'Compare X vs Y.', 'Scan for vulnerabilities.']) {
      const event = makeEvent(content);
      const classification = router.classifyEvent(event);
      const agentRec = router.routeToAgent(classification);
      const pluginRecs = router.routeToPlugin(classification, pluginIndex);

      router.logDecision({
        event,
        classification,
        agentRecommendation: agentRec,
        pluginRecommendations: pluginRecs,
        timestamp: new Date().toISOString(),
      });
    }

    const raw = readFileSync(logPath, 'utf-8').trim();
    const lines = raw.split('\n');
    expect(lines.length).toBe(3);
  });

  it('silently skips logging when no log path is configured', () => {
    // Arrange — no log path
    const router = new DispatchRouter();
    const event = makeEvent('Write a function.');
    const classification = router.classifyEvent(event);
    const agentRec = router.routeToAgent(classification);

    const decision: RoutingDecision = {
      event,
      classification,
      agentRecommendation: agentRec,
      pluginRecommendations: [],
      timestamp: new Date().toISOString(),
    };

    // Act + Assert — should not throw
    expect(() => router.logDecision(decision)).not.toThrow();
  });
});
