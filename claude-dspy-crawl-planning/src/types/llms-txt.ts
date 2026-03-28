// src/types/llms-txt.ts — Branded types for llms.txt video competitor crawling
//
// Extends core.ts with video-competitor-specific types.
// Uses Boris Cherny strict TypeScript: branded types, Result<T,E>,
// discriminated unions, readonly everything, exhaustive matching.

import { assertNever } from './core.js';

// ── Branded Types ───────────────────────────────────────────
type Brand<K, T> = K & { readonly __brand: T };

export type ProviderId = Brand<string, 'ProviderId'>;
export type LlmsTxtUrl = Brand<string, 'LlmsTxtUrl'>;

export function toProviderId(s: string): ProviderId { return s as ProviderId; }
export function toLlmsTxtUrl(s: string): LlmsTxtUrl { return s as LlmsTxtUrl; }

// ── Provider Classification (Discriminated Union) ───────────

export type ProviderTier = 'tier1_realism' | 'tier2_strong' | 'tier3_budget' | 'avatar' | 'editing' | 'aggregator';
export type ProviderOrigin = 'us' | 'china' | 'israel' | 'uk' | 'open_source';

export type LlmsTxtStatus =
  | { readonly status: 'found'; readonly url: LlmsTxtUrl; readonly content: string }
  | { readonly status: 'found_via_replicate'; readonly replicateNamespace: string; readonly models: ReadonlyArray<string> }
  | { readonly status: 'found_custom'; readonly url: LlmsTxtUrl; readonly format: string }
  | { readonly status: 'not_found'; readonly docsUrl?: string; readonly reason: string };

export function statusLabel(s: LlmsTxtStatus): string {
  switch (s.status) {
    case 'found': return 'FOUND';
    case 'found_via_replicate': return 'PARTIAL (Replicate)';
    case 'found_custom': return 'PARTIAL (Custom)';
    case 'not_found': return 'NOT FOUND';
    default: return assertNever(s);
  }
}

// ── Provider Definition ─────────────────────────────────────

export type VideoProvider = {
  readonly id: ProviderId;
  readonly name: string;
  readonly domain: string;
  readonly tier: ProviderTier;
  readonly origin: ProviderOrigin;
  readonly llmsTxt: LlmsTxtStatus;
  readonly llmsFullTxt: LlmsTxtStatus;
  readonly apiEndpoint?: string;
  readonly hasPublicApi: boolean;
  readonly priority: number; // 1 = highest
};

// ── Crawl Task (Discriminated Union) ────────────────────────

export type CrawlTaskType =
  | { readonly type: 'llms_txt'; readonly url: LlmsTxtUrl }
  | { readonly type: 'llms_full_txt'; readonly url: LlmsTxtUrl }
  | { readonly type: 'replicate_model'; readonly namespace: string; readonly model: string }
  | { readonly type: 'custom_llm_info'; readonly url: LlmsTxtUrl };

export type CrawlTaskState =
  | { readonly state: 'pending' }
  | { readonly state: 'crawling'; readonly startedAt: Date }
  | { readonly state: 'complete'; readonly content: string; readonly crawledAt: Date }
  | { readonly state: 'failed'; readonly error: string; readonly failedAt: Date }
  | { readonly state: 'blocked'; readonly reason: string };

export type CrawlTask = {
  readonly providerId: ProviderId;
  readonly task: CrawlTaskType;
  readonly taskState: CrawlTaskState;
};

export function isTaskComplete(task: CrawlTask): boolean {
  return task.taskState.state === 'complete';
}

export function isTaskActionable(task: CrawlTask): boolean {
  switch (task.taskState.state) {
    case 'pending': return true;
    case 'crawling': return false;
    case 'complete': return false;
    case 'failed': return true; // can retry
    case 'blocked': return false;
    default: return assertNever(task.taskState);
  }
}

// ── Validation ──────────────────────────────────────────────

export type ValidationDimension =
  | 'url_reachable'
  | 'content_non_empty'
  | 'has_markdown_structure'
  | 'has_api_docs'
  | 'has_model_info';

export type ValidationResult = {
  readonly providerId: ProviderId;
  readonly dimension: ValidationDimension;
  readonly passed: boolean;
  readonly detail: string;
};

export function validateLlmsTxtContent(
  providerId: ProviderId,
  content: string,
): ReadonlyArray<ValidationResult> {
  const results: ValidationResult[] = [];

  results.push({
    providerId,
    dimension: 'content_non_empty',
    passed: content.length > 0,
    detail: content.length > 0 ? `${content.length} chars` : 'Empty content',
  });

  results.push({
    providerId,
    dimension: 'has_markdown_structure',
    passed: /^#\s|^\-\s|^\*\s|\[.*\]\(.*\)/m.test(content),
    detail: /^#\s/m.test(content) ? 'Has headings' : 'No markdown structure detected',
  });

  results.push({
    providerId,
    dimension: 'has_api_docs',
    passed: /api|endpoint|sdk|authentication|webhook/i.test(content),
    detail: /api/i.test(content) ? 'References API documentation' : 'No API references',
  });

  results.push({
    providerId,
    dimension: 'has_model_info',
    passed: /model|generate|video|image|resolution|fps/i.test(content),
    detail: /model/i.test(content) ? 'Contains model information' : 'No model info',
  });

  return results;
}

// ── Kimball Fact Table Types (star schema for crawl results) ─

export type FactLlmsTxtCrawl = {
  readonly provider_sk: number;      // surrogate key
  readonly crawl_date_sk: number;    // dim_date FK
  readonly url: string;
  readonly file_type: 'llms_txt' | 'llms_full_txt' | 'replicate_model' | 'custom';
  readonly status: 'found' | 'not_found' | 'blocked' | 'error';
  readonly content_length: number;
  readonly has_api_docs: boolean;
  readonly has_model_info: boolean;
  readonly response_code: number;
  readonly crawl_duration_ms: number;
};

// GRAIN: one row per provider per crawl date per file type

export type DimProvider = {
  readonly provider_sk: number;
  readonly provider_id: ProviderId;
  readonly provider_name: string;
  readonly domain: string;
  readonly tier: ProviderTier;
  readonly origin: ProviderOrigin;
  readonly has_public_api: boolean;
  readonly effective_from: Date;
  readonly effective_to: Date | null;   // SCD Type 2
  readonly is_current: boolean;
};
