import { scoreOutput } from './scorer.js';
import type { QualityScore } from '../types/quality.js';

// ─── Judgment types ─────────────────────────────────────────────────────────

export interface JudgmentResult {
  taskRelevance: number;
  synthesisCoherence: number;
  sourceAttributionQuality: number;
  overallJudgment: number;
  confidence: number;
  rationale: string;
  improvementAreas: string[];
  timestamp: Date;
}

export interface JudgmentReport {
  taskId: string;
  judgments: JudgmentResult[];
  overallAssessment: string;
  improvementAreas: string[];
}

// ─── JudgmentEngine ─────────────────────────────────────────────────────────

export class JudgmentEngine {
  /**
   * Perform multi-dimensional judgment of output against task spec.
   * Integrates quality scoring with dispatch-specific criteria.
   */
  async judge(
    output: string,
    taskSpec: string,
    previousJudgments?: JudgmentResult[],
  ): Promise<JudgmentResult> {
    // Get base quality score for alignment
    const qualityScore = await scoreOutput(output, taskSpec);

    // Task relevance: how well does the output address the task?
    const taskRelevance = this.scoreTaskRelevance(output, taskSpec);

    // Synthesis coherence: is the output a coherent synthesis?
    const synthesisCoherence = this.scoreSynthesisCoherence(output);

    // Source attribution: are sources properly cited?
    const sourceAttributionQuality = this.scoreSourceAttribution(output);

    // Compute overall judgment weighted by all factors
    const overallJudgment =
      taskRelevance * 0.35 +
      synthesisCoherence * 0.25 +
      sourceAttributionQuality * 0.15 +
      qualityScore.overall * 0.25;

    // Identify improvement areas
    const improvementAreas: string[] = [];
    if (taskRelevance < 0.7) {
      improvementAreas.push('Task relevance: output does not sufficiently address task requirements');
    }
    if (synthesisCoherence < 0.7) {
      improvementAreas.push('Synthesis coherence: output lacks unified narrative structure');
    }
    if (sourceAttributionQuality < 0.5) {
      improvementAreas.push('Source attribution: claims need proper citations or references');
    }
    if (qualityScore.overall < 0.7) {
      improvementAreas.push(`Base quality (${qualityScore.overall.toFixed(2)}): needs improvement across dimensions`);
    }

    // Factor in previous judgments for consistency
    let confidence = 0.7;
    if (previousJudgments && previousJudgments.length > 0) {
      const prevAvg =
        previousJudgments.reduce((s, j) => s + j.overallJudgment, 0) /
        previousJudgments.length;
      const drift = Math.abs(overallJudgment - prevAvg);
      // Lower confidence if judgment drifts significantly from previous
      confidence = Math.max(0.3, 0.8 - drift * 0.5);
    }

    const rationale = this.buildRationale(
      taskRelevance,
      synthesisCoherence,
      sourceAttributionQuality,
      qualityScore,
    );

    return {
      taskRelevance,
      synthesisCoherence,
      sourceAttributionQuality,
      overallJudgment,
      confidence,
      rationale,
      improvementAreas,
      timestamp: new Date(),
    };
  }

  /**
   * Build a full judgment report for a task.
   */
  buildReport(
    taskId: string,
    judgments: JudgmentResult[],
  ): JudgmentReport {
    if (judgments.length === 0) {
      return {
        taskId,
        judgments: [],
        overallAssessment: 'No judgments available.',
        improvementAreas: [],
      };
    }

    const latest = judgments[judgments.length - 1]!;
    const avgOverall =
      judgments.reduce((s, j) => s + j.overallJudgment, 0) / judgments.length;

    // Aggregate improvement areas
    const allAreas = new Set<string>();
    for (const j of judgments) {
      for (const area of j.improvementAreas) {
        allAreas.add(area);
      }
    }

    let overallAssessment: string;
    if (avgOverall >= 0.85) {
      overallAssessment = `Excellent quality (${avgOverall.toFixed(2)}). Output meets high standards across all dimensions.`;
    } else if (avgOverall >= 0.7) {
      overallAssessment = `Good quality (${avgOverall.toFixed(2)}). Minor improvements needed in ${latest.improvementAreas.length} area(s).`;
    } else if (avgOverall >= 0.5) {
      overallAssessment = `Adequate quality (${avgOverall.toFixed(2)}). Significant improvements needed.`;
    } else {
      overallAssessment = `Below threshold (${avgOverall.toFixed(2)}). Major revision required.`;
    }

    return {
      taskId,
      judgments,
      overallAssessment,
      improvementAreas: Array.from(allAreas),
    };
  }

  // ─── Private scoring methods ────────────────────────────────────────────

  private scoreTaskRelevance(output: string, taskSpec: string): number {
    const specWords = taskSpec
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);
    if (specWords.length === 0) return 0.5;

    const matched = specWords.filter((w) =>
      output.toLowerCase().includes(w),
    );
    const ratio = matched.length / specWords.length;
    return Math.min(1, ratio * 1.2); // slight boost
  }

  private scoreSynthesisCoherence(output: string): number {
    let score = 0.5;
    // Check for logical flow indicators
    const flowWords = [
      'first', 'second', 'third', 'finally',
      'in addition', 'moreover', 'therefore',
      'as a result', 'in conclusion', 'to summarize',
    ];
    const flowCount = flowWords.filter((w) =>
      output.toLowerCase().includes(w),
    ).length;
    score += Math.min(0.3, flowCount * 0.05);

    // Check for section breaks (paragraphs or headings)
    const sections = output.split(/\n\n+/).length;
    if (sections >= 2 && sections <= 20) score += 0.15;

    // Penalize very short output
    if (output.length < 100) score -= 0.2;

    return Math.min(1, Math.max(0, score));
  }

  private scoreSourceAttribution(output: string): number {
    let score = 0.3;
    // References / citations
    const refs = (output.match(/\[\d+\]/g) ?? []).length;
    score += Math.min(0.3, refs * 0.05);
    // URLs
    const urls = (output.match(/https?:\/\/\S+/g) ?? []).length;
    score += Math.min(0.2, urls * 0.04);
    // "According to" style attributions
    const attributions = (
      output.match(/(?:according to|cited by|source:|ref:|see )/gi) ?? []
    ).length;
    score += Math.min(0.2, attributions * 0.05);

    return Math.min(1, Math.max(0, score));
  }

  private buildRationale(
    taskRelevance: number,
    synthesisCoherence: number,
    sourceAttribution: number,
    qualityScore: QualityScore,
  ): string {
    const parts: string[] = [];
    parts.push(`Task relevance: ${taskRelevance.toFixed(2)}`);
    parts.push(`Synthesis coherence: ${synthesisCoherence.toFixed(2)}`);
    parts.push(`Source attribution: ${sourceAttribution.toFixed(2)}`);
    parts.push(`Base quality: ${qualityScore.overall.toFixed(2)}`);

    const weakest = [
      { name: 'task relevance', score: taskRelevance },
      { name: 'synthesis coherence', score: synthesisCoherence },
      { name: 'source attribution', score: sourceAttribution },
    ].sort((a, b) => a.score - b.score)[0];

    if (weakest && weakest.score < 0.6) {
      parts.push(`Primary weakness: ${weakest.name} (${weakest.score.toFixed(2)})`);
    }

    return parts.join('. ');
  }
}
