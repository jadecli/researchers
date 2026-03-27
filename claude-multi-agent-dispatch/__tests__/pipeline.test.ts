import { describe, it, expect, vi } from 'vitest';
import type { PipelineStage, ApproachCandidate, StageResult, PipelineState, StageName } from '../src/pipeline/stages.js';
import { STAGE_ORDER } from '../src/pipeline/stages.js';
import { PipelineRunner, type PipelineConfig, type StageHooks } from '../src/pipeline/runner.js';
import { renderTemplate, STAGE_TEMPLATES, loadTemplatesFromYaml, type PromptTemplate } from '../src/pipeline/templates.js';
import { toDispatchId, toUSD } from '../src/types/index.js';

// ─── PipelineStage union construction ───────────────────────────────────────

describe('PipelineStage', () => {
  it('should construct an analyze stage', () => {
    const stage: PipelineStage = {
      stage: 'analyze',
      input: 'Build a REST API',
      requirements: ['authentication', 'CRUD operations'],
    };
    expect(stage.stage).toBe('analyze');
    expect(stage.input).toBe('Build a REST API');
    expect(stage.requirements).toHaveLength(2);
  });

  it('should construct an approach stage with candidates', () => {
    const candidates: ApproachCandidate[] = [
      {
        description: 'Monolithic approach',
        estimatedCost: 0.05,
        confidence: 0.8,
        tradeoffs: ['Simple', 'Not scalable'],
      },
    ];
    const stage: PipelineStage = {
      stage: 'approach',
      analysis: 'Task requires API development',
      candidates,
    };
    expect(stage.stage).toBe('approach');
    expect(stage.candidates).toHaveLength(1);
    expect(stage.candidates[0]!.confidence).toBe(0.8);
  });

  it('should construct an execute stage with plan', () => {
    const stage: PipelineStage = {
      stage: 'execute',
      selectedApproach: 'Microservices',
      plan: {
        id: toDispatchId('plan-1'),
        tasks: [],
        budget: toUSD(0.5),
        maxAgents: 3,
        timeline: { estimatedDurationMs: 10000, createdAt: new Date() },
      },
    };
    expect(stage.stage).toBe('execute');
    expect(stage.selectedApproach).toBe('Microservices');
  });

  it('should construct an evaluate stage with scores', () => {
    const stage: PipelineStage = {
      stage: 'evaluate',
      outputs: ['Result A', 'Result B'],
      scores: {
        dimensions: [
          { dimension: 'completeness', value: 0.8, confidence: 0.9, weight: 1 },
        ],
        overall: 0.8,
        overallConfidence: 0.9,
      },
    };
    expect(stage.stage).toBe('evaluate');
    expect(stage.outputs).toHaveLength(2);
    expect(stage.scores.overall).toBe(0.8);
  });

  it('should construct a refine stage with feedback and delta', () => {
    const stage: PipelineStage = {
      stage: 'refine',
      evaluation: {
        dimensions: [],
        overall: 0.6,
        overallConfidence: 0.7,
      },
      feedback: [
        { dimension: 'completeness', score: 0.5, suggestion: 'Add more detail' },
      ],
      nextDelta: {
        iteration: 1,
        newPatterns: ['added detail'],
        failingStrategies: [],
        qualityBefore: 0.6,
        qualityAfter: 0.7,
        steerDirection: 'improve',
        discoveredTypes: [],
      },
    };
    expect(stage.stage).toBe('refine');
    expect(stage.feedback).toHaveLength(1);
  });

  it('should have 5 stages in STAGE_ORDER', () => {
    expect(STAGE_ORDER).toEqual(['analyze', 'approach', 'execute', 'evaluate', 'refine']);
  });
});

// ─── PipelineRunner ─────────────────────────────────────────────────────────

describe('PipelineRunner', () => {
  it('should run a full pipeline and return results', async () => {
    const runner = new PipelineRunner({ stageTimeout: 5000 });
    const result = await runner.runPipeline('Implement a sorting algorithm');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stageResults).toHaveLength(5);
      expect(result.value.totalDuration).toBeGreaterThanOrEqual(0);
      expect(result.value.totalTokens).toBeGreaterThanOrEqual(0);
      expect(result.value.qualityScore.overall).toBeGreaterThan(0);
    }
  });

  it('should call beforeStage and afterStage hooks', async () => {
    const beforeCalls: StageName[] = [];
    const afterCalls: StageName[] = [];

    const hooks: StageHooks = {
      beforeStage: (stage) => { beforeCalls.push(stage); },
      afterStage: (stage) => { afterCalls.push(stage); },
    };

    const runner = new PipelineRunner({ hooks, stageTimeout: 5000 });
    const result = await runner.runPipeline('Test hooks');

    expect(result.ok).toBe(true);
    expect(beforeCalls).toEqual(['analyze', 'approach', 'execute', 'evaluate', 'refine']);
    expect(afterCalls).toEqual(['analyze', 'approach', 'execute', 'evaluate', 'refine']);
  });

  it('should support pause and resume via checkpoint', async () => {
    const runner = new PipelineRunner({ stageTimeout: 5000 });

    // Use a hook to pause after the second stage
    let stageCount = 0;
    const hooks: StageHooks = {
      afterStage: (_stage, _result, state) => {
        stageCount++;
        if (stageCount === 2) {
          // Simulate pause by saving checkpoint on this runner
          runner.pause(state, []);
        }
      },
    };

    // Assign hooks to the same runner
    await runner.runPipeline('Test pause resume', { hooks });

    // Verify checkpoint was set
    const checkpoint = runner.getCheckpoint();
    expect(checkpoint).not.toBeNull();
    if (checkpoint) {
      expect(checkpoint.paused).toBe(true);
    }

    // Clear and verify
    runner.clearCheckpoint();
    expect(runner.getCheckpoint()).toBeNull();
  });

  it('should respect maxStageRetries config', async () => {
    const runner = new PipelineRunner({ maxStageRetries: 0, stageTimeout: 5000 });
    const result = await runner.runPipeline('Test retries');

    // Even with 0 retries, default stages should succeed
    expect(result.ok).toBe(true);
  });

  it('should accumulate context across stages', async () => {
    let finalState: PipelineState | null = null;

    const hooks: StageHooks = {
      afterStage: (_stage, _result, state) => {
        finalState = { ...state };
      },
    };

    const runner = new PipelineRunner({ hooks, stageTimeout: 5000 });
    await runner.runPipeline('Build context test');

    expect(finalState).not.toBeNull();
    if (finalState) {
      expect((finalState as PipelineState).accumulatedContext.length).toBeGreaterThan(0);
      expect((finalState as PipelineState).stageHistory.length).toBe(5);
    }
  });
});

// ─── PromptTemplate rendering ───────────────────────────────────────────────

describe('PromptTemplate', () => {
  it('should render a template with valid placeholders', () => {
    const template: PromptTemplate = {
      name: 'test',
      template: 'Hello {{name}}, welcome to {{place}}!',
      placeholders: ['name', 'place'],
    };

    const result = renderTemplate(template, { name: 'Alice', place: 'Wonderland' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('Hello Alice, welcome to Wonderland!');
    }
  });

  it('should fail on missing placeholders', () => {
    const template: PromptTemplate = {
      name: 'test',
      template: 'Hello {{name}}!',
      placeholders: ['name'],
    };

    const result = renderTemplate(template, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Missing placeholders');
    }
  });

  it('should fail on validator rejection', () => {
    const template: PromptTemplate = {
      name: 'test',
      template: 'Score: {{score}}',
      placeholders: ['score'],
      validators: {
        score: (val) => {
          const num = parseFloat(val);
          return !isNaN(num) && num >= 0 && num <= 1;
        },
      },
    };

    const result = renderTemplate(template, { score: '2.5' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Validation failed');
    }
  });

  it('should pass with valid validator input', () => {
    const template: PromptTemplate = {
      name: 'test',
      template: 'Score: {{score}}',
      placeholders: ['score'],
      validators: {
        score: (val) => {
          const num = parseFloat(val);
          return !isNaN(num) && num >= 0 && num <= 1;
        },
      },
    };

    const result = renderTemplate(template, { score: '0.75' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('Score: 0.75');
    }
  });

  it('should have STAGE_TEMPLATES for all 5 pipeline stages', () => {
    expect(STAGE_TEMPLATES['analyze_task']).toBeDefined();
    expect(STAGE_TEMPLATES['generate_approaches']).toBeDefined();
    expect(STAGE_TEMPLATES['execute_plan']).toBeDefined();
    expect(STAGE_TEMPLATES['evaluate_output']).toBeDefined();
    expect(STAGE_TEMPLATES['generate_refinement']).toBeDefined();
  });

  it('should render analyze_task template', () => {
    const template = STAGE_TEMPLATES['analyze_task']!;
    const result = renderTemplate(template, { task: 'Build a web server' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain('Build a web server');
    }
  });

  it('loadTemplatesFromYaml should return built-in templates', () => {
    const templates = loadTemplatesFromYaml('/nonexistent/path.yaml');
    expect(templates.length).toBe(5);
    expect(templates.map((t) => t.name)).toContain('analyze_task');
  });
});
