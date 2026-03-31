// src/monitoring/telemetry.ts — Telemetry types and cost tracking
//
// OTel → Prometheus pipeline for Claude Code monitoring.
// Key metrics: claude_code_cost_usage_USD_total, claude_code_token_usage_tokens_total
// Labels: user_email, model, session_id, token type

import type { USD } from '../types/core.js';
import { toUSD } from '../types/core.js';

// ── Telemetry Event Types ───────────────────────────────────────
export type TelemetryEvent =
  | {
      readonly type: 'session_start';
      readonly sessionId: string;
      readonly model: string;
      readonly timestamp: Date;
    }
  | {
      readonly type: 'tool_call';
      readonly sessionId: string;
      readonly toolName: string;
      readonly durationMs: number;
      readonly success: boolean;
    }
  | {
      readonly type: 'token_usage';
      readonly sessionId: string;
      readonly model: string;
      readonly input: number;
      readonly output: number;
      readonly cacheRead: number;
      readonly cacheWrite: number;
    }
  | {
      readonly type: 'cost_incurred';
      readonly sessionId: string;
      readonly amount: USD;
      readonly model: string;
    }
  | {
      readonly type: 'subagent_spawn';
      readonly sessionId: string;
      readonly parentAgentId: string;
      readonly childAgentId: string;
      readonly model: string;
    }
  | {
      readonly type: 'session_end';
      readonly sessionId: string;
      readonly totalCost: USD;
      readonly totalTurns: number;
      readonly totalToolCalls: number;
    };

// ── Model Pricing ───────────────────────────────────────────────
export type ModelPricing = {
  readonly model: string;
  readonly inputPerMillion: number;
  readonly outputPerMillion: number;
  readonly cacheWritePerMillion: number;
  readonly cacheReadPerMillion: number;
};

export const MODEL_PRICING: ReadonlyArray<ModelPricing> = [
  {
    model: 'claude-opus-4-6',
    inputPerMillion: 15,
    outputPerMillion: 75,
    cacheWritePerMillion: 18.75,
    cacheReadPerMillion: 1.5,
  },
  {
    model: 'claude-sonnet-4-6',
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.3,
  },
  {
    model: 'claude-haiku-4-5-20251001',
    inputPerMillion: 0.8,
    outputPerMillion: 4,
    cacheWritePerMillion: 1.0,
    cacheReadPerMillion: 0.08,
  },
] as const;

export function calculateSessionCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheWriteTokens: number,
  cacheReadTokens: number,
): USD {
  const pricing =
    MODEL_PRICING.find((p) => p.model === model) ?? MODEL_PRICING[1]!;
  const cost =
    (inputTokens * pricing.inputPerMillion) / 1_000_000 +
    (outputTokens * pricing.outputPerMillion) / 1_000_000 +
    (cacheWriteTokens * pricing.cacheWritePerMillion) / 1_000_000 +
    (cacheReadTokens * pricing.cacheReadPerMillion) / 1_000_000;
  return toUSD(cost);
}

// ── Session Tracker ─────────────────────────────────────────────
export class SessionTracker {
  private events: TelemetryEvent[] = [];
  private sessionId: string;
  private model: string;
  private totalInput = 0;
  private totalOutput = 0;
  private totalCacheRead = 0;
  private totalCacheWrite = 0;
  private toolCalls = 0;
  private turns = 0;

  constructor(sessionId: string, model: string) {
    this.sessionId = sessionId;
    this.model = model;
    this.recordEvent({
      type: 'session_start',
      sessionId,
      model,
      timestamp: new Date(),
    });
  }

  recordTokenUsage(input: number, output: number, cacheRead = 0, cacheWrite = 0): void {
    this.totalInput += input;
    this.totalOutput += output;
    this.totalCacheRead += cacheRead;
    this.totalCacheWrite += cacheWrite;
    this.turns++;
    this.recordEvent({
      type: 'token_usage',
      sessionId: this.sessionId,
      model: this.model,
      input,
      output,
      cacheRead,
      cacheWrite,
    });
  }

  recordToolCall(toolName: string, durationMs: number, success: boolean): void {
    this.toolCalls++;
    this.recordEvent({
      type: 'tool_call',
      sessionId: this.sessionId,
      toolName,
      durationMs,
      success,
    });
  }

  recordSubagentSpawn(parentId: string, childId: string, model: string): void {
    this.recordEvent({
      type: 'subagent_spawn',
      sessionId: this.sessionId,
      parentAgentId: parentId,
      childAgentId: childId,
      model,
    });
  }

  end(): TelemetryEvent {
    const totalCost = calculateSessionCost(
      this.model,
      this.totalInput,
      this.totalOutput,
      this.totalCacheWrite,
      this.totalCacheRead,
    );
    const endEvent: TelemetryEvent = {
      type: 'session_end',
      sessionId: this.sessionId,
      totalCost,
      totalTurns: this.turns,
      totalToolCalls: this.toolCalls,
    };
    this.recordEvent(endEvent);
    return endEvent;
  }

  getEvents(): ReadonlyArray<TelemetryEvent> {
    return this.events;
  }

  getCurrentCost(): USD {
    return calculateSessionCost(
      this.model,
      this.totalInput,
      this.totalOutput,
      this.totalCacheWrite,
      this.totalCacheRead,
    );
  }

  private recordEvent(event: TelemetryEvent): void {
    this.events.push(event);
  }
}

// ── Docker Compose + OTel Config ────────────────────────────────
export function generateDockerCompose(): string {
  return `version: "3.8"
services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    ports: ["4317:4317", "4318:4318", "8889:8889"]
    volumes: ["./otel-collector-config.yaml:/etc/otelcol-contrib/config.yaml"]
    deploy: { resources: { limits: { memory: 1G } } }
  prometheus:
    image: prom/prometheus:latest
    ports: ["9090:9090"]
    volumes: ["./prometheus.yml:/etc/prometheus/prometheus.yml"]
    depends_on: [otel-collector]
  grafana:
    image: grafana/grafana:latest
    ports: ["3000:3000"]
    depends_on: [prometheus]
    environment:
      GF_AUTH_ANONYMOUS_ENABLED: "true"
      GF_AUTH_ANONYMOUS_ORG_ROLE: "Admin"`;
}

export function generateTelemetryEnvScript(): string {
  return `#!/bin/bash
# Enable Claude Code telemetry export to OTel collector
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
export OTEL_METRIC_EXPORT_INTERVAL=60000`;
}
