// tests/orchestrator.test.ts — Campaign, ImprovementChain, context injection tests
import { describe, it, expect } from 'vitest';
import { ImprovementChain } from '../src/orchestrator/improvement-chain.js';
import { injectContext } from '../src/orchestrator/context-injector.js';
import { CrawlCampaign } from '../src/orchestrator/campaign.js';
import type { CampaignState } from '../src/orchestrator/campaign.js';
import { createCrawlPlan, createCrawlTarget } from '../src/models/crawl-target.js';
import { toIteration, toQualityValue, assertNever } from '../src/types.js';
import type { ContextDelta } from '../src/models/extraction-result.js';

// ── ImprovementChain ────────────────────────────────────────────
describe('ImprovementChain', () => {
  it('starts empty', () => {
    const chain = new ImprovementChain();
    expect(chain.iterationCount).toBe(0);
    expect(chain.totalImprovement).toBe(0);
    expect(chain.shouldContinue()).toBe(true);
    expect(chain.getCumulativeDelta()).toBeUndefined();
  });

  it('accumulates iterations', () => {
    const chain = new ImprovementChain();
    chain.addIteration({
      iteration: toIteration(0),
      newPatterns: ['p1'],
      failingSelectors: ['s1'],
      qualityBefore: toQualityValue(0.5),
      qualityAfter: toQualityValue(0.7),
      steerDirection: 'improve',
      discoveredPageTypes: ['doc'],
    });
    expect(chain.iterationCount).toBe(1);
    expect(chain.totalImprovement).toBeCloseTo(0.2, 2);
  });

  it('computes cumulative delta', () => {
    const chain = new ImprovementChain();
    chain.addIteration({
      iteration: toIteration(0),
      newPatterns: ['p1'],
      failingSelectors: [],
      qualityBefore: toQualityValue(0.4),
      qualityAfter: toQualityValue(0.6),
      steerDirection: 'step1',
      discoveredPageTypes: ['doc'],
    });
    chain.addIteration({
      iteration: toIteration(1),
      newPatterns: ['p2'],
      failingSelectors: ['s1'],
      qualityBefore: toQualityValue(0.6),
      qualityAfter: toQualityValue(0.8),
      steerDirection: 'step2',
      discoveredPageTypes: ['api'],
    });

    const cumulative = chain.getCumulativeDelta()!;
    expect(cumulative.qualityBefore as number).toBe(0.4);
    expect(cumulative.qualityAfter as number).toBe(0.8);
    expect(cumulative.newPatterns).toContain('p1');
    expect(cumulative.newPatterns).toContain('p2');
    expect(cumulative.discoveredPageTypes).toContain('doc');
    expect(cumulative.discoveredPageTypes).toContain('api');
  });

  it('detects stagnation and stops', () => {
    const chain = new ImprovementChain({ maxStagnant: 2 });
    chain.addIteration({
      iteration: toIteration(0),
      newPatterns: [],
      failingSelectors: [],
      qualityBefore: toQualityValue(0.5),
      qualityAfter: toQualityValue(0.5),
      steerDirection: '',
      discoveredPageTypes: [],
    });
    expect(chain.shouldContinue()).toBe(true); // 1 stagnant, max 2

    chain.addIteration({
      iteration: toIteration(1),
      newPatterns: [],
      failingSelectors: [],
      qualityBefore: toQualityValue(0.5),
      qualityAfter: toQualityValue(0.5),
      steerDirection: '',
      discoveredPageTypes: [],
    });
    expect(chain.shouldContinue()).toBe(false); // 2 stagnant = stop
  });

  it('detects regression and stops', () => {
    const chain = new ImprovementChain({ regressionTolerance: 1 });
    chain.addIteration({
      iteration: toIteration(0),
      newPatterns: [],
      failingSelectors: [],
      qualityBefore: toQualityValue(0.7),
      qualityAfter: toQualityValue(0.5),
      steerDirection: '',
      discoveredPageTypes: [],
    });
    expect(chain.shouldContinue()).toBe(false);
  });

  it('continues when improving', () => {
    const chain = new ImprovementChain();
    chain.addIteration({
      iteration: toIteration(0),
      newPatterns: [],
      failingSelectors: [],
      qualityBefore: toQualityValue(0.3),
      qualityAfter: toQualityValue(0.5),
      steerDirection: '',
      discoveredPageTypes: [],
    });
    expect(chain.shouldContinue()).toBe(true);
  });

  it('tracks all discovered patterns', () => {
    const chain = new ImprovementChain();
    chain.addIteration({
      iteration: toIteration(0),
      newPatterns: ['b', 'a'],
      failingSelectors: [],
      qualityBefore: toQualityValue(0.5),
      qualityAfter: toQualityValue(0.6),
      steerDirection: '',
      discoveredPageTypes: [],
    });
    chain.addIteration({
      iteration: toIteration(1),
      newPatterns: ['c', 'a'],
      failingSelectors: [],
      qualityBefore: toQualityValue(0.6),
      qualityAfter: toQualityValue(0.7),
      steerDirection: '',
      discoveredPageTypes: [],
    });
    expect(chain.allDiscoveredPatterns).toEqual(['a', 'b', 'c']);
  });
});

// ── Context Injector ────────────────────────────────────────────
describe('injectContext', () => {
  it('generates initial iteration context', () => {
    const ctx = injectContext(0);
    expect(ctx).toContain('iteration 0');
    expect(ctx).toContain('initial crawl iteration');
  });

  it('includes target info', () => {
    const target = createCrawlTarget({
      url: 'https://example.com',
      spiderName: 'docs_spider',
      maxPages: 10,
    });
    const ctx = injectContext(0, undefined, target);
    expect(ctx).toContain('https://example.com');
    expect(ctx).toContain('docs_spider');
  });

  it('includes chain history', () => {
    const chain = new ImprovementChain();
    chain.addIteration({
      iteration: toIteration(0),
      newPatterns: ['pattern1'],
      failingSelectors: ['failing1'],
      qualityBefore: toQualityValue(0.3),
      qualityAfter: toQualityValue(0.5),
      steerDirection: 'go deeper',
      discoveredPageTypes: ['doc', 'api'],
    });
    chain.addIteration({
      iteration: toIteration(1),
      newPatterns: [],
      failingSelectors: [],
      qualityBefore: toQualityValue(0.5),
      qualityAfter: toQualityValue(0.7),
      steerDirection: 'maintain',
      discoveredPageTypes: [],
    });
    const ctx = injectContext(2, chain);
    expect(ctx).toContain('Quality Trajectory');
    expect(ctx).toContain('pattern1');
    expect(ctx).toContain('failing1');
    expect(ctx).toContain('Last Iteration Summary');
  });
});

// ── CampaignState (Discriminated Union) ─────────────────────────
describe('CampaignState', () => {
  it('handles all states exhaustively', () => {
    const states: CampaignState[] = [
      { status: 'planning' },
      { status: 'executing', iteration: 0 },
      { status: 'improving', patchCount: 3 },
      { status: 'complete', totalResults: 10, avgQuality: 0.8 },
      { status: 'failed', error: 'boom' },
    ];

    for (const state of states) {
      switch (state.status) {
        case 'planning':
          expect(state.status).toBe('planning');
          break;
        case 'executing':
          expect(state.iteration).toBe(0);
          break;
        case 'improving':
          expect(state.patchCount).toBe(3);
          break;
        case 'complete':
          expect(state.totalResults).toBe(10);
          break;
        case 'failed':
          expect(state.error).toBe('boom');
          break;
        default:
          assertNever(state);
      }
    }
  });
});

// ── CrawlCampaign ───────────────────────────────────────────────
describe('CrawlCampaign', () => {
  it('generates plan summary', () => {
    const plan = createCrawlPlan({
      targets: [
        { url: 'https://a.com', maxPages: 10, priority: 5 },
        { url: 'https://b.com', maxPages: 20, priority: 10 },
      ],
      totalBudgetUsd: 10,
      maxIterations: 5,
      qualityThreshold: 0.7,
    });
    const campaign = new CrawlCampaign(plan);
    const summary = campaign.planCampaign();

    expect(summary.targetCount).toBe(2);
    expect(summary.totalPages).toBe(30);
    expect(summary.budgetUsd).toBe(10);
    expect(summary.maxIterations).toBe(5);
    expect(summary.qualityThreshold).toBe(0.7);
    // Sorted by priority desc
    expect(summary.targets[0]!.priority).toBe(10);
  });

  it('starts in planning state', () => {
    const plan = createCrawlPlan({
      targets: [{ url: 'https://a.com' }],
    });
    const campaign = new CrawlCampaign(plan);
    expect(campaign.getState().status).toBe('planning');
  });
});
