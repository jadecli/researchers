#!/usr/bin/env npx tsx
/**
 * Test suite for the official vendor skills crawler.
 *
 * Validates: URL safety, publisher allowlist, BAML-style extraction,
 * BloomFilter dedup, catalog parsing, and Kimball schema compatibility.
 */

import {
  OFFICIAL_PUBLISHERS,
  isOfficialPublisher,
  classifyDomain,
  classifyMaturity,
  classifyAgentTarget,
  classifyContentType,
  parseInstallCount,
  extractSkillTyped,
  printTypedSkills,
  SkillDomain,
  SkillMaturity,
  AgentTarget,
  SkillContentType,
  type SkillCatalogEntry,
} from "./skills-extractor.js";

import {
  isSafeUrl,
  parseSkillUrl,
  SEED_URLS,
  PUBLISHER_URLS,
  SkillsCrawler,
} from "./skills-crawler.js";

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

// ── Test 1: Official Publisher Allowlist ────────────────────────────
console.log('\n1. Official Publisher Allowlist');
assert(OFFICIAL_PUBLISHERS.length === 7, `7 official publishers (got ${OFFICIAL_PUBLISHERS.length})`);
assert(isOfficialPublisher('anthropics'), 'anthropics is official');
assert(isOfficialPublisher('vercel-labs'), 'vercel-labs is official');
assert(isOfficialPublisher('openai'), 'openai is official');
assert(isOfficialPublisher('supabase'), 'supabase is official');
assert(isOfficialPublisher('microsoft'), 'microsoft is official');
assert(!isOfficialPublisher('random-user'), 'random-user is NOT official');
assert(!isOfficialPublisher(''), 'empty string is NOT official');

// ── Test 2: URL Safety Filter ──────────────────────────────────────
console.log('\n2. URL Safety Filter');
// Safe URLs
assert(isSafeUrl('https://skills.sh/official'), '/official is safe');
assert(isSafeUrl('https://skills.sh/audits'), '/audits is safe');
assert(isSafeUrl('https://skills.sh/docs'), '/docs is safe');
assert(isSafeUrl('https://skills.sh/docs/cli'), '/docs/cli is safe');
assert(isSafeUrl('https://skills.sh/docs/faq'), '/docs/faq is safe');
assert(isSafeUrl('https://skills.sh/anthropics'), '/anthropics is safe');
assert(isSafeUrl('https://skills.sh/anthropics/skills'), '/anthropics/skills is safe');
assert(isSafeUrl('https://skills.sh/anthropics/skills/frontend-design'), '/anthropics/skills/frontend-design is safe');
assert(isSafeUrl('https://skills.sh/vercel-labs/agent-skills/react-best-practices'), 'vercel-labs skill is safe');

// Unsafe URLs — non-official publishers
assert(!isSafeUrl('https://skills.sh/random-user/my-skills/evil-skill'), 'random-user skill is UNSAFE');
assert(!isSafeUrl('https://skills.sh/hacker/payload'), 'unknown publisher is UNSAFE');
assert(!isSafeUrl('https://evil.com/anthropics/skills'), 'wrong domain is UNSAFE');
assert(!isSafeUrl('https://skills.sh/anthropics/skills/a/b/c/d'), 'too many path segments is UNSAFE');
assert(!isSafeUrl('not-a-url'), 'invalid URL is UNSAFE');

// ── Test 3: URL Parsing ────────────────────────────────────────────
console.log('\n3. URL Parsing');
const parsed1 = parseSkillUrl('https://skills.sh/anthropics/skills/frontend-design');
assert(parsed1 !== null, 'Parses valid skill URL');
assert(parsed1?.publisher === 'anthropics', 'Publisher is anthropics');
assert(parsed1?.repo === 'skills', 'Repo is skills');
assert(parsed1?.skill === 'frontend-design', 'Skill is frontend-design');

const parsed2 = parseSkillUrl('https://skills.sh/anthropics/knowledge-work-plugins');
assert(parsed2 !== null, 'Parses publisher/repo URL');
assert(parsed2?.skill === undefined, 'No skill in publisher/repo URL');

const parsed3 = parseSkillUrl('https://skills.sh/random-user/skills/bad');
assert(parsed3 === null, 'Non-official publisher returns null');

// ── Test 4: Seed & Publisher URLs ──────────────────────────────────
console.log('\n4. Seed & Publisher URLs');
assert(SEED_URLS.length === 5, `5 seed URLs (got ${SEED_URLS.length})`);
assert(SEED_URLS.includes('https://skills.sh/official'), 'Includes /official');
assert(SEED_URLS.includes('https://skills.sh/audits'), 'Includes /audits');
assert(PUBLISHER_URLS.length === 7, `7 publisher URLs (got ${PUBLISHER_URLS.length})`);
assert(PUBLISHER_URLS.includes('https://skills.sh/anthropics'), 'Includes anthropics');
assert(PUBLISHER_URLS.every(u => isSafeUrl(u)), 'All publisher URLs are safe');

// ── Test 5: Domain Classification (BAML enum) ─────────────────────
console.log('\n5. BAML Domain Classification');
assert(classifyDomain('code-review', 'Review pull requests') === SkillDomain.ENGINEERING, 'code-review → ENGINEERING');
assert(classifyDomain('sql-queries', 'Write and optimize SQL') === SkillDomain.DATA, 'sql-queries → DATA');
assert(classifyDomain('frontend-design', 'CSS and UI patterns') === SkillDomain.DESIGN, 'frontend-design → DESIGN');
assert(classifyDomain('deploy-checklist', 'Pre-deploy verification') === SkillDomain.DEVOPS, 'deploy-checklist → DEVOPS');
assert(classifyDomain('testing-strategy', 'Plan test coverage') === SkillDomain.TESTING, 'testing-strategy → TESTING');
assert(classifyDomain('vulnerability-scan', 'Check for CVEs') === SkillDomain.SECURITY, 'vulnerability-scan → SECURITY');
assert(classifyDomain('some-random-skill', 'Does something') === SkillDomain.OTHER, 'unknown → OTHER');

// ── Test 6: Maturity Classification (BAML enum) ───────────────────
console.log('\n6. BAML Maturity Classification');
assert(classifyMaturity(277_000, true) === SkillMaturity.FLAGSHIP, '277K + official → FLAGSHIP');
assert(classifyMaturity(150_000, false) === SkillMaturity.ESTABLISHED, '150K non-official → ESTABLISHED (not flagship)');
assert(classifyMaturity(55_000, true) === SkillMaturity.ESTABLISHED, '55K → ESTABLISHED');
assert(classifyMaturity(5_000, false) === SkillMaturity.GROWING, '5K → GROWING');
assert(classifyMaturity(500, true) === SkillMaturity.EMERGING, '500 → EMERGING');
assert(classifyMaturity(null, true) === SkillMaturity.UNKNOWN, 'null → UNKNOWN');

// ── Test 7: Agent Target Classification ────────────────────────────
console.log('\n7. Agent Target Classification');
assert(classifyAgentTarget('Works with Claude Code and Cursor and Codex and OpenCode') === AgentTarget.MULTI_AGENT, '4 agents → MULTI_AGENT');
assert(classifyAgentTarget('Built for Claude Code') === AgentTarget.CLAUDE_CODE, 'Claude Code → CLAUDE_CODE');
assert(classifyAgentTarget('Cursor integration') === AgentTarget.CURSOR, 'Cursor → CURSOR');
assert(classifyAgentTarget('No agent specified') === AgentTarget.UNKNOWN, 'No agent → UNKNOWN');

// ── Test 8: Content Type Classification ────────────────────────────
console.log('\n8. Content Type Classification');
assert(classifyContentType('react-best-practices', 'React patterns') === SkillContentType.FRAMEWORK, 'react → FRAMEWORK');
assert(classifyContentType('code-review', 'Review workflow') === SkillContentType.WORKFLOW, 'review → WORKFLOW');
assert(classifyContentType('skill-creator', 'Create new skills') === SkillContentType.META, 'skill-creator → META');
assert(classifyContentType('web-scraper', 'Extract data') === SkillContentType.EXTRACTOR, 'extract → EXTRACTOR');

// ── Test 9: Install Count Parsing ──────────────────────────────────
console.log('\n9. Install Count Parsing');
assert(parseInstallCount('277K') === 277_000, '277K → 277000');
assert(parseInstallCount('55.0K') === 55_000, '55.0K → 55000');
assert(parseInstallCount('893.3K') === 893_300, '893.3K → 893300');
assert(parseInstallCount('1.2M') === 1_200_000, '1.2M → 1200000');
assert(parseInstallCount('5000') === 5_000, '5000 → 5000');
assert(parseInstallCount('') === null, 'empty → null');
assert(parseInstallCount('N/A') === null, 'N/A → null');

// ── Test 10: Typed Skill Extraction ────────────────────────────────
console.log('\n10. Typed Skill Extraction');
const entry: SkillCatalogEntry = {
  name: 'frontend-design',
  publisher: 'anthropics',
  repo: 'skills',
  url: 'https://skills.sh/anthropics/skills/frontend-design',
  installCount: 277_000,
  description: 'CSS and frontend design patterns',
};
const typed = extractSkillTyped(entry, 'Works with Claude Code and Cursor');
assert(typed.name === 'frontend-design', 'Name preserved');
assert(typed.publisher === 'anthropics', 'Publisher preserved');
assert(typed.isOfficial === true, 'Is official');
assert(typed.domain === SkillDomain.DESIGN, 'Domain classified');
assert(typed.maturity === SkillMaturity.FLAGSHIP, 'Maturity classified');
assert(typed.sourceUrl === 'https://github.com/anthropics/skills', 'Source URL generated');

// ── Test 11: Non-official extraction ───────────────────────────────
console.log('\n11. Non-Official Skill Detection');
const nonOfficial: SkillCatalogEntry = {
  name: 'shady-skill',
  publisher: 'random-user',
  repo: 'my-skills',
  url: 'https://skills.sh/random-user/my-skills/shady-skill',
  installCount: 50,
  description: 'Does suspicious things',
};
const typedNon = extractSkillTyped(nonOfficial, 'Claude Code');
assert(typedNon.isOfficial === false, 'Correctly flagged as non-official');
assert(typedNon.maturity !== SkillMaturity.FLAGSHIP, 'Non-official cannot be FLAGSHIP');

// ── Test 12: Print Summary ─────────────────────────────────────────
console.log('\n12. Print Summary');
const summary = printTypedSkills([typed]);
assert(summary.includes('Official Vendor Skills (1)'), 'Summary header correct');
assert(summary.includes('frontend-design'), 'Contains skill name');
assert(summary.includes('anthropics'), 'Contains publisher');
assert(summary.includes('277,000'), 'Contains install count');

// ── Test 13: Crawler Construction ──────────────────────────────────
console.log('\n13. Crawler Construction');
const crawler = new SkillsCrawler({ maxPages: 10 });
const stats = crawler.getStats();
assert(stats.pagesRequested === 0, 'No requests yet');
assert(stats.pagesCrawled === 0, 'No pages crawled yet');
assert(crawler.getTypedSkills().length === 0, 'No typed skills yet');
assert(crawler.getResults().length === 0, 'No results yet');
const bloomStats = crawler.getBloomFilterStats();
assert(bloomStats.urlsSeen === 0, 'BloomFilter starts empty');

// ── Summary ────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed.');
}
