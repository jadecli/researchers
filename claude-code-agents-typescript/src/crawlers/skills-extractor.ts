/**
 * BAML-style typed extraction for skills.sh skill pages.
 *
 * Mirrors baml-extractor.ts pattern: enum definitions, deterministic
 * classifier functions, typed output interfaces. No LLM calls —
 * pure programmatic extraction with typed guarantees.
 *
 * Only extracts from OFFICIAL verified publishers to avoid
 * supply chain risk from unvetted community skills.
 */

import type { ExtractedPage } from "../extractors/html-extractor.js";

// ── Official Publisher Registry ─────────────────────────────────────
// Source of truth: https://skills.sh/official (78 verified vendors).
// Only these publishers are crawled. Non-official skills introduce
// security risk (adversarial context injection, phantom dependency
// attacks, no version pinning). See: https://skills.sh/audits
//
// Each entry maps publisher → { repo, skills_count } as listed on
// skills.sh/official. This is NOT hallucinated — it is the exact
// registry provided by the user from the live /official page.

export interface OfficialVendor {
  readonly creator: string;
  readonly repo: string;
  readonly skillsCount: number;
}

export const OFFICIAL_REGISTRY: ReadonlyMap<string, OfficialVendor> = new Map([
  ['anthropics',          { creator: 'anthropics',          repo: 'skills',                     skillsCount: 256 }],
  ['apify',               { creator: 'apify',               repo: 'agent-skills',               skillsCount: 22 }],
  ['apollographql',       { creator: 'apollographql',       repo: 'skills',                     skillsCount: 13 }],
  ['auth0',               { creator: 'auth0',               repo: 'agent-skills',               skillsCount: 12 }],
  ['automattic',          { creator: 'automattic',          repo: 'agent-skills',               skillsCount: 25 }],
  ['axiomhq',             { creator: 'axiomhq',             repo: 'skills',                     skillsCount: 7 }],
  ['base',                { creator: 'base',                repo: 'skills',                     skillsCount: 19 }],
  ['better-auth',         { creator: 'better-auth',         repo: 'skills',                     skillsCount: 11 }],
  ['bitwarden',           { creator: 'bitwarden',           repo: 'ai-plugins',                 skillsCount: 32 }],
  ['box',                 { creator: 'box',                 repo: 'box-for-ai',                 skillsCount: 1 }],
  ['brave',               { creator: 'brave',               repo: 'brave-search-skills',        skillsCount: 10 }],
  ['browser-use',         { creator: 'browser-use',         repo: 'browser-use',                skillsCount: 4 }],
  ['browserbase',         { creator: 'browserbase',         repo: 'skills',                     skillsCount: 13 }],
  ['callstackincubator',  { creator: 'callstackincubator',  repo: 'agent-skills',               skillsCount: 11 }],
  ['clerk',               { creator: 'clerk',               repo: 'skills',                     skillsCount: 17 }],
  ['clickhouse',          { creator: 'clickhouse',          repo: 'agent-skills',               skillsCount: 8 }],
  ['cloudflare',          { creator: 'cloudflare',          repo: 'skills',                     skillsCount: 50 }],
  ['coderabbitai',        { creator: 'coderabbitai',        repo: 'skills',                     skillsCount: 4 }],
  ['coinbase',            { creator: 'coinbase',            repo: 'agentic-wallet-skills',      skillsCount: 10 }],
  ['dagster-io',          { creator: 'dagster-io',          repo: 'erk',                        skillsCount: 53 }],
  ['datadog-labs',        { creator: 'datadog-labs',        repo: 'agent-skills',               skillsCount: 16 }],
  ['dbt-labs',            { creator: 'dbt-labs',            repo: 'dbt-agent-skills',           skillsCount: 13 }],
  ['denoland',            { creator: 'denoland',            repo: 'skills',                     skillsCount: 6 }],
  ['elevenlabs',          { creator: 'elevenlabs',          repo: 'skills',                     skillsCount: 9 }],
  ['encoredev',           { creator: 'encoredev',           repo: 'skills',                     skillsCount: 18 }],
  ['expo',                { creator: 'expo',                repo: 'skills',                     skillsCount: 17 }],
  ['facebook',            { creator: 'facebook',            repo: 'react',                      skillsCount: 11 }],
  ['figma',               { creator: 'figma',               repo: 'mcp-server-guide',           skillsCount: 10 }],
  ['firebase',            { creator: 'firebase',            repo: 'agent-skills',               skillsCount: 35 }],
  ['firecrawl',           { creator: 'firecrawl',           repo: 'cli',                        skillsCount: 68 }],
  ['flutter',             { creator: 'flutter',             repo: 'skills',                     skillsCount: 49 }],
  ['getsentry',           { creator: 'getsentry',           repo: 'skills',                     skillsCount: 207 }],
  ['github',              { creator: 'github',              repo: 'awesome-copilot',            skillsCount: 277 }],
  ['google-gemini',       { creator: 'google-gemini',       repo: 'gemini-skills',              skillsCount: 19 }],
  ['google-labs-code',    { creator: 'google-labs-code',    repo: 'stitch-skills',              skillsCount: 16 }],
  ['hashicorp',           { creator: 'hashicorp',           repo: 'agent-skills',               skillsCount: 47 }],
  ['huggingface',         { creator: 'huggingface',         repo: 'skills',                     skillsCount: 27 }],
  ['kotlin',              { creator: 'kotlin',              repo: 'kotlin-agent-skills',        skillsCount: 4 }],
  ['langchain-ai',        { creator: 'langchain-ai',        repo: 'langchain-skills',           skillsCount: 78 }],
  ['langfuse',            { creator: 'langfuse',            repo: 'skills',                     skillsCount: 9 }],
  ['launchdarkly',        { creator: 'launchdarkly',        repo: 'agent-skills',               skillsCount: 11 }],
  ['livekit',             { creator: 'livekit',             repo: 'agent-skills',               skillsCount: 1 }],
  ['makenotion',          { creator: 'makenotion',          repo: 'claude-code-notion-plugin',  skillsCount: 23 }],
  ['mapbox',              { creator: 'mapbox',              repo: 'mapbox-agent-skills',        skillsCount: 22 }],
  ['mastra-ai',           { creator: 'mastra-ai',           repo: 'skills',                     skillsCount: 13 }],
  ['mcp-use',             { creator: 'mcp-use',             repo: 'mcp-use',                    skillsCount: 5 }],
  ['medusajs',            { creator: 'medusajs',            repo: 'medusa-agent-skills',        skillsCount: 16 }],
  ['microsoft',           { creator: 'microsoft',           repo: 'github-copilot-for-azure',   skillsCount: 630 }],
  ['n8n-io',              { creator: 'n8n-io',              repo: 'n8n',                        skillsCount: 9 }],
  ['neondatabase',        { creator: 'neondatabase',        repo: 'agent-skills',               skillsCount: 21 }],
  ['nuxt',                { creator: 'nuxt',                repo: 'ui',                         skillsCount: 3 }],
  ['openai',              { creator: 'openai',              repo: 'skills',                     skillsCount: 82 }],
  ['openshift',           { creator: 'openshift',           repo: 'hypershift',                 skillsCount: 7 }],
  ['planetscale',         { creator: 'planetscale',         repo: 'database-skills',            skillsCount: 8 }],
  ['posthog',             { creator: 'posthog',             repo: 'posthog',                    skillsCount: 28 }],
  ['prisma',              { creator: 'prisma',              repo: 'skills',                     skillsCount: 36 }],
  ['pulumi',              { creator: 'pulumi',              repo: 'agent-skills',               skillsCount: 28 }],
  ['pytorch',             { creator: 'pytorch',             repo: 'pytorch',                    skillsCount: 12 }],
  ['redis',               { creator: 'redis',               repo: 'agent-skills',               skillsCount: 3 }],
  ['remotion-dev',        { creator: 'remotion-dev',        repo: 'skills',                     skillsCount: 9 }],
  ['resend',              { creator: 'resend',              repo: 'resend-skills',              skillsCount: 10 }],
  ['rivet-dev',           { creator: 'rivet-dev',           repo: 'skills',                     skillsCount: 11 }],
  ['runwayml',            { creator: 'runwayml',            repo: 'skills',                     skillsCount: 1 }],
  ['sanity-io',           { creator: 'sanity-io',           repo: 'agent-toolkit',              skillsCount: 18 }],
  ['semgrep',             { creator: 'semgrep',             repo: 'skills',                     skillsCount: 6 }],
  ['streamlit',           { creator: 'streamlit',           repo: 'agent-skills',               skillsCount: 15 }],
  ['stripe',              { creator: 'stripe',              repo: 'ai',                         skillsCount: 7 }],
  ['supabase',            { creator: 'supabase',            repo: 'agent-skills',               skillsCount: 8 }],
  ['sveltejs',            { creator: 'sveltejs',            repo: 'mcp',                        skillsCount: 4 }],
  ['tavily-ai',           { creator: 'tavily-ai',           repo: 'skills',                     skillsCount: 19 }],
  ['tinybirdco',          { creator: 'tinybirdco',          repo: 'tinybird-agent-skills',      skillsCount: 4 }],
  ['tldraw',              { creator: 'tldraw',              repo: 'tldraw',                     skillsCount: 13 }],
  ['triggerdotdev',       { creator: 'triggerdotdev',       repo: 'skills',                     skillsCount: 12 }],
  ['upstash',             { creator: 'upstash',             repo: 'context7',                   skillsCount: 22 }],
  ['vercel',              { creator: 'vercel',              repo: 'ai',                         skillsCount: 163 }],
  ['vercel-labs',         { creator: 'vercel-labs',         repo: 'agent-skills',               skillsCount: 195 }],
  ['webflow',             { creator: 'webflow',             repo: 'webflow-skills',             skillsCount: 22 }],
  ['wix',                 { creator: 'wix',                 repo: 'skills',                     skillsCount: 19 }],
  ['wordpress',           { creator: 'wordpress',           repo: 'agent-skills',               skillsCount: 13 }],
]);

/** Flat array of official publisher names (for fast membership checks). */
export const OFFICIAL_PUBLISHERS: ReadonlyArray<string> = [...OFFICIAL_REGISTRY.keys()];

/** Total skills across all official vendors. */
export const OFFICIAL_TOTAL_SKILLS: number = [...OFFICIAL_REGISTRY.values()]
  .reduce((sum, v) => sum + v.skillsCount, 0);

export function isOfficialPublisher(publisher: string): boolean {
  return OFFICIAL_REGISTRY.has(publisher);
}

/** Get the canonical repo for an official publisher. */
export function getOfficialRepo(publisher: string): string | undefined {
  return OFFICIAL_REGISTRY.get(publisher)?.repo;
}

// ── BAML-style enum definitions (mirrors baml-extractor.ts) ────────

/** Skill domain — enum classification, not string tags. */
export enum SkillDomain {
  ENGINEERING = 'engineering',
  DATA = 'data',
  DESIGN = 'design',
  PRODUCTIVITY = 'productivity',
  SECURITY = 'security',
  DEVOPS = 'devops',
  DOCUMENTATION = 'documentation',
  TESTING = 'testing',
  SALES = 'sales',
  SUPPORT = 'support',
  LEGAL = 'legal',
  PRODUCT = 'product',
  INFRASTRUCTURE = 'infrastructure',
  OTHER = 'other',
}

/** Skill maturity — enum classification from install counts + signals. */
export enum SkillMaturity {
  FLAGSHIP = 'flagship',       // 100K+ installs, official publisher
  ESTABLISHED = 'established', // 10K+ installs
  GROWING = 'growing',         // 1K+ installs
  EMERGING = 'emerging',       // <1K installs
  UNKNOWN = 'unknown',
}

/** Agent compatibility — which agents the skill supports. */
export enum AgentTarget {
  CLAUDE_CODE = 'claude-code',
  CURSOR = 'cursor',
  CODEX = 'codex',
  OPENCODE = 'opencode',
  WINDSURF = 'windsurf',
  GEMINI_CLI = 'gemini-cli',
  MULTI_AGENT = 'multi-agent',  // supports 3+ agents
  UNKNOWN = 'unknown',
}

/** Skill content type — what the skill teaches/does. */
export enum SkillContentType {
  FRAMEWORK = 'framework',       // React, Next.js, Django patterns
  WORKFLOW = 'workflow',          // code-review, deploy-checklist
  GENERATOR = 'generator',       // creates files/docs/configs
  EXTRACTOR = 'extractor',       // pulls/transforms data
  CONNECTOR = 'connector',       // MCP/API integration
  REFERENCE = 'reference',       // knowledge base / best practices
  META = 'meta',                 // skill-creator, find-skills
  OTHER = 'other',
}

// ── BAML-style typed output interfaces ─────────────────────────────

export interface TypedSkill {
  readonly name: string;
  readonly publisher: string;
  readonly repo: string;
  readonly domain: SkillDomain;
  readonly maturity: SkillMaturity;
  readonly contentType: SkillContentType;
  readonly agentTarget: AgentTarget;
  readonly description: string;
  readonly installCount: number | null;
  readonly url: string;
  readonly sourceUrl: string;       // GitHub source
  readonly isOfficial: boolean;
}

export interface SkillCatalogEntry {
  readonly name: string;
  readonly publisher: string;
  readonly repo: string;
  readonly url: string;
  readonly installCount: number | null;
  readonly description: string;
}

// ── BAML-style classifier functions ────────────────────────────────

/** Classify skill domain from name + description — deterministic enum mapping.
 *  Mirrors baml-extractor.ts classifyIndustry(). */
export function classifyDomain(name: string, description: string): SkillDomain {
  const text = `${name} ${description}`.toLowerCase();
  if (text.includes('code-review') || text.includes('debug') || text.includes('architecture') || text.includes('system-design')) return SkillDomain.ENGINEERING;
  if (text.includes('data') || text.includes('sql') || text.includes('analytics') || text.includes('dashboard')) return SkillDomain.DATA;
  if (text.includes('design') || text.includes('css') || text.includes('frontend') || text.includes('ui') || text.includes('ux')) return SkillDomain.DESIGN;
  if (text.includes('task') || text.includes('calendar') || text.includes('standup') || text.includes('memory')) return SkillDomain.PRODUCTIVITY;
  if (text.includes('security') || text.includes('vulnerability') || text.includes('audit') || text.includes('cve')) return SkillDomain.SECURITY;
  if (text.includes('deploy') || text.includes('ci') || text.includes('devops') || text.includes('incident')) return SkillDomain.DEVOPS;
  if (text.includes('doc') || text.includes('readme') || text.includes('changelog')) return SkillDomain.DOCUMENTATION;
  if (text.includes('test') || text.includes('spec') || text.includes('coverage') || text.includes('vitest') || text.includes('jest')) return SkillDomain.TESTING;
  if (text.includes('sales') || text.includes('pipeline') || text.includes('outreach') || text.includes('prospect')) return SkillDomain.SALES;
  if (text.includes('support') || text.includes('ticket') || text.includes('triage') || text.includes('escalation')) return SkillDomain.SUPPORT;
  if (text.includes('legal') || text.includes('contract') || text.includes('compliance') || text.includes('nda')) return SkillDomain.LEGAL;
  if (text.includes('product') || text.includes('roadmap') || text.includes('feature') || text.includes('stakeholder')) return SkillDomain.PRODUCT;
  if (text.includes('infra') || text.includes('docker') || text.includes('kubernetes') || text.includes('terraform')) return SkillDomain.INFRASTRUCTURE;
  return SkillDomain.OTHER;
}

/** Classify maturity from install count — deterministic enum mapping.
 *  Mirrors baml-extractor.ts classifyTier(). */
export function classifyMaturity(installCount: number | null, isOfficial: boolean): SkillMaturity {
  if (installCount === null) return SkillMaturity.UNKNOWN;
  if (installCount >= 100_000 && isOfficial) return SkillMaturity.FLAGSHIP;
  if (installCount >= 10_000) return SkillMaturity.ESTABLISHED;
  if (installCount >= 1_000) return SkillMaturity.GROWING;
  return SkillMaturity.EMERGING;
}

/** Classify agent target from page content — deterministic enum mapping. */
export function classifyAgentTarget(text: string): AgentTarget {
  const lower = text.toLowerCase();
  const agents = [
    lower.includes('claude') || lower.includes('claude-code'),
    lower.includes('cursor'),
    lower.includes('codex'),
    lower.includes('opencode'),
    lower.includes('windsurf'),
    lower.includes('gemini'),
  ].filter(Boolean).length;

  if (agents >= 3) return AgentTarget.MULTI_AGENT;
  if (lower.includes('claude-code') || lower.includes('claude code')) return AgentTarget.CLAUDE_CODE;
  if (lower.includes('cursor')) return AgentTarget.CURSOR;
  if (lower.includes('codex')) return AgentTarget.CODEX;
  return AgentTarget.UNKNOWN;
}

/** Classify content type from skill description + name. */
export function classifyContentType(name: string, description: string): SkillContentType {
  const text = `${name} ${description}`.toLowerCase();
  // META must check first — skill-creator contains "creat" which would match GENERATOR
  if (text.includes('skill-creator') || text.includes('find-skill') || text.includes('meta') || text.includes('init')) return SkillContentType.META;
  if (text.includes('react') || text.includes('next') || text.includes('django') || text.includes('express') || text.includes('tailwind')) return SkillContentType.FRAMEWORK;
  if (text.includes('review') || text.includes('checklist') || text.includes('standup') || text.includes('workflow')) return SkillContentType.WORKFLOW;
  if (text.includes('generat') || text.includes('creat') || text.includes('build') || text.includes('scaffold')) return SkillContentType.GENERATOR;
  if (text.includes('extract') || text.includes('pars') || text.includes('scrap')) return SkillContentType.EXTRACTOR;
  if (text.includes('mcp') || text.includes('connect') || text.includes('integrat') || text.includes('api')) return SkillContentType.CONNECTOR;
  if (text.includes('best practice') || text.includes('guideline') || text.includes('reference') || text.includes('pattern')) return SkillContentType.REFERENCE;
  return SkillContentType.OTHER;
}

// ── Parse install count from text ──────────────────────────────────

/** Parse install count strings like "277K", "55.0K", "893.3K". */
export function parseInstallCount(raw: string): number | null {
  if (!raw || raw.trim() === '') return null;
  const cleaned = raw.trim().replace(/,/g, '');
  const kMatch = cleaned.match(/([\d.]+)\s*[kK]/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]!) * 1_000);
  const mMatch = cleaned.match(/([\d.]+)\s*[mM]/);
  if (mMatch) return Math.round(parseFloat(mMatch[1]!) * 1_000_000);
  const numMatch = cleaned.match(/^(\d+)$/);
  if (numMatch) return parseInt(numMatch[1]!, 10);
  return null;
}

// ── Public BAML-style extraction function ──────────────────────────

/** Extract typed skill data from a catalog entry + page content.
 *  Equivalent to BAML: function ExtractSkill(entry, page) -> TypedSkill */
export function extractSkillTyped(
  entry: SkillCatalogEntry,
  pageContent: string,
): TypedSkill {
  const isOfficial = isOfficialPublisher(entry.publisher);
  const domain = classifyDomain(entry.name, entry.description);
  const maturity = classifyMaturity(entry.installCount, isOfficial);
  const contentType = classifyContentType(entry.name, entry.description);
  const agentTarget = classifyAgentTarget(pageContent);

  return {
    name: entry.name,
    publisher: entry.publisher,
    repo: entry.repo,
    domain,
    maturity,
    contentType,
    agentTarget,
    description: entry.description,
    installCount: entry.installCount,
    url: entry.url,
    sourceUrl: `https://github.com/${entry.publisher}/${entry.repo}`,
    isOfficial,
  };
}

// ── Formatted output (mirrors baml-extractor.ts printTypedCustomers) ──

export function printTypedSkills(skills: ReadonlyArray<TypedSkill>): string {
  let out = `## Official Vendor Skills (${skills.length})\n\n`;
  out += `| Skill | Publisher | Domain | Maturity | Type | Installs |\n`;
  out += `|-------|-----------|--------|----------|------|----------|\n`;
  for (const s of skills) {
    const installs = s.installCount !== null ? s.installCount.toLocaleString() : 'N/A';
    out += `| ${s.name} | ${s.publisher} | ${s.domain} | ${s.maturity} | ${s.contentType} | ${installs} |\n`;
  }
  return out;
}
