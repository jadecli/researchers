// src/pipeline/signatures.ts — Structured pipeline signatures (TypeScript port of DSPy signatures)
import { z } from 'zod';

// ── Page Classifier Signature ───────────────────────────────────
export const PageClassifierInput = z.object({
  url: z.string(),
  title: z.string(),
  contentSnippet: z.string(),
  htmlSnippet: z.string(),
});

export const PageClassifierOutput = z.object({
  pageType: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type PageClassifierInputT = z.infer<typeof PageClassifierInput>;
export type PageClassifierOutputT = z.infer<typeof PageClassifierOutput>;

// ── Quality Scorer Signature ────────────────────────────────────
export const QualityScorerInput = z.object({
  url: z.string(),
  extractedContent: z.string(),
  structuredData: z.string(),
  selectorsUsed: z.string(),
  linkCount: z.number().int(),
});

export const QualityScorerOutput = z.object({
  completeness: z.number().min(0).max(1),
  structure: z.number().min(0).max(1),
  links: z.number().min(0).max(1),
  issues: z.string(),
});

export type QualityScorerInputT = z.infer<typeof QualityScorerInput>;
export type QualityScorerOutputT = z.infer<typeof QualityScorerOutput>;

// ── Selector Proposer Signature ─────────────────────────────────
export const SelectorProposerInput = z.object({
  spiderName: z.string(),
  currentSelectors: z.string(),
  failingSelectors: z.string(),
  htmlSample: z.string(),
  pageType: z.string(),
});

export const SelectorProposerOutput = z.object({
  proposedSelectors: z.string(),
  rationale: z.string(),
  expectedImprovement: z.number().min(0).max(1),
});

export type SelectorProposerInputT = z.infer<typeof SelectorProposerInput>;
export type SelectorProposerOutputT = z.infer<typeof SelectorProposerOutput>;

// ── Plugin Designer Signature ───────────────────────────────────
export const PluginDesignerInput = z.object({
  domain: z.string(),
  crawledSummaries: z.string(),
  discoveredPageTypes: z.string(),
  existingPlugins: z.string(),
});

export const PluginDesignerOutput = z.object({
  pluginName: z.string(),
  pluginDescription: z.string(),
  skillsJson: z.string(),
  agentsJson: z.string(),
  connectorsJson: z.string(),
});

export type PluginDesignerInputT = z.infer<typeof PluginDesignerInput>;
export type PluginDesignerOutputT = z.infer<typeof PluginDesignerOutput>;

// ── Codegen Router Signature ────────────────────────────────────
export const CodegenRouterInput = z.object({
  taskDescription: z.string(),
  targetEnvironment: z.string(),
  preferredLanguages: z.string(),
  constraints: z.string(),
});

export const CodegenRouterOutput = z.object({
  primaryLanguage: z.string(),
  secondaryLanguages: z.string(),
  framework: z.string(),
  scaffoldType: z.string(),
  rationale: z.string(),
});

export type CodegenRouterInputT = z.infer<typeof CodegenRouterInput>;
export type CodegenRouterOutputT = z.infer<typeof CodegenRouterOutput>;
