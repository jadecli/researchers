// src/orchestrator/campaign.ts — Crawl campaign orchestrator driving iterative crawl-improve loops
import type { CrawlPlan, CrawlTarget } from '../models/crawl-target.js';
import { effectiveDomains, sortedTargets } from '../models/crawl-target.js';
import type {
  ContextDelta,
  ExtractionResult,
} from '../models/extraction-result.js';
import { CrawlOutputSchema, EMPTY_QUALITY } from '../models/extraction-result.js';
import type { SelectorPatch } from '../models/improvement.js';
import { ResearchPipeline } from '../pipeline/pipeline.js';
import type { Result } from '../types.js';
import { Ok, toIteration, toQualityValue, toSpiderName, toUrl } from '../types.js';
import { injectContext } from './context-injector.js';
import { HeadlessRunner } from './headless-runner.js';
import { ImprovementChain } from './improvement-chain.js';

// ── Campaign Error ──────────────────────────────────────────────
export class CampaignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CampaignError';
  }
}

// ── Campaign State (Discriminated Union) ────────────────────────
export type CampaignState =
  | { readonly status: 'planning' }
  | { readonly status: 'executing'; readonly iteration: number }
  | { readonly status: 'improving'; readonly patchCount: number }
  | {
      readonly status: 'complete';
      readonly totalResults: number;
      readonly avgQuality: number;
    }
  | { readonly status: 'failed'; readonly error: string };

// ── Plan Summary ────────────────────────────────────────────────
export interface PlanSummary {
  readonly targetCount: number;
  readonly totalPages: number;
  readonly budgetUsd: number;
  readonly maxIterations: number;
  readonly qualityThreshold: number;
  readonly targets: readonly {
    readonly url: string;
    readonly spider: string;
    readonly maxPages: number;
    readonly priority: number;
  }[];
}

// ── Crawl Campaign ──────────────────────────────────────────────
export class CrawlCampaign {
  private readonly plan: CrawlPlan;
  private readonly pipeline: ResearchPipeline;
  private readonly runner: HeadlessRunner;
  private readonly chain: ImprovementChain;
  private readonly results: ExtractionResult[] = [];
  private currentIteration = 0;
  private state: CampaignState = { status: 'planning' };

  constructor(
    plan: CrawlPlan,
    pipeline?: ResearchPipeline,
    runner?: HeadlessRunner,
  ) {
    this.plan = plan;
    this.pipeline = pipeline ?? new ResearchPipeline();
    this.runner = runner ?? new HeadlessRunner();
    this.chain = new ImprovementChain();
  }

  getState(): CampaignState {
    return this.state;
  }

  planCampaign(): PlanSummary {
    const sorted = sortedTargets(this.plan);
    return {
      targetCount: sorted.length,
      totalPages: sorted.reduce((s, t) => s + t.maxPages, 0),
      budgetUsd: this.plan.totalBudgetUsd as number,
      maxIterations: this.plan.maxIterations,
      qualityThreshold: this.plan.qualityThreshold as number,
      targets: sorted.map((t) => ({
        url: t.url as string,
        spider: t.spiderName as string,
        maxPages: t.maxPages,
        priority: t.priority,
      })),
    };
  }

  execute(
    targets?: readonly CrawlTarget[],
  ): Result<readonly ExtractionResult[], CampaignError> {
    const crawlTargets = targets ?? sortedTargets(this.plan);
    this.state = { status: 'executing', iteration: this.currentIteration };
    const iterationResults: ExtractionResult[] = [];

    for (const target of crawlTargets) {
      const contextFragment = injectContext(
        this.currentIteration,
        this.chain,
        target,
      );
      const prompt = this.buildCrawlPrompt(target, contextFragment);
      const runResult = this.runner.run(prompt);

      const result = this.parseCrawlOutput(
        target,
        runResult.ok ? runResult.value : '',
      );

      const { pageType } = this.pipeline.classify(
        result.url as string,
        result.title ?? '',
        result.content.slice(0, 2000),
      );
      result.pageType = pageType;

      const quality = this.pipeline.scoreQuality(result);
      result.quality = quality;

      iterationResults.push(result);
    }

    this.results.push(...iterationResults);
    return Ok(iterationResults);
  }

  improve(
    results: readonly ExtractionResult[],
  ): readonly SelectorPatch[] {
    const qualityBefore = this.averageQuality(results);
    const allPatches: SelectorPatch[] = [];
    const failingSelectors: string[] = [];
    const newPatterns: string[] = [];
    const discoveredTypes: string[] = [];

    for (const result of results) {
      if ((result.quality.overall as number) < (this.plan.qualityThreshold as number)) {
        const failing = result.selectorsUsed.filter(
          () => (result.quality.completeness as number) < 0.5,
        );
        failingSelectors.push(...failing);

        const patches = this.pipeline.proposeSelectors(
          result.spiderName as string,
          result.selectorsUsed,
          failing,
          result.rawHtmlSnippet ?? '',
          result.pageType,
        );
        allPatches.push(...patches);
        newPatterns.push(...patches.map((p) => p.newSelector));
      }
      discoveredTypes.push(result.pageType);
    }

    const delta: ContextDelta = {
      iteration: toIteration(this.currentIteration),
      newPatterns,
      failingSelectors,
      qualityBefore: toQualityValue(qualityBefore),
      qualityAfter: toQualityValue(qualityBefore),
      steerDirection: this.computeSteerDirection(allPatches),
      discoveredPageTypes: [...new Set(discoveredTypes)],
    };
    this.chain.addIteration(delta);
    this.currentIteration++;

    this.state = { status: 'improving', patchCount: allPatches.length };
    return allPatches;
  }

  run(): Result<readonly ExtractionResult[], CampaignError> {
    this.planCampaign();

    const firstResult = this.execute();
    if (!firstResult.ok) return firstResult;
    let results = firstResult.value;

    for (let iteration = 1; iteration < this.plan.maxIterations; iteration++) {
      const avgQuality = this.averageQuality(results);

      if (avgQuality >= (this.plan.qualityThreshold as number)) {
        break;
      }

      if (!this.chain.shouldContinue()) {
        break;
      }

      const patches = this.improve(results);
      if (patches.length === 0) {
        break;
      }

      const nextResult = this.execute();
      if (!nextResult.ok) return nextResult;
      results = nextResult.value;
    }

    const avgQuality = this.averageQuality(this.results);
    this.state = {
      status: 'complete',
      totalResults: this.results.length,
      avgQuality,
    };
    return Ok(this.results);
  }

  getAllResults(): readonly ExtractionResult[] {
    return [...this.results];
  }

  private buildCrawlPrompt(target: CrawlTarget, context: string): string {
    const domains = effectiveDomains(target).join(', ');
    return [
      `Crawl the website at ${target.url} using the '${target.spiderName}' spider.`,
      `Extract up to ${target.maxPages} pages.`,
      `Focus on domains: ${domains}`,
      '',
      context,
      '',
      'Return structured JSON with fields: url, title, content, links, selectors_used, raw_html_snippet (first 2000 chars).',
    ].join('\n');
  }

  private parseCrawlOutput(
    target: CrawlTarget,
    rawOutput: string,
  ): ExtractionResult {
    try {
      const data = CrawlOutputSchema.parse(JSON.parse(rawOutput));
      return {
        url: toUrl(data.url ?? (target.url as string)),
        spiderName: toSpiderName(target.spiderName as string),
        pageType: 'doc',
        title: data.title,
        content: data.content ?? '',
        structuredData: data.structured_data ?? {},
        links: data.links ?? [],
        selectorsUsed: data.selectors_used ?? [],
        quality: EMPTY_QUALITY,
        rawHtmlSnippet: data.raw_html_snippet,
        extractedAt: new Date(),
        metadata: {},
      };
    } catch {
      return {
        url: toUrl(target.url as string),
        spiderName: toSpiderName(target.spiderName as string),
        pageType: 'doc',
        title: undefined,
        content: rawOutput,
        structuredData: {},
        links: [],
        selectorsUsed: [],
        quality: EMPTY_QUALITY,
        rawHtmlSnippet: undefined,
        extractedAt: new Date(),
        metadata: {},
      };
    }
  }

  private averageQuality(results: readonly ExtractionResult[]): number {
    if (results.length === 0) return 0;
    return (
      results.reduce((sum, r) => sum + (r.quality.overall as number), 0) /
      results.length
    );
  }

  private computeSteerDirection(
    patches: readonly SelectorPatch[],
  ): string {
    if (patches.length === 0) return 'maintain current approach';
    const spiders = new Set(patches.map((p) => p.spider as string));
    return `Focus on improving selectors for: ${[...spiders].join(', ')}. ${patches.length} patches proposed.`;
  }
}
