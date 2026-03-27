// src/models/extraction-result.ts — Extraction results and quality scoring models
import { z } from 'zod';
import type { Iteration, QualityValue, SpiderName, Url } from '../types.js';
import { toQualityValue } from '../types.js';
import type { PageType } from './crawl-target.js';

// ── Quality Score ───────────────────────────────────────────────
export interface QualityScore {
  readonly completeness: QualityValue;
  readonly structure: QualityValue;
  readonly links: QualityValue;
  readonly overall: QualityValue;
}

export function computeQualityScore(
  completeness: number,
  structure: number,
  links: number,
): QualityScore {
  const overall = 0.4 * completeness + 0.35 * structure + 0.25 * links;
  return {
    completeness: toQualityValue(completeness),
    structure: toQualityValue(structure),
    links: toQualityValue(links),
    overall: toQualityValue(Math.round(overall * 10000) / 10000),
  };
}

export function meetsThreshold(score: QualityScore, threshold: number): boolean {
  return (score.overall as number) >= threshold;
}

export const EMPTY_QUALITY: QualityScore = computeQualityScore(0, 0, 0);

// ── Extraction Result ───────────────────────────────────────────
export interface ExtractionResult {
  readonly url: Url;
  readonly spiderName: SpiderName;
  pageType: PageType;
  readonly title: string | undefined;
  readonly content: string;
  readonly structuredData: Readonly<Record<string, unknown>>;
  readonly links: readonly string[];
  readonly selectorsUsed: readonly string[];
  quality: QualityScore;
  readonly rawHtmlSnippet: string | undefined;
  readonly extractedAt: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export function contentLength(result: ExtractionResult): number {
  return result.content.length;
}

export function linkCount(result: ExtractionResult): number {
  return result.links.length;
}

export function isEmpty(result: ExtractionResult): boolean {
  return (
    result.content.trim().length === 0 &&
    Object.keys(result.structuredData).length === 0
  );
}

// ── Context Delta (tracks iteration changes) ────────────────────
export interface ContextDelta {
  readonly iteration: Iteration;
  readonly newPatterns: readonly string[];
  readonly failingSelectors: readonly string[];
  readonly qualityBefore: QualityValue;
  readonly qualityAfter: QualityValue;
  readonly steerDirection: string;
  readonly discoveredPageTypes: readonly string[];
}

export function qualityImprovement(delta: ContextDelta): number {
  return Math.round(
    ((delta.qualityAfter as number) - (delta.qualityBefore as number)) * 10000,
  ) / 10000;
}

export function isRegression(delta: ContextDelta): boolean {
  return (delta.qualityAfter as number) < (delta.qualityBefore as number);
}

export function isStagnant(delta: ContextDelta): boolean {
  return (
    Math.abs((delta.qualityAfter as number) - (delta.qualityBefore as number)) < 0.001
  );
}

// ── Zod schema for parsing crawl output ─────────────────────────
export const CrawlOutputSchema = z.object({
  url: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  structured_data: z.record(z.unknown()).optional(),
  links: z.array(z.string()).optional(),
  selectors_used: z.array(z.string()).optional(),
  raw_html_snippet: z.string().optional(),
});
