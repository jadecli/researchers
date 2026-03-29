// src/orchestrator/team-orchestrator.ts — Multi-agent red/blue/white team orchestrator
//
// Informed by:
//   arxiv.org/abs/2511.02823 — Modular scaffold: decompose capability into 5 skills
//   alignment.anthropic.com/2025/strengthening-red-teams — Red-blue adversarial framework
//   arxiv.org/abs/2511.02997 — Blue team structural improvement patterns
//   anthropic.com/engineering — Engineering best practices
//   anthropic.com/research — Frontier research methodology
//
// Dogfoods: concurrency.ts (atomic writes, file locks), signal-router.ts (routing),
//   transitions.ts (state machine guards), heartbeat.ts (liveness), cursor.ts (JSONL reads)
//
// Boris Cherny patterns: Branded types, Result<T,E>, discriminated unions.

import type { AgentId, DispatchId, SessionId, USD } from '../types/core.js';
import { toAgentId, toDispatchId, toSessionId, toUSD, Ok, Err, type Result } from '../types/core.js';
import type { DispatchState, DispatchPlan } from '../types/dispatch.js';
import {
  transitionToPlanning,
  transitionToDispatching,
  transitionToExecuting,
  transitionToScoring,
  transitionToComplete,
  transitionToError,
  runSentinelGate,
  type SentinelCheck,
} from './transitions.js';
import { HeartbeatWriter, checkAllWorkers, sendDrainSignal } from './heartbeat.js';

// ── Team Role (Discriminated Union) ────────────────────────

export type TeamRole = 'red' | 'blue' | 'white' | 'engineering' | 'research';

export interface TeamConfig {
  readonly role: TeamRole;
  readonly model: 'opus' | 'sonnet' | 'haiku';
  readonly agentCount: number;
  readonly targetUrls: readonly string[];
  readonly targetPaths: readonly string[];
  readonly sweepConfig: Record<string, unknown>;
}

// ── Team Agent Definitions ─────────────────────────────────
// Each team has specialized agent roles following the modular scaffold
// pattern from arxiv.org/abs/2511.02823 (5 decomposed capabilities).

export interface TeamAgent {
  readonly id: AgentId;
  readonly role: TeamRole;
  readonly capability: string;
  readonly model: 'opus' | 'sonnet' | 'haiku';
  readonly prompt: string;
}

/**
 * Red Team agents — Security QA (arxiv.org/abs/2511.02823 scaffold)
 * 5 modular capabilities: suspicion modeling, attack selection,
 * plan synthesis, execution, subtlety assessment
 */
export function createRedTeamAgents(): readonly TeamAgent[] {
  return [
    {
      id: toAgentId('red-scanner'),
      role: 'red',
      capability: 'vulnerability-scanning',
      model: 'opus',
      prompt: `You are a security red team agent. Analyze the codebase for:
- OWASP Top 10 vulnerabilities (XSS, SQL injection, command injection)
- Insecure dependencies and known CVEs
- Hardcoded secrets, API keys, credentials
- Path traversal and SSRF vulnerabilities
- Improper input validation at system boundaries
Report each finding with: severity, file_path, line_number, evidence, suggested_fix.`,
    },
    {
      id: toAgentId('red-attack-surface'),
      role: 'red',
      capability: 'attack-surface-analysis',
      model: 'sonnet',
      prompt: `You are an attack surface analyst. Map all entry points:
- HTTP endpoints and their input validation
- MCP tool handlers and their parameter sanitization
- Shell command execution points (child_process, exec)
- File system access patterns (read, write, delete)
- Environment variable usage and trust boundaries
Classify each entry point by risk level and data flow.`,
    },
    {
      id: toAgentId('red-supply-chain'),
      role: 'red',
      capability: 'supply-chain-audit',
      model: 'haiku',
      prompt: `You are a supply chain security auditor. Check:
- package.json and requirements.txt for vulnerable versions
- Lock file integrity (package-lock.json, uv.lock)
- Transitive dependency risk (deep dependency tree)
- Typosquatting risk on package names
Report findings with severity and remediation steps.`,
    },
  ] as const;
}

/**
 * Blue Team agents — Structural improvement (arxiv.org/abs/2511.02997)
 * Defensive patterns: type safety, error handling, monitoring
 */
export function createBlueTeamAgents(): readonly TeamAgent[] {
  return [
    {
      id: toAgentId('blue-types'),
      role: 'blue',
      capability: 'type-safety-enforcement',
      model: 'sonnet',
      prompt: `You are a type safety enforcer. Analyze the codebase for:
- Missing return type annotations on exported functions
- Untyped 'any' usage that should use branded types or generics
- Missing exhaustive switch/assertNever on discriminated unions
- Unsafe type assertions (as any, as unknown)
- Missing Zod/runtime validation at system boundaries
Report each issue with the file, line, and suggested typed fix.`,
    },
    {
      id: toAgentId('blue-error-handling'),
      role: 'blue',
      capability: 'error-handling-audit',
      model: 'sonnet',
      prompt: `You are an error handling auditor. Check for:
- Empty catch blocks that swallow errors silently
- Thrown exceptions crossing module boundaries (should use Result<T,E>)
- Missing error propagation in async chains
- Unhandled promise rejections
- Error messages without context (stack, input, state)
Suggest Result<T,E> pattern replacements where appropriate.`,
    },
    {
      id: toAgentId('blue-architecture'),
      role: 'blue',
      capability: 'architecture-compliance',
      model: 'opus',
      prompt: `You are an architecture compliance checker. Verify:
- Kimball layer separation (runtime/reporting/semantic never crossed)
- Boris Cherny patterns (branded types, Result<T,E>, assertNever)
- No direct cross-repo imports (each sub-repo is independent)
- Proper use of discriminated unions for state machines
- Hook escalation chain integrity (fix→slack→linear→todo)
Report violations with severity and remediation guidance.`,
    },
  ] as const;
}

/**
 * White Team agents — Functionality buildout
 */
export function createWhiteTeamAgents(): readonly TeamAgent[] {
  return [
    {
      id: toAgentId('white-integration'),
      role: 'white',
      capability: 'integration-testing',
      model: 'sonnet',
      prompt: `You are an integration test designer. Identify:
- Cross-module interfaces that lack integration tests
- API contracts between sub-repos that need contract tests
- Data flow paths from crawl→store→bloom that need e2e tests
- State machine transitions that need property-based tests
Design test cases with setup, execution, and assertion steps.`,
    },
    {
      id: toAgentId('white-feature-gaps'),
      role: 'white',
      capability: 'feature-gap-analysis',
      model: 'sonnet',
      prompt: `You are a feature gap analyst. Compare:
- Implemented features vs ARCHITECTURE.md specifications
- todos.jsonl items vs actual implementation status
- Research doc plans vs code reality
- Agent YAML definitions vs actual agent capabilities
Report gaps with priority (P0-P3) and implementation effort estimates.`,
    },
  ] as const;
}

/**
 * Engineering Team agents — Pipeline operations
 */
export function createEngineeringAgents(): readonly TeamAgent[] {
  return [
    {
      id: toAgentId('eng-pipeline'),
      role: 'engineering',
      capability: 'pipeline-validation',
      model: 'sonnet',
      prompt: `You are a pipeline operations engineer. Validate:
- Crawl→Store: Scrapy/Crawlee output reaches Neon PG18 tables
- Store→Bloom: Stored pages are indexed in bloom filters
- Bloom→Route: Bloom filter pre-checks correctly route to signal router
- Signal→Dispatch: Signal router scores feed into dispatch decisions
- Dispatch→Heartbeat: Workers report liveness during execution
Test each pipeline stage end-to-end with sample data.`,
    },
    {
      id: toAgentId('eng-performance'),
      role: 'engineering',
      capability: 'performance-profiling',
      model: 'haiku',
      prompt: `You are a performance profiler. Measure:
- JSONL read performance: cursor vs full-file reads
- Bloom filter false positive rates under load
- Atomic write latency with file lock contention
- Heartbeat check overhead across many workers
Report metrics with baselines and recommendations.`,
    },
  ] as const;
}

/**
 * Research Team agents — Frontier knowledge extraction
 */
export function createResearchAgents(): readonly TeamAgent[] {
  return [
    {
      id: toAgentId('research-crawler'),
      role: 'research',
      capability: 'frontier-paper-crawl',
      model: 'opus',
      prompt: `You are a frontier research crawler. Target:
- arxiv.org papers on AI safety, multi-agent systems, red teaming
- anthropic.com/research publications and blog posts
- alignment.anthropic.com posts on evaluation methodology
- Competitor research (OpenAI, DeepMind, Google) on agent frameworks
Extract: title, authors, abstract, key findings, architectural patterns.
Store results in crawl_store with page_type='research'.`,
    },
    {
      id: toAgentId('research-synthesizer'),
      role: 'research',
      capability: 'knowledge-synthesis',
      model: 'opus',
      prompt: `You are a knowledge synthesizer. From crawled research papers:
- Extract implementable patterns and techniques
- Map findings to existing codebase components
- Identify gaps between academic approaches and our implementation
- Propose concrete code changes based on research insights
Produce synthesis reports with evidence links and confidence scores.`,
    },
  ] as const;
}

// ── Sweep Types ────────────────────────────────────────────

export interface SweepResult {
  readonly sweepId: string;
  readonly teamRole: TeamRole;
  readonly status: 'complete' | 'failed';
  readonly findings: readonly Finding[];
  readonly qualityScore: number;
  readonly durationMs: number;
  readonly tokenCostUsd: number;
}

export interface Finding {
  readonly id: string;
  readonly teamRole: TeamRole;
  readonly severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly evidence?: string;
  readonly filePath?: string;
  readonly lineNumber?: number;
  readonly suggestedFix?: string;
  readonly agentId: string;
  readonly confidence: number;
}

// ── Team Orchestrator ──────────────────────────────────────
// Coordinates all 5 teams using guarded state transitions,
// sentinel gates, and heartbeat monitoring.

export class TeamOrchestrator {
  private state: DispatchState = { status: 'idle' };
  private readonly heartbeatDir: string;
  private readonly findingsLog: Finding[] = [];

  constructor(heartbeatDir: string = '/tmp/team-heartbeats') {
    this.heartbeatDir = heartbeatDir;
  }

  /**
   * Get all agents for a given team role.
   */
  getAgentsForTeam(role: TeamRole): readonly TeamAgent[] {
    switch (role) {
      case 'red': return createRedTeamAgents();
      case 'blue': return createBlueTeamAgents();
      case 'white': return createWhiteTeamAgents();
      case 'engineering': return createEngineeringAgents();
      case 'research': return createResearchAgents();
    }
  }

  /**
   * Get agents for all teams.
   */
  getAllAgents(): readonly TeamAgent[] {
    const roles: TeamRole[] = ['red', 'blue', 'white', 'engineering', 'research'];
    return roles.flatMap((role) => [...this.getAgentsForTeam(role)]);
  }

  /**
   * Run sentinel gate checks before a sweep.
   * Fail-closed: blocks dispatch if any check fails.
   */
  runPreSweepGate(config: TeamConfig): Result<void, Error> {
    const checks: SentinelCheck[] = [
      {
        name: 'budget-check',
        check: () => config.agentCount > 0 && config.agentCount <= 10,
      },
      {
        name: 'target-check',
        check: () => config.targetUrls.length > 0 || config.targetPaths.length > 0,
      },
      {
        name: 'model-check',
        check: () => ['opus', 'sonnet', 'haiku'].includes(config.model),
      },
      {
        name: 'worker-health',
        check: () => {
          const { dead } = checkAllWorkers(this.heartbeatDir);
          // Allow sweep if no more than 2 dead workers
          return dead.length <= 2;
        },
      },
    ];

    const result = runSentinelGate(checks);
    if (!result.passed) {
      return Err(new Error(`Pre-sweep gate failed at: ${result.failedAt}`));
    }
    return Ok(undefined);
  }

  /**
   * Transition the orchestrator through the dispatch state machine.
   * Uses guarded transitions to prevent illegal state jumps.
   */
  planSweep(config: TeamConfig): Result<DispatchState, Error> {
    const r1 = transitionToPlanning(this.state);
    if (!r1.ok) return r1;
    this.state = r1.value;
    return Ok(this.state);
  }

  /**
   * Start executing a sweep with the given agents.
   */
  startSweep(
    plan: DispatchPlan,
    agents: readonly TeamAgent[],
  ): Result<DispatchState, Error> {
    const r1 = transitionToDispatching(this.state, plan);
    if (!r1.ok) return r1;
    this.state = r1.value;

    const agentIds = agents.map((a) => a.id);
    const r2 = transitionToExecuting(this.state, agentIds);
    if (!r2.ok) return r2;
    this.state = r2.value;

    return Ok(this.state);
  }

  /**
   * Record a finding from a team agent.
   */
  recordFinding(finding: Finding): void {
    this.findingsLog.push(finding);
  }

  /**
   * Complete a sweep and transition to scoring → complete.
   */
  completeSweep(
    outputs: readonly string[],
    qualityScore: number,
    durationMs: number,
  ): Result<SweepResult, Error> {
    const r1 = transitionToScoring(this.state, outputs);
    if (!r1.ok) return r1;
    this.state = r1.value;

    const sweepId = `sweep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result: SweepResult = {
      sweepId,
      teamRole: this.findingsLog[0]?.teamRole ?? 'white',
      status: 'complete',
      findings: [...this.findingsLog],
      qualityScore,
      durationMs,
      tokenCostUsd: 0,
    };

    const dispatchResult = {
      id: toDispatchId(sweepId),
      outputs,
      qualityScore,
      usage: {
        inputTokens: 0 as any,
        outputTokens: 0 as any,
        cacheReadTokens: 0 as any,
        cacheWriteTokens: 0 as any,
        totalCost: toUSD(0),
      },
      duration: durationMs,
    };

    const r2 = transitionToComplete(this.state, dispatchResult);
    if (!r2.ok) return r2;
    this.state = r2.value;

    return Ok(result);
  }

  /**
   * Handle sweep failure.
   */
  failSweep(error: string): Result<DispatchState, Error> {
    const r = transitionToError(this.state, error);
    if (!r.ok) return r;
    this.state = r.value;
    return Ok(this.state);
  }

  /**
   * Get current orchestrator state.
   */
  getState(): DispatchState {
    return this.state;
  }

  /**
   * Get all recorded findings.
   */
  getFindings(): readonly Finding[] {
    return [...this.findingsLog];
  }

  /**
   * Drain all workers gracefully.
   */
  drainAllWorkers(): void {
    const { alive } = checkAllWorkers(this.heartbeatDir);
    for (const worker of alive) {
      if (worker.alive) {
        sendDrainSignal(this.heartbeatDir, worker.agentId);
      }
    }
  }
}
