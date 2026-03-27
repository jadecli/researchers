// src/models/crawl-target.ts — Crawl target and plan models for campaign orchestration
import { z } from 'zod';
import type {
  CampaignId,
  QualityValue,
  SpiderName,
  USD,
  Url,
} from '../types.js';
import {
  assertNever,
  toCampaignId,
  toQualityValue,
  toSpiderName,
  toUrl,
} from '../types.js';

// ── Page Type (Discriminated Union) ─────────────────────────────
export const PAGE_TYPES = [
  'doc',
  'research',
  'news',
  'api',
  'legal',
  'product',
  'plugin_spec',
  'sdk_ref',
] as const;

export type PageType = (typeof PAGE_TYPES)[number];

export function isPageType(value: string): value is PageType {
  return (PAGE_TYPES as readonly string[]).includes(value);
}

export function toPageType(value: string): PageType {
  const lower = value.trim().toLowerCase();
  if (isPageType(lower)) return lower;
  return 'doc';
}

export function describePageType(pt: PageType): string {
  switch (pt) {
    case 'doc':
      return 'Documentation page';
    case 'research':
      return 'Research paper or article';
    case 'news':
      return 'News or announcement';
    case 'api':
      return 'API reference';
    case 'legal':
      return 'Legal or policy page';
    case 'product':
      return 'Product page';
    case 'plugin_spec':
      return 'Plugin specification';
    case 'sdk_ref':
      return 'SDK reference';
    default:
      return assertNever(pt);
  }
}

// ── Zod Schemas ─────────────────────────────────────────────────
export const CrawlTargetSchema = z.object({
  url: z.string().url(),
  spiderName: z.string().default('generic'),
  maxPages: z.number().int().min(1).max(10000).default(50),
  priority: z.number().int().min(0).max(10).default(0),
  allowedDomains: z.array(z.string()).default([]),
  pageTypeHint: z.enum(PAGE_TYPES).optional(),
});

export type CrawlTargetInput = z.input<typeof CrawlTargetSchema>;

export interface CrawlTarget {
  readonly url: Url;
  readonly spiderName: SpiderName;
  readonly maxPages: number;
  readonly priority: number;
  readonly allowedDomains: readonly string[];
  readonly pageTypeHint: PageType | undefined;
}

export function createCrawlTarget(input: CrawlTargetInput): CrawlTarget {
  const parsed = CrawlTargetSchema.parse(input);
  return {
    url: toUrl(parsed.url),
    spiderName: toSpiderName(parsed.spiderName),
    maxPages: parsed.maxPages,
    priority: parsed.priority,
    allowedDomains: parsed.allowedDomains,
    pageTypeHint: parsed.pageTypeHint,
  };
}

export function effectiveDomains(target: CrawlTarget): readonly string[] {
  if (target.allowedDomains.length > 0) return target.allowedDomains;
  try {
    const parsed = new URL(target.url);
    return [parsed.hostname];
  } catch {
    return [];
  }
}

// ── Crawl Plan ──────────────────────────────────────────────────
export const CrawlPlanSchema = z.object({
  targets: z.array(CrawlTargetSchema).default([]),
  totalBudgetUsd: z.number().positive().max(1000).default(5.0),
  maxIterations: z.number().int().min(1).max(20).default(3),
  concurrency: z.number().int().min(1).max(10).default(2),
  qualityThreshold: z.number().min(0).max(1).default(0.8),
});

export type CrawlPlanInput = z.input<typeof CrawlPlanSchema>;

export interface CrawlPlan {
  readonly id: CampaignId;
  readonly targets: readonly CrawlTarget[];
  readonly totalBudgetUsd: USD;
  readonly maxIterations: number;
  readonly concurrency: number;
  readonly qualityThreshold: QualityValue;
}

export function createCrawlPlan(input: CrawlPlanInput): CrawlPlan {
  const parsed = CrawlPlanSchema.parse(input);
  return {
    id: toCampaignId(crypto.randomUUID()),
    targets: parsed.targets.map(createCrawlTarget),
    totalBudgetUsd: parsed.totalBudgetUsd as USD,
    maxIterations: parsed.maxIterations,
    concurrency: parsed.concurrency,
    qualityThreshold: toQualityValue(parsed.qualityThreshold),
  };
}

export function totalMaxPages(plan: CrawlPlan): number {
  return plan.targets.reduce((sum, t) => sum + t.maxPages, 0);
}

export function sortedTargets(plan: CrawlPlan): readonly CrawlTarget[] {
  return [...plan.targets].sort((a, b) => b.priority - a.priority);
}
