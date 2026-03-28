// tests/pipeline.test.ts — Pipeline signatures, modules, and crawl adapter tests
import { describe, it, expect } from 'vitest';
import {
  PageClassifierInput,
  QualityScorerInput,
  SelectorProposerInput,
  PluginDesignerInput,
  CodegenRouterInput,
} from '../src/pipeline/signatures.js';
import { ResearchPipeline } from '../src/pipeline/pipeline.js';
import {
  convertPromptToCampaign,
  campaignToJson,
  VIDEO_AI_CRAWL_CAMPAIGN,
  SPIDER_TYPES,
  CRAWL_PRIORITIES,
  resultPassed,
} from '../src/pipeline/crawl-adapter.js';
import { toUrl, toSpiderName, toQualityValue } from '../src/types.js';
import type { ExtractionResult } from '../src/models/extraction-result.js';
import { EMPTY_QUALITY, computeQualityScore } from '../src/models/extraction-result.js';

// ── Zod Signature Schemas ───────────────────────────────────────
describe('Pipeline Signatures', () => {
  it('validates PageClassifier input', () => {
    const input = PageClassifierInput.parse({
      url: 'https://example.com',
      title: 'Test',
      contentSnippet: 'content here',
      htmlSnippet: '<div>html</div>',
    });
    expect(input.url).toBe('https://example.com');
  });

  it('validates QualityScorer input', () => {
    const input = QualityScorerInput.parse({
      url: 'https://example.com',
      extractedContent: 'content',
      structuredData: '{}',
      selectorsUsed: '.main',
      linkCount: 5,
    });
    expect(input.linkCount).toBe(5);
  });

  it('validates SelectorProposer input', () => {
    const input = SelectorProposerInput.parse({
      spiderName: 'docs_spider',
      currentSelectors: '.content',
      failingSelectors: '.old',
      htmlSample: '<div>sample</div>',
      pageType: 'doc',
    });
    expect(input.spiderName).toBe('docs_spider');
  });

  it('validates PluginDesigner input', () => {
    const input = PluginDesignerInput.parse({
      domain: 'engineering',
      crawledSummaries: 'summary1; summary2',
      discoveredPageTypes: 'doc, api',
      existingPlugins: 'code-review',
    });
    expect(input.domain).toBe('engineering');
  });

  it('validates CodegenRouter input', () => {
    const input = CodegenRouterInput.parse({
      taskDescription: 'Build an API',
      targetEnvironment: 'web',
      preferredLanguages: 'typescript',
      constraints: 'none',
    });
    expect(input.targetEnvironment).toBe('web');
  });
});

// ── ResearchPipeline ────────────────────────────────────────────
describe('ResearchPipeline', () => {
  const pipeline = new ResearchPipeline();

  it('classifies API pages', () => {
    const result = pipeline.classify(
      'https://api.example.com/v1',
      'API Reference',
      'API endpoint documentation',
    );
    expect(result.pageType).toBe('api');
    expect(result.confidence as number).toBeGreaterThan(0);
  });

  it('classifies doc pages by default', () => {
    const result = pipeline.classify(
      'https://example.com',
      'Guide',
      'How to use the system',
    );
    expect(result.pageType).toBe('doc');
  });

  it('classifies legal pages', () => {
    const result = pipeline.classify(
      'https://example.com/privacy',
      'Privacy Policy',
      'We handle your data according to GDPR privacy regulations',
    );
    expect(result.pageType).toBe('legal');
  });

  it('scores quality based on content', () => {
    const result: ExtractionResult = {
      url: toUrl('https://example.com'),
      spiderName: toSpiderName('test'),
      pageType: 'doc',
      title: 'Test',
      content: 'x'.repeat(5000),
      structuredData: { key: 'value' },
      links: Array.from({ length: 20 }, (_, i) => `https://link${i}.com`),
      selectorsUsed: ['.main'],
      quality: EMPTY_QUALITY,
      rawHtmlSnippet: undefined,
      extractedAt: new Date(),
      metadata: {},
    };
    const quality = pipeline.scoreQuality(result);
    expect(quality.overall as number).toBeGreaterThan(0.5);
  });

  it('proposes selectors for failing ones', () => {
    const patches = pipeline.proposeSelectors(
      'docs_spider',
      ['.main', '.content'],
      ['.old-selector'],
      '<div class="content">html</div>',
    );
    expect(patches.length).toBe(1);
    expect(patches[0]!.oldSelector).toBe('.old-selector');
  });

  it('designs plugin from domain', () => {
    const spec = pipeline.designPlugin('engineering', ['summary1', 'summary2']);
    expect(spec.name as string).toBe('engineering-plugin');
    expect(spec.skills.length).toBeGreaterThan(0);
  });

  it('routes codegen to language', () => {
    const route = pipeline.routeCodegen('Build a REST API', 'web');
    expect(route.primaryLanguage).toBeTruthy();
    expect(route.scaffoldType).toBe('web-api');
  });
});

// ── Crawl Adapter ───────────────────────────────────────────────
describe('Crawl Adapter', () => {
  it('has 4 spider types', () => {
    expect(SPIDER_TYPES.length).toBe(4);
  });

  it('has 4 crawl priorities', () => {
    expect(CRAWL_PRIORITIES.length).toBe(4);
  });

  it('converts prompt to campaign', () => {
    const campaign = convertPromptToCampaign({
      promptTitle: 'Test Campaign',
      keyTopics: ['topic1', 'topic2'],
      sourceUrls: [
        { url: 'https://code.claude.com/docs/llms.txt', priority: 'critical' },
        { url: 'https://example.com', priority: 'low' },
      ],
      focusAreas: ['area1'],
    });
    expect(campaign.targets.length).toBe(2);
    expect(campaign.targets[0]!.priority).toBe('critical');
    expect(campaign.targets[1]!.priority).toBe('low');
  });

  it('serializes campaign to JSON', () => {
    const campaign = convertPromptToCampaign({
      promptTitle: 'JSON Test',
      keyTopics: ['t1'],
      sourceUrls: [{ url: 'https://example.com' }],
      focusAreas: ['f1'],
    });
    const json = campaignToJson(campaign);
    const parsed = JSON.parse(json);
    expect(parsed.targets.length).toBe(1);
    expect(parsed.name).toBe('json-test');
  });

  it('detects passed results', () => {
    expect(
      resultPassed({
        target: {
          url: 'https://example.com',
          spider: 'docs_spider',
          priority: 'high',
          maxPages: 10,
          description: 'test',
          expectedContent: 'content',
          qualityThreshold: 0.6,
        },
        pagesCrawled: 5,
        avgQuality: 0.7,
        items: [],
        errors: [],
      }),
    ).toBe(true);
  });

  it('detects failed results', () => {
    expect(
      resultPassed({
        target: {
          url: 'https://example.com',
          spider: 'docs_spider',
          priority: 'high',
          maxPages: 10,
          description: 'test',
          expectedContent: 'content',
          qualityThreshold: 0.9,
        },
        pagesCrawled: 5,
        avgQuality: 0.5,
        items: [],
        errors: [],
      }),
    ).toBe(false);
  });

  it('has pre-built VIDEO_AI_CRAWL_CAMPAIGN', () => {
    expect(VIDEO_AI_CRAWL_CAMPAIGN.targets.length).toBe(4);
    expect(VIDEO_AI_CRAWL_CAMPAIGN.targets[0]!.priority).toBe('critical');
    expect(VIDEO_AI_CRAWL_CAMPAIGN.name).toContain('ai-video');
  });
});
