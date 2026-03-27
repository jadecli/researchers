// src/index.ts — Barrel exports for @anthropic-skills/multi-agent-research

// Core types
export type {
  AgentId,
  SessionId,
  ToolCallId,
  TokenCount,
  USD,
  Result,
  AgentMessage,
  ContentBlock,
  ToolCall,
  TokenUsage,
  AgentState,
  SubagentResult,
  ModelId,
  ModelAlias,
} from './types/core.js';

export {
  toAgentId,
  toSessionId,
  toToolCallId,
  toTokenCount,
  toUSD,
  Ok,
  Err,
  map,
  flatMap,
  unwrap,
  unwrapOr,
  assertNever,
  handleAgentState,
  resolveModel,
} from './types/core.js';

// Agent loop
export type { ToolDefinition, AgentLoopConfig, AgentLoopResult } from './agent/loop.js';
export {
  runAgentLoop,
  DEFAULT_CONFIG,
  AgentBudgetExceededError,
  AgentMaxTurnsError,
} from './agent/loop.js';

// Orchestrator
export type {
  QueryType,
  SubagentTask,
  OrchestrationResult,
} from './agent/orchestrator.js';
export {
  classifyQuery,
  determineScale,
  orchestrateResearch,
  buildSubagentTasks,
} from './agent/orchestrator.js';

// Context management
export type {
  ContextBudget,
  CompactionStrategy,
  ToolManifestEntry,
  ToolManifest,
  AgentMemoryCategory,
  AgentMemoryEntry,
  CaseFacts,
} from './context/manager.js';
export {
  calculateBudget,
  selectCompactionStrategy,
  describeCompactionStrategy,
  createToolManifest,
  estimateToolTokenSavings,
  formatMemoryForContext,
  trimToolOutput,
  formatCaseFacts,
} from './context/manager.js';

// MCP server
export { createResearchMcpServer } from './mcp/server.js';

// Hooks
export type { HookEvent, HookType, HookRule, HookProfile } from './hooks/profiles.js';
export {
  researchAgentHooks,
  securityHooks,
  ciHooks,
  generateSettingsJson,
  mergeProfiles,
} from './hooks/profiles.js';

// Monitoring
export type { TelemetryEvent, ModelPricing } from './monitoring/telemetry.js';
export {
  MODEL_PRICING,
  calculateSessionCost,
  SessionTracker,
  generateDockerCompose,
  generateTelemetryEnvScript,
} from './monitoring/telemetry.js';
