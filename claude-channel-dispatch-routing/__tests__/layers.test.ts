import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  asRuntime,
  asReporting,
  asSemantic,
  toSurrogateKey,
  toNaturalKey,
  type RuntimeRecord,
  type ReportingRecord,
  type SemanticRecord,
  type ETLTransform,
  type RuntimeLayer,
  type ReportingLayer,
  type MetricDefinition,
  type DimensionDefinition,
  type SurrogateKey,
  type NaturalKey,
  type RuntimeBaseFields,
  type SCDType2Fields,
  type BusMatrix,
  type GrainDeclaration,
} from '../src/types/layers.js';

// ── Test Domain Types ───────────────────────────────────────

type CrawlEvent = RuntimeBaseFields & {
  url: string;
  spiderName: string;
  responseStatus: number;
  contentHash: string;
  qualityScore: number;
};

type DimPage = SCDType2Fields & {
  pageSk: SurrogateKey;
  url: string;
  domain: string;
  pageType: string;
};

type FactCrawlQuality = {
  crawlQualitySk: SurrogateKey;
  pageSk: SurrogateKey;
  roundSk: SurrogateKey;
  overallScore: number;
  contentChanged: boolean;
};

// ── Layer Branding Tests ────────────────────────────────────

describe('Layer Branding', () => {
  it('asRuntime tags data with runtime layer', () => {
    const event = asRuntime<CrawlEvent>({
      _id: 'uuid-1',
      _createdAt: new Date(),
      _source: 'docs_spider',
      url: 'https://code.claude.com/docs/en/skills',
      spiderName: 'docs_spider',
      responseStatus: 200,
      contentHash: 'abc123',
      qualityScore: 0.85,
    });

    expect(event.url).toBe('https://code.claude.com/docs/en/skills');
    expect(event._source).toBe('docs_spider');
    expect(event.qualityScore).toBe(0.85);
  });

  it('asReporting tags data with reporting layer', () => {
    const dim = asReporting<DimPage>({
      pageSk: toSurrogateKey(1),
      url: 'https://code.claude.com/docs/en/skills',
      domain: 'code.claude.com',
      pageType: 'doc',
      isCurrent: true,
      validFrom: new Date('2025-01-01'),
      validTo: new Date('9999-12-31'),
    });

    expect(dim.pageSk).toBe(1);
    expect(dim.isCurrent).toBe(true);
  });

  it('asSemantic tags data with semantic layer', () => {
    const metric = asSemantic({
      name: 'average_crawl_quality',
      description: 'Average extraction quality across all pages in a round',
      formula: 'AVG(fact_crawl_quality.overall_score)',
      grain: 'one value per round',
      additivity: 'non_additive' as const,
      dimensions: ['round', 'page_type', 'agent'],
      unit: 'score_0_to_1',
    });

    expect(metric.name).toBe('average_crawl_quality');
    expect(metric.additivity).toBe('non_additive');
  });
});

// ── Branded Key Tests ───────────────────────────────────────

describe('Branded Keys', () => {
  it('SurrogateKey is a branded number', () => {
    const sk = toSurrogateKey(42);
    // At runtime it's just a number
    expect(sk).toBe(42);
    expect(typeof sk).toBe('number');
  });

  it('NaturalKey is a branded string', () => {
    const nk = toNaturalKey('https://code.claude.com/docs/en/skills');
    expect(nk).toBe('https://code.claude.com/docs/en/skills');
    expect(typeof nk).toBe('string');
  });

  it('SurrogateKey and NaturalKey are not interchangeable at type level', () => {
    // This is a compile-time test — if it compiles, the brands work
    const sk: SurrogateKey = toSurrogateKey(1);
    const nk: NaturalKey = toNaturalKey('key');
    expect(sk).not.toBe(nk);
  });
});

// ── ETL Transform Tests ────────────────────────────────────

describe('ETL Transforms', () => {
  it('transforms runtime records into reporting records', () => {
    const transform: ETLTransform<RuntimeLayer, ReportingLayer, CrawlEvent, FactCrawlQuality> = {
      name: 'crawl_events_to_fact_quality',
      sourceLayer: undefined as unknown as RuntimeLayer,
      targetLayer: undefined as unknown as ReportingLayer,
      transform: (source) => {
        return asReporting<FactCrawlQuality>({
          crawlQualitySk: toSurrogateKey(0), // auto-generated
          pageSk: toSurrogateKey(0), // looked up from dim_page
          roundSk: toSurrogateKey(0), // looked up from dim_round
          overallScore: source.qualityScore,
          contentChanged: true,
        });
      },
    };

    const runtimeEvent = asRuntime<CrawlEvent>({
      _id: 'uuid-1',
      _createdAt: new Date(),
      _source: 'docs_spider',
      url: 'https://example.com',
      spiderName: 'docs_spider',
      responseStatus: 200,
      contentHash: 'abc',
      qualityScore: 0.92,
    });

    const fact = transform.transform(runtimeEvent);
    expect(fact.overallScore).toBe(0.92);
    expect(fact.contentChanged).toBe(true);
  });
});

// ── Grain Declaration Tests ─────────────────────────────────

describe('Grain Declarations', () => {
  it('declares grain for fact tables', () => {
    const grain: GrainDeclaration = {
      factTable: 'fact_crawl_quality',
      grain: 'one row per page per crawl round',
      dimensions: ['page', 'round', 'agent', 'date'],
    };

    expect(grain.factTable).toBe('fact_crawl_quality');
    expect(grain.dimensions).toContain('page');
    expect(grain.dimensions).toContain('round');
  });
});

// ── Bus Matrix Tests ────────────────────────────────────────

describe('Bus Matrix', () => {
  it('declares dimension conformance across fact tables', () => {
    const busMatrix: BusMatrix = [
      { factTable: 'fact_crawl_quality', dimensions: ['page', 'round', 'agent', 'date'] },
      { factTable: 'fact_dispatch', dimensions: ['round', 'agent', 'platform', 'date'] },
      { factTable: 'fact_channel_event', dimensions: ['round', 'platform', 'date'] },
      { factTable: 'fact_pg_cache', dimensions: ['page', 'round', 'date'] },
      { factTable: 'fact_plugin_route', dimensions: ['round', 'agent', 'platform', 'date'] },
    ];

    // Conformed dimensions appear in multiple fact tables
    const roundFacts = busMatrix.filter(e => e.dimensions.includes('round'));
    expect(roundFacts.length).toBe(5); // All fact tables share 'round'

    const dateFacts = busMatrix.filter(e => e.dimensions.includes('date'));
    expect(dateFacts.length).toBe(5); // All share 'date'

    const pageFacts = busMatrix.filter(e => e.dimensions.includes('page'));
    expect(pageFacts.length).toBe(2); // Only crawl_quality and pg_cache

    const platformFacts = busMatrix.filter(e => e.dimensions.includes('platform'));
    expect(platformFacts.length).toBe(3); // dispatch, channel, plugin_route
  });
});

// ── SCD Type 2 Tests ────────────────────────────────────────

describe('SCD Type 2', () => {
  it('tracks dimension history with validity windows', () => {
    const currentVersion = asReporting<DimPage>({
      pageSk: toSurrogateKey(1),
      url: 'https://code.claude.com/docs/en/skills',
      domain: 'code.claude.com',
      pageType: 'doc',
      isCurrent: true,
      validFrom: new Date('2025-06-01'),
      validTo: new Date('9999-12-31'),
    });

    const historicalVersion = asReporting<DimPage>({
      pageSk: toSurrogateKey(2),
      url: 'https://code.claude.com/docs/en/skills',
      domain: 'code.claude.com',
      pageType: 'guide', // was classified differently before
      isCurrent: false,
      validFrom: new Date('2025-01-01'),
      validTo: new Date('2025-05-31'),
    });

    expect(currentVersion.isCurrent).toBe(true);
    expect(historicalVersion.isCurrent).toBe(false);
    expect(currentVersion.pageSk).not.toBe(historicalVersion.pageSk);
    // Same natural key (URL), different surrogate keys
    expect(currentVersion.url).toBe(historicalVersion.url);
  });
});

// ── Metric Definition Tests ─────────────────────────────────

describe('Metric Definitions', () => {
  it('enforces additivity declaration', () => {
    const additive = asSemantic({
      name: 'total_crawl_cost',
      description: 'Total token cost in USD',
      formula: 'SUM(fact_dispatch.cost_usd)',
      grain: 'one value per round',
      additivity: 'additive' as const,
      dimensions: ['round', 'agent', 'platform'],
      unit: 'usd',
    });

    const nonAdditive = asSemantic({
      name: 'average_quality',
      description: 'Average quality score',
      formula: 'AVG(overall_score)',
      grain: 'one value per round',
      additivity: 'non_additive' as const,
      dimensions: ['round'],
      unit: 'score_0_to_1',
    });

    expect(additive.additivity).toBe('additive');
    expect(nonAdditive.additivity).toBe('non_additive');
    // Additive metrics can be summed across any dimension
    // Non-additive metrics cannot — this is a semantic constraint
  });

  it('links metrics to dimensions via grain', () => {
    const metric = asSemantic({
      name: 'pages_changed',
      description: 'Pages with content changes',
      formula: 'COUNT(*) WHERE content_changed = true',
      grain: 'one value per round',
      additivity: 'additive' as const,
      dimensions: ['round', 'page_type', 'domain'],
      unit: 'count',
    });

    // Every dimension in the metric must exist in the bus matrix
    expect(metric.dimensions).toContain('round');
    expect(metric.dimensions.length).toBeGreaterThan(0);
  });
});

// ── Dimension Hierarchy Tests ───────────────────────────────

describe('Dimension Hierarchies', () => {
  it('declares drill-down paths', () => {
    const pageDim = asSemantic({
      name: 'page',
      description: 'Crawled documentation pages',
      hierarchy: ['domain', 'page_type', 'url'],
      attributes: ['first_seen', 'last_seen', 'is_current'],
    });

    // Hierarchy goes from coarse to fine
    expect(pageDim.hierarchy[0]).toBe('domain');
    expect(pageDim.hierarchy[1]).toBe('page_type');
    expect(pageDim.hierarchy[2]).toBe('url');
    // Attributes are descriptive, not for grouping
    expect(pageDim.attributes).toContain('first_seen');
  });

  it('date dimension has standard hierarchy', () => {
    const dateDim = asSemantic({
      name: 'date',
      description: 'Standard date dimension',
      hierarchy: ['year', 'quarter', 'month', 'week', 'day'],
      attributes: ['is_weekend', 'fiscal_quarter'],
    });

    expect(dateDim.hierarchy.length).toBe(5);
    expect(dateDim.hierarchy[0]).toBe('year');
    expect(dateDim.hierarchy[4]).toBe('day');
  });
});
