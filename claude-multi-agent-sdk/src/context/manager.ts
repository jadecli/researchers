// src/context/manager.ts — Context window management utilities
//
// Context engineering: curating the smallest possible set of high-signal tokens.
// Seven layers: system prompt optimization → tool token efficiency →
// just-in-time retrieval → compaction → structured note-taking →
// sub-agent isolation → programmatic tool calling.

import type { TokenCount } from '../types/core.js';
import { toTokenCount, assertNever } from '../types/core.js';

// ── Context Budget ──────────────────────────────────────────────
export type ContextBudget = {
  readonly maxTokens: TokenCount;
  readonly systemPromptTokens: TokenCount;
  readonly toolDefinitionTokens: TokenCount;
  readonly conversationTokens: TokenCount;
  readonly remainingTokens: TokenCount;
  readonly usageRatio: number;
};

export function calculateBudget(
  maxTokens: number,
  systemTokens: number,
  toolTokens: number,
  conversationTokens: number,
): ContextBudget {
  const remaining = maxTokens - systemTokens - toolTokens - conversationTokens;
  return {
    maxTokens: toTokenCount(maxTokens),
    systemPromptTokens: toTokenCount(systemTokens),
    toolDefinitionTokens: toTokenCount(toolTokens),
    conversationTokens: toTokenCount(conversationTokens),
    remainingTokens: toTokenCount(Math.max(0, remaining)),
    usageRatio: 1 - Math.max(0, remaining) / maxTokens,
  };
}

// ── Compaction Strategy ─────────────────────────────────────────
// Three tiers matching Anthropic's Claude Code compaction:
// 1. Light-touch: clear old tool results, keep recent
// 2. Full: summarize conversation, preserve key files
// 3. Nuclear: delegate to sub-agent with fresh context
export type CompactionStrategy =
  | {
      readonly type: 'tool_result_clearing';
      readonly keepRecent: number;
    }
  | {
      readonly type: 'conversation_summary';
      readonly preserveFiles: ReadonlyArray<string>;
      readonly preserveDecisions: boolean;
    }
  | {
      readonly type: 'sub_agent_delegation';
      readonly taskDescription: string;
      readonly contextSummary: string;
    };

export function selectCompactionStrategy(
  budget: ContextBudget,
): CompactionStrategy {
  if (budget.usageRatio < 0.7) {
    return { type: 'tool_result_clearing', keepRecent: 5 };
  }
  if (budget.usageRatio < 0.9) {
    return {
      type: 'conversation_summary',
      preserveFiles: [],
      preserveDecisions: true,
    };
  }
  return {
    type: 'sub_agent_delegation',
    taskDescription: 'Continue the current task with fresh context',
    contextSummary: '',
  };
}

export function describeCompactionStrategy(strategy: CompactionStrategy): string {
  switch (strategy.type) {
    case 'tool_result_clearing':
      return `Clear tool results, keeping ${strategy.keepRecent} most recent`;
    case 'conversation_summary':
      return `Summarize conversation${strategy.preserveDecisions ? ', preserving architectural decisions' : ''}`;
    case 'sub_agent_delegation':
      return `Delegate to sub-agent: ${strategy.taskDescription}`;
    default:
      return assertNever(strategy);
  }
}

// ── Progressive Disclosure for Tools ────────────────────────────
// Mirrors Anthropic's Tool Search Tool: 85% token reduction
export type ToolManifestEntry = {
  readonly name: string;
  readonly briefDescription: string; // ~20 tokens
  readonly fullDefinition: Record<string, unknown>; // ~200+ tokens
  readonly deferLoading: boolean;
};

export type ToolManifest = {
  readonly deferred: ReadonlyArray<{
    name: string;
    description: string;
  }>;
  readonly immediate: ReadonlyArray<Record<string, unknown>>;
};

export function createToolManifest(
  tools: ReadonlyArray<ToolManifestEntry>,
): ToolManifest {
  return {
    deferred: tools
      .filter((t) => t.deferLoading)
      .map((t) => ({ name: t.name, description: t.briefDescription })),
    immediate: tools.filter((t) => !t.deferLoading).map((t) => t.fullDefinition),
  };
}

export function estimateToolTokenSavings(
  tools: ReadonlyArray<ToolManifestEntry>,
): { before: number; after: number; savedPercent: number } {
  const fullTokens = tools.reduce(
    (s, t) => s + JSON.stringify(t.fullDefinition).length / 4,
    0,
  );
  const deferredTokens = tools
    .filter((t) => t.deferLoading)
    .reduce((s, t) => s + t.briefDescription.length / 4, 0);
  const immediateTokens = tools
    .filter((t) => !t.deferLoading)
    .reduce((s, t) => s + JSON.stringify(t.fullDefinition).length / 4, 0);
  const after = deferredTokens + immediateTokens;
  return {
    before: Math.round(fullTokens),
    after: Math.round(after),
    savedPercent: Math.round(((fullTokens - after) / fullTokens) * 100),
  };
}

// ── Structured Note-Taking (Agentic Memory) ─────────────────────
// Agent writes notes persisted outside context window
export type AgentMemoryCategory =
  | 'architectural_decision'
  | 'unresolved_bug'
  | 'key_finding'
  | 'todo'
  | 'source_reference';

export type AgentMemoryEntry = {
  readonly timestamp: string;
  readonly category: AgentMemoryCategory;
  readonly content: string;
  readonly source: string;
  readonly confidence?: number;
};

export function formatMemoryForContext(
  entries: ReadonlyArray<AgentMemoryEntry>,
  maxTokens: number,
): string {
  // Prioritize by category importance
  const priority: Record<AgentMemoryCategory, number> = {
    key_finding: 0,
    unresolved_bug: 1,
    todo: 2,
    architectural_decision: 3,
    source_reference: 4,
  };

  const sorted = [...entries].sort(
    (a, b) => priority[a.category] - priority[b.category],
  );

  let output = '## Agent Memory\n\n';
  let estimatedTokens = 10;

  for (const entry of sorted) {
    const confidence = entry.confidence !== undefined ? ` (confidence: ${(entry.confidence * 100).toFixed(0)}%)` : '';
    const line = `- [${entry.category}] ${entry.content}${confidence} (from: ${entry.source})\n`;
    const lineTokens = Math.ceil(line.length / 4);
    if (estimatedTokens + lineTokens > maxTokens) break;
    output += line;
    estimatedTokens += lineTokens;
  }

  return output;
}

// ── Context Extraction (trim verbose tool outputs) ──────────────
// From Anthropic: keep only return-relevant fields from order lookups
export function trimToolOutput(
  toolOutput: string,
  relevantFields: ReadonlyArray<string>,
): string {
  try {
    const parsed = JSON.parse(toolOutput) as Record<string, unknown>;
    const trimmed: Record<string, unknown> = {};
    for (const field of relevantFields) {
      if (field in parsed) {
        trimmed[field] = parsed[field];
      }
    }
    return JSON.stringify(trimmed);
  } catch {
    // Not JSON — return as-is but truncated
    if (toolOutput.length > 2000) {
      return toolOutput.slice(0, 2000) + '\n...[truncated]';
    }
    return toolOutput;
  }
}

// ── Case Facts Extraction ───────────────────────────────────────
// From Anthropic's customer support pattern: extract transactional facts
// into a persistent block included in each prompt
export type CaseFacts = {
  readonly customerId?: string;
  readonly orderIds: ReadonlyArray<string>;
  readonly amounts: ReadonlyArray<{ orderId: string; amount: number; currency: string }>;
  readonly dates: ReadonlyArray<{ event: string; date: string }>;
  readonly statuses: ReadonlyArray<{ entity: string; status: string }>;
};

export function formatCaseFacts(facts: CaseFacts): string {
  let output = '## Case Facts\n';
  if (facts.customerId) output += `- Customer: ${facts.customerId}\n`;
  for (const order of facts.orderIds) output += `- Order: ${order}\n`;
  for (const amount of facts.amounts)
    output += `- Amount (${amount.orderId}): ${amount.currency} ${amount.amount}\n`;
  for (const date of facts.dates)
    output += `- ${date.event}: ${date.date}\n`;
  for (const status of facts.statuses)
    output += `- ${status.entity}: ${status.status}\n`;
  return output;
}
