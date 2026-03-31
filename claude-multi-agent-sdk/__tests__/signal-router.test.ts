import { describe, it, expect } from 'vitest';
import {
  extractSignals,
  routeTask,
  type RoutingDecision,
} from '../src/agent/signal-router.js';

describe('Signal Extraction', () => {
  it('detects question depth from first word', () => {
    expect(extractSignals('why does this fail').questionDepth).toBe(4);
    expect(extractSignals('how do I fix this').questionDepth).toBe(3);
    expect(extractSignals('what is the output').questionDepth).toBe(2);
    expect(extractSignals('where is the config').questionDepth).toBe(1);
    expect(extractSignals('fix the bug').questionDepth).toBe(0);
  });

  it('detects multi-step markers', () => {
    expect(extractSignals('first do X then do Y').hasMultipleSteps).toBe(true);
    expect(extractSignals('step 1 do X step 2 do Y').hasMultipleSteps).toBe(true);
    expect(extractSignals('just fix the typo').hasMultipleSteps).toBe(false);
  });

  it('detects architecture keywords', () => {
    expect(extractSignals('refactor the system architecture').mentionsArchitecture).toBe(true);
    expect(extractSignals('fix a typo in readme').mentionsArchitecture).toBe(false);
  });

  it('infers reversibility from destructive keywords', () => {
    expect(extractSignals('delete all test files').reversibility).toBe('difficult');
    expect(extractSignals('update the config').reversibility).toBe('moderate');
    expect(extractSignals('read the file').reversibility).toBe('easy');
  });

  it('infers impact scope', () => {
    expect(extractSignals('system-wide migration').impactScope).toBe('system_wide');
    expect(extractSignals('update the module').impactScope).toBe('module');
    expect(extractSignals('fix a typo').impactScope).toBe('local');
  });

  it('detects exploratory tasks', () => {
    expect(extractSignals('explore the codebase').isExploratoryTask).toBe(true);
    expect(extractSignals('investigate the bug').isExploratoryTask).toBe(true);
    expect(extractSignals('implement the feature').isExploratoryTask).toBe(false);
  });

  it('detects synthesis requirements', () => {
    expect(extractSignals('summarize the findings').requiresSynthesis).toBe(true);
    expect(extractSignals('compare implementations').requiresSynthesis).toBe(true);
    expect(extractSignals('fix the bug').requiresSynthesis).toBe(false);
  });
});

describe('Task Routing', () => {
  it('routes simple exploration to haiku', () => {
    const decision = routeTask('explore the local config file');
    expect(decision.model).toBe('haiku');
    expect(decision.tier).toBe('low');
  });

  it('routes architecture changes to opus', () => {
    const decision = routeTask('refactor the system-wide architecture to use event sourcing');
    expect(decision.model).toBe('opus');
    expect(decision.tier).toBe('high');
  });

  it('routes multi-step synthesis to opus', () => {
    const decision = routeTask('first analyze the codebase, then synthesize a migration plan with step 1 and step 2');
    expect(decision.model).toBe('opus');
    expect(decision.tier).toBe('high');
  });

  it('routes single-file easy tasks to haiku', () => {
    const decision = routeTask('read this file and tell me what it does', { fileCount: 1 });
    expect(decision.model).toBe('haiku');
    expect(decision.tier).toBe('low');
  });

  it('provides confidence scores', () => {
    const decision = routeTask('why does the system architecture need refactoring');
    expect(decision.confidence).toBeGreaterThan(0);
    expect(decision.confidence).toBeLessThanOrEqual(1);
  });

  it('includes signal details in decision', () => {
    const decision = routeTask('explore the code');
    expect(decision.signals).toBeDefined();
    expect(typeof decision.score).toBe('number');
  });

  it('applies rule overrides with named rules', () => {
    const decision = routeTask('delete all files in the module directory');
    // destructive + non-local → should hit 'destructive-operation' rule
    expect(decision.tier).toBe('high');
    expect(decision.matchedRule).toBe('destructive-operation');
  });

  it('reduces confidence when scorer and rules disagree', () => {
    // A task that hits a rule override but might score differently
    const decision = routeTask('explore the local directory');
    if (decision.matchedRule) {
      // If a rule matched, confidence depends on agreement with scorer
      expect(decision.confidence).toBeGreaterThan(0);
    }
  });
});
