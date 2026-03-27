// src/index.ts — Barrel exports for claude-code-agents-typescript

// ── Foundation Types ────────────────────────────────────────────
export {
  type CampaignId,
  type Confidence,
  type DomainId,
  type Iteration,
  type LanguageId,
  type PluginName,
  type QualityValue,
  type Result,
  type SpiderName,
  type USD,
  type Url,
  Err,
  Ok,
  assertNever,
  flatMap,
  map,
  toCampaignId,
  toConfidence,
  toDomainId,
  toIteration,
  toLanguageId,
  toPluginName,
  toQualityValue,
  toSpiderName,
  toUSD,
  toUrl,
  unwrap,
  unwrapOr,
} from './types.js';

// ── Models ──────────────────────────────────────────────────────
export {
  type CrawlPlan,
  type CrawlTarget,
  type PageType,
  PAGE_TYPES,
  createCrawlPlan,
  createCrawlTarget,
  describePageType,
  effectiveDomains,
  isPageType,
  sortedTargets,
  toPageType,
  totalMaxPages,
} from './models/crawl-target.js';

export {
  type ContextDelta,
  type ExtractionResult,
  type QualityScore,
  EMPTY_QUALITY,
  computeQualityScore,
  contentLength,
  isEmpty,
  isRegression,
  isStagnant,
  linkCount,
  meetsThreshold,
  qualityImprovement,
} from './models/extraction-result.js';

export {
  type ImprovementSuggestion,
  type SelectorPatch,
  applyToSource,
  asDiffLine,
  createSelectorPatch,
  isHighConfidence,
  toSelectorPatch,
} from './models/improvement.js';

export {
  type LanguageConfig,
  type SupportedLanguage,
  LSP_BINARIES,
  SDK_PACKAGES,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  languageConfigFor,
} from './models/language.js';

export {
  type AgentSpec,
  type ConnectorSpec,
  type PluginSpec,
  type SkillSpec,
  type TransportType,
  agentCount,
  agentFileName,
  connectorCount,
  createAgentSpec,
  createConnectorSpec,
  createPluginSpec,
  createSkillSpec,
  hasPlaceholders,
  pluginDirName,
  skillCount,
  skillFileName,
} from './models/plugin-spec.js';

// ── Pipeline ────────────────────────────────────────────────────
export {
  type ClassificationResult,
  type CodegenRouteResult,
  PipelineError,
  ResearchPipeline,
} from './pipeline/pipeline.js';

export {
  type AdapterCrawlCampaign,
  type AdapterCrawlResult,
  type AdapterCrawlTarget,
  type CrawlPriority,
  type SpiderType,
  CRAWL_PRIORITIES,
  SPIDER_TYPES,
  VIDEO_AI_CRAWL_CAMPAIGN,
  campaignToJson,
  convertPromptToCampaign,
  resultPassed,
} from './pipeline/crawl-adapter.js';

// ── Orchestrator ────────────────────────────────────────────────
export {
  CampaignError,
  type CampaignState,
  CrawlCampaign,
  type PlanSummary,
} from './orchestrator/campaign.js';

export {
  HeadlessRunner,
  type HeadlessRunnerConfig,
  RunnerError,
  RunnerNotFoundError,
  RunnerTimeoutError,
  type StreamEvent,
} from './orchestrator/headless-runner.js';

export { ImprovementChain } from './orchestrator/improvement-chain.js';

export { injectContext } from './orchestrator/context-injector.js';

// ── Codegen ─────────────────────────────────────────────────────
export {
  LanguageRouter,
  type RouteResult,
} from './codegen/language-router.js';

export {
  TemplateEngine,
  type TemplateFile,
} from './codegen/template-engine.js';

export {
  MultiLangScaffold,
  type ScaffoldResult,
} from './codegen/multi-lang-scaffold.js';

// ── Cowork ──────────────────────────────────────────────────────
export {
  type CoworkDomain,
  COWORK_DOMAINS,
  CoworkTaskRouter,
  type TaskRouteResult,
} from './cowork/task-router.js';

export {
  PluginRecommender,
  type PluginRecommendation,
  type RecommendationResult,
} from './cowork/plugin-recommender.js';

export {
  KnowledgeSynthesizer,
  type KnowledgeSynthesis,
  type QualityTier,
  type SynthesisStats,
} from './cowork/knowledge-synthesizer.js';

// ── Plugin Generation ───────────────────────────────────────────
export { generatePlugin } from './plugin_gen/scaffold.js';
