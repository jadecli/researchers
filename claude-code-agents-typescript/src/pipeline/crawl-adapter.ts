// src/pipeline/crawl-adapter.ts — Converts research prompts into structured crawl campaigns
import { assertNever } from '../types.js';

// ── Spider Type ─────────────────────────────────────────────────
export const SPIDER_TYPES = [
  'docs_spider',
  'platform_spider',
  'anthropic_spider',
  'claude_com_spider',
] as const;

export type SpiderType = (typeof SPIDER_TYPES)[number];

// ── Crawl Priority (Discriminated Union) ────────────────────────
export const CRAWL_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export type CrawlPriority = (typeof CRAWL_PRIORITIES)[number];

function priorityOrder(p: CrawlPriority): number {
  switch (p) {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'medium':
      return 2;
    case 'low':
      return 3;
    default:
      return assertNever(p);
  }
}

// ── Adapter Crawl Target ────────────────────────────────────────
export interface AdapterCrawlTarget {
  readonly url: string;
  readonly spider: SpiderType;
  readonly priority: CrawlPriority;
  readonly maxPages: number;
  readonly description: string;
  readonly expectedContent: string;
  readonly qualityThreshold: number;
}

// ── Adapter Crawl Campaign ──────────────────────────────────────
export interface AdapterCrawlCampaign {
  readonly name: string;
  readonly description: string;
  readonly targets: readonly AdapterCrawlTarget[];
  readonly totalMaxPages: number;
  readonly overallQualityThreshold: number;
  readonly improvementIterations: number;
  readonly contextSteering: string;
}

// ── Adapter Crawl Result ────────────────────────────────────────
export interface AdapterCrawlResult {
  readonly target: AdapterCrawlTarget;
  readonly pagesCrawled: number;
  readonly avgQuality: number;
  readonly items: readonly Record<string, unknown>[];
  readonly errors: readonly string[];
}

export function resultPassed(result: AdapterCrawlResult): boolean {
  return (
    result.avgQuality >= result.target.qualityThreshold &&
    result.pagesCrawled > 0
  );
}

// ── Source URL Input ────────────────────────────────────────────
interface SourceUrl {
  readonly url: string;
  readonly description?: string;
  readonly priority?: CrawlPriority;
}

// ── Route Spider ────────────────────────────────────────────────
function routeSpider(url: string): SpiderType {
  if (url.includes('code.claude.com')) return 'docs_spider';
  if (url.includes('platform.claude.com')) return 'platform_spider';
  if (url.includes('anthropic.com')) return 'anthropic_spider';
  if (url.includes('claude.com') || url.includes('claude.ai'))
    return 'claude_com_spider';
  if (url.includes('github.com/modelcontextprotocol')) return 'docs_spider';
  if (url.includes('github.com')) return 'anthropic_spider';
  if (url.includes('neon.tech')) return 'platform_spider';
  return 'docs_spider';
}

// ── Convert Prompt to Campaign ──────────────────────────────────
export function convertPromptToCampaign(input: {
  readonly promptTitle: string;
  readonly keyTopics: readonly string[];
  readonly sourceUrls: readonly SourceUrl[];
  readonly focusAreas: readonly string[];
  readonly maxPagesPerTarget?: number;
  readonly qualityThreshold?: number;
  readonly iterations?: number;
}): AdapterCrawlCampaign {
  const maxPages = input.maxPagesPerTarget ?? 10;
  const threshold = input.qualityThreshold ?? 0.65;
  const iterations = input.iterations ?? 3;

  const targets: AdapterCrawlTarget[] = input.sourceUrls.map((source) => ({
    url: source.url,
    spider: routeSpider(source.url),
    priority: source.priority ?? 'high',
    maxPages,
    description: source.description ?? source.url,
    expectedContent: input.keyTopics.slice(0, 3).join(', '),
    qualityThreshold: threshold,
  }));

  targets.sort(
    (a, b) => priorityOrder(a.priority) - priorityOrder(b.priority),
  );

  return {
    name: input.promptTitle.toLowerCase().replace(/ /g, '-').slice(0, 50),
    description: input.promptTitle,
    targets,
    totalMaxPages: targets.reduce((sum, t) => sum + t.maxPages, 0),
    overallQualityThreshold: threshold,
    improvementIterations: iterations,
    contextSteering: input.focusAreas.slice(0, 5).join('; '),
  };
}

// ── Campaign to JSON ────────────────────────────────────────────
export function campaignToJson(campaign: AdapterCrawlCampaign): string {
  return JSON.stringify(
    {
      name: campaign.name,
      description: campaign.description,
      total_max_pages: campaign.totalMaxPages,
      overall_quality_threshold: campaign.overallQualityThreshold,
      improvement_iterations: campaign.improvementIterations,
      context_steering: campaign.contextSteering,
      targets: campaign.targets.map((t) => ({
        url: t.url,
        spider: t.spider,
        priority: t.priority,
        max_pages: t.maxPages,
        description: t.description,
        expected_content: t.expectedContent,
        quality_threshold: t.qualityThreshold,
      })),
    },
    null,
    2,
  );
}

// ── Pre-built Video AI Campaign ─────────────────────────────────
export const VIDEO_AI_CRAWL_CAMPAIGN = convertPromptToCampaign({
  promptTitle:
    'AI Video Generation Platforms — Kling 3.0 + Veo 3.1 + Seedance 2.0 + Higgsfield',
  keyTopics: [
    'Kling 3.0 VIDEO AI Director feature',
    'Google Veo 3.1 cinematic generation',
    'Seedance 2.0 multimodal audio-video',
    'Higgsfield Cinema Studio workflow',
    'AI video generation API documentation',
    'Text-to-video model capabilities',
    'Multi-shot video generation',
    'Native audio synchronization',
  ],
  sourceUrls: [
    {
      url: 'https://app.klingai.com/llms.txt',
      description:
        'Kling AI platform index — creation tools, documentation, membership',
      priority: 'critical',
    },
    {
      url: 'https://docs.higgsfield.ai/llms.txt',
      description:
        'Higgsfield API docs — image gen, video gen, SDKs, webhooks',
      priority: 'critical',
    },
    {
      url: 'https://ai.google.dev/gemini-api/docs/llms.txt',
      description:
        'Google AI dev docs — Gemini API, Veo, Imagen, Live API',
      priority: 'high',
    },
    {
      url: 'https://seed.bytedance.com/en/seedance2_0',
      description:
        'Seedance 2.0 product page — multimodal video generation',
      priority: 'high',
    },
  ],
  focusAreas: [
    'Extract video generation API endpoints and parameters',
    'Map model capabilities (resolution, duration, audio)',
    'Identify pricing and rate limiting patterns',
    'Catalog SDK integration patterns across platforms',
    'Document multi-shot and cinematic features',
  ],
  maxPagesPerTarget: 50,
  qualityThreshold: 0.65,
  iterations: 3,
});
