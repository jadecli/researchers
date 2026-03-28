// devops-review/src/orchestrator.ts — Multi-PR fan-out/fan-in orchestrator
//
// This is the runner that both surfaces invoke:
// - Claude Code: `npx tsx devops-review/src/orchestrator.ts`
// - Claude Cowork: the skill sub-agent calls this programmatically
//
// It lists open PRs, generates XML per PR, runs the review engine,
// and produces the multi-PR output with cross-PR analysis.

import type {
  PRMetadata,
  DiffSummary,
  FileChange,
  PRReviewInput,
  PRReviewOutput,
  MultiPRReviewOutput,
  Surface,
  DevOpsRun,
  CoworkDeliverable,
} from './types.js';
import { toPRNumber } from './types.js';
import {
  loadTeamDecisions,
  inferChecksFromDiff,
  detectAffectedRepos,
  generatePRReviewXML,
} from './xml-generator.js';
import {
  reviewPR,
  buildMultiPROutput,
} from './review-engine.js';

// ── GitHub PR shape (from MCP or API) ───────────────────────
interface GitHubPR {
  readonly number: number;
  readonly title: string;
  readonly user: { readonly login: string };
  readonly head: { readonly ref: string };
  readonly base: { readonly ref: string };
  readonly created_at: string;
  readonly updated_at: string;
  readonly labels?: ReadonlyArray<{ readonly name: string }>;
  readonly changed_files?: number;
  readonly additions?: number;
  readonly deletions?: number;
}

interface GitHubFile {
  readonly filename: string;
  readonly status: string;
  readonly additions: number;
  readonly deletions: number;
}

// ── Convert GitHub PR to our types ──────────────────────────
function toPRMetadata(pr: GitHubPR): PRMetadata {
  return {
    number: toPRNumber(pr.number),
    title: pr.title,
    author: pr.user.login,
    branch: pr.head.ref,
    base: pr.base.ref,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    labels: pr.labels?.map((l) => l.name) ?? [],
  };
}

function toDiffSummary(
  pr: GitHubPR,
  files: ReadonlyArray<GitHubFile>,
): DiffSummary {
  const fileChanges: FileChange[] = files.map((f) => ({
    path: f.filename,
    status: (
      f.status === 'added'
        ? 'added'
        : f.status === 'removed'
          ? 'deleted'
          : f.status === 'renamed'
            ? 'renamed'
            : 'modified'
    ) as FileChange['status'],
    additions: f.additions,
    deletions: f.deletions,
  }));

  return {
    filesChanged: files.length,
    additions: pr.additions ?? files.reduce((s, f) => s + f.additions, 0),
    deletions: pr.deletions ?? files.reduce((s, f) => s + f.deletions, 0),
    affectedRepos: detectAffectedRepos(fileChanges),
    files: fileChanges,
  };
}

// ── Build review input for one PR ───────────────────────────
export function buildReviewInput(
  pr: GitHubPR,
  files: ReadonlyArray<GitHubFile>,
  allPRs: ReadonlyArray<GitHubPR>,
): PRReviewInput {
  const metadata = toPRMetadata(pr);
  const diffSummary = toDiffSummary(pr, files);
  const decisions = loadTeamDecisions();
  const checks = inferChecksFromDiff(diffSummary.files, decisions);

  // Detect related PRs by overlapping affected repos
  const myRepos = new Set(diffSummary.affectedRepos);
  const relatedPRs = allPRs
    .filter((other) => other.number !== pr.number)
    .map((other) => ({
      number: toPRNumber(other.number),
      title: other.title,
      relationship: 'same-repo' as const,
    }));

  return {
    metadata,
    diffSummary,
    checks,
    teamDecisions: decisions,
    context: {
      relatedPRs: relatedPRs.length > 0 ? relatedPRs : undefined,
    },
  };
}

// ── Orchestrate multi-PR review ─────────────────────────────
export function orchestrateReview(
  prs: ReadonlyArray<GitHubPR>,
  filesPerPR: ReadonlyMap<number, ReadonlyArray<GitHubFile>>,
): MultiPRReviewOutput {
  const reviews: PRReviewOutput[] = [];

  for (const pr of prs) {
    const files = filesPerPR.get(pr.number) ?? [];
    const input = buildReviewInput(pr, files, prs);

    // Generate XML (for logging/audit — the actual review uses typed input)
    const xml = generatePRReviewXML(
      input.metadata,
      input.diffSummary,
      input.checks,
      input.teamDecisions,
      input.context,
    );

    // Log XML to stdout for audit trail
    console.error(
      `[devops] Generated XML for PR #${pr.number} (${xml.length} bytes)`,
    );

    const review = reviewPR(input);
    reviews.push(review);
  }

  return buildMultiPROutput(reviews);
}

// ── Format as Cowork deliverable ────────────────────────────
export function toCoworkDeliverable(
  output: MultiPRReviewOutput,
): CoworkDeliverable {
  const actionItems: string[] = [];

  for (const review of output.reviews) {
    if (review.overallVerdict === 'request-changes') {
      actionItems.push(
        `PR #${review.prNumber} "${review.title}": ${review.blockerCount} blocker(s) must be resolved`,
      );
    } else if (review.overallVerdict === 'comment') {
      actionItems.push(
        `PR #${review.prNumber} "${review.title}": ${review.warningCount} warning(s) to review`,
      );
    } else {
      actionItems.push(
        `PR #${review.prNumber} "${review.title}": Ready to merge`,
      );
    }
  }

  for (const cf of output.crossPRFindings) {
    actionItems.push(
      `[${cf.severity.toUpperCase()}] ${cf.description}`,
    );
  }

  const hasBlockers = output.reviews.some(
    (r) => r.overallVerdict === 'request-changes',
  );

  return {
    format: 'markdown-report',
    title: `PR Review Report — ${new Date().toISOString().split('T')[0]}`,
    content: output.executiveSummary,
    actionItems,
    approvalRequired: hasBlockers,
  };
}

// ── Build DevOps run result ─────────────────────────────────
export function buildDevOpsRun(
  surface: Surface,
  triggeredBy: DevOpsRun['triggeredBy'],
  output: MultiPRReviewOutput,
): DevOpsRun {
  const run: DevOpsRun = {
    surface,
    triggeredBy,
    triggeredAt: new Date().toISOString(),
    result: output,
  };

  if (surface === 'claude-cowork') {
    return {
      ...run,
      deliverable: toCoworkDeliverable(output),
    };
  }

  return run;
}
