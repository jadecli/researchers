// src/types/core.ts — Branded types + Agent SDK v2 canonical objects
//
// Uses unstable_v2_createSession / send() / stream() patterns.
// Shannon thinking types for structured crawl planning.

// ── Branded Types ───────────────────────────────────────────
type Brand<K, T> = K & { readonly __brand: T };

export type CrawlId = Brand<string, 'CrawlId'>;
export type RoundId = Brand<string, 'RoundId'>;
export type PageId = Brand<string, 'PageId'>;
export type ThoughtId = Brand<string, 'ThoughtId'>;

export function toCrawlId(s: string): CrawlId { return s as CrawlId; }
export function toRoundId(s: string): RoundId { return s as RoundId; }
export function toPageId(s: string): PageId { return s as PageId; }
export function toThoughtId(s: string): ThoughtId { return s as ThoughtId; }

// ── Result<T, E> ────────────────────────────────────────────
export type Result<T, E extends Error = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function Ok<T>(value: T): Result<T, never> { return { ok: true, value }; }
export function Err<E extends Error>(error: E): Result<never, E> { return { ok: false, error }; }

export function assertNever(value: never): never {
  throw new Error(`Unhandled: ${JSON.stringify(value)}`);
}

// ── Shannon Thought Types (forked from jadecli/shannon-thinking) ─
export type ThoughtType =
  | 'problem_definition'  // Strip to fundamental elements
  | 'constraints'         // Identify system limitations
  | 'model'              // Develop mathematical/structural framework
  | 'proof'              // Validate through formal checks
  | 'implementation';    // Design practical solution

export type AssumptionStatus = 'active' | 'challenged' | 'invalidated';

export type Assumption = {
  readonly id: string;
  readonly description: string;
  readonly status: AssumptionStatus;
  readonly evidence?: string;
};

export type ShannonThought = {
  readonly id: ThoughtId;
  readonly type: ThoughtType;
  readonly content: string;
  readonly confidence: number;      // 0-1
  readonly uncertainty: number;     // 0-1
  readonly assumptions: ReadonlyArray<Assumption>;
  readonly dependencies: ReadonlyArray<ThoughtId>;
  readonly isRevision: boolean;
  readonly revisesThoughtId?: ThoughtId;
  readonly timestamp: Date;
};

// ── Crawl Planning Types ────────────────────────────────────
export type CrawlPriority = 'critical' | 'high' | 'medium' | 'low';

export type DocCategory =
  | 'first_steps'
  | 'models_pricing'
  | 'build_with_claude'
  | 'model_capabilities'
  | 'tools'
  | 'tool_reference'
  | 'tool_infrastructure'
  | 'context_management'
  | 'files_assets'
  | 'agent_skills'
  | 'agent_sdk'
  | 'mcp_api'
  | 'third_party'
  | 'prompt_engineering'
  | 'test_evaluate'
  | 'admin_monitoring';

export type CrawlTarget = {
  readonly url: string;
  readonly category: DocCategory;
  readonly priority: CrawlPriority;
  readonly title: string;
  readonly maxPages: number;
  readonly qualityThreshold: number;
};

export type CrawlPlan = {
  readonly id: CrawlId;
  readonly name: string;
  readonly round: number;
  readonly targets: ReadonlyArray<CrawlTarget>;
  readonly thoughts: ReadonlyArray<ShannonThought>;  // Planning rationale
  readonly totalPages: number;
  readonly overallThreshold: number;
  readonly steeringContext: string;
  readonly createdAt: Date;
};

export type CrawlPageResult = {
  readonly pageId: PageId;
  readonly url: string;
  readonly title: string;
  readonly contentLength: number;
  readonly qualityScore: number;
  readonly category: DocCategory;
};

export type CrawlRoundResult = {
  readonly roundId: RoundId;
  readonly plan: CrawlPlan;
  readonly pages: ReadonlyArray<CrawlPageResult>;
  readonly avgQuality: number;
  readonly passed: boolean;
  readonly duration: number;
  readonly contextDelta: ContextDelta;
};

export type ContextDelta = {
  readonly round: number;
  readonly newPatterns: ReadonlyArray<string>;
  readonly failingTargets: ReadonlyArray<string>;
  readonly qualityBefore: number;
  readonly qualityAfter: number;
  readonly steerDirection: string;
};

// ── Agent SDK v2 Canonical Types ────────────────────────────
// These mirror the unstable_v2 API surface

export type SessionConfig = {
  readonly model: 'claude-opus-4-6' | 'claude-sonnet-4-6' | 'claude-haiku-4-5-20251001';
  readonly systemPrompt?: string;
  readonly maxTurns?: number;
  readonly allowedTools?: ReadonlyArray<string>;
};

export type SDKMessageType =
  | 'system'
  | 'assistant'
  | 'user'
  | 'result';

export type SDKResultSubtype =
  | 'success'
  | 'error_max_turns'
  | 'error_budget';
