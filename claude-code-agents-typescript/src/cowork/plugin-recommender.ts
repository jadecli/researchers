// src/cowork/plugin-recommender.ts — Recommends plugins based on task analysis
import type { Confidence } from '../types.js';
import { toConfidence } from '../types.js';
import type { CoworkDomain } from './task-router.js';
import { CoworkTaskRouter } from './task-router.js';

// ── Plugin Catalog Entry ────────────────────────────────────────
interface CatalogEntry {
  readonly name: string;
  readonly domain: CoworkDomain;
  readonly capabilities: readonly string[];
  readonly description: string;
}

const PLUGIN_CATALOG: readonly CatalogEntry[] = [
  { name: 'code-review', domain: 'engineering', capabilities: ['review', 'lint', 'security', 'style'], description: 'Automated code review with style and security checks' },
  { name: 'architecture-advisor', domain: 'engineering', capabilities: ['architecture', 'design', 'patterns', 'scalability'], description: 'Architecture recommendations and pattern analysis' },
  { name: 'devops-helper', domain: 'engineering', capabilities: ['deploy', 'ci', 'cd', 'docker', 'kubernetes'], description: 'CI/CD pipeline and deployment assistance' },
  { name: 'data-analyst', domain: 'data', capabilities: ['sql', 'query', 'analytics', 'dashboard'], description: 'Data analysis and SQL query generation' },
  { name: 'ml-pipeline', domain: 'data', capabilities: ['ml', 'model', 'training', 'prediction'], description: 'ML pipeline setup and model management' },
  { name: 'viz-generator', domain: 'data', capabilities: ['chart', 'visualization', 'dashboard', 'report'], description: 'Data visualization and dashboard generation' },
  { name: 'content-writer', domain: 'marketing', capabilities: ['content', 'copywriting', 'blog', 'social'], description: 'Content creation for marketing channels' },
  { name: 'seo-optimizer', domain: 'marketing', capabilities: ['seo', 'keyword', 'ranking', 'meta'], description: 'SEO analysis and optimization suggestions' },
  { name: 'contract-reviewer', domain: 'legal', capabilities: ['contract', 'review', 'clause', 'risk'], description: 'Contract analysis and risk identification' },
  { name: 'prd-writer', domain: 'product', capabilities: ['prd', 'requirements', 'feature', 'user story'], description: 'Product requirement document generation' },
  { name: 'design-system', domain: 'design', capabilities: ['component', 'ui', 'style', 'tokens'], description: 'Design system component documentation' },
  { name: 'ticket-resolver', domain: 'support', capabilities: ['ticket', 'troubleshoot', 'faq', 'resolution'], description: 'Support ticket analysis and resolution suggestions' },
  { name: 'budget-analyzer', domain: 'finance', capabilities: ['budget', 'forecast', 'cost', 'roi'], description: 'Budget analysis and financial forecasting' },
  { name: 'job-post-writer', domain: 'hr', capabilities: ['hiring', 'job description', 'requirements', 'culture'], description: 'Job posting creation and optimization' },
];

// ── Recommendation ──────────────────────────────────────────────
export interface PluginRecommendation {
  readonly pluginName: string;
  readonly domain: CoworkDomain;
  readonly relevanceScore: Confidence;
  readonly reason: string;
}

export interface RecommendationResult {
  readonly task: string;
  readonly recommendations: readonly PluginRecommendation[];
  readonly topDomain: CoworkDomain;
}

// ── Plugin Recommender ──────────────────────────────────────────
export class PluginRecommender {
  private readonly router: CoworkTaskRouter;

  constructor(router?: CoworkTaskRouter) {
    this.router = router ?? new CoworkTaskRouter();
  }

  recommend(task: string, topK = 3): RecommendationResult {
    const routes = this.router.routeMulti(task, 3);
    const taskLower = task.toLowerCase();

    const scored: { entry: CatalogEntry; score: number }[] = [];

    for (const entry of PLUGIN_CATALOG) {
      let score = 0;

      // Domain match bonus
      const domainRoute = routes.find((r) => r.domain === entry.domain);
      if (domainRoute) {
        score += (domainRoute.confidence as number) * 0.5;
      }

      // Capability keyword overlap
      const capMatches = entry.capabilities.filter((cap) =>
        taskLower.includes(cap),
      ).length;
      score += (capMatches / entry.capabilities.length) * 0.35;

      // Plugin name similarity
      if (taskLower.includes(entry.name.replace(/-/g, ' '))) {
        score += 0.15;
      }

      scored.push({ entry, score });
    }

    scored.sort((a, b) => b.score - a.score);

    const recommendations = scored.slice(0, topK).map((s) => ({
      pluginName: s.entry.name,
      domain: s.entry.domain,
      relevanceScore: toConfidence(s.score),
      reason: `${s.entry.description} — matches ${s.entry.domain} domain`,
    }));

    return {
      task,
      recommendations,
      topDomain: routes[0]!.domain,
    };
  }
}
