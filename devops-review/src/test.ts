#!/usr/bin/env npx tsx
// devops-review/src/test.ts — Engine test suite
//
// Validates: XML parsing, check inference, review logic, cross-PR analysis,
// Cowork deliverable formatting, connector config.

import { loadTeamDecisions, inferChecksFromDiff, generatePRReviewXML } from './xml-generator.js';
import { reviewPR, buildMultiPROutput } from './review-engine.js';
import { toCoworkDeliverable } from './orchestrator.js';
import { getConnectorsForSurface, DEVOPS_CONNECTORS } from './connectors.js';
import { toPRNumber } from './types.js';
import type { PRReviewInput, TypedCheck } from './types.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string): void {
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.error(`  FAIL: ${name}`);
    failed++;
  }
}

// ── Test 1: Load team decisions from XML ────────────────────
console.log('\n1. Team Decision Loading');
const decisions = loadTeamDecisions();
assert(decisions.length === 12, `Loaded ${decisions.length} decisions (expected 12)`);
assert(decisions[0]!.id === 'TD-001', 'First decision is TD-001');
assert(decisions[0]!.category === 'branded-types', 'TD-001 category is branded-types');
assert(decisions[11]!.id === 'TD-012', 'Last decision is TD-012');
assert(decisions[11]!.category === 'architectural-consistency', 'TD-012 category is architectural-consistency');

// ── Test 2: Infer checks from TypeScript diff ───────────────
console.log('\n2. Check Inference — TypeScript');
const tsFiles = [
  { path: 'src/types.ts', status: 'added' as const, additions: 100, deletions: 0 },
  { path: 'src/test.spec.ts', status: 'added' as const, additions: 50, deletions: 0 },
  { path: 'package.json', status: 'modified' as const, additions: 5, deletions: 2 },
];
const tsChecks = inferChecksFromDiff(tsFiles, decisions);
const tsCheckNames = tsChecks.map((c) => c.name);
assert(tsCheckNames.includes('Branded type usage'), 'Infers branded type check');
assert(tsCheckNames.includes('Result<T,E> pattern'), 'Infers Result pattern check');
assert(tsCheckNames.includes('TypeScript strict mode'), 'Infers strict mode check');
assert(tsCheckNames.includes('Dependency hygiene'), 'Infers dependency check for package.json');
assert(tsCheckNames.includes('Test coverage'), 'Infers test coverage check');
assert(tsCheckNames.includes('Security review'), 'Infers security check');

// ── Test 3: Infer checks from Python diff ───────────────────
console.log('\n3. Check Inference — Python');
const pyFiles = [
  { path: 'scrapy_researchers/spiders/new_spider.py', status: 'added' as const, additions: 80, deletions: 0 },
];
const pyChecks = inferChecksFromDiff(pyFiles, decisions);
const pyCheckNames = pyChecks.map((c) => c.name);
assert(pyCheckNames.includes('Python naming conventions'), 'Infers Python naming check');
assert(!pyCheckNames.includes('Branded type usage'), 'Does NOT infer branded types for Python');
assert(!pyCheckNames.includes('TypeScript strict mode'), 'Does NOT infer TS strict for Python');

// ── Test 4: Infer checks from SQL migrations ────────────────
console.log('\n4. Check Inference — SQL');
const sqlFiles = [
  { path: 'migrations/006_new_table.sql', status: 'added' as const, additions: 30, deletions: 0 },
];
const sqlChecks = inferChecksFromDiff(sqlFiles, decisions);
const sqlCheckNames = sqlChecks.map((c) => c.name);
assert(sqlCheckNames.includes('Kimball layer compliance'), 'Infers Kimball check for SQL');

// ── Test 5: Infer checks from agent definitions ─────────────
console.log('\n5. Check Inference — Agent Definitions');
const agentFiles = [
  { path: '.claude/agents/new-agent.md', status: 'added' as const, additions: 40, deletions: 0 },
];
const agentChecks = inferChecksFromDiff(agentFiles, decisions);
const agentCheckNames = agentChecks.map((c) => c.name);
assert(agentCheckNames.includes('Agent definition format'), 'Infers agent format check');

// ── Test 6: Generate XML ────────────────────────────────────
console.log('\n6. XML Generation');
const metadata = {
  number: toPRNumber(7),
  title: 'feat: bootstrap Jade product-strategy department',
  author: 'alex-jadecli',
  branch: 'claude/setup-multi-agent-routing-6iYl3',
  base: 'main',
  createdAt: '2026-03-28T00:00:00Z',
  updatedAt: '2026-03-28T01:00:00Z',
  labels: ['enhancement', 'product-strategy'],
};
const diffSummary = {
  filesChanged: 3,
  additions: 155,
  deletions: 2,
  affectedRepos: ['claude-code'] as readonly string[],
  files: tsFiles,
};
const xml = generatePRReviewXML(metadata, diffSummary, tsChecks, decisions);
assert(xml.includes('<?xml version="1.0"'), 'XML has declaration');
assert(xml.includes('<pr-review'), 'XML has pr-review root');
assert(xml.includes('version="1.0"'), 'XML has version attribute');
assert(xml.includes('<pr-number>7</pr-number>'), 'XML has PR number');
assert(xml.includes('TD-001'), 'XML includes relevant decision TD-001');
assert(xml.includes('CHK-BRANDED'), 'XML includes branded check');
assert(xml.includes('<label>enhancement</label>'), 'XML includes labels');
assert(xml.includes('feat: bootstrap Jade product-strategy department'), 'XML includes title');
assert(xml.length > 500, `XML is substantial (${xml.length} bytes)`);

// ── Test 7: Review — all pass → approve ─────────────────────
console.log('\n7. Review Engine — All Pass');
const allPassInput: PRReviewInput = {
  metadata,
  diffSummary,
  checks: tsChecks.map((c) => ({ ...c, result: 'pass' as const })),
  teamDecisions: decisions,
};
const approveOutput = reviewPR(allPassInput);
assert(approveOutput.prNumber === 7, 'PR number preserved');
assert(approveOutput.overallVerdict === 'approve', 'All pass → approve');
assert(approveOutput.blockerCount === 0, 'No blockers');
assert(approveOutput.summary.includes('APPROVE'), 'Summary mentions APPROVE');

// ── Test 8: Review — blocker fail → request-changes ─────────
console.log('\n8. Review Engine — Blocker Fail');
const blockerInput: PRReviewInput = {
  metadata,
  diffSummary,
  checks: tsChecks.map((c) =>
    c.severity === 'blocker' ? { ...c, result: 'fail' as const } : { ...c, result: 'pass' as const },
  ),
  teamDecisions: decisions,
};
const changesOutput = reviewPR(blockerInput);
assert(changesOutput.overallVerdict === 'request-changes', 'Blocker fail → request-changes');
assert(changesOutput.blockerCount > 0, `Has ${changesOutput.blockerCount} blocker(s)`);
assert(changesOutput.summary.includes('Blockers'), 'Summary has Blockers section');

// ── Test 9: Review — warning fail → comment ─────────────────
console.log('\n9. Review Engine — Warning Fail');
const warningInput: PRReviewInput = {
  metadata,
  diffSummary,
  checks: tsChecks.map((c) =>
    c.severity === 'warning' ? { ...c, result: 'fail' as const } : { ...c, result: 'pass' as const },
  ),
  teamDecisions: decisions,
};
const commentOutput = reviewPR(warningInput);
assert(commentOutput.overallVerdict === 'comment', 'Warning fail → comment');
assert(commentOutput.warningCount > 0, `Has ${commentOutput.warningCount} warning(s)`);

// ── Test 10: Multi-PR cross-analysis ────────────────────────
console.log('\n10. Multi-PR Cross Analysis');
const review1 = reviewPR(blockerInput);
const review2 = reviewPR({
  ...blockerInput,
  metadata: { ...metadata, number: toPRNumber(5), title: 'Bloom filter deduplication' },
});
const multiOutput = buildMultiPROutput([review1, review2]);
assert(multiOutput.totalPRs === 2, 'Total PRs is 2');
assert(multiOutput.reviews.length === 2, 'Has 2 reviews');
assert(multiOutput.crossPRFindings.length > 0, `Has ${multiOutput.crossPRFindings.length} cross-PR finding(s)`);
assert(multiOutput.executiveSummary.includes('DevOps Multi-PR'), 'Executive summary present');
assert(multiOutput.executiveSummary.includes('Ready to Merge'), 'Summary has merge status');

// ── Test 11: Cowork deliverable ─────────────────────────────
console.log('\n11. Cowork Deliverable');
const deliverable = toCoworkDeliverable(multiOutput);
assert(deliverable.format === 'markdown-report', 'Format is markdown-report');
assert(deliverable.approvalRequired === true, 'Approval required with blockers');
assert(deliverable.actionItems.length > 0, `Has ${deliverable.actionItems.length} action items`);
assert(deliverable.title.includes('PR Review Report'), 'Title includes PR Review Report');
assert(deliverable.content.length > 0, 'Content is non-empty');

// ── Test 12: Cowork deliverable — no blockers ───────────────
console.log('\n12. Cowork Deliverable — No Blockers');
const cleanReview1 = reviewPR(allPassInput);
const cleanReview2 = reviewPR({
  ...allPassInput,
  metadata: { ...metadata, number: toPRNumber(3), title: 'Design DNA' },
});
const cleanMulti = buildMultiPROutput([cleanReview1, cleanReview2]);
const cleanDeliverable = toCoworkDeliverable(cleanMulti);
assert(cleanDeliverable.approvalRequired === false, 'No approval required when all pass');
assert(
  cleanDeliverable.actionItems.some((a) => a.includes('Ready to merge')),
  'Action items mention ready to merge',
);

// ── Test 13: Connector config ───────────────────────────────
console.log('\n13. Connector Configuration');
assert(DEVOPS_CONNECTORS.length === 5, `Has ${DEVOPS_CONNECTORS.length} connectors (expected 5)`);
const requiredOnly = getConnectorsForSurface('claude-code');
assert(requiredOnly.length === 1, 'Code surface: 1 required connector');
assert(requiredOnly[0]!.name === 'GitHub', 'Required connector is GitHub');
const withSlack = getConnectorsForSurface('claude-cowork', ['Slack']);
assert(withSlack.length === 2, 'Cowork + Slack: 2 connectors');
const withAll = getConnectorsForSurface('claude-cowork', ['Slack', 'Linear', 'Vercel', 'Supabase']);
assert(withAll.length === 5, 'All connectors enabled: 5');

// ── Summary ─────────────────────────────────────────────────
console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed.');
}
