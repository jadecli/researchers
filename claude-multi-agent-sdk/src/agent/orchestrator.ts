// src/agent/orchestrator.ts — Lead-subagent multi-agent research architecture
//
// Anthropic's pattern: Opus lead spawns Sonnet subagents.
// Lead handles planning + synthesis; subagents handle exploration + compression.
// Each subagent gets a clean context window and returns condensed findings.
// 10K+ tokens of exploration → 1-2K tokens of summary.

import type {
  AgentId,
  SubagentResult,
  Result,
  TokenUsage,
  ModelAlias,
} from '../types/core.js';
import {
  Ok,
  Err,
  toAgentId,
  toTokenCount,
  toUSD,
  assertNever,
  resolveModel,
} from '../types/core.js';
import { runAgentLoop, type ToolDefinition } from './loop.js';

// ── Query Classification ────────────────────────────────────────
export type QueryType =
  | { readonly type: 'straightforward'; readonly approach: string }
  | {
      readonly type: 'depth_first';
      readonly perspectives: ReadonlyArray<string>;
    }
  | {
      readonly type: 'breadth_first';
      readonly subtopics: ReadonlyArray<string>;
    };

// ── Subagent Task Definition ────────────────────────────────────
export type SubagentTask = {
  readonly id: AgentId;
  readonly objective: string;
  readonly outputFormat: string;
  readonly tools: ReadonlyArray<ToolDefinition>;
  readonly model: ModelAlias;
  readonly maxTurns: number;
  readonly systemPrompt?: string;
};

// ── Scaling Rules (from Anthropic's actual prompts) ─────────────
export function determineScale(queryType: QueryType): {
  agentCount: number;
  toolCallsPerAgent: number;
} {
  switch (queryType.type) {
    case 'straightforward':
      return { agentCount: 1, toolCallsPerAgent: 10 };
    case 'depth_first':
      return {
        agentCount: Math.min(queryType.perspectives.length, 5),
        toolCallsPerAgent: 15,
      };
    case 'breadth_first':
      return {
        agentCount: Math.min(queryType.subtopics.length, 20),
        toolCallsPerAgent: 15,
      };
    default:
      return assertNever(queryType);
  }
}

// ── Query Classifier ────────────────────────────────────────────
export function classifyQuery(query: string): QueryType {
  const lower = query.toLowerCase();

  const breadthSignals = [
    'compare',
    'list all',
    'each of',
    'versus',
    ' vs ',
    'differences between',
    'pros and cons',
    'alternatives to',
  ];
  const depthSignals = [
    'why',
    'how does',
    'analyze',
    'deep dive',
    'root cause',
    'implications',
    'investigate',
    'explain in detail',
  ];

  const hasBreadth = breadthSignals.some((s) => lower.includes(s));
  const hasDepth = depthSignals.some((s) => lower.includes(s));

  if (hasBreadth && !hasDepth) {
    return {
      type: 'breadth_first',
      subtopics: extractSubtopics(query),
    };
  }

  if (hasDepth) {
    return {
      type: 'depth_first',
      perspectives: ['technical', 'strategic', 'empirical', 'comparative'],
    };
  }

  return { type: 'straightforward', approach: 'direct_search' };
}

function extractSubtopics(query: string): ReadonlyArray<string> {
  const entities = query.match(/(?:compare|between|vs\.?)\s+(.+)/i);
  if (!entities?.[1]) return [query];
  return entities[1]
    .split(/,|\band\b|vs\.?/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ── Orchestration Result ────────────────────────────────────────
export type OrchestrationResult = {
  readonly queryType: QueryType;
  readonly scale: { agentCount: number; toolCallsPerAgent: number };
  readonly subagentResults: ReadonlyArray<SubagentResult>;
  readonly synthesis: string;
  readonly totalUsage: TokenUsage;
  readonly totalDuration: number;
};

// ── Research Orchestrator ───────────────────────────────────────
export async function orchestrateResearch(
  userQuery: string,
  tasks: ReadonlyArray<SubagentTask>,
  synthesisPrompt?: string,
): Promise<Result<OrchestrationResult, Error>> {
  const startTime = Date.now();
  const queryType = classifyQuery(userQuery);
  const scale = determineScale(queryType);

  // Fan-out: spawn all subagents in parallel
  const subagentPromises = tasks.map(
    async (task): Promise<SubagentResult> => {
      const agentStart = Date.now();

      const systemPrompt =
        task.systemPrompt ??
        `You are a research subagent. Your task: ${task.objective}
Output format: ${task.outputFormat}
Be thorough but concise. Return only high-signal findings.
Include source URLs and evidence for every claim.`;

      const result = await runAgentLoop(
        {
          model: resolveModel(task.model),
          systemPrompt,
          tools: [...task.tools],
          maxTurns: task.maxTurns,
          maxBudgetUsd: 1.0,
          maxTokens: 8192,
          effort: 'high',
        },
        task.objective,
      );

      return {
        agentId: task.id,
        summary: result.ok ? result.value.text : `Error: ${result.error.message}`,
        tokenUsage: result.ok
          ? result.value.usage
          : {
              inputTokens: toTokenCount(0),
              outputTokens: toTokenCount(0),
              cacheCreationTokens: toTokenCount(0),
              cacheReadTokens: toTokenCount(0),
              cost: toUSD(0),
            },
        duration: Date.now() - agentStart,
      };
    },
  );

  try {
    const results = await Promise.all(subagentPromises);

    // Synthesize results
    const synthesis = synthesizeResults(
      userQuery,
      results,
      synthesisPrompt,
    );

    // Aggregate usage
    const totalUsage: TokenUsage = {
      inputTokens: toTokenCount(
        results.reduce((s, r) => s + (r.tokenUsage.inputTokens as number), 0),
      ),
      outputTokens: toTokenCount(
        results.reduce((s, r) => s + (r.tokenUsage.outputTokens as number), 0),
      ),
      cacheCreationTokens: toTokenCount(
        results.reduce(
          (s, r) => s + (r.tokenUsage.cacheCreationTokens as number),
          0,
        ),
      ),
      cacheReadTokens: toTokenCount(
        results.reduce(
          (s, r) => s + (r.tokenUsage.cacheReadTokens as number),
          0,
        ),
      ),
      cost: toUSD(
        results.reduce((s, r) => s + (r.tokenUsage.cost as number), 0),
      ),
    };

    return Ok({
      queryType,
      scale,
      subagentResults: results,
      synthesis,
      totalUsage,
      totalDuration: Date.now() - startTime,
    });
  } catch (err) {
    return Err(err instanceof Error ? err : new Error(String(err)));
  }
}

// ── Synthesis ───────────────────────────────────────────────────
function synthesizeResults(
  query: string,
  results: ReadonlyArray<SubagentResult>,
  _customPrompt?: string,
): string {
  const successful = results.filter((r) => !r.summary.startsWith('Error:'));
  const failed = results.filter((r) => r.summary.startsWith('Error:'));

  let output = `# Research Synthesis: ${query}\n\n`;

  if (failed.length > 0) {
    output += `> **Note**: ${failed.length} of ${results.length} subagents encountered errors.\n\n`;
  }

  for (const result of successful) {
    output += `## ${result.agentId}\n`;
    output += `${result.summary}\n`;
    output += `*Duration: ${(result.duration / 1000).toFixed(1)}s | Cost: $${(result.tokenUsage.cost as number).toFixed(4)}*\n\n`;
  }

  if (failed.length > 0) {
    output += `## Coverage Gaps\n`;
    for (const result of failed) {
      output += `- **${result.agentId}**: ${result.summary}\n`;
    }
  }

  return output;
}

// ── Task Builder Helper ─────────────────────────────────────────
export function buildSubagentTasks(
  queryType: QueryType,
  baseTools: ReadonlyArray<ToolDefinition>,
  model: ModelAlias = 'sonnet',
  maxTurns = 15,
): ReadonlyArray<SubagentTask> {
  switch (queryType.type) {
    case 'straightforward':
      return [
        {
          id: toAgentId('agent-0'),
          objective: queryType.approach,
          outputFormat: 'Concise findings with sources',
          tools: baseTools,
          model,
          maxTurns,
        },
      ];
    case 'depth_first':
      return queryType.perspectives.map((perspective, i) => ({
        id: toAgentId(`agent-${i}-${perspective}`),
        objective: `Analyze from ${perspective} perspective`,
        outputFormat: `${perspective} analysis with evidence`,
        tools: baseTools,
        model,
        maxTurns,
      }));
    case 'breadth_first':
      return queryType.subtopics.map((topic, i) => ({
        id: toAgentId(`agent-${i}-${topic.replace(/\s+/g, '-').toLowerCase()}`),
        objective: `Research: ${topic}`,
        outputFormat: 'Structured findings with key facts bolded',
        tools: baseTools,
        model,
        maxTurns,
      }));
    default:
      return assertNever(queryType);
  }
}
