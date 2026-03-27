import * as fs from 'node:fs';
import * as path from 'node:path';
import { Ok, Err, type Result } from '../types/core.js';
import type { QualityScore, ContextDeltaPayload } from '../types/quality.js';
import type { RoundDefinition, RoundResult } from './types.js';
import { ContextDeltaAccumulator } from '../refinement/context-delta.js';
import { scoreOutput } from '../quality/scorer.js';
import { buildContextDelta } from '../quality/feedback.js';
import { JSONLWriter } from '../logging/jsonl.js';

// ─── AuditStore interface ───────────────────────────────────────────────────
// Minimal interface for the audit store dependency.

export interface AuditStore {
  getRoundResult(roundId: string): RoundResult | undefined;
  saveRoundResult(result: RoundResult): void;
}

// ─── RoundRunner ────────────────────────────────────────────────────────────

export class RoundRunner {
  private readonly store: AuditStore;
  private readonly deltaAccumulator: ContextDeltaAccumulator;
  private readonly baseDir: string;

  constructor(
    store: AuditStore,
    deltaAccumulator: ContextDeltaAccumulator,
    baseDir: string = 'rounds',
  ) {
    this.store = store;
    this.deltaAccumulator = deltaAccumulator;
    this.baseDir = baseDir;
  }

  /**
   * Execute a round definition through the full pipeline:
   * verify prerequisites → load deltas → inject context → execute → score → persist.
   */
  async executeRound(
    definition: RoundDefinition,
  ): Promise<Result<RoundResult, Error>> {
    const startTime = Date.now();

    // 1. Verify prerequisites
    const prereqResult = this.verifyPrerequisites(definition);
    if (!prereqResult.ok) return prereqResult;

    // 2. Load accumulated deltas
    const accumulatedContext = this.loadAccumulatedDeltas();

    // 3. Inject context from previous rounds
    const contextFragment = this.injectContext(definition, accumulatedContext);

    // 4. Execute extraction tasks
    const extractionOutput = await this.executeExtractionTasks(
      definition,
      contextFragment,
    );

    // 5. Score quality
    const qualityScore = await this.scoreQuality(
      extractionOutput,
      definition.goal,
    );

    // 6. Generate delta
    const contextDelta = this.generateDelta(
      definition,
      qualityScore,
      extractionOutput,
    );

    // Add delta to accumulator
    this.deltaAccumulator.add(contextDelta);

    // 7. Build result
    const roundDir = path.join(
      this.baseDir,
      String(definition.number),
    );
    const eventsLogPath = path.join(roundDir, 'events.jsonl');

    const result: RoundResult = {
      roundId: definition.id,
      qualityScore,
      extractedPatterns: this.extractPatterns(extractionOutput),
      contextDelta,
      duration: Date.now() - startTime,
      eventsLogPath,
    };

    // 8. Persist results
    this.persistResults(definition, result, extractionOutput);

    return Ok(result);
  }

  // ─── Internal pipeline stages ─────────────────────────────────────────

  private verifyPrerequisites(
    definition: RoundDefinition,
  ): Result<void, Error> {
    for (const prereqId of definition.prerequisites) {
      const prereqResult = this.store.getRoundResult(prereqId as string);
      if (!prereqResult) {
        return Err(
          new Error(
            `Prerequisite ${prereqId} not completed for round ${definition.id}`,
          ),
        );
      }

      // Check that prerequisite met its quality threshold
      if (prereqResult.qualityScore.overall < definition.qualityThreshold * 0.8) {
        return Err(
          new Error(
            `Prerequisite ${prereqId} quality (${prereqResult.qualityScore.overall.toFixed(2)}) below acceptable level`,
          ),
        );
      }
    }
    return Ok(undefined);
  }

  private loadAccumulatedDeltas(): ContextDeltaPayload {
    return this.deltaAccumulator.getCumulativeDelta();
  }

  private injectContext(
    definition: RoundDefinition,
    accumulatedDelta: ContextDeltaPayload,
  ): string {
    const parts: string[] = [];

    parts.push(`# Round ${definition.number}: ${definition.name}`);
    parts.push(`Goal: ${definition.goal}`);
    parts.push(`Quality threshold: ${definition.qualityThreshold}`);

    if (accumulatedDelta.newPatterns.length > 0) {
      parts.push(
        `\nDiscovered patterns:\n${accumulatedDelta.newPatterns.map((p) => `- ${p}`).join('\n')}`,
      );
    }

    if (accumulatedDelta.steerDirection) {
      parts.push(`\nFocus: ${accumulatedDelta.steerDirection}`);
    }

    if (accumulatedDelta.failingStrategies.length > 0) {
      parts.push(
        `\nAvoid:\n${accumulatedDelta.failingStrategies.map((s) => `- ${s}`).join('\n')}`,
      );
    }

    parts.push(
      `\nQuality trajectory: ${accumulatedDelta.qualityBefore.toFixed(2)} → ${accumulatedDelta.qualityAfter.toFixed(2)}`,
    );

    return parts.join('\n');
  }

  private async executeExtractionTasks(
    definition: RoundDefinition,
    contextFragment: string,
  ): Promise<string> {
    // In a real implementation, this would dispatch to agents.
    // Here we produce a structured output based on the round definition.
    const output = [
      `# Round ${definition.number}: ${definition.name}`,
      '',
      `## Context`,
      contextFragment,
      '',
      `## Extraction Results`,
      `Target repositories: ${definition.targetRepos.join(', ')}`,
      '',
      `## Findings`,
      `Round ${definition.number} completed extraction for: ${definition.goal}`,
      '',
      `## Patterns Discovered`,
      `- Pattern from ${definition.name}`,
      `- Architecture insight from round ${definition.number}`,
    ].join('\n');

    return output;
  }

  private async scoreQuality(
    output: string,
    goal: string,
  ): Promise<QualityScore> {
    return scoreOutput(output, goal);
  }

  private generateDelta(
    definition: RoundDefinition,
    qualityScore: QualityScore,
    output: string,
  ): ContextDeltaPayload {
    const patterns = this.extractPatterns(output);
    const previousDelta =
      this.deltaAccumulator.getHistory().length > 0
        ? this.deltaAccumulator.getHistory()[
            this.deltaAccumulator.getHistory().length - 1
          ]
        : undefined;

    return buildContextDelta([qualityScore], previousDelta);
  }

  private extractPatterns(output: string): string[] {
    const patterns: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Extract bullet points as patterns
      if (trimmed.startsWith('- ') && trimmed.length > 5) {
        patterns.push(trimmed.slice(2));
      }
    }

    return patterns;
  }

  private persistResults(
    definition: RoundDefinition,
    result: RoundResult,
    output: string,
  ): void {
    const roundDir = path.join(
      this.baseDir,
      String(definition.number),
    );

    // Ensure directory exists
    if (!fs.existsSync(roundDir)) {
      fs.mkdirSync(roundDir, { recursive: true });
    }

    // Write events.jsonl
    const writer = new JSONLWriter(path.join(roundDir, 'events.jsonl'));
    writer.append({
      type: 'quality_score',
      scores: Object.fromEntries(
        result.qualityScore.dimensions.map((d) => [d.dimension, d.value]),
      ),
      overall: result.qualityScore.overall,
      timestamp: new Date(),
    });

    // Write quality.json
    fs.writeFileSync(
      path.join(roundDir, 'quality.json'),
      JSON.stringify(result.qualityScore, null, 2),
      'utf-8',
    );

    // Write delta.json
    fs.writeFileSync(
      path.join(roundDir, 'delta.json'),
      JSON.stringify(result.contextDelta, null, 2),
      'utf-8',
    );

    // Write summary.md
    const summary = [
      `# Round ${definition.number}: ${definition.name}`,
      '',
      `**Goal:** ${definition.goal}`,
      `**Quality Score:** ${result.qualityScore.overall.toFixed(2)}`,
      `**Threshold:** ${definition.qualityThreshold}`,
      `**Duration:** ${result.duration}ms`,
      '',
      `## Extracted Patterns`,
      ...result.extractedPatterns.map((p) => `- ${p}`),
      '',
      `## Quality Dimensions`,
      ...result.qualityScore.dimensions.map(
        (d) => `- ${d.dimension}: ${d.value.toFixed(2)} (confidence: ${d.confidence.toFixed(2)})`,
      ),
    ].join('\n');

    fs.writeFileSync(
      path.join(roundDir, 'summary.md'),
      summary,
      'utf-8',
    );

    // Save to audit store
    this.store.saveRoundResult(result);
  }
}
