// devops-review/src/review-engine.ts — Core review logic shared by both surfaces
//
// Takes a PRReviewInput (parsed from XML) and produces PRReviewOutput.
// Pure logic — no I/O, no GitHub calls, no MCP. Both surfaces call this.

import type {
  PRReviewInput,
  PRReviewOutput,
  CheckFinding,
  TypedCheck,
  TeamDecision,
  CrossPRFinding,
  MultiPRReviewOutput,
  PRNumber,
  Severity,
} from './types.js';
import { toCheckId, toDecisionId } from './types.js';

// ── Match checks to team decisions ──────────────────────────
function matchCheckToDecision(
  check: TypedCheck,
  decisions: ReadonlyArray<TeamDecision>,
): TeamDecision | undefined {
  return decisions.find((d) => d.category === check.category);
}

// ── Evaluate a single check result ──────────────────────────
function evaluateCheck(
  check: TypedCheck,
  decision: TeamDecision | undefined,
): CheckFinding {
  return {
    checkId: check.id,
    decisionId: decision?.id ?? toDecisionId('UNMATCHED'),
    result: check.result,
    severity: check.severity,
    message: decision
      ? `${check.name}: Validates against "${decision.rule.slice(0, 80)}..."`
      : `${check.name}: ${check.description}`,
    evidence: check.evidence,
    suggestion: check.suggestion,
  };
}

// ── Determine overall verdict ───────────────────────────────
function determineVerdict(
  findings: ReadonlyArray<CheckFinding>,
): 'approve' | 'request-changes' | 'comment' {
  const hasBlocker = findings.some(
    (f) => f.severity === 'blocker' && f.result === 'fail',
  );
  const hasWarning = findings.some(
    (f) => f.severity === 'warning' && f.result === 'fail',
  );

  if (hasBlocker) return 'request-changes';
  if (hasWarning) return 'comment';
  return 'approve';
}

// ── Generate summary for a single PR ────────────────────────
function generateSummary(
  title: string,
  findings: ReadonlyArray<CheckFinding>,
  verdict: string,
): string {
  const blockers = findings.filter(
    (f) => f.severity === 'blocker' && f.result === 'fail',
  );
  const warnings = findings.filter(
    (f) => f.severity === 'warning' && f.result === 'fail',
  );
  const passed = findings.filter((f) => f.result === 'pass');

  let summary = `## DevOps Review: ${title}\n\n`;
  summary += `**Verdict**: ${verdict.toUpperCase()}\n\n`;

  if (blockers.length > 0) {
    summary += `### Blockers (${blockers.length})\n`;
    for (const b of blockers) {
      summary += `- ${b.message}`;
      if (b.suggestion) summary += ` — *Suggestion: ${b.suggestion}*`;
      summary += '\n';
    }
    summary += '\n';
  }

  if (warnings.length > 0) {
    summary += `### Warnings (${warnings.length})\n`;
    for (const w of warnings) {
      summary += `- ${w.message}`;
      if (w.suggestion) summary += ` — *Suggestion: ${w.suggestion}*`;
      summary += '\n';
    }
    summary += '\n';
  }

  if (passed.length > 0) {
    summary += `### Passed (${passed.length})\n`;
    for (const p of passed) {
      summary += `- ${p.message}\n`;
    }
  }

  return summary;
}

// ── Review a single PR ──────────────────────────────────────
export function reviewPR(input: PRReviewInput): PRReviewOutput {
  const findings: CheckFinding[] = [];

  for (const check of input.checks) {
    const decision = matchCheckToDecision(check, input.teamDecisions);
    findings.push(evaluateCheck(check, decision));
  }

  const verdict = determineVerdict(findings);
  const summary = generateSummary(
    input.metadata.title,
    findings,
    verdict,
  );

  return {
    prNumber: input.metadata.number,
    title: input.metadata.title,
    overallVerdict: verdict,
    findings,
    summary,
    blockerCount: findings.filter(
      (f) => f.severity === 'blocker' && f.result === 'fail',
    ).length,
    warningCount: findings.filter(
      (f) => f.severity === 'warning' && f.result === 'fail',
    ).length,
    infoCount: findings.filter((f) => f.severity === 'info').length,
  };
}

// ── Cross-PR Analysis ───────────────────────────────────────
export function analyzeCrossPR(
  reviews: ReadonlyArray<PRReviewOutput>,
): ReadonlyArray<CrossPRFinding> {
  const findings: CrossPRFinding[] = [];

  // Detect PRs that touch the same files/repos (potential conflicts)
  // This is a structural analysis — the actual diff comparison happens
  // in the agent/skill with full file access.

  if (reviews.length > 1) {
    // Check for PRs that both have blockers (compounding risk)
    const blockerPRs = reviews.filter((r) => r.blockerCount > 0);
    if (blockerPRs.length > 1) {
      findings.push({
        type: 'dependency',
        description: `${blockerPRs.length} PRs have blockers — resolve these before merging any to avoid compounding issues`,
        affectedPRs: blockerPRs.map((r) => r.prNumber),
        severity: 'blocker',
        suggestion:
          'Address blockers in priority order: highest severity first, then by PR age',
      });
    }

    // Check for PRs that might conflict on architecture
    const archPRs = reviews.filter((r) =>
      r.findings.some(
        (f) => f.checkId === toCheckId('CHK-KIMBALL') || f.checkId === toCheckId('CHK-BRANDED'),
      ),
    );
    if (archPRs.length > 1) {
      findings.push({
        type: 'conflict',
        description:
          'Multiple PRs modify architectural patterns — review together for consistency',
        affectedPRs: archPRs.map((r) => r.prNumber),
        severity: 'warning',
        suggestion:
          'Merge architectural PRs sequentially and verify compilation after each',
      });
    }
  }

  return findings;
}

// ── Generate Executive Summary ──────────────────────────────
export function generateExecutiveSummary(
  reviews: ReadonlyArray<PRReviewOutput>,
  crossFindings: ReadonlyArray<CrossPRFinding>,
): string {
  const totalBlockers = reviews.reduce((s, r) => s + r.blockerCount, 0);
  const totalWarnings = reviews.reduce((s, r) => s + r.warningCount, 0);
  const approvable = reviews.filter(
    (r) => r.overallVerdict === 'approve',
  );

  let summary = `# DevOps Multi-PR Review Summary\n\n`;
  summary += `**Date**: ${new Date().toISOString().split('T')[0]}\n`;
  summary += `**PRs Reviewed**: ${reviews.length}\n`;
  summary += `**Ready to Merge**: ${approvable.length}/${reviews.length}\n`;
  summary += `**Total Blockers**: ${totalBlockers}\n`;
  summary += `**Total Warnings**: ${totalWarnings}\n\n`;

  if (crossFindings.length > 0) {
    summary += `## Cross-PR Findings\n`;
    for (const cf of crossFindings) {
      summary += `- **[${cf.severity.toUpperCase()}]** ${cf.description} (PRs: ${cf.affectedPRs.join(', ')})\n`;
      summary += `  *${cf.suggestion}*\n`;
    }
    summary += '\n';
  }

  summary += `## Per-PR Status\n\n`;
  summary += `| PR | Title | Verdict | Blockers | Warnings |\n`;
  summary += `|----|-------|---------|----------|----------|\n`;
  for (const r of reviews) {
    const icon =
      r.overallVerdict === 'approve'
        ? 'APPROVE'
        : r.overallVerdict === 'request-changes'
          ? 'CHANGES REQUESTED'
          : 'COMMENT';
    summary += `| #${r.prNumber} | ${r.title.slice(0, 50)} | ${icon} | ${r.blockerCount} | ${r.warningCount} |\n`;
  }

  return summary;
}

// ── Build full multi-PR output ──────────────────────────────
export function buildMultiPROutput(
  reviews: ReadonlyArray<PRReviewOutput>,
): MultiPRReviewOutput {
  const crossFindings = analyzeCrossPR(reviews);
  const executiveSummary = generateExecutiveSummary(
    reviews,
    crossFindings,
  );

  return {
    timestamp: new Date().toISOString(),
    totalPRs: reviews.length,
    reviews,
    crossPRFindings: crossFindings,
    executiveSummary,
  };
}
