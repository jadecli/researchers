import type {
  QualityScore,
  QualityFeedback,
  QualityDimension,
  ContextDeltaPayload,
} from '../types/quality.js';

// ─── Dimension-specific improvement suggestions ─────────────────────────────

const IMPROVEMENT_SUGGESTIONS: Record<QualityDimension, string[]> = {
  completeness: [
    'Address all requirements listed in the task specification',
    'Ensure each section of the task is covered with sufficient detail',
    'Add missing examples or edge cases',
  ],
  structure: [
    'Organize content with clear headings and subheadings',
    'Use bullet points or numbered lists for sequential steps',
    'Add a summary section at the beginning or end',
  ],
  accuracy: [
    'Verify claims against reliable sources',
    'Add citations or references for factual statements',
    'Remove or qualify uncertain statements',
  ],
  coherence: [
    'Use transition words to connect ideas between sections',
    'Ensure consistent terminology throughout the document',
    'Restructure to follow a logical progression',
  ],
  safety: [
    'Remove any exposed credentials or API keys',
    'Sanitize file paths and URLs to prevent SSRF',
    'Avoid including executable code patterns without proper caveats',
  ],
};

const DEFAULT_THRESHOLD = 0.7;

// ─── generateFeedback ───────────────────────────────────────────────────────

/**
 * Map each dimension below threshold to specific improvement suggestions.
 */
export function generateFeedback(
  score: QualityScore,
  _taskSpec: string,
  threshold: number = DEFAULT_THRESHOLD,
): QualityFeedback[] {
  const feedbacks: QualityFeedback[] = [];

  for (const dim of score.dimensions) {
    if (dim.value < threshold) {
      const suggestions = IMPROVEMENT_SUGGESTIONS[dim.dimension] ?? [];
      const suggestion =
        suggestions.length > 0
          ? suggestions.join('; ')
          : `Improve ${dim.dimension} score from ${dim.value.toFixed(2)} to at least ${threshold.toFixed(2)}`;

      feedbacks.push({
        dimension: dim.dimension,
        score: dim.value,
        suggestion,
      });
    }
  }

  return feedbacks;
}

// ─── buildContextDelta ──────────────────────────────────────────────────────

/**
 * Compute quality trajectory and build context delta for refinement.
 */
export function buildContextDelta(
  scores: QualityScore[],
  previousDelta?: ContextDeltaPayload,
): ContextDeltaPayload {
  if (scores.length === 0) {
    return {
      iteration: previousDelta ? previousDelta.iteration + 1 : 0,
      newPatterns: [],
      failingStrategies: [],
      qualityBefore: previousDelta?.qualityAfter ?? 0,
      qualityAfter: 0,
      steerDirection: 'No scores available to analyze',
      discoveredTypes: [],
    };
  }

  const latest = scores[scores.length - 1]!;
  const qualityAfter = latest.overall;
  const qualityBefore =
    scores.length > 1
      ? scores[scores.length - 2]!.overall
      : previousDelta?.qualityAfter ?? 0;

  // Identify failing dimensions
  const failingDims = latest.dimensions
    .filter((d) => d.value < 0.7)
    .map((d) => d.dimension);

  // Identify improving dimensions (compare to previous)
  const newPatterns: string[] = [];
  if (scores.length > 1) {
    const prev = scores[scores.length - 2]!;
    for (const dim of latest.dimensions) {
      const prevDim = prev.dimensions.find((d) => d.dimension === dim.dimension);
      if (prevDim && dim.value > prevDim.value + 0.05) {
        newPatterns.push(
          `${dim.dimension} improved: ${prevDim.value.toFixed(2)} → ${dim.value.toFixed(2)}`,
        );
      }
    }
  }

  // Determine steer direction
  let steerDirection: string;
  if (failingDims.length === 0) {
    steerDirection = 'All dimensions above threshold. Focus on maintaining quality.';
  } else if (failingDims.length === 1) {
    steerDirection = `Focus improvement on ${failingDims[0]}`;
  } else {
    steerDirection = `Priority improvements needed: ${failingDims.join(', ')}`;
  }

  // Merge with previous delta patterns
  const allPatterns = [
    ...(previousDelta?.newPatterns ?? []),
    ...newPatterns,
  ];
  const allFailing = [
    ...(previousDelta?.failingStrategies ?? []),
    ...failingDims.map((d) => `${d} below threshold`),
  ];

  // Discover types from quality trajectory
  const discoveredTypes: string[] = [];
  if (qualityAfter > qualityBefore + 0.1) {
    discoveredTypes.push('quality_improving');
  }
  if (qualityAfter < qualityBefore - 0.05) {
    discoveredTypes.push('quality_regressing');
  }
  if (Math.abs(qualityAfter - qualityBefore) < 0.01) {
    discoveredTypes.push('quality_stagnant');
  }

  return {
    iteration: previousDelta ? previousDelta.iteration + 1 : scores.length,
    newPatterns: deduplicate(allPatterns),
    failingStrategies: deduplicate(allFailing),
    qualityBefore,
    qualityAfter,
    steerDirection,
    discoveredTypes: [
      ...(previousDelta?.discoveredTypes ?? []),
      ...discoveredTypes,
    ],
  };
}

// ─── aggregateFeedback ──────────────────────────────────────────────────────

/**
 * Merge multiple rounds of feedback, deduplicating by dimension.
 * Later feedback takes priority (keeps the latest suggestion per dimension).
 */
export function aggregateFeedback(
  feedbacks: QualityFeedback[][],
): QualityFeedback[] {
  const byDimension = new Map<string, QualityFeedback>();

  for (const round of feedbacks) {
    for (const fb of round) {
      // Later rounds overwrite earlier — keeps most recent per dimension
      byDimension.set(fb.dimension, fb);
    }
  }

  return Array.from(byDimension.values());
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function deduplicate(arr: readonly string[]): string[] {
  return [...new Set(arr)];
}
