// src/cowork/task-router.ts — Routes knowledge-work tasks to domains
import type { Confidence, DomainId } from '../types.js';
import { toConfidence, toDomainId } from '../types.js';

// ── Cowork Domains ──────────────────────────────────────────────
export const COWORK_DOMAINS = [
  'engineering',
  'data',
  'sales',
  'marketing',
  'legal',
  'product',
  'design',
  'support',
  'finance',
  'hr',
] as const;

export type CoworkDomain = (typeof COWORK_DOMAINS)[number];

// ── Domain Keywords ─────────────────────────────────────────────
const DOMAIN_KEYWORDS: Readonly<Record<CoworkDomain, readonly string[]>> = {
  engineering: [
    'code', 'bug', 'deploy', 'ci', 'cd', 'test', 'refactor', 'api',
    'database', 'architecture', 'debug', 'build', 'lint', 'typescript',
    'python', 'rust', 'go', 'docker', 'kubernetes', 'git',
  ],
  data: [
    'analytics', 'dashboard', 'metric', 'sql', 'query', 'etl', 'pipeline',
    'warehouse', 'report', 'visualization', 'chart', 'dataset', 'ml',
    'machine learning', 'model', 'prediction',
  ],
  sales: [
    'deal', 'pipeline', 'quota', 'crm', 'lead', 'prospect', 'revenue',
    'close', 'negotiation', 'proposal', 'pricing', 'discount',
  ],
  marketing: [
    'campaign', 'seo', 'content', 'social', 'brand', 'copywriting',
    'email', 'newsletter', 'audience', 'conversion', 'funnel', 'ad',
  ],
  legal: [
    'contract', 'compliance', 'regulation', 'policy', 'nda', 'ip',
    'patent', 'trademark', 'license', 'liability', 'privacy', 'gdpr',
  ],
  product: [
    'prd', 'roadmap', 'feature', 'user story', 'requirement', 'backlog',
    'sprint', 'milestone', 'launch', 'mvp', 'okr', 'kpi',
  ],
  design: [
    'ui', 'ux', 'wireframe', 'prototype', 'figma', 'component',
    'design system', 'typography', 'color', 'layout', 'responsive',
  ],
  support: [
    'ticket', 'issue', 'customer', 'helpdesk', 'faq', 'troubleshoot',
    'escalation', 'sla', 'response time', 'satisfaction',
  ],
  finance: [
    'budget', 'forecast', 'invoice', 'expense', 'p&l', 'roi',
    'cost', 'revenue', 'accounting', 'audit', 'tax',
  ],
  hr: [
    'hiring', 'onboarding', 'performance', 'review', 'compensation',
    'benefits', 'culture', 'diversity', 'training', 'retention',
  ],
};

// ── Domain Suggested Plugins ────────────────────────────────────
const DOMAIN_PLUGINS: Readonly<Record<CoworkDomain, readonly string[]>> = {
  engineering: ['code-review', 'architecture-advisor', 'devops-helper'],
  data: ['data-analyst', 'ml-pipeline', 'viz-generator'],
  sales: ['deal-tracker', 'proposal-writer'],
  marketing: ['content-writer', 'seo-optimizer'],
  legal: ['contract-reviewer'],
  product: ['prd-writer', 'ticket-resolver'],
  design: ['design-system'],
  support: ['ticket-resolver'],
  finance: ['budget-analyzer'],
  hr: ['job-post-writer'],
};

// ── Route Result ────────────────────────────────────────────────
export interface TaskRouteResult {
  readonly domain: CoworkDomain;
  readonly domainId: DomainId;
  readonly confidence: Confidence;
  readonly matchedKeywords: readonly string[];
  readonly suggestedPlugins: readonly string[];
}

// ── Task Router ─────────────────────────────────────────────────
export class CoworkTaskRouter {
  route(task: string): TaskRouteResult {
    return this.routeMulti(task, 1)[0]!;
  }

  routeMulti(task: string, topK = 3): readonly TaskRouteResult[] {
    const taskLower = task.toLowerCase();
    const scores: { domain: CoworkDomain; matched: string[]; score: number }[] = [];

    for (const domain of COWORK_DOMAINS) {
      const keywords = DOMAIN_KEYWORDS[domain];
      const matched = keywords.filter((kw) => taskLower.includes(kw));
      const score = matched.length / keywords.length;
      scores.push({ domain, matched, score });
    }

    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, topK).map((s) => ({
      domain: s.domain,
      domainId: toDomainId(s.domain),
      confidence: toConfidence(Math.min(1, s.score * 3)),
      matchedKeywords: s.matched,
      suggestedPlugins: DOMAIN_PLUGINS[s.domain],
    }));
  }
}
