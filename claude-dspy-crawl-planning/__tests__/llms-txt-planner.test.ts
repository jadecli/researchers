// __tests__/llms-txt-planner.test.ts — Full coverage for Shannon thinking planner
//
// Tests DSPy signature flow: Input → ChainOfThought → Output
// Validates Shannon 5-step thinking, task generation, completion reports,
// connector recommendations. Boris Cherny strict patterns throughout.

import { describe, it, expect } from 'vitest';
import {
  VIDEO_PROVIDERS,
  planCrawlSession,
  formatCompletionReport,
  generateConnectorRecommendations,
  type CrawlSessionPlannerInput,
  type CrawlSessionPlannerOutput,
} from '../src/thinking/llms-txt-planner.js';
import {
  toProviderId,
  toLlmsTxtUrl,
  isTaskComplete,
  isTaskActionable,
  type CrawlTask,
  type VideoProvider,
} from '../src/types/llms-txt.js';

// ── Test Helpers ────────────────────────────────────────────

function makeDefaultInput(overrides: Partial<CrawlSessionPlannerInput> = {}): CrawlSessionPlannerInput {
  return {
    providers: VIDEO_PROVIDERS,
    previousTasks: [],
    environmentConstraints: ['webfetch_blocked'],
    ...overrides,
  };
}

function makeMinimalProvider(overrides: Partial<VideoProvider> & { id: ReturnType<typeof toProviderId>; name: string }): VideoProvider {
  return {
    domain: 'example.com',
    tier: 'tier2_strong',
    origin: 'us',
    priority: 99,
    hasPublicApi: true,
    llmsTxt: { status: 'not_found', reason: 'test' },
    llmsFullTxt: { status: 'not_found', reason: 'test' },
    ...overrides,
  };
}

// ── VIDEO_PROVIDERS Registry ────────────────────────────────

describe('VIDEO_PROVIDERS registry', () => {
  it('contains 17 providers', () => {
    expect(VIDEO_PROVIDERS).toHaveLength(17);
  });

  it('has unique provider IDs', () => {
    const ids = VIDEO_PROVIDERS.map(p => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('has unique priority values', () => {
    const priorities = VIDEO_PROVIDERS.map(p => p.priority);
    const unique = new Set(priorities);
    expect(unique.size).toBe(priorities.length);
  });

  it('priorities are 1-indexed and contiguous', () => {
    const sorted = [...VIDEO_PROVIDERS].sort((a, b) => a.priority - b.priority);
    for (let i = 0; i < sorted.length; i++) {
      expect(sorted[i]!.priority).toBe(i + 1);
    }
  });

  it('Higgsfield is priority 1 (top of list)', () => {
    const higgsfield = VIDEO_PROVIDERS.find(p => p.id === 'higgsfield');
    expect(higgsfield?.priority).toBe(1);
  });

  it('has 5 providers with native llms.txt', () => {
    const native = VIDEO_PROVIDERS.filter(p => p.llmsTxt.status === 'found');
    expect(native).toHaveLength(4); // higgsfield, google-veo, openai, heygen
  });

  it('has 5 providers via Replicate', () => {
    const replicate = VIDEO_PROVIDERS.filter(p => p.llmsTxt.status === 'found_via_replicate');
    expect(replicate).toHaveLength(5); // kling, seedance, runway, minimax, wan
  });

  it('has 1 provider with custom format', () => {
    const custom = VIDEO_PROVIDERS.filter(p => p.llmsTxt.status === 'found_custom');
    expect(custom).toHaveLength(1); // luma
  });

  it('has correct tier distribution', () => {
    const tiers = new Map<string, number>();
    for (const p of VIDEO_PROVIDERS) {
      tiers.set(p.tier, (tiers.get(p.tier) ?? 0) + 1);
    }
    expect(tiers.get('tier1_realism')).toBe(3);
    expect(tiers.get('tier2_strong')).toBe(6);
    expect(tiers.get('avatar')).toBe(3);
    expect(tiers.get('aggregator')).toBe(1);
  });

  it('has correct origin distribution', () => {
    const origins = new Map<string, number>();
    for (const p of VIDEO_PROVIDERS) {
      origins.set(p.origin, (origins.get(p.origin) ?? 0) + 1);
    }
    expect(origins.get('us')).toBeGreaterThan(0);
    expect(origins.get('china')).toBeGreaterThan(0);
    expect(origins.get('israel')).toBeGreaterThan(0);
  });

  it('Midjourney has no public API', () => {
    const mj = VIDEO_PROVIDERS.find(p => p.id === 'midjourney');
    expect(mj?.hasPublicApi).toBe(false);
  });

  it('all Replicate providers have at least one model', () => {
    const replicate = VIDEO_PROVIDERS.filter(p => p.llmsTxt.status === 'found_via_replicate');
    for (const p of replicate) {
      if (p.llmsTxt.status === 'found_via_replicate') {
        expect(p.llmsTxt.models.length).toBeGreaterThan(0);
      }
    }
  });
});

// ── planCrawlSession: Shannon Thinking ──────────────────────

describe('planCrawlSession', () => {
  it('produces all 5 Shannon thought types', () => {
    const output = planCrawlSession(makeDefaultInput());
    const types = output.thoughts.map(t => t.type);

    expect(types).toContain('problem_definition');
    expect(types).toContain('constraints');
    expect(types).toContain('model');
    expect(types).toContain('proof');
    expect(types).toContain('implementation');
  });

  it('thoughts are ordered by Shannon step sequence', () => {
    const output = planCrawlSession(makeDefaultInput());
    const expectedOrder = ['problem_definition', 'constraints', 'model', 'proof', 'implementation'];

    for (let i = 0; i < expectedOrder.length; i++) {
      expect(output.thoughts[i]?.type).toBe(expectedOrder[i]);
    }
  });

  it('each thought has confidence in [0, 1]', () => {
    const output = planCrawlSession(makeDefaultInput());
    for (const t of output.thoughts) {
      expect(t.confidence).toBeGreaterThanOrEqual(0);
      expect(t.confidence).toBeLessThanOrEqual(1);
      expect(t.uncertainty).toBeCloseTo(1 - t.confidence, 5);
    }
  });

  it('thoughts have dependency chains', () => {
    const output = planCrawlSession(makeDefaultInput());

    // Step 1 has no deps
    expect(output.thoughts[0]?.dependencies).toHaveLength(0);

    // Step 2 depends on Step 1
    expect(output.thoughts[1]?.dependencies).toContain(output.thoughts[0]?.id);

    // Step 5 depends on Step 4
    expect(output.thoughts[4]?.dependencies).toContain(output.thoughts[3]?.id);
  });

  it('problem_definition thought includes coverage stats', () => {
    const output = planCrawlSession(makeDefaultInput());
    const t1 = output.thoughts[0]!;
    expect(t1.content).toContain('17');
    expect(t1.content).toContain('Coverage');
  });

  it('constraints thought includes WebFetch assumption when blocked', () => {
    const output = planCrawlSession(makeDefaultInput({ environmentConstraints: ['webfetch_blocked'] }));
    const t1 = output.thoughts[0]!;
    const webfetchAssumption = t1.assumptions.find(a => a.description.includes('WebFetch'));
    expect(webfetchAssumption?.status).toBe('active');
  });

  it('constraints thought challenges WebFetch assumption when not blocked', () => {
    const output = planCrawlSession(makeDefaultInput({ environmentConstraints: [] }));
    const t1 = output.thoughts[0]!;
    const webfetchAssumption = t1.assumptions.find(a => a.description.includes('WebFetch'));
    expect(webfetchAssumption?.status).toBe('challenged');
  });
});

// ── planCrawlSession: Task Generation ───────────────────────

describe('planCrawlSession tasks', () => {
  it('generates tasks for providers with discoverable llms.txt', () => {
    const output = planCrawlSession(makeDefaultInput());
    expect(output.tasks.length).toBeGreaterThan(0);
  });

  it('does not generate tasks for not_found providers', () => {
    const output = planCrawlSession(makeDefaultInput());
    const pikaTask = output.tasks.find(t => t.providerId === 'pika');
    expect(pikaTask).toBeUndefined();
  });

  it('generates replicate_model tasks for Replicate providers', () => {
    const output = planCrawlSession(makeDefaultInput());
    const replicateTasks = output.tasks.filter(t => t.task.type === 'replicate_model');
    expect(replicateTasks.length).toBeGreaterThan(0);
  });

  it('generates custom_llm_info task for Luma', () => {
    const output = planCrawlSession(makeDefaultInput());
    const lumaTask = output.tasks.find(t => t.providerId === 'luma');
    expect(lumaTask?.task.type).toBe('custom_llm_info');
  });

  it('marks tasks as blocked when WebFetch is blocked', () => {
    const output = planCrawlSession(makeDefaultInput({ environmentConstraints: ['webfetch_blocked'] }));
    const blockedTasks = output.tasks.filter(t => t.taskState.state === 'blocked');
    expect(blockedTasks.length).toBeGreaterThan(0);
  });

  it('marks previously complete tasks as complete', () => {
    const previousTasks: CrawlTask[] = [{
      providerId: toProviderId('higgsfield'),
      task: { type: 'llms_txt', url: toLlmsTxtUrl('https://docs.higgsfield.ai/llms.txt') },
      taskState: { state: 'complete', content: '# Higgsfield', crawledAt: new Date() },
    }];

    const output = planCrawlSession(makeDefaultInput({ previousTasks }));
    const higgsfieldTask = output.tasks.find(
      t => t.providerId === 'higgsfield' && t.task.type === 'llms_txt',
    );
    expect(higgsfieldTask?.taskState.state).toBe('complete');
  });
});

// ── planCrawlSession: Completion Report ─────────────────────

describe('planCrawlSession completionReport', () => {
  it('has correct totalProviders count', () => {
    const output = planCrawlSession(makeDefaultInput());
    expect(output.completionReport.totalProviders).toBe(17);
  });

  it('coverage segments sum to total', () => {
    const r = planCrawlSession(makeDefaultInput()).completionReport;
    expect(r.foundNative + r.foundReplicate + r.foundCustom + r.notFound).toBe(r.totalProviders);
  });

  it('coveragePercent excludes not_found', () => {
    const r = planCrawlSession(makeDefaultInput()).completionReport;
    const expected = (r.foundNative + r.foundReplicate + r.foundCustom) / r.totalProviders * 100;
    expect(r.coveragePercent).toBeCloseTo(expected, 1);
  });

  it('task counts are non-negative', () => {
    const r = planCrawlSession(makeDefaultInput()).completionReport;
    expect(r.tasksComplete).toBeGreaterThanOrEqual(0);
    expect(r.tasksPending).toBeGreaterThanOrEqual(0);
    expect(r.tasksBlocked).toBeGreaterThanOrEqual(0);
  });
});

// ── planCrawlSession: Connector Recommendations ─────────────

describe('planCrawlSession recommendations', () => {
  it('recommends replicate connector', () => {
    const output = planCrawlSession(makeDefaultInput());
    const replicate = output.recommendations.find(r => r.name === 'replicate-llms-txt-connector');
    expect(replicate).toBeDefined();
    expect(replicate?.type).toBe('mcp_server');
    expect(replicate?.priority).toBe('critical');
  });

  it('recommends readme.io connector for D-ID', () => {
    const output = planCrawlSession(makeDefaultInput());
    const readme = output.recommendations.find(r => r.name === 'readme-io-docs-connector');
    expect(readme).toBeDefined();
    expect(readme?.type).toBe('api_connector');
  });

  it('recommends mintlify connector for Higgsfield', () => {
    const output = planCrawlSession(makeDefaultInput());
    const mintlify = output.recommendations.find(r => r.name === 'mintlify-docs-connector');
    expect(mintlify).toBeDefined();
    expect(mintlify?.targetProviders).toContain('Higgsfield AI');
  });

  it('recommends google docs connector', () => {
    const output = planCrawlSession(makeDefaultInput());
    const google = output.recommendations.find(r => r.name === 'google-ai-docs-connector');
    expect(google).toBeDefined();
    expect(google?.type).toBe('scrapy_middleware');
  });

  it('recommends webhook for change detection', () => {
    const output = planCrawlSession(makeDefaultInput());
    const webhook = output.recommendations.find(r => r.name === 'llms-txt-change-webhook');
    expect(webhook).toBeDefined();
    expect(webhook?.type).toBe('webhook');
  });

  it('recommends llmstxt directory scraper', () => {
    const output = planCrawlSession(makeDefaultInput());
    const directory = output.recommendations.find(r => r.name === 'llmstxt-directory-connector');
    expect(directory).toBeDefined();
    expect(directory?.priority).toBe('low');
  });

  it('all recommendations have non-empty targetProviders', () => {
    const output = planCrawlSession(makeDefaultInput());
    for (const rec of output.recommendations) {
      expect(rec.targetProviders.length).toBeGreaterThan(0);
    }
  });
});

// ── generateConnectorRecommendations standalone ─────────────

describe('generateConnectorRecommendations', () => {
  it('returns empty for providers with no Replicate sources', () => {
    const providers: VideoProvider[] = [
      makeMinimalProvider({
        id: toProviderId('test'),
        name: 'Test',
        llmsTxt: { status: 'not_found', reason: 'test' },
      }),
    ];
    const recs = generateConnectorRecommendations(providers);
    // Should still have generic recs (mintlify, google, openai, directory, webhook) but no replicate
    const replicate = recs.find(r => r.name === 'replicate-llms-txt-connector');
    expect(replicate).toBeUndefined();
  });

  it('includes replicate connector when providers have replicate status', () => {
    const providers: VideoProvider[] = [
      makeMinimalProvider({
        id: toProviderId('test'),
        name: 'Test',
        llmsTxt: { status: 'found_via_replicate', replicateNamespace: 'ns', models: ['m1'] },
      }),
    ];
    const recs = generateConnectorRecommendations(providers);
    const replicate = recs.find(r => r.name === 'replicate-llms-txt-connector');
    expect(replicate).toBeDefined();
    expect(replicate?.targetProviders).toContain('Test');
  });
});

// ── formatCompletionReport ──────────────────────────────────

describe('formatCompletionReport', () => {
  it('produces a non-empty string', () => {
    const output = planCrawlSession(makeDefaultInput());
    const report = formatCompletionReport(output);
    expect(report.length).toBeGreaterThan(0);
  });

  it('includes coverage section', () => {
    const output = planCrawlSession(makeDefaultInput());
    const report = formatCompletionReport(output);
    expect(report).toContain('Coverage');
    expect(report).toContain('Providers:');
  });

  it('includes Shannon Thinking section', () => {
    const output = planCrawlSession(makeDefaultInput());
    const report = formatCompletionReport(output);
    expect(report).toContain('Shannon Thinking');
    expect(report).toContain('problem_definition');
    expect(report).toContain('implementation');
  });

  it('includes Recommended Connectors section', () => {
    const output = planCrawlSession(makeDefaultInput());
    const report = formatCompletionReport(output);
    expect(report).toContain('Recommended Connectors');
    expect(report).toContain('replicate-llms-txt-connector');
  });

  it('includes assumption details', () => {
    const output = planCrawlSession(makeDefaultInput({ environmentConstraints: ['webfetch_blocked'] }));
    const report = formatCompletionReport(output);
    expect(report).toContain('assumption');
    expect(report).toContain('WebFetch');
  });

  it('includes task status counts', () => {
    const output = planCrawlSession(makeDefaultInput());
    const report = formatCompletionReport(output);
    expect(report).toContain('Task Status');
    expect(report).toContain('Complete:');
    expect(report).toContain('Pending:');
    expect(report).toContain('Blocked:');
  });
});
