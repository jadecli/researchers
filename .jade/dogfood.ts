#!/usr/bin/env npx tsx
// .jade/dogfood.ts — Session-start smoke test for .jade/ data models
//
// Simulates a fresh session: imports everything, validates integrity,
// finds mismatches between classifyUrl decision tree and registered surfaces.

import { ALL_DOC_PAGES, DOC_PAGE_REGISTRY } from './surfaces/registry.js';
import { classifyUrl, ALL_SURFACES } from './surfaces/doc-surface.js';
import { DECISION_TREE, getDecision, getSchemaForSurface } from './schemas/output-schemas.js';
import { AGENT_FILES, buildCrawlPrompt, buildScorerPrompt, buildEmitterPrompt } from './agents/crawl-agent.js';
import { bumpVersion } from './models/base.js';

const errors: string[] = [];
const warnings: string[] = [];

function check(label: string, ok: boolean, detail?: string): void {
  if (!ok) {
    errors.push(`FAIL: ${label}${detail ? ' — ' + detail : ''}`);
  }
}

// ─── 1. Registry Integrity ──────────────────────────────────────────────────
console.log('=== Registry ===');
console.log(`Pages: ${ALL_DOC_PAGES.length}`);
console.log(`Version: ${DOC_PAGE_REGISTRY.currentVersion}`);
check('Registry has pages', ALL_DOC_PAGES.length >= 45);
check('Registry is v1', (DOC_PAGE_REGISTRY.currentVersion as number) === 1);
check('Registry is current', DOC_PAGE_REGISTRY.current.isCurrent);

const surfaces = new Set(ALL_DOC_PAGES.map(p => p.surface));
check('All 7 surfaces covered', surfaces.size === 7);

// ─── 2. classifyUrl vs Registered Surface ───────────────────────────────────
console.log('\n=== classifyUrl Mismatches ===');
let mismatches = 0;
for (const page of ALL_DOC_PAGES) {
  const classified = classifyUrl(page.url);
  if (classified.surface !== page.surface) {
    warnings.push(`classifyUrl mismatch: ${page.slug} registered=${page.surface} classified=${classified.surface} url=${page.url}`);
    mismatches++;
  }
}
console.log(`Mismatches: ${mismatches}`);

// ─── 3. Decision Tree → Agent File Coverage ─────────────────────────────────
console.log('\n=== Agent Coverage Gaps ===');
for (const s of ALL_SURFACES) {
  const agents = AGENT_FILES.filter(a => a.surface === s);
  const decision = getDecision(s);
  const missingRoles = decision.agentRoles.filter(r => !agents.some(a => a.role === r));
  if (missingRoles.length > 0) {
    warnings.push(`Surface "${s}" missing agent roles: ${missingRoles.join(', ')}`);
  }
}

// ─── 4. Schema Coverage ─────────────────────────────────────────────────────
console.log('\n=== Schema Coverage ===');
for (const s of ALL_SURFACES) {
  const schema = getSchemaForSurface(s);
  check(`Schema exists for ${s}`, !!schema);
  check(`Schema has fields for ${s}`, schema.fields.length > 0);
  check(`Schema has template for ${s}`, schema.yamlTemplate.length > 10);
}

// ─── 5. Version Bump ────────────────────────────────────────────────────────
console.log('\n=== Version Bump ===');
const v2 = bumpVersion(DOC_PAGE_REGISTRY, DOC_PAGE_REGISTRY.current.data, 'dogfood', 'test');
check('v2 version is 2', (v2.currentVersion as number) === 2);
check('v2 has 1 history entry', v2.history.length === 1);
check('v1 in history is closed', !v2.history[0]!.isCurrent);

// ─── 6. Prompt Generation ───────────────────────────────────────────────────
console.log('\n=== Prompt Generation ===');
const page = ALL_DOC_PAGES[0]!;
check('crawl prompt contains URL', buildCrawlPrompt(page).includes(page.url));
check('scorer prompt has dimensions', buildScorerPrompt(page, 'x').includes('Completeness'));
check('emitter prompt has format', buildEmitterPrompt(page, 'x', 'yaml').includes('yaml'));

// ─── 7. Parent-Child Consistency ────────────────────────────────────────────
console.log('\n=== Parent-Child Links ===');
const slugSet = new Set(ALL_DOC_PAGES.map(p => p.slug as string));
for (const p of ALL_DOC_PAGES) {
  if (p.parentSlug !== null && !slugSet.has(p.parentSlug as string)) {
    errors.push(`Broken parent link: ${p.slug} → ${p.parentSlug}`);
  }
  for (const child of p.childSlugs) {
    if (!slugSet.has(child as string)) {
      errors.push(`Broken child link: ${p.slug} → ${child}`);
    }
  }
}

// ─── Summary ────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
if (errors.length === 0) {
  console.log(`✓ All checks passed`);
} else {
  console.log(`✗ ${errors.length} errors:`);
  for (const e of errors) console.log(`  ${e}`);
}
if (warnings.length > 0) {
  console.log(`⚠ ${warnings.length} warnings:`);
  for (const w of warnings) console.log(`  ${w}`);
}
console.log('═'.repeat(60));

process.exit(errors.length > 0 ? 1 : 0);
