// devops-review/src/types.ts — Shared types for DevOps engine
//
// Consumed by both Claude Code agent and Claude Cowork skill.
// Boris Cherny: branded types, readonly, no any.

// ── Branded Type Utility ────────────────────────────────────
type Brand<K, T extends string> = K & { readonly __brand: T };

export type PRNumber = Brand<number, 'PRNumber'>;
export type CheckId = Brand<string, 'CheckId'>;
export type DecisionId = Brand<string, 'DecisionId'>;

export const toPRNumber = (n: number): PRNumber => n as PRNumber;
export const toCheckId = (s: string): CheckId => s as CheckId;
export const toDecisionId = (s: string): DecisionId => s as DecisionId;

// ── Check Categories ────────────────────────────────────────
export type CheckCategory =
  | 'architectural-consistency'
  | 'type-safety'
  | 'naming-conventions'
  | 'test-coverage'
  | 'security'
  | 'performance'
  | 'kimball-compliance'
  | 'branded-types'
  | 'result-pattern'
  | 'documentation'
  | 'dependency-hygiene';

export type Severity = 'blocker' | 'warning' | 'info';
export type CheckResult = 'pass' | 'fail' | 'skip' | 'pending';

// ── Check Definition ────────────────────────────────────────
export interface TypedCheck {
  readonly id: CheckId;
  readonly name: string;
  readonly category: CheckCategory;
  readonly severity: Severity;
  readonly description: string;
  readonly result: CheckResult;
  readonly evidence?: string;
  readonly suggestion?: string;
}

// ── Team Decision Rule ──────────────────────────────────────
export interface TeamDecision {
  readonly id: DecisionId;
  readonly category: CheckCategory;
  readonly rule: string;
  readonly rationale: string;
  readonly source: string;
}

// ── PR Metadata ─────────────────────────────────────────────
export interface PRMetadata {
  readonly number: PRNumber;
  readonly title: string;
  readonly author: string;
  readonly branch: string;
  readonly base: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly labels: ReadonlyArray<string>;
}

// ── Diff Summary ────────────────────────────────────────────
export interface FileChange {
  readonly path: string;
  readonly status: 'added' | 'modified' | 'deleted' | 'renamed';
  readonly additions: number;
  readonly deletions: number;
}

export interface DiffSummary {
  readonly filesChanged: number;
  readonly additions: number;
  readonly deletions: number;
  readonly affectedRepos: ReadonlyArray<string>;
  readonly files: ReadonlyArray<FileChange>;
}

// ── PR Review Input (parsed from XML) ───────────────────────
export interface PRReviewInput {
  readonly metadata: PRMetadata;
  readonly diffSummary: DiffSummary;
  readonly checks: ReadonlyArray<TypedCheck>;
  readonly teamDecisions: ReadonlyArray<TeamDecision>;
  readonly context?: PRReviewContext;
}

export interface PRReviewContext {
  readonly architectureExcerpt?: string;
  readonly relatedPRs?: ReadonlyArray<{
    readonly number: PRNumber;
    readonly title: string;
    readonly relationship: string;
  }>;
  readonly todos?: string;
}

// ── Review Output ───────────────────────────────────────────
export interface CheckFinding {
  readonly checkId: CheckId;
  readonly decisionId: DecisionId;
  readonly result: CheckResult;
  readonly severity: Severity;
  readonly message: string;
  readonly evidence?: string;
  readonly suggestion?: string;
  readonly file?: string;
  readonly line?: number;
}

export interface PRReviewOutput {
  readonly prNumber: PRNumber;
  readonly title: string;
  readonly overallVerdict: 'approve' | 'request-changes' | 'comment';
  readonly findings: ReadonlyArray<CheckFinding>;
  readonly summary: string;
  readonly blockerCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
}

// ── Multi-PR Orchestration ──────────────────────────────────
export interface MultiPRReviewOutput {
  readonly timestamp: string;
  readonly totalPRs: number;
  readonly reviews: ReadonlyArray<PRReviewOutput>;
  readonly crossPRFindings: ReadonlyArray<CrossPRFinding>;
  readonly executiveSummary: string;
}

export interface CrossPRFinding {
  readonly type: 'conflict' | 'dependency' | 'duplication' | 'gap';
  readonly description: string;
  readonly affectedPRs: ReadonlyArray<PRNumber>;
  readonly severity: Severity;
  readonly suggestion: string;
}

// ── Surface Types ───────────────────────────────────────────
// Both surfaces produce the same output types but differ in trigger/delivery

export type Surface = 'claude-code' | 'claude-cowork';

export interface DevOpsRun {
  readonly surface: Surface;
  readonly triggeredBy: 'cron' | 'manual' | 'scheduled-task' | 'webhook';
  readonly triggeredAt: string;
  readonly result: MultiPRReviewOutput;
  readonly deliverable?: CoworkDeliverable;
}

// Cowork-specific: the polished deliverable returned to the operator
export interface CoworkDeliverable {
  readonly format: 'markdown-report' | 'briefing' | 'summary';
  readonly title: string;
  readonly content: string;
  readonly actionItems: ReadonlyArray<string>;
  readonly approvalRequired: boolean;
}
