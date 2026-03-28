// __tests__/llms-txt-types.test.ts — Full coverage for llms-txt branded types
//
// Boris Cherny patterns: branded type safety, discriminated union exhaustiveness,
// Result<T,E> flow, readonly enforcement. Arrange-Act-Assert throughout.

import { describe, it, expect } from 'vitest';
import {
  toProviderId,
  toLlmsTxtUrl,
  statusLabel,
  isTaskComplete,
  isTaskActionable,
  validateLlmsTxtContent,
  type LlmsTxtStatus,
  type CrawlTask,
  type CrawlTaskState,
  type VideoProvider,
  type ProviderId,
  type FactLlmsTxtCrawl,
  type DimProvider,
} from '../src/types/llms-txt.js';

// ── Branded Type Tests ──────────────────────────────────────

describe('Branded types', () => {
  it('creates a ProviderId from string', () => {
    const id = toProviderId('kling');
    expect(id).toBe('kling');
    // Type-level: id is ProviderId, not assignable to LlmsTxtUrl
  });

  it('creates a LlmsTxtUrl from string', () => {
    const url = toLlmsTxtUrl('https://docs.higgsfield.ai/llms.txt');
    expect(url).toBe('https://docs.higgsfield.ai/llms.txt');
  });

  it('preserves string operations on branded types', () => {
    const id = toProviderId('google-veo');
    expect(id.includes('google')).toBe(true);
    expect(id.toUpperCase()).toBe('GOOGLE-VEO');
  });
});

// ── LlmsTxtStatus Discriminated Union ───────────────────────

describe('statusLabel', () => {
  it('returns FOUND for native llms.txt', () => {
    const status: LlmsTxtStatus = {
      status: 'found',
      url: toLlmsTxtUrl('https://docs.higgsfield.ai/llms.txt'),
      content: '# Higgsfield',
    };
    expect(statusLabel(status)).toBe('FOUND');
  });

  it('returns PARTIAL (Replicate) for replicate sources', () => {
    const status: LlmsTxtStatus = {
      status: 'found_via_replicate',
      replicateNamespace: 'kwaivgi',
      models: ['kling-v3-video'],
    };
    expect(statusLabel(status)).toBe('PARTIAL (Replicate)');
  });

  it('returns PARTIAL (Custom) for custom format', () => {
    const status: LlmsTxtStatus = {
      status: 'found_custom',
      url: toLlmsTxtUrl('https://lumalabs.ai/llm-info'),
      format: 'HTML info page',
    };
    expect(statusLabel(status)).toBe('PARTIAL (Custom)');
  });

  it('returns NOT FOUND for missing files', () => {
    const status: LlmsTxtStatus = {
      status: 'not_found',
      reason: 'No public API',
    };
    expect(statusLabel(status)).toBe('NOT FOUND');
  });

  it('includes optional docsUrl in not_found status', () => {
    const status: LlmsTxtStatus = {
      status: 'not_found',
      docsUrl: 'https://docs.d-id.com/',
      reason: 'No llms.txt',
    };
    expect(statusLabel(status)).toBe('NOT FOUND');
    expect(status.docsUrl).toBe('https://docs.d-id.com/');
  });
});

// ── CrawlTaskState Discriminated Union ──────────────────────

describe('isTaskComplete', () => {
  it('returns true for complete tasks', () => {
    const task: CrawlTask = {
      providerId: toProviderId('higgsfield'),
      task: { type: 'llms_txt', url: toLlmsTxtUrl('https://example.com/llms.txt') },
      taskState: { state: 'complete', content: '# Doc', crawledAt: new Date() },
    };
    expect(isTaskComplete(task)).toBe(true);
  });

  it('returns false for pending tasks', () => {
    const task: CrawlTask = {
      providerId: toProviderId('pika'),
      task: { type: 'llms_txt', url: toLlmsTxtUrl('https://pika.art/llms.txt') },
      taskState: { state: 'pending' },
    };
    expect(isTaskComplete(task)).toBe(false);
  });

  it('returns false for failed tasks', () => {
    const task: CrawlTask = {
      providerId: toProviderId('kling'),
      task: { type: 'replicate_model', namespace: 'kwaivgi', model: 'kling-v3-video' },
      taskState: { state: 'failed', error: 'Network error', failedAt: new Date() },
    };
    expect(isTaskComplete(task)).toBe(false);
  });

  it('returns false for blocked tasks', () => {
    const task: CrawlTask = {
      providerId: toProviderId('openai'),
      task: { type: 'llms_full_txt', url: toLlmsTxtUrl('https://developers.openai.com/api/docs/llms-full.txt') },
      taskState: { state: 'blocked', reason: 'WebFetch blocked' },
    };
    expect(isTaskComplete(task)).toBe(false);
  });

  it('returns false for crawling tasks', () => {
    const task: CrawlTask = {
      providerId: toProviderId('heygen'),
      task: { type: 'llms_txt', url: toLlmsTxtUrl('https://docs.heygen.com/llms.txt') },
      taskState: { state: 'crawling', startedAt: new Date() },
    };
    expect(isTaskComplete(task)).toBe(false);
  });
});

describe('isTaskActionable', () => {
  it('pending tasks are actionable', () => {
    const task: CrawlTask = {
      providerId: toProviderId('higgsfield'),
      task: { type: 'llms_txt', url: toLlmsTxtUrl('https://example.com/llms.txt') },
      taskState: { state: 'pending' },
    };
    expect(isTaskActionable(task)).toBe(true);
  });

  it('failed tasks are actionable (can retry)', () => {
    const task: CrawlTask = {
      providerId: toProviderId('kling'),
      task: { type: 'replicate_model', namespace: 'kwaivgi', model: 'kling-v3' },
      taskState: { state: 'failed', error: 'Timeout', failedAt: new Date() },
    };
    expect(isTaskActionable(task)).toBe(true);
  });

  it('crawling tasks are not actionable', () => {
    const task: CrawlTask = {
      providerId: toProviderId('luma'),
      task: { type: 'custom_llm_info', url: toLlmsTxtUrl('https://lumalabs.ai/llm-info') },
      taskState: { state: 'crawling', startedAt: new Date() },
    };
    expect(isTaskActionable(task)).toBe(false);
  });

  it('complete tasks are not actionable', () => {
    const task: CrawlTask = {
      providerId: toProviderId('openai'),
      task: { type: 'llms_txt', url: toLlmsTxtUrl('https://developers.openai.com/api/docs/llms.txt') },
      taskState: { state: 'complete', content: '# OpenAI', crawledAt: new Date() },
    };
    expect(isTaskActionable(task)).toBe(false);
  });

  it('blocked tasks are not actionable', () => {
    const task: CrawlTask = {
      providerId: toProviderId('heygen'),
      task: { type: 'llms_txt', url: toLlmsTxtUrl('https://docs.heygen.com/llms.txt') },
      taskState: { state: 'blocked', reason: 'WebFetch blocked' },
    };
    expect(isTaskActionable(task)).toBe(false);
  });
});

// ── CrawlTaskType Discriminated Union ───────────────────────

describe('CrawlTaskType variants', () => {
  it('llms_txt task has url', () => {
    const task: CrawlTask = {
      providerId: toProviderId('higgsfield'),
      task: { type: 'llms_txt', url: toLlmsTxtUrl('https://docs.higgsfield.ai/llms.txt') },
      taskState: { state: 'pending' },
    };
    expect(task.task.type).toBe('llms_txt');
    expect(task.task.url).toContain('llms.txt');
  });

  it('llms_full_txt task has url', () => {
    const task: CrawlTask = {
      providerId: toProviderId('openai'),
      task: { type: 'llms_full_txt', url: toLlmsTxtUrl('https://developers.openai.com/api/docs/llms-full.txt') },
      taskState: { state: 'pending' },
    };
    expect(task.task.type).toBe('llms_full_txt');
  });

  it('replicate_model task has namespace and model', () => {
    const task: CrawlTask = {
      providerId: toProviderId('kling'),
      task: { type: 'replicate_model', namespace: 'kwaivgi', model: 'kling-v3-video' },
      taskState: { state: 'pending' },
    };
    expect(task.task.type).toBe('replicate_model');
    expect(task.task.namespace).toBe('kwaivgi');
    expect(task.task.model).toBe('kling-v3-video');
  });

  it('custom_llm_info task has url', () => {
    const task: CrawlTask = {
      providerId: toProviderId('luma'),
      task: { type: 'custom_llm_info', url: toLlmsTxtUrl('https://lumalabs.ai/llm-info') },
      taskState: { state: 'pending' },
    };
    expect(task.task.type).toBe('custom_llm_info');
  });
});

// ── Validation ──────────────────────────────────────────────

describe('validateLlmsTxtContent', () => {
  it('validates non-empty content with markdown and API refs', () => {
    const content = '# Higgsfield API\n- [Generate Video](https://docs.higgsfield.ai/guides/video.md)\n## SDK\nAuthentication via API key';
    const results = validateLlmsTxtContent(toProviderId('higgsfield'), content);

    expect(results).toHaveLength(4);
    expect(results.find(r => r.dimension === 'content_non_empty')?.passed).toBe(true);
    expect(results.find(r => r.dimension === 'has_markdown_structure')?.passed).toBe(true);
    expect(results.find(r => r.dimension === 'has_api_docs')?.passed).toBe(true);
    expect(results.find(r => r.dimension === 'has_model_info')?.passed).toBe(true);
  });

  it('fails all checks on empty content', () => {
    const results = validateLlmsTxtContent(toProviderId('pika'), '');

    expect(results.find(r => r.dimension === 'content_non_empty')?.passed).toBe(false);
    expect(results.find(r => r.dimension === 'has_markdown_structure')?.passed).toBe(false);
    expect(results.find(r => r.dimension === 'has_api_docs')?.passed).toBe(false);
    expect(results.find(r => r.dimension === 'has_model_info')?.passed).toBe(false);
  });

  it('detects markdown list items', () => {
    const content = '- Item one\n- Item two';
    const results = validateLlmsTxtContent(toProviderId('test'), content);
    expect(results.find(r => r.dimension === 'has_markdown_structure')?.passed).toBe(true);
  });

  it('detects markdown links', () => {
    const content = 'See [docs](https://example.com)';
    const results = validateLlmsTxtContent(toProviderId('test'), content);
    expect(results.find(r => r.dimension === 'has_markdown_structure')?.passed).toBe(true);
  });

  it('detects API-related keywords', () => {
    const content = 'Use the webhook endpoint for real-time updates';
    const results = validateLlmsTxtContent(toProviderId('test'), content);
    expect(results.find(r => r.dimension === 'has_api_docs')?.passed).toBe(true);
  });

  it('detects model/video keywords', () => {
    const content = 'Generate 1080p video at 60fps';
    const results = validateLlmsTxtContent(toProviderId('test'), content);
    expect(results.find(r => r.dimension === 'has_model_info')?.passed).toBe(true);
  });

  it('preserves providerId in all results', () => {
    const pid = toProviderId('kling');
    const results = validateLlmsTxtContent(pid, 'some content');
    for (const r of results) {
      expect(r.providerId).toBe(pid);
    }
  });
});

// ── Kimball Fact/Dimension Type Shape ───────────────────────

describe('Kimball schema types', () => {
  it('FactLlmsTxtCrawl has correct grain fields', () => {
    const fact: FactLlmsTxtCrawl = {
      provider_sk: 1,
      crawl_date_sk: 20260328,
      url: 'https://docs.higgsfield.ai/llms.txt',
      file_type: 'llms_txt',
      status: 'found',
      content_length: 1234,
      has_api_docs: true,
      has_model_info: true,
      response_code: 200,
      crawl_duration_ms: 450,
    };
    expect(fact.provider_sk).toBe(1);
    expect(fact.file_type).toBe('llms_txt');
    expect(fact.status).toBe('found');
  });

  it('FactLlmsTxtCrawl supports all file_type variants', () => {
    const types: FactLlmsTxtCrawl['file_type'][] = ['llms_txt', 'llms_full_txt', 'replicate_model', 'custom'];
    expect(types).toHaveLength(4);
  });

  it('FactLlmsTxtCrawl supports all status variants', () => {
    const statuses: FactLlmsTxtCrawl['status'][] = ['found', 'not_found', 'blocked', 'error'];
    expect(statuses).toHaveLength(4);
  });

  it('DimProvider has SCD Type 2 fields', () => {
    const dim: DimProvider = {
      provider_sk: 1,
      provider_id: toProviderId('higgsfield'),
      provider_name: 'Higgsfield AI',
      domain: 'higgsfield.ai',
      tier: 'aggregator',
      origin: 'us',
      has_public_api: true,
      effective_from: new Date('2024-01-01'),
      effective_to: null,
      is_current: true,
    };
    expect(dim.is_current).toBe(true);
    expect(dim.effective_to).toBeNull();
  });

  it('DimProvider supports all tier variants', () => {
    const tiers: DimProvider['tier'][] = [
      'tier1_realism', 'tier2_strong', 'tier3_budget', 'avatar', 'editing', 'aggregator',
    ];
    expect(tiers).toHaveLength(6);
  });

  it('DimProvider supports all origin variants', () => {
    const origins: DimProvider['origin'][] = ['us', 'china', 'israel', 'uk', 'open_source'];
    expect(origins).toHaveLength(5);
  });
});
