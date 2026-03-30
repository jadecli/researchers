import Anthropic from '@anthropic-ai/sdk';
import type { ModelId, TokenUsage, Result } from '../types/core.js';
import { Ok, Err, toTokenCount, toUSD } from '../types/core.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface ToolDef {
  readonly name: string;
  readonly description: string;
  readonly input_schema: Record<string, unknown>;
}

export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly input: Record<string, unknown>;
}

export interface InferenceConfig {
  readonly model: ModelId;
  readonly maxTokens: number;
  readonly systemPrompt: string;
  readonly tools?: readonly ToolDef[];
}

export interface InferenceResponse {
  readonly text: string;
  readonly toolCalls: readonly ToolCall[];
  readonly usage: TokenUsage;
  readonly stopReason: string;
}

// ─── InferenceError ──────────────────────────────────────────────────────────

export type ErrorCategory = 'transient' | 'validation' | 'business' | 'permission';

export class InferenceError extends Error {
  readonly category: ErrorCategory;
  readonly isRetryable: boolean;

  constructor(message: string, category: ErrorCategory) {
    super(message);
    this.name = 'InferenceError';
    this.category = category;
    this.isRetryable = category === 'transient';
  }
}

// ─── Cost Tracking ───────────────────────────────────────────────────────────

const COST_PER_1K_INPUT: Record<ModelId, number> = {
  'claude-opus-4-6': 0.015,
  'claude-sonnet-4-6': 0.003,
  'claude-haiku-3-20250307': 0.00025,
};

const COST_PER_1K_OUTPUT: Record<ModelId, number> = {
  'claude-opus-4-6': 0.075,
  'claude-sonnet-4-6': 0.015,
  'claude-haiku-3-20250307': 0.00125,
};

function computeCost(model: ModelId, inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1000) * COST_PER_1K_INPUT[model];
  const outputCost = (outputTokens / 1000) * COST_PER_1K_OUTPUT[model];
  return inputCost + outputCost;
}

// ─── Error Classification ────────────────────────────────────────────────────

function classifyError(error: unknown): InferenceError {
  if (error instanceof Anthropic.APIError) {
    const status = error.status;
    if (status === 401 || status === 403) {
      return new InferenceError(
        `Authentication/permission error: ${error.message}`,
        'permission',
      );
    }
    if (status === 400 || status === 422) {
      return new InferenceError(
        `Validation error: ${error.message}`,
        'validation',
      );
    }
    if (status === 429 || status === 500 || status === 502 || status === 503 || status === 529) {
      return new InferenceError(
        `Transient error (status ${status}): ${error.message}`,
        'transient',
      );
    }
    return new InferenceError(
      `API error (status ${status}): ${error.message}`,
      'business',
    );
  }

  if (error instanceof Error) {
    // Network errors are transient
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT') || error.message.includes('fetch failed')) {
      return new InferenceError(`Network error: ${error.message}`, 'transient');
    }
    return new InferenceError(error.message, 'business');
  }

  return new InferenceError(String(error), 'business');
}

// ─── Main Inference Function ─────────────────────────────────────────────────

let clientInstance: Anthropic | null = null;

function getClient(): Anthropic {
  if (!clientInstance) {
    clientInstance = new Anthropic();
  }
  return clientInstance;
}

export async function infer(
  config: InferenceConfig,
  messages: readonly ChatMessage[],
): Promise<Result<InferenceResponse, InferenceError>> {
  try {
    const client = getClient();

    const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const requestParams: Anthropic.MessageCreateParams = {
      model: config.model,
      max_tokens: config.maxTokens,
      system: config.systemPrompt,
      messages: apiMessages,
    };

    if (config.tools && config.tools.length > 0) {
      requestParams.tools = config.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool['input_schema'],
      }));
    }

    const response = await client.messages.create(requestParams);

    // Extract text and tool calls from content blocks
    let text = '';
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cacheRead = (response.usage as unknown as Record<string, unknown>).cache_read_input_tokens;
    const cacheWrite = (response.usage as unknown as Record<string, unknown>).cache_creation_input_tokens;
    const totalCost = computeCost(config.model, inputTokens, outputTokens);

    const usage: TokenUsage = {
      inputTokens: toTokenCount(inputTokens),
      outputTokens: toTokenCount(outputTokens),
      cacheReadTokens: toTokenCount(typeof cacheRead === 'number' ? cacheRead : 0),
      cacheWriteTokens: toTokenCount(typeof cacheWrite === 'number' ? cacheWrite : 0),
      totalCost: toUSD(totalCost),
    };

    return Ok({
      text,
      toolCalls,
      usage,
      stopReason: response.stop_reason ?? 'unknown',
    });
  } catch (error) {
    return Err(classifyError(error));
  }
}
