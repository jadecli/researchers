// src/agent/loop.ts — The core agentic loop with full type safety
//
// Anthropic's agent loop: while loop alternating between LLM calls and tool execution.
// Tool calls execute in parallel via Promise.all — Anthropic found parallel tool calling
// reduces research time by 90%.

import Anthropic from '@anthropic-ai/sdk';
import type {
  Result,
  TokenUsage,
  ModelId,
} from '../types/core.js';
import { Ok, Err, toTokenCount, toUSD } from '../types/core.js';

// ── Tool Definition ─────────────────────────────────────────────
export type ToolDefinition = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly execute: (input: Record<string, unknown>) => Promise<string>;
};

// ── Agent Loop Configuration ────────────────────────────────────
export type AgentLoopConfig = {
  readonly model: ModelId;
  readonly systemPrompt: string;
  readonly tools: ReadonlyArray<ToolDefinition>;
  readonly maxTurns: number;
  readonly maxBudgetUsd: number;
  readonly maxTokens: number;
  readonly effort: 'low' | 'medium' | 'high' | 'max';
};

export const DEFAULT_CONFIG: Omit<AgentLoopConfig, 'systemPrompt' | 'tools'> = {
  model: 'claude-sonnet-4-20250514',
  maxTurns: 25,
  maxBudgetUsd: 5.0,
  maxTokens: 16384,
  effort: 'high',
};

// ── Agent Loop Error Types ──────────────────────────────────────
export class AgentBudgetExceededError extends Error {
  constructor(
    public readonly spent: number,
    public readonly budget: number,
  ) {
    super(`Budget exceeded: $${spent.toFixed(4)} > $${budget.toFixed(4)}`);
    this.name = 'AgentBudgetExceededError';
  }
}

export class AgentMaxTurnsError extends Error {
  constructor(public readonly turns: number) {
    super(`Max turns reached: ${turns}`);
    this.name = 'AgentMaxTurnsError';
  }
}

// ── Loop Result ─────────────────────────────────────────────────
export type AgentLoopResult = {
  readonly text: string;
  readonly usage: TokenUsage;
  readonly turns: number;
  readonly toolCallCount: number;
};

// ── The Loop ────────────────────────────────────────────────────
export async function runAgentLoop(
  config: AgentLoopConfig,
  userPrompt: string,
): Promise<Result<AgentLoopResult, Error>> {
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userPrompt },
  ];
  const toolDefs = config.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));

  let turns = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheCreation = 0;
  let totalCacheRead = 0;
  let totalToolCalls = 0;

  while (turns < config.maxTurns) {
    turns++;

    // Budget check
    const currentCost = estimateCost(
      config.model,
      totalInputTokens,
      totalOutputTokens,
      totalCacheCreation,
      totalCacheRead,
    );
    if (currentCost > config.maxBudgetUsd) {
      return Err(new AgentBudgetExceededError(currentCost, config.maxBudgetUsd));
    }

    const response = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      system: config.systemPrompt,
      tools: toolDefs,
      messages,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;
    if ('cache_creation_input_tokens' in response.usage) {
      totalCacheCreation += (response.usage as unknown as Record<string, number>)['cache_creation_input_tokens'] ?? 0;
    }
    if ('cache_read_input_tokens' in response.usage) {
      totalCacheRead += (response.usage as unknown as Record<string, number>)['cache_read_input_tokens'] ?? 0;
    }

    // Check stop_reason — the core loop control
    // "tool_use" → continue loop; "end_turn" → return final response
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ContentBlock & { type: 'tool_use' } =>
        block.type === 'tool_use',
    );

    if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
      const textBlock = response.content.find((b) => b.type === 'text');
      const text = textBlock && 'text' in textBlock ? textBlock.text : '';
      return Ok({
        text,
        turns,
        toolCallCount: totalToolCalls,
        usage: buildUsage(
          config.model,
          totalInputTokens,
          totalOutputTokens,
          totalCacheCreation,
          totalCacheRead,
        ),
      });
    }

    // Execute all tool calls in parallel (Anthropic's key perf insight)
    totalToolCalls += toolUseBlocks.length;
    messages.push({ role: 'assistant', content: response.content });

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const tool = config.tools.find((t) => t.name === block.name);
        if (!tool) {
          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: JSON.stringify({
              error: `Unknown tool: ${block.name}`,
              errorCategory: 'validation',
              isRetryable: false,
            }),
            is_error: true as const,
          };
        }
        try {
          const result = await tool.execute(
            block.input as Record<string, unknown>,
          );
          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: result,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const isTransient = msg.includes('timeout') || msg.includes('ECONNREFUSED');
          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: JSON.stringify({
              error: msg,
              errorCategory: isTransient ? 'transient' : 'business',
              isRetryable: isTransient,
            }),
            is_error: true as const,
          };
        }
      }),
    );

    messages.push({ role: 'user', content: toolResults });
  }

  return Err(new AgentMaxTurnsError(config.maxTurns));
}

// ── Cost Estimation ─────────────────────────────────────────────
const RATES: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  'claude-opus-4-20250514': { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  'claude-sonnet-4-20250514': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-haiku-3-5-20241022': { input: 0.8, output: 4, cacheWrite: 1.0, cacheRead: 0.08 },
};

function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheWriteTokens: number,
  cacheReadTokens: number,
): number {
  const rate = RATES[model] ?? RATES['claude-sonnet-4-20250514']!;
  return (
    (inputTokens * rate.input) / 1_000_000 +
    (outputTokens * rate.output) / 1_000_000 +
    (cacheWriteTokens * rate.cacheWrite) / 1_000_000 +
    (cacheReadTokens * rate.cacheRead) / 1_000_000
  );
}

function buildUsage(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreation: number,
  cacheRead: number,
): TokenUsage {
  return {
    inputTokens: toTokenCount(inputTokens),
    outputTokens: toTokenCount(outputTokens),
    cacheCreationTokens: toTokenCount(cacheCreation),
    cacheReadTokens: toTokenCount(cacheRead),
    cost: toUSD(estimateCost(model, inputTokens, outputTokens, cacheCreation, cacheRead)),
  };
}
