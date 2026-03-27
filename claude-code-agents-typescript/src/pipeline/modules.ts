// src/pipeline/modules.ts — Chain-of-thought wrapper modules for each pipeline signature
import type { Result } from '../types.js';
import { Err } from '../types.js';
import type {
  CodegenRouterInputT,
  CodegenRouterOutputT,
  PageClassifierInputT,
  PageClassifierOutputT,
  PluginDesignerInputT,
  PluginDesignerOutputT,
  QualityScorerInputT,
  QualityScorerOutputT,
  SelectorProposerInputT,
  SelectorProposerOutputT,
} from './signatures.js';
import {
  CodegenRouterOutput,
  PageClassifierOutput,
  PluginDesignerOutput,
  QualityScorerOutput,
  SelectorProposerOutput,
} from './signatures.js';

// ── Module Error ────────────────────────────────────────────────
export class ModuleError extends Error {
  constructor(
    readonly module: string,
    message: string,
  ) {
    super(`[${module}] ${message}`);
    this.name = 'ModuleError';
  }
}

// ── Base Module Pattern ─────────────────────────────────────────
type ModuleForward<I, O> = (input: I) => Promise<Result<O, ModuleError>>;

function createModule<I, O>(
  name: string,
  _schema: { parse(data: unknown): O },
  buildPrompt: (input: I) => string,
): ModuleForward<I, O> {
  return async (input: I): Promise<Result<O, ModuleError>> => {
    try {
      const prompt = buildPrompt(input);
      // In production, this calls Anthropic API with chain-of-thought
      // For now, return a structured placeholder that can be overridden
      void prompt;
      return Err(
        new ModuleError(name, 'LM not configured — call pipeline.configure() first'),
      );
    } catch (e) {
      return Err(
        new ModuleError(name, e instanceof Error ? e.message : String(e)),
      );
    }
  };
}

// ── Page Classifier Module ──────────────────────────────────────
export const pageClassifierModule: ModuleForward<
  PageClassifierInputT,
  PageClassifierOutputT
> = createModule('PageClassifier', PageClassifierOutput, (input) =>
  [
    'Classify this web page into one of: doc, research, news, api, legal, product, plugin_spec, sdk_ref',
    `URL: ${input.url}`,
    `Title: ${input.title}`,
    `Content: ${input.contentSnippet.slice(0, 2000)}`,
    `HTML: ${input.htmlSnippet.slice(0, 1000)}`,
  ].join('\n'),
);

// ── Quality Scorer Module ───────────────────────────────────────
export const qualityScorerModule: ModuleForward<
  QualityScorerInputT,
  QualityScorerOutputT
> = createModule('QualityScorer', QualityScorerOutput, (input) =>
  [
    'Score extraction quality (completeness, structure, links) each 0.0-1.0',
    `URL: ${input.url}`,
    `Content: ${input.extractedContent.slice(0, 3000)}`,
    `Structured data: ${input.structuredData.slice(0, 2000)}`,
    `Selectors: ${input.selectorsUsed}`,
    `Links: ${input.linkCount}`,
  ].join('\n'),
);

// ── Selector Proposer Module ────────────────────────────────────
export const selectorProposerModule: ModuleForward<
  SelectorProposerInputT,
  SelectorProposerOutputT
> = createModule('SelectorProposer', SelectorProposerOutput, (input) =>
  [
    'Propose improved selectors. Format: old -> new',
    `Spider: ${input.spiderName}`,
    `Current: ${input.currentSelectors}`,
    `Failing: ${input.failingSelectors}`,
    `HTML: ${input.htmlSample.slice(0, 5000)}`,
    `Page type: ${input.pageType}`,
  ].join('\n'),
);

// ── Plugin Designer Module ──────────────────────────────────────
export const pluginDesignerModule: ModuleForward<
  PluginDesignerInputT,
  PluginDesignerOutputT
> = createModule('PluginDesigner', PluginDesignerOutput, (input) =>
  [
    'Design a Claude Code plugin with skills, agents, connectors',
    `Domain: ${input.domain}`,
    `Summaries: ${input.crawledSummaries}`,
    `Page types: ${input.discoveredPageTypes}`,
    `Existing: ${input.existingPlugins}`,
  ].join('\n'),
);

// ── Codegen Router Module ───────────────────────────────────────
export const codegenRouterModule: ModuleForward<
  CodegenRouterInputT,
  CodegenRouterOutputT
> = createModule('CodegenRouter', CodegenRouterOutput, (input) =>
  [
    'Route codegen to language + scaffold type',
    `Task: ${input.taskDescription}`,
    `Env: ${input.targetEnvironment}`,
    `Preferred: ${input.preferredLanguages}`,
    `Constraints: ${input.constraints}`,
  ].join('\n'),
);
