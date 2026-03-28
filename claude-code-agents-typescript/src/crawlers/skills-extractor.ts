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

// ── Official Publisher Allowlist ────────────────────────────────────
// Only these verified publishers are crawled. Non-official skills
// introduce security risk (adversarial context injection, phantom
// dependency attacks). See: https://skills.sh/audits

export const OFFICIAL_PUBLISHERS: ReadonlyArray<string> = [
  'anthropics',
  'vercel-labs',
  'openai',
  'supabase',
  'microsoft',
  'google-gemini',
  'apify',
] as const;

export function isOfficialPublisher(publisher: string): boolean {
  return OFFICIAL_PUBLISHERS.includes(publisher);
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
