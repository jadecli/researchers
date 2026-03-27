// ─── Types ──────────────────────────────────────────────────────────────────
export type {
  DispatchId,
  RoundId,
  AgentId,
  SessionId,
  ToolCallId,
  TokenCount,
  USD,
  TranscriptId,
  AuditId,
  Result,
  ModelId,
  ModelAlias,
  TokenUsage,
} from './types/core.js';

export {
  Ok,
  Err,
  map,
  flatMap,
  unwrap,
  unwrapOr,
  assertNever,
  resolveModel,
  toDispatchId,
  toRoundId,
  toAgentId,
  toSessionId,
  toToolCallId,
  toTokenCount,
  toUSD,
  toTranscriptId,
  toAuditId,
} from './types/core.js';

export type {
  QualityDimension,
  DimensionScore,
  QualityScore,
  QualityThreshold,
  ContextDeltaPayload,
  QualityFeedback,
} from './types/quality.js';

export type {
  Message,
  Event,
  ToolCallEvent,
  ToolResultEvent,
  DecisionEvent,
  QualityScoreEvent,
  ContextDeltaEvent,
  DispatchEvent,
  AuditEvent,
  TranscriptMetadata,
  Transcript,
} from './types/transcript.js';

export type {
  DispatchTask,
  SimpleTask,
  ParallelTask,
  SequentialTask,
  ConditionalTask,
  DispatchPlan,
  DispatchResult,
  DispatchState,
  PlatformTarget,
} from './types/dispatch.js';

export type {
  ThoughtType,
  Assumption,
  ShannonThought,
  ThoughtChain,
  ThinkingReport,
} from './types/thinking.js';

// ─── Logging ────────────────────────────────────────────────────────────────
export {
  JSONLWriter,
  TranscriptBuilder,
  SessionTracker,
  DispatchTracker,
  MODEL_PRICING,
  calculateCost,
} from './logging/index.js';

// ─── Quality ────────────────────────────────────────────────────────────────
export {
  DIMENSION_WEIGHTS,
  scoreOutput,
  meetsThreshold,
  JudgmentEngine,
  CalibrationModel,
  generateFeedback,
  buildContextDelta,
  aggregateFeedback,
} from './quality/index.js';
export type { JudgmentResult, JudgmentReport } from './quality/index.js';

// ─── Refinement ─────────────────────────────────────────────────────────────
export {
  SeedImprover,
  SelectorEvolver,
  ContextDeltaAccumulator,
} from './refinement/index.js';
export type { ImprovementResult, SelectorPatch, AgentProfile } from './refinement/index.js';

// ─── Dispatch ───────────────────────────────────────────────────────────────
export {
  HeadlessRunner,
  ActionsDispatcher,
  ChromeDispatcher,
  SlackDispatcher,
} from './dispatch/index.js';
export type { StreamEvent, RunStatus, McpToolExecutor } from './dispatch/index.js';

// ─── Safety ─────────────────────────────────────────────────────────────────
export {
  DispatchValidator,
  SSRFScanner,
  PIIScanner,
  luhnCheck,
} from './safety/index.js';
export type {
  Finding,
  ValidationResult,
  SSRFVulnerability,
  PIIMatch,
} from './safety/index.js';

// ─── Rounds ─────────────────────────────────────────────────────────────────
export {
  RoundRunner,
  ROUND_07,
  ROUND_08,
  ROUND_09,
  ROUND_10,
  ROUND_DEFINITIONS,
} from './rounds/index.js';
export type { RoundDefinition, RoundResult, AuditStore } from './rounds/index.js';

// ─── Pipeline ───────────────────────────────────────────────────────────────
export {
  STAGE_TEMPLATES,
  renderTemplate,
  loadTemplatesFromYaml,
} from './pipeline/templates.js';
