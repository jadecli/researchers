// tests/cowork.test.ts — Task routing, plugin recommendation, knowledge synthesis tests
import { describe, it, expect } from 'vitest';
import { CoworkTaskRouter, COWORK_DOMAINS } from '../src/cowork/task-router.js';
import { PluginRecommender } from '../src/cowork/plugin-recommender.js';
import { KnowledgeSynthesizer } from '../src/cowork/knowledge-synthesizer.js';
import type { ExtractionResult } from '../src/models/extraction-result.js';
import { computeQualityScore } from '../src/models/extraction-result.js';
import { toUrl, toSpiderName } from '../src/types.js';

// ── CoworkTaskRouter ────────────────────────────────────────────
describe('CoworkTaskRouter', () => {
  const router = new CoworkTaskRouter();

  it('has 10 domains', () => {
    expect(COWORK_DOMAINS.length).toBe(10);
  });

  it('routes code task to engineering', () => {
    const result = router.route('Fix a bug in the code and deploy');
    expect(result.domain).toBe('engineering');
    expect(result.matchedKeywords.length).toBeGreaterThan(0);
  });

  it('routes SQL task to data', () => {
    const result = router.route('Write a SQL query for the analytics dashboard');
    expect(result.domain).toBe('data');
  });

  it('routes contract task to legal', () => {
    const result = router.route('Review the NDA contract for compliance');
    expect(result.domain).toBe('legal');
  });

  it('routes SEO task to marketing', () => {
    const result = router.route('Optimize SEO content for the campaign');
    expect(result.domain).toBe('marketing');
  });

  it('routes ticket task to support', () => {
    const result = router.route('Resolve the customer support ticket');
    expect(result.domain).toBe('support');
  });

  it('returns top-k results', () => {
    const results = router.routeMulti('Build a data pipeline with code', 3);
    expect(results.length).toBe(3);
  });

  it('includes suggested plugins', () => {
    const result = router.route('Review the code architecture');
    expect(result.suggestedPlugins.length).toBeGreaterThan(0);
  });

  it('includes confidence scores', () => {
    const result = router.route('Deploy the docker kubernetes cluster');
    expect(result.confidence as number).toBeGreaterThan(0);
    expect(result.confidence as number).toBeLessThanOrEqual(1);
  });
});

// ── PluginRecommender ───────────────────────────────────────────
describe('PluginRecommender', () => {
  const recommender = new PluginRecommender();

  it('recommends plugins for engineering task', () => {
    const result = recommender.recommend('Review the code for bugs');
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.topDomain).toBe('engineering');
  });

  it('recommends data plugins for analytics task', () => {
    const result = recommender.recommend(
      'Build a SQL analytics dashboard with charts',
    );
    expect(result.recommendations.some((r) => r.domain === 'data')).toBe(true);
  });

  it('limits recommendations by topK', () => {
    const result = recommender.recommend('Do something', 2);
    expect(result.recommendations.length).toBeLessThanOrEqual(2);
  });

  it('includes relevance scores', () => {
    const result = recommender.recommend('Deploy code to production');
    for (const rec of result.recommendations) {
      expect(rec.relevanceScore as number).toBeGreaterThanOrEqual(0);
      expect(rec.relevanceScore as number).toBeLessThanOrEqual(1);
    }
  });

  it('includes reasons', () => {
    const result = recommender.recommend('Write a contract');
    for (const rec of result.recommendations) {
      expect(rec.reason).toBeTruthy();
    }
  });
});

// ── KnowledgeSynthesizer ────────────────────────────────────────
describe('KnowledgeSynthesizer', () => {
  const synthesizer = new KnowledgeSynthesizer();

  function makeResult(
    pageType: string,
    quality: number,
    content = 'test content',
  ): ExtractionResult {
    return {
      url: toUrl('https://example.com'),
      spiderName: toSpiderName('test'),
      pageType: pageType as any,
      title: 'Test',
      content,
      structuredData: {},
      links: [],
      selectorsUsed: [],
      quality: computeQualityScore(quality, quality, quality),
      rawHtmlSnippet: undefined,
      extractedAt: new Date(),
      metadata: {},
    };
  }

  it('handles empty results', () => {
    const synthesis = synthesizer.synthesize([]);
    expect(synthesis.statistics.totalResults).toBe(0);
    expect(synthesis.statistics.averageQuality).toBe(0);
  });

  it('groups by page type', () => {
    const results = [
      makeResult('doc', 0.8),
      makeResult('api', 0.7),
      makeResult('doc', 0.9),
    ];
    const synthesis = synthesizer.synthesize(results);
    expect(synthesis.byPageType['doc']!.length).toBe(2);
    expect(synthesis.byPageType['api']!.length).toBe(1);
  });

  it('groups by quality tier', () => {
    const results = [
      makeResult('doc', 0.9), // high
      makeResult('doc', 0.6), // medium
      makeResult('doc', 0.3), // low
    ];
    const synthesis = synthesizer.synthesize(results);
    expect(synthesis.byQualityTier.high.length).toBe(1);
    expect(synthesis.byQualityTier.medium.length).toBe(1);
    expect(synthesis.byQualityTier.low.length).toBe(1);
  });

  it('computes correct statistics', () => {
    const results = [makeResult('doc', 0.8), makeResult('api', 0.6)];
    const synthesis = synthesizer.synthesize(results);
    expect(synthesis.statistics.totalResults).toBe(2);
    expect(synthesis.statistics.averageQuality).toBeCloseTo(0.7, 1);
    expect(synthesis.statistics.uniquePageTypes).toBe(2);
  });

  it('extracts API endpoints from content', () => {
    const result = makeResult('api', 0.8, 'Use GET /api/v1/users to list users');
    const synthesis = synthesizer.synthesize([result]);
    expect(synthesis.apiEndpoints).toContain('/api/v1/users');
  });

  it('generates summaries for quality >= 0.5', () => {
    const results = [makeResult('doc', 0.8), makeResult('doc', 0.3)];
    const synthesis = synthesizer.synthesize(results);
    expect(synthesis.summaries.length).toBe(1);
  });

  it('finds common selector patterns', () => {
    const r1: ExtractionResult = {
      ...makeResult('doc', 0.8),
      selectorsUsed: ['.main', '.content'],
    };
    const r2: ExtractionResult = {
      ...makeResult('doc', 0.7),
      selectorsUsed: ['.main', '.sidebar'],
    };
    const synthesis = synthesizer.synthesize([r1, r2]);
    expect(synthesis.commonPatterns).toContain('.main');
  });
});
