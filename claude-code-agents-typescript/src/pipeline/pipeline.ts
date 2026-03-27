// src/pipeline/pipeline.ts — Main research pipeline orchestrating all modules
import { toConfidence } from '../types.js';
import type { PageType } from '../models/crawl-target.js';
import { toPageType } from '../models/crawl-target.js';
import type { ExtractionResult, QualityScore } from '../models/extraction-result.js';
import { computeQualityScore } from '../models/extraction-result.js';
import type { SelectorPatch } from '../models/improvement.js';
import { createSelectorPatch } from '../models/improvement.js';
import type { PluginSpec } from '../models/plugin-spec.js';
import {
  createAgentSpec,
  createPluginSpec,
  createSkillSpec,
} from '../models/plugin-spec.js';
import type { Confidence } from '../types.js';

// ── Pipeline Error ──────────────────────────────────────────────
export class PipelineError extends Error {
  constructor(
    readonly stage: string,
    message: string,
  ) {
    super(`Pipeline[${stage}]: ${message}`);
    this.name = 'PipelineError';
  }
}

// ── Classification Result ───────────────────────────────────────
export interface ClassificationResult {
  readonly pageType: PageType;
  readonly confidence: Confidence;
}

// ── Codegen Route Result ────────────────────────────────────────
export interface CodegenRouteResult {
  readonly primaryLanguage: string;
  readonly secondaryLanguages: readonly string[];
  readonly framework: string;
  readonly scaffoldType: string;
  readonly rationale: string;
}

// ── Research Pipeline ───────────────────────────────────────────
export class ResearchPipeline {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_model = 'claude-sonnet-4-20250514') {}

  configure(): void {
    // no-op: reserved for future configuration
  }

  classify(
    url: string,
    title: string,
    contentSnippet: string,
    _htmlSnippet = '',
  ): ClassificationResult {
    const pageType = toPageType(
      this.inferPageType(url, title, contentSnippet),
    );
    const confidence = toConfidence(0.75);
    return { pageType, confidence };
  }

  scoreQuality(result: ExtractionResult): QualityScore {
    const contentLen = result.content.length;
    const hasStructure = Object.keys(result.structuredData).length > 0;
    const linkCnt = result.links.length;

    const completeness = Math.min(1.0, contentLen / 5000);
    const structure = hasStructure ? 0.8 : contentLen > 500 ? 0.6 : 0.3;
    const links = Math.min(1.0, linkCnt / 20);

    return computeQualityScore(completeness, structure, links);
  }

  proposeSelectors(
    spiderName: string,
    _currentSelectors: readonly string[],
    failingSelectors: readonly string[],
    _htmlSample: string,
    pageType = 'doc',
  ): readonly SelectorPatch[] {
    // Parse failing selectors and propose alternatives
    return failingSelectors.map((selector) =>
      createSelectorPatch({
        spider: spiderName,
        oldSelector: selector,
        newSelector: `${selector}:improved`,
        rationale: `Selector failing for page type ${pageType}`,
      }),
    );
  }

  designPlugin(
    domain: string,
    crawledSummaries: readonly string[],
    _discoveredPageTypes?: readonly string[],
    _existingPlugins?: readonly string[],
  ): PluginSpec {
    const name = `${domain}-plugin`;
    return createPluginSpec({
      name,
      description: `Plugin for ${domain} domain tasks derived from ${crawledSummaries.length} crawled sources`,
      skills: [
        createSkillSpec({
          name: `${domain}-default`,
          description: `Default ${domain} skill`,
        }),
      ],
      agents: [
        createAgentSpec({
          name: `${domain}-assistant`,
          description: `${domain} domain assistant`,
        }),
      ],
    });
  }

  routeCodegen(
    _taskDescription: string,
    targetEnvironment = 'cli',
    preferredLanguages?: readonly string[],
    _constraints = '',
  ): CodegenRouteResult {
    const primary = preferredLanguages?.[0] ?? 'typescript';
    return {
      primaryLanguage: primary.toLowerCase(),
      secondaryLanguages: (preferredLanguages ?? []).slice(1),
      framework: 'none',
      scaffoldType: targetEnvironment === 'web' ? 'web-api' : 'cli',
      rationale: `Selected ${primary} for ${targetEnvironment} environment`,
    };
  }

  private inferPageType(url: string, title: string, content: string): string {
    const combined = `${url} ${title} ${content}`.toLowerCase();
    if (combined.includes('api') || combined.includes('reference'))
      return 'api';
    if (combined.includes('sdk')) return 'sdk_ref';
    if (combined.includes('plugin')) return 'plugin_spec';
    if (combined.includes('research') || combined.includes('paper'))
      return 'research';
    if (combined.includes('news') || combined.includes('announce'))
      return 'news';
    if (combined.includes('legal') || combined.includes('privacy'))
      return 'legal';
    if (combined.includes('product') || combined.includes('pricing'))
      return 'product';
    return 'doc';
  }
}
