// devops-review/src/programmatic-review.ts — DSPy-style programmatic review generation
//
// Dogfoods two codebase patterns:
//
// 1. baml-extractor.ts (enum classification + typed extraction):
//    - Enum-based category classification (not string tags)
//    - Deterministic classifier functions (classifyIndustry, classifyTier)
//    - Typed output interfaces (TypedCustomer, TypedProduct)
//
// 2. campaign.py (DSPy orchestration):
//    - ContextDelta: steering payload injected between iterations
//    - ImprovementChain: accumulates deltas and checks convergence
//    - CrawlCampaign: plan → execute → improve loop
//
// Applied here: enum-classify PR risk, generate typed review context deltas,
// and accumulate improvement signals across review rounds.

import type {
  PRReviewOutput,
  CheckFinding,
  TypedCheck,
  Severity,
  CheckCategory,
  PRMetadata,
  DiffSummary,
} from './types.js';

// ── BAML-style enum definitions (mirrors baml-extractor.ts) ────────

/** PR risk level — enum classification, not string. */
export enum PRRiskLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  TRIVIAL = 'trivial',
}

/** Change scope — enum classification of what the PR touches. */
export enum ChangeScope {
  ARCHITECTURE = 'architecture',
  DATA_MODEL = 'data_model',
  API_SURFACE = 'api_surface',
  BUSINESS_LOGIC = 'business_logic',
  INFRASTRUCTURE = 'infrastructure',
  DOCUMENTATION = 'documentation',
  TESTS_ONLY = 'tests_only',
  CONFIGURATION = 'configuration',
}

/** Review urgency — determines notification priority. */
export enum ReviewUrgency {
  IMMEDIATE = 'immediate',     // security/data issues
  SAME_DAY = 'same_day',      // blockers
  NEXT_SPRINT = 'next_sprint', // warnings
  INFORMATIONAL = 'informational',
}

// ── BAML-style classifier functions (mirrors classifyIndustry etc.) ──

/** Classify PR risk from findings — deterministic enum mapping. */
export function classifyRisk(findings: ReadonlyArray<CheckFinding>): PRRiskLevel {
  const blockers = findings.filter(f => f.severity === 'blocker' && f.result === 'fail');
  const warnings = findings.filter(f => f.severity === 'warning' && f.result === 'fail');

  if (blockers.length >= 3) return PRRiskLevel.CRITICAL;
  if (blockers.length >= 1) return PRRiskLevel.HIGH;
  if (warnings.length >= 3) return PRRiskLevel.MEDIUM;
  if (warnings.length >= 1) return PRRiskLevel.LOW;
  return PRRiskLevel.TRIVIAL;
}

/** Classify change scope from diff — deterministic enum mapping. */
export function classifyScope(diff: DiffSummary): ChangeScope {
  const paths = diff.files.map(f => f.path.toLowerCase());
  const joined = paths.join(' ');

  if (joined.includes('architecture') || joined.includes('schema')) return ChangeScope.ARCHITECTURE;
  if (joined.includes('migration') || joined.includes('.sql')) return ChangeScope.DATA_MODEL;
  if (joined.includes('api') || joined.includes('route') || joined.includes('endpoint')) return ChangeScope.API_SURFACE;
  if (paths.every(p => p.includes('test') || p.includes('spec'))) return ChangeScope.TESTS_ONLY;
  if (paths.every(p => p.endsWith('.md') || p.endsWith('.txt'))) return ChangeScope.DOCUMENTATION;
  if (paths.every(p => p.includes('config') || p.endsWith('.json') || p.endsWith('.yaml'))) return ChangeScope.CONFIGURATION;
  if (joined.includes('ci') || joined.includes('docker') || joined.includes('deploy')) return ChangeScope.INFRASTRUCTURE;
  return ChangeScope.BUSINESS_LOGIC;
}

/** Classify review urgency from risk and scope. */
export function classifyUrgency(risk: PRRiskLevel, scope: ChangeScope): ReviewUrgency {
  if (risk === PRRiskLevel.CRITICAL) return ReviewUrgency.IMMEDIATE;
  if (risk === PRRiskLevel.HIGH && scope !== ChangeScope.TESTS_ONLY) return ReviewUrgency.SAME_DAY;
  if (risk === PRRiskLevel.MEDIUM) return ReviewUrgency.NEXT_SPRINT;
  return ReviewUrgency.INFORMATIONAL;
}

// ── DSPy-style ContextDelta (mirrors campaign.py) ──────────────────

/** Context delta — steering payload between review rounds.
 *  Mirrors campaign.py ContextDelta: new_patterns, failing_targets, steer_direction. */
export interface ReviewContextDelta {
  readonly round: number;
  readonly timestamp: string;
  readonly newPatterns: ReadonlyArray<string>;       // new violation patterns detected
  readonly recurringViolations: ReadonlyArray<string>; // violations that keep appearing
  readonly resolvedViolations: ReadonlyArray<string>;  // violations fixed since last round
  readonly qualityTrajectory: 'improving' | 'degrading' | 'stable';
  readonly steerDirection: string;                   // guidance for next review focus
}

/** Generate a context delta from two review rounds.
 *  Mirrors campaign.py's inject_context() pattern. */
export function generateContextDelta(
  round: number,
  currentFindings: ReadonlyArray<CheckFinding>,
  previousFindings: ReadonlyArray<CheckFinding>,
): ReviewContextDelta {
  const currentIds = new Set(currentFindings.filter(f => f.result === 'fail').map(f => f.checkId));
  const previousIds = new Set(previousFindings.filter(f => f.result === 'fail').map(f => f.checkId));

  const newPatterns = [...currentIds].filter(id => !previousIds.has(id));
  const recurringViolations = [...currentIds].filter(id => previousIds.has(id));
  const resolvedViolations = [...previousIds].filter(id => !currentIds.has(id));

  const currentFails = currentFindings.filter(f => f.result === 'fail').length;
  const previousFails = previousFindings.filter(f => f.result === 'fail').length;

  const qualityTrajectory: ReviewContextDelta['qualityTrajectory'] =
    currentFails < previousFails ? 'improving' :
    currentFails > previousFails ? 'degrading' : 'stable';

  // Steer direction — programmatic prompt guidance
  let steerDirection = '';
  if (recurringViolations.length > 0) {
    steerDirection = `Focus on recurring violations: ${recurringViolations.join(', ')}. These have persisted across rounds.`;
  } else if (newPatterns.length > 0) {
    steerDirection = `New violation patterns detected: ${newPatterns.join(', ')}. Investigate root cause.`;
  } else {
    steerDirection = 'Quality stable. Continue current review approach.';
  }

  return {
    round,
    timestamp: new Date().toISOString(),
    newPatterns,
    recurringViolations,
    resolvedViolations,
    qualityTrajectory,
    steerDirection,
  };
}

// ── DSPy-style ImprovementChain (mirrors campaign.py) ──────────────

/** Improvement chain — accumulates deltas and checks convergence.
 *  Mirrors campaign.py ImprovementChain pattern. */
export class ReviewImprovementChain {
  private deltas: ReviewContextDelta[] = [];
  private readonly convergenceThreshold: number;

  constructor(convergenceThreshold = 0) {
    this.convergenceThreshold = convergenceThreshold;
  }

  /** Add a delta from the latest review round. */
  addDelta(delta: ReviewContextDelta): void {
    this.deltas.push(delta);
  }

  /** Check if the review process has converged (no new violations, stable quality). */
  hasConverged(): boolean {
    if (this.deltas.length < 2) return false;
    const latest = this.deltas[this.deltas.length - 1]!;
    return (
      latest.newPatterns.length <= this.convergenceThreshold &&
      latest.qualityTrajectory !== 'degrading'
    );
  }

  /** Get the full chain of deltas for audit trail. */
  getChain(): ReadonlyArray<ReviewContextDelta> {
    return this.deltas;
  }

  /** Get the latest steering direction. */
  getLatestSteer(): string {
    if (this.deltas.length === 0) return 'No review history yet.';
    return this.deltas[this.deltas.length - 1]!.steerDirection;
  }

  /** Summary for JSONL logging (TD-005). */
  toJSONL(): string {
    return this.deltas
      .map(d => JSON.stringify({
        event: 'review_delta',
        round: d.round,
        timestamp: d.timestamp,
        new_patterns: d.newPatterns.length,
        recurring: d.recurringViolations.length,
        resolved: d.resolvedViolations.length,
        trajectory: d.qualityTrajectory,
        steer: d.steerDirection,
      }))
      .join('\n');
  }
}

// ── Typed Review Summary (BAML-style typed output) ─────────────────

/** Typed review summary — structured output combining all classifications.
 *  Mirrors baml-extractor.ts TypedCustomer/TypedProduct pattern. */
export interface TypedReviewSummary {
  readonly prNumber: number;
  readonly title: string;
  readonly riskLevel: PRRiskLevel;
  readonly changeScope: ChangeScope;
  readonly urgency: ReviewUrgency;
  readonly blockerCount: number;
  readonly warningCount: number;
  readonly verdict: 'approve' | 'request-changes' | 'comment';
  readonly topFindings: ReadonlyArray<string>;
}

/** Generate typed review summary from review output + diff.
 *  Equivalent to BAML: function ExtractReviewSummary(review, diff) -> TypedReviewSummary */
export function extractTypedReviewSummary(
  review: PRReviewOutput,
  diff: DiffSummary,
): TypedReviewSummary {
  const riskLevel = classifyRisk(review.findings);
  const changeScope = classifyScope(diff);
  const urgency = classifyUrgency(riskLevel, changeScope);

  return {
    prNumber: review.prNumber,
    title: review.title,
    riskLevel,
    changeScope,
    urgency,
    blockerCount: review.blockerCount,
    warningCount: review.warningCount,
    verdict: review.overallVerdict,
    topFindings: review.findings
      .filter(f => f.result === 'fail')
      .slice(0, 5)
      .map(f => f.message),
  };
}
