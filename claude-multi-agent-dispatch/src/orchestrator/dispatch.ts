import {
  Ok,
  Err,
  type Result,
  type DispatchId,
  type AgentId,
  type USD,
  type RoundId,
  type QualityScore,
  type PlatformTarget,
  type DispatchResult,
  type DispatchPlan,
  toDispatchId,
  toUSD,
  toAgentId,
} from '../types/index.js';
import {
  selectAgent,
  cosineSimilarity,
  type AgentCapability,
  type AgentProfile,
  DEFAULT_AGENTS,
} from './selector.js';
import { SessionStore, type DispatchSession } from './state.js';

// ─── DispatchConfig ─────────────────────────────────────────────────────────

export interface DispatchConfig {
  readonly maxBudget: USD;
  readonly maxAgents: number;
  readonly platform: PlatformTarget;
  readonly qualityThreshold: number;
  readonly roundId?: RoundId;
}

export const DEFAULT_DISPATCH_CONFIG: DispatchConfig = {
  maxBudget: toUSD(1.0),
  maxAgents: 4,
  platform: 'cli',
  qualityThreshold: 0.65,
};

// ─── OrchestratorResult ─────────────────────────────────────────────────────

export interface OrchestratorResult {
  readonly dispatchId: DispatchId;
  readonly outputs: readonly string[];
  readonly qualityScore: QualityScore;
  readonly budgetUsed: USD;
  readonly agentsUsed: readonly AgentId[];
  readonly duration: number;
  readonly conflicts: readonly ConflictReport[];
}

export interface ConflictReport {
  readonly agentA: AgentId;
  readonly agentB: AgentId;
  readonly dimension: string;
  readonly description: string;
}

// ─── Internal task classification ───────────────────────────────────────────

interface TaskClassification {
  readonly requirements: AgentCapability;
  readonly complexity: 'low' | 'medium' | 'high';
  readonly subtasks: readonly string[];
}

// ─── Agent task result ──────────────────────────────────────────────────────

interface AgentTaskResult {
  readonly agentId: AgentId;
  readonly output: string;
  readonly cost: number;
  readonly duration: number;
}

// ─── DispatchOrchestrator ───────────────────────────────────────────────────

/**
 * Core orchestrator that classifies tasks, selects agents, builds plans,
 * fans out work in parallel, collects results, synthesizes, and scores quality.
 */
export class DispatchOrchestrator {
  private readonly sessionStore: SessionStore;
  private readonly agents: readonly AgentProfile[];
  private budgetUsed: number = 0;

  constructor(
    sessionStore?: SessionStore,
    agents?: readonly AgentProfile[],
  ) {
    this.sessionStore = sessionStore ?? new SessionStore();
    this.agents = agents ?? DEFAULT_AGENTS;
  }

  /**
   * Dispatch a task through the full orchestration pipeline:
   * classifyTask -> selectAgents -> buildPlan -> fanOut -> collectResults -> synthesize -> scoreQuality
   */
  async dispatch(
    task: string,
    config?: Partial<DispatchConfig>,
  ): Promise<Result<OrchestratorResult, Error>> {
    const mergedConfig: DispatchConfig = { ...DEFAULT_DISPATCH_CONFIG, ...config };
    const startTime = Date.now();
    this.budgetUsed = 0;

    const dispatchId = toDispatchId(
      `dispatch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );

    try {
      // Step 1: Classify the task
      const classification = this.classifyTask(task);

      // Step 2: Select agents based on requirements and budget
      const selectedAgents = this.selectAgents(
        classification,
        mergedConfig.maxBudget,
        mergedConfig.maxAgents,
      );

      if (selectedAgents.length === 0) {
        return Err(new Error('No agents could be selected within budget'));
      }

      // Step 3: Build dispatch plan
      const plan = this.buildPlan(dispatchId, classification, selectedAgents, mergedConfig);

      // Step 4: Fan out work to agents in parallel
      const fanOutResults = await this.fanOut(
        classification.subtasks,
        selectedAgents,
        mergedConfig.maxBudget,
      );

      // Step 5: Collect results
      const collected = this.collectResults(fanOutResults);

      // Step 6: Synthesize outputs with conflict detection
      const { synthesized, conflicts } = this.synthesize(collected);

      // Step 7: Score quality
      const qualityScore = this.scoreQuality(synthesized, task);

      const duration = Date.now() - startTime;

      return Ok({
        dispatchId,
        outputs: synthesized,
        qualityScore,
        budgetUsed: toUSD(this.budgetUsed),
        agentsUsed: selectedAgents.map((a) => a.id),
        duration,
        conflicts,
      });
    } catch (err) {
      return Err(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // ─── Pipeline steps ─────────────────────────────────────────────────────

  private classifyTask(task: string): TaskClassification {
    const taskLower = task.toLowerCase();

    // Heuristic task classification
    const requirements: AgentCapability = {
      code: this.keywordScore(taskLower, ['code', 'implement', 'function', 'class', 'api', 'bug', 'refactor']),
      research: this.keywordScore(taskLower, ['research', 'find', 'investigate', 'explore', 'survey', 'compare']),
      analysis: this.keywordScore(taskLower, ['analyze', 'review', 'evaluate', 'assess', 'audit', 'inspect']),
      creative: this.keywordScore(taskLower, ['design', 'create', 'write', 'generate', 'brainstorm', 'innovate']),
      safety: this.keywordScore(taskLower, ['secure', 'safety', 'validate', 'verify', 'test', 'check']),
    };

    // Complexity based on task length and keyword density
    const words = task.split(/\s+/).length;
    const complexity: 'low' | 'medium' | 'high' =
      words < 20 ? 'low' : words < 100 ? 'medium' : 'high';

    // Split into subtasks (simple heuristic: split on sentence boundaries)
    const subtasks = task
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    // If only one subtask, use the full task
    if (subtasks.length === 0) {
      subtasks.push(task);
    }

    return { requirements, complexity, subtasks };
  }

  private selectAgents(
    classification: TaskClassification,
    maxBudget: USD,
    maxAgents: number,
  ): AgentProfile[] {
    const selected: AgentProfile[] = [];
    let remainingBudget = maxBudget as number;

    // For high complexity, try to select multiple complementary agents
    const targetCount = classification.complexity === 'high'
      ? Math.min(maxAgents, classification.subtasks.length)
      : classification.complexity === 'medium'
        ? Math.min(maxAgents, 2)
        : 1;

    // Score all agents
    const scored = this.agents.map((agent) => ({
      agent,
      similarity: cosineSimilarity(classification.requirements, agent.capabilities),
    }));

    // Sort by similarity descending
    scored.sort((a, b) => b.similarity - a.similarity);

    const modelCost: Record<string, number> = { opus: 0.10, sonnet: 0.02, haiku: 0.002 };

    for (const { agent } of scored) {
      if (selected.length >= targetCount) break;

      const cost = modelCost[agent.model] ?? 0.05;
      if (cost <= remainingBudget) {
        selected.push(agent);
        remainingBudget -= cost;
      }
    }

    return selected;
  }

  private buildPlan(
    dispatchId: DispatchId,
    classification: TaskClassification,
    agents: AgentProfile[],
    config: DispatchConfig,
  ): DispatchPlan {
    return {
      id: dispatchId,
      tasks: classification.subtasks.map((subtask) => ({
        type: 'simple' as const,
        objective: subtask,
        model: 'claude-sonnet-4-6' as const,
      })),
      budget: config.maxBudget,
      maxAgents: agents.length,
      timeline: {
        estimatedDurationMs: classification.subtasks.length * 5000,
        createdAt: new Date(),
      },
    };
  }

  private async fanOut(
    subtasks: readonly string[],
    agents: AgentProfile[],
    maxBudget: USD,
  ): Promise<PromiseSettledResult<AgentTaskResult>[]> {
    const modelCost: Record<string, number> = { opus: 0.10, sonnet: 0.02, haiku: 0.002 };

    const promises = subtasks.map(async (subtask, i) => {
      const agent = agents[i % agents.length]!;
      const cost = modelCost[agent.model] ?? 0.02;

      // Budget check before spawning
      if (this.budgetUsed + cost > (maxBudget as number)) {
        throw new Error(
          `Budget exceeded: used ${this.budgetUsed.toFixed(4)}, ` +
          `need ${cost.toFixed(4)}, limit ${(maxBudget as number).toFixed(4)}`,
        );
      }

      this.budgetUsed += cost;

      // In production, this would call the inference API
      // For now, simulate agent work
      const start = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 1)); // Minimal async yield

      return {
        agentId: agent.id,
        output: `[${agent.name}] Result for: ${subtask}`,
        cost,
        duration: Date.now() - start,
      } satisfies AgentTaskResult;
    });

    return Promise.allSettled(promises);
  }

  private collectResults(
    settled: PromiseSettledResult<AgentTaskResult>[],
  ): AgentTaskResult[] {
    const results: AgentTaskResult[] = [];

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
      // Rejected results are silently dropped (logged in production)
    }

    return results;
  }

  private synthesize(
    results: AgentTaskResult[],
  ): { synthesized: string[]; conflicts: ConflictReport[] } {
    const outputs = results.map((r) => r.output);
    const conflicts: ConflictReport[] = [];

    // Detect conflicts: look for contradictory outputs from different agents
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const a = results[i]!;
        const b = results[j]!;

        // Simple conflict detection: same subtask, different agents, different outputs
        if (
          String(a.agentId) !== String(b.agentId) &&
          a.output !== b.output &&
          this.outputSimilarity(a.output, b.output) < 0.3
        ) {
          conflicts.push({
            agentA: a.agentId,
            agentB: b.agentId,
            dimension: 'output_divergence',
            description: `Agents produced divergent outputs for overlapping subtasks`,
          });
        }
      }
    }

    return { synthesized: outputs, conflicts };
  }

  private scoreQuality(outputs: string[], _task: string): QualityScore {
    // Heuristic quality scoring
    const avgLength = outputs.reduce((sum, o) => sum + o.length, 0) / Math.max(1, outputs.length);

    const completeness = Math.min(1.0, outputs.length / 3);
    const structure = avgLength > 20 ? 0.7 : 0.4;
    const accuracy = 0.75; // Default assumption without LLM verification
    const coherence = outputs.length <= 1 ? 0.8 : 0.65;
    const safety = 0.9;

    const overall =
      completeness * 0.25 + structure * 0.2 + accuracy * 0.25 + coherence * 0.15 + safety * 0.15;

    return {
      dimensions: [
        { dimension: 'completeness', value: completeness, confidence: 0.7, weight: 0.25 },
        { dimension: 'structure', value: structure, confidence: 0.6, weight: 0.2 },
        { dimension: 'accuracy', value: accuracy, confidence: 0.5, weight: 0.25 },
        { dimension: 'coherence', value: coherence, confidence: 0.6, weight: 0.15 },
        { dimension: 'safety', value: safety, confidence: 0.8, weight: 0.15 },
      ],
      overall: Math.round(overall * 100) / 100,
      overallConfidence: 0.65,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private keywordScore(text: string, keywords: string[]): number {
    const matches = keywords.filter((kw) => text.includes(kw)).length;
    return Math.min(1.0, matches / Math.max(1, keywords.length) * 2);
  }

  private outputSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    return union === 0 ? 0 : intersection / union;
  }
}
