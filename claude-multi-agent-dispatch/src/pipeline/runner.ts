import {
  Ok,
  Err,
  type Result,
  type QualityScore,
  type QualityFeedback,
  type ContextDeltaPayload,
  type DispatchPlan,
  toDispatchId,
  toUSD,
} from '../types/index.js';
import type { PipelineStage, StageResult, PipelineState, ApproachCandidate } from './stages.js';
import { STAGE_ORDER, type StageName } from './stages.js';
import { STAGE_TEMPLATES, renderTemplate } from './templates.js';

// ─── PipelineConfig ─────────────────────────────────────────────────────────
export interface StageHooks {
  beforeStage?: (stage: StageName, state: PipelineState) => Promise<void> | void;
  afterStage?: (stage: StageName, result: StageResult<unknown>, state: PipelineState) => Promise<void> | void;
}

export interface PipelineConfig {
  readonly maxStageRetries: number;
  readonly stageTimeout: number;
  readonly hooks?: StageHooks;
}

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  maxStageRetries: 2,
  stageTimeout: 60_000,
};

// ─── PipelineResult ─────────────────────────────────────────────────────────
export interface PipelineResult {
  readonly stageResults: readonly StageResult<unknown>[];
  readonly totalDuration: number;
  readonly totalTokens: number;
  readonly qualityScore: QualityScore;
  readonly contextDelta: ContextDeltaPayload;
}

// ─── Checkpoint for pause/resume ────────────────────────────────────────────
export interface PipelineCheckpoint {
  readonly state: PipelineState;
  readonly completedStages: readonly StageName[];
  readonly stageResults: readonly StageResult<unknown>[];
  paused: boolean;
}

// ─── PipelineRunner ─────────────────────────────────────────────────────────
export class PipelineRunner {
  private checkpoint: PipelineCheckpoint | null = null;
  private readonly config: PipelineConfig;

  constructor(config?: Partial<PipelineConfig>) {
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
  }

  /**
   * Run the full 5-stage pipeline for a given task.
   */
  async runPipeline(
    task: string,
    config?: Partial<PipelineConfig>,
  ): Promise<Result<PipelineResult, Error>> {
    const mergedConfig: PipelineConfig = { ...this.config, ...config };
    const startTime = Date.now();

    // Initialize or resume from checkpoint
    let state: PipelineState;
    let stageResults: StageResult<unknown>[];
    let startStageIndex: number;

    if (this.checkpoint && this.checkpoint.paused) {
      state = { ...this.checkpoint.state };
      stageResults = [...this.checkpoint.stageResults];
      startStageIndex = this.checkpoint.completedStages.length;
      this.checkpoint.paused = false;
    } else {
      state = {
        currentStage: 'analyze',
        stageHistory: [],
        accumulatedContext: '',
        startTime: new Date(),
      };
      stageResults = [];
      startStageIndex = 0;
    }

    try {
      for (let i = startStageIndex; i < STAGE_ORDER.length; i++) {
        const stageName = STAGE_ORDER[i]!;
        state.currentStage = stageName;

        // Before-stage hook
        if (mergedConfig.hooks?.beforeStage) {
          await mergedConfig.hooks.beforeStage(stageName, state);
        }

        // Check if paused (set externally between hooks)
        if (this.checkpoint?.paused) {
          return Err(new Error('Pipeline paused at stage: ' + stageName));
        }

        // Execute stage with retries
        let result: StageResult<unknown> | null = null;
        let lastError: Error | null = null;

        for (let retry = 0; retry <= mergedConfig.maxStageRetries; retry++) {
          const stageStart = Date.now();
          try {
            const stageOutput = await this.executeStageWithTimeout(
              stageName,
              task,
              state,
              stageResults,
              mergedConfig.stageTimeout,
            );

            if (!stageOutput.ok) {
              lastError = stageOutput.error;
              continue;
            }

            result = Ok({
              output: stageOutput.value,
              duration: Date.now() - stageStart,
              tokensUsed: this.estimateTokens(stageName),
            });
            break;
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
          }
        }

        if (!result) {
          result = Err(lastError ?? new Error(`Stage ${stageName} failed after retries`));
        }

        stageResults.push(result);

        // Update state
        if (result.ok) {
          state.accumulatedContext += `\n[${stageName}]: ${JSON.stringify(result.value.output).slice(0, 500)}`;
          const stageData = this.buildStageData(stageName, task, state, stageResults);
          state.stageHistory.push(stageData);
        }

        // After-stage hook
        if (mergedConfig.hooks?.afterStage) {
          await mergedConfig.hooks.afterStage(stageName, result, state);
        }

        // Fail fast on critical stages
        if (!result.ok && (stageName === 'analyze' || stageName === 'execute')) {
          return Err(result.error);
        }
      }

      const totalDuration = Date.now() - startTime;
      const totalTokens = stageResults.reduce((sum, r) => {
        return sum + (r.ok ? r.value.tokensUsed : 0);
      }, 0);

      // Extract quality score from evaluate stage (index 3)
      const evaluateResult = stageResults[3];
      const qualityScore: QualityScore = evaluateResult?.ok
        ? (evaluateResult.value.output as QualityScore)
        : {
            dimensions: [
              { dimension: 'completeness', value: 0, confidence: 0, weight: 1 },
              { dimension: 'structure', value: 0, confidence: 0, weight: 1 },
              { dimension: 'accuracy', value: 0, confidence: 0, weight: 1 },
              { dimension: 'coherence', value: 0, confidence: 0, weight: 1 },
              { dimension: 'safety', value: 0, confidence: 0, weight: 1 },
            ],
            overall: 0,
            overallConfidence: 0,
          };

      // Extract context delta from refine stage (index 4)
      const refineResult = stageResults[4];
      const contextDelta: ContextDeltaPayload = refineResult?.ok
        ? (refineResult.value.output as ContextDeltaPayload)
        : {
            iteration: 0,
            newPatterns: [],
            failingStrategies: [],
            qualityBefore: 0,
            qualityAfter: 0,
            steerDirection: 'none',
            discoveredTypes: [],
          };

      return Ok({
        stageResults,
        totalDuration,
        totalTokens,
        qualityScore,
        contextDelta,
      });
    } catch (err) {
      return Err(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Pause the pipeline, saving a checkpoint for later resume.
   */
  pause(state: PipelineState, stageResults: StageResult<unknown>[]): void {
    const completedStages = STAGE_ORDER.filter(
      (_, i) => i < stageResults.length,
    ) as unknown as StageName[];

    this.checkpoint = {
      state: { ...state },
      completedStages,
      stageResults: [...stageResults],
      paused: true,
    };
  }

  /**
   * Get the current checkpoint if paused.
   */
  getCheckpoint(): PipelineCheckpoint | null {
    return this.checkpoint;
  }

  /**
   * Clear checkpoint to start fresh.
   */
  clearCheckpoint(): void {
    this.checkpoint = null;
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  private async executeStageWithTimeout(
    stage: StageName,
    task: string,
    state: PipelineState,
    previousResults: StageResult<unknown>[],
    timeout: number,
  ): Promise<Result<unknown, Error>> {
    return new Promise<Result<unknown, Error>>((resolve) => {
      const timer = setTimeout(() => {
        resolve(Err(new Error(`Stage ${stage} timed out after ${timeout}ms`)));
      }, timeout);

      this.executeStage(stage, task, state, previousResults)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          resolve(Err(err instanceof Error ? err : new Error(String(err))));
        });
    });
  }

  private async executeStage(
    stage: StageName,
    task: string,
    state: PipelineState,
    previousResults: StageResult<unknown>[],
  ): Promise<Result<unknown, Error>> {
    switch (stage) {
      case 'analyze':
        return this.runAnalyze(task);
      case 'approach':
        return this.runApproach(task, previousResults);
      case 'execute':
        return this.runExecute(task, state, previousResults);
      case 'evaluate':
        return this.runEvaluate(task, previousResults);
      case 'refine':
        return this.runRefine(previousResults);
      default:
        return Err(new Error(`Unknown stage: ${String(stage)}`));
    }
  }

  private async runAnalyze(task: string): Promise<Result<unknown, Error>> {
    const template = STAGE_TEMPLATES['analyze_task'];
    if (!template) return Err(new Error('Missing analyze_task template'));

    const rendered = renderTemplate(template, { task });
    if (!rendered.ok) return rendered;

    // Structured analysis output (would call LLM in production)
    return Ok({
      requirements: [task],
      complexity: 'medium' as const,
      capabilities: { code: 0.5, research: 0.5, analysis: 0.7, creative: 0.3, safety: 0.5 },
      risks: ['Scope may expand', 'Quality depends on agent selection'],
      prompt: rendered.value,
    });
  }

  private async runApproach(
    _task: string,
    previousResults: StageResult<unknown>[],
  ): Promise<Result<unknown, Error>> {
    const analyzeResult = previousResults[0];
    if (!analyzeResult?.ok) {
      return Err(new Error('Cannot generate approaches without analysis'));
    }

    const analysis = analyzeResult.value.output as Record<string, unknown>;
    const template = STAGE_TEMPLATES['generate_approaches'];
    if (!template) return Err(new Error('Missing generate_approaches template'));

    const rendered = renderTemplate(template, {
      analysis: JSON.stringify(analysis),
      requirements: JSON.stringify(analysis['requirements'] ?? []),
    });
    if (!rendered.ok) return rendered;

    const candidates: ApproachCandidate[] = [
      {
        description: 'Single-agent sequential execution',
        estimatedCost: 0.05,
        confidence: 0.7,
        tradeoffs: ['Simple but slow', 'No parallelism', 'Lower cost'],
      },
      {
        description: 'Multi-agent parallel dispatch',
        estimatedCost: 0.15,
        confidence: 0.85,
        tradeoffs: ['Faster execution', 'Higher cost', 'Better coverage'],
      },
    ];

    return Ok({ candidates, selectedIndex: 1, prompt: rendered.value });
  }

  private async runExecute(
    _task: string,
    state: PipelineState,
    previousResults: StageResult<unknown>[],
  ): Promise<Result<unknown, Error>> {
    const approachResult = previousResults[1];
    if (!approachResult?.ok) {
      return Err(new Error('Cannot execute without selected approach'));
    }

    const approach = approachResult.value.output as Record<string, unknown>;
    const candidates = (approach['candidates'] as ApproachCandidate[]) ?? [];
    const selectedIndex = (approach['selectedIndex'] as number) ?? 0;
    const selected = candidates[selectedIndex];

    const template = STAGE_TEMPLATES['execute_plan'];
    if (!template) return Err(new Error('Missing execute_plan template'));

    const rendered = renderTemplate(template, {
      approach: selected?.description ?? 'default',
      plan: JSON.stringify({ steps: ['analyze', 'implement', 'verify'] }),
      context: state.accumulatedContext,
    });
    if (!rendered.ok) return rendered;

    return Ok({
      outputs: ['Execution output for the selected approach'],
      artifacts: [],
      prompt: rendered.value,
    });
  }

  private async runEvaluate(
    task: string,
    previousResults: StageResult<unknown>[],
  ): Promise<Result<unknown, Error>> {
    const executeResult = previousResults[2];
    if (!executeResult?.ok) {
      return Err(new Error('Cannot evaluate without execution results'));
    }

    const execution = executeResult.value.output as Record<string, unknown>;
    const outputs = (execution['outputs'] as string[]) ?? [];

    const template = STAGE_TEMPLATES['evaluate_output'];
    if (!template) return Err(new Error('Missing evaluate_output template'));

    const rendered = renderTemplate(template, {
      taskSpec: task,
      outputs: JSON.stringify(outputs),
    });
    if (!rendered.ok) return rendered;

    // Quality score using the project's QualityScore shape
    const qualityScore: QualityScore = {
      dimensions: [
        { dimension: 'completeness', value: 0.65, confidence: 0.8, weight: 1.0 },
        { dimension: 'structure', value: 0.70, confidence: 0.85, weight: 1.0 },
        { dimension: 'accuracy', value: 0.75, confidence: 0.8, weight: 1.0 },
        { dimension: 'coherence', value: 0.70, confidence: 0.75, weight: 1.0 },
        { dimension: 'safety', value: 0.90, confidence: 0.9, weight: 1.0 },
      ],
      overall: 0.74,
      overallConfidence: 0.82,
    };

    return Ok(qualityScore);
  }

  private async runRefine(
    previousResults: StageResult<unknown>[],
  ): Promise<Result<unknown, Error>> {
    const evaluateResult = previousResults[3];
    if (!evaluateResult?.ok) {
      return Err(new Error('Cannot refine without evaluation'));
    }

    const scores = evaluateResult.value.output as QualityScore;

    const template = STAGE_TEMPLATES['generate_refinement'];
    if (!template) return Err(new Error('Missing generate_refinement template'));

    const rendered = renderTemplate(template, {
      evaluation: JSON.stringify(scores),
      scores: JSON.stringify(scores.dimensions),
      threshold: '0.7',
    });
    if (!rendered.ok) return rendered;

    const contextDelta: ContextDeltaPayload = {
      iteration: 1,
      newPatterns: ['Refinement suggestions based on evaluation'],
      failingStrategies: [],
      qualityBefore: scores.overall,
      qualityAfter: scores.overall + 0.05,
      steerDirection: 'improve_completeness',
      discoveredTypes: [],
    };

    return Ok(contextDelta);
  }

  private estimateTokens(stage: StageName): number {
    const estimates: Record<StageName, number> = {
      analyze: 500,
      approach: 800,
      execute: 2000,
      evaluate: 600,
      refine: 400,
    };
    return estimates[stage];
  }

  private buildStageData(
    stage: StageName,
    task: string,
    _state: PipelineState,
    _results: StageResult<unknown>[],
  ): PipelineStage {
    const emptyQuality: QualityScore = {
      dimensions: [
        { dimension: 'completeness', value: 0, confidence: 0, weight: 1 },
        { dimension: 'structure', value: 0, confidence: 0, weight: 1 },
        { dimension: 'accuracy', value: 0, confidence: 0, weight: 1 },
        { dimension: 'coherence', value: 0, confidence: 0, weight: 1 },
        { dimension: 'safety', value: 0, confidence: 0, weight: 1 },
      ],
      overall: 0,
      overallConfidence: 0,
    };

    const emptyDelta: ContextDeltaPayload = {
      iteration: 0,
      newPatterns: [],
      failingStrategies: [],
      qualityBefore: 0,
      qualityAfter: 0,
      steerDirection: 'none',
      discoveredTypes: [],
    };

    const emptyPlan: DispatchPlan = {
      id: toDispatchId('plan-empty'),
      tasks: [],
      budget: toUSD(0),
      maxAgents: 0,
      timeline: { estimatedDurationMs: 0, createdAt: new Date() },
    };

    switch (stage) {
      case 'analyze':
        return { stage: 'analyze', input: task, requirements: [task] };
      case 'approach':
        return { stage: 'approach', analysis: task, candidates: [] };
      case 'execute':
        return { stage: 'execute', selectedApproach: 'default', plan: emptyPlan };
      case 'evaluate':
        return { stage: 'evaluate', outputs: [], scores: emptyQuality };
      case 'refine':
        return { stage: 'refine', evaluation: emptyQuality, feedback: [], nextDelta: emptyDelta };
    }
  }
}
