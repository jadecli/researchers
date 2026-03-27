import { describe, it, expect } from 'vitest';
import { scoreOutput, meetsThreshold, DIMENSION_WEIGHTS } from '../src/quality/scorer.js';
import { CalibrationModel } from '../src/quality/calibration.js';
import { generateFeedback, buildContextDelta, aggregateFeedback } from '../src/quality/feedback.js';
import { JudgmentEngine } from '../src/quality/judge.js';
import type { QualityThreshold } from '../src/types/quality.js';
import { toRoundId } from '../src/types/core.js';

// ─── scoreOutput tests ──────────────────────────────────────────────────────

describe('scoreOutput', () => {
  it('should score all 5 dimensions', async () => {
    const score = await scoreOutput(
      '# Analysis\n\nThis is a comprehensive analysis of the task. Furthermore, it covers all requirements.\n\n## Section 1\n- Point A\n- Point B\n\n## Section 2\nAdditionally, the results show clear improvements.',
      'Analyze the task requirements and provide comprehensive coverage of all points.',
    );

    expect(score.dimensions).toHaveLength(5);
    expect(score.overall).toBeGreaterThan(0);
    expect(score.overall).toBeLessThanOrEqual(1);
    expect(score.overallConfidence).toBeGreaterThan(0);

    const dimNames = score.dimensions.map((d) => d.dimension);
    expect(dimNames).toContain('completeness');
    expect(dimNames).toContain('structure');
    expect(dimNames).toContain('accuracy');
    expect(dimNames).toContain('coherence');
    expect(dimNames).toContain('safety');
  });

  it('should apply correct dimension weights', async () => {
    const score = await scoreOutput('test output', 'test task');

    for (const dim of score.dimensions) {
      expect(dim.weight).toBe(DIMENSION_WEIGHTS[dim.dimension]);
    }

    // Weights should sum to 1.0
    const weightSum = Object.values(DIMENSION_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(weightSum).toBeCloseTo(1.0, 5);
  });

  it('should penalize unsafe output', async () => {
    const safeScore = await scoreOutput(
      'This is a safe analysis with no dangerous content.',
      'Analyze safety',
    );
    const unsafeScore = await scoreOutput(
      'Run this: rm -rf / and also eval("malicious") and <script>alert(1)</script>',
      'Analyze safety',
    );

    const safeDim = safeScore.dimensions.find((d) => d.dimension === 'safety')!;
    const unsafeDim = unsafeScore.dimensions.find((d) => d.dimension === 'safety')!;
    expect(safeDim.value).toBeGreaterThan(unsafeDim.value);
  });

  it('should reward structured output', async () => {
    const unstructured = await scoreOutput('just some text', 'task');
    const structured = await scoreOutput(
      '# Title\n\n## Section 1\n- Item 1\n- Item 2\n\n## Section 2\n```code```\n\nParagraph here.',
      'task',
    );

    const unstructDim = unstructured.dimensions.find((d) => d.dimension === 'structure')!;
    const structDim = structured.dimensions.find((d) => d.dimension === 'structure')!;
    expect(structDim.value).toBeGreaterThan(unstructDim.value);
  });
});

// ─── meetsThreshold tests ───────────────────────────────────────────────────

describe('meetsThreshold', () => {
  const threshold: QualityThreshold = {
    roundId: toRoundId('round-07'),
    minOverall: 0.75,
    minPerDimension: {
      completeness: 0.6,
      structure: 0.5,
      accuracy: 0.6,
      coherence: 0.4,
      safety: 0.7,
    },
  };

  it('should pass when all dimensions above threshold', () => {
    const score = {
      dimensions: [
        { dimension: 'completeness' as const, value: 0.8, confidence: 0.7, weight: 0.3 },
        { dimension: 'structure' as const, value: 0.7, confidence: 0.7, weight: 0.25 },
        { dimension: 'accuracy' as const, value: 0.8, confidence: 0.7, weight: 0.25 },
        { dimension: 'coherence' as const, value: 0.6, confidence: 0.7, weight: 0.1 },
        { dimension: 'safety' as const, value: 0.9, confidence: 0.7, weight: 0.1 },
      ],
      overall: 0.78,
      overallConfidence: 0.7,
    };
    expect(meetsThreshold(score, threshold)).toBe(true);
  });

  it('should fail when overall below threshold', () => {
    const score = {
      dimensions: [
        { dimension: 'completeness' as const, value: 0.8, confidence: 0.7, weight: 0.3 },
        { dimension: 'structure' as const, value: 0.7, confidence: 0.7, weight: 0.25 },
        { dimension: 'accuracy' as const, value: 0.8, confidence: 0.7, weight: 0.25 },
        { dimension: 'coherence' as const, value: 0.6, confidence: 0.7, weight: 0.1 },
        { dimension: 'safety' as const, value: 0.9, confidence: 0.7, weight: 0.1 },
      ],
      overall: 0.5,
      overallConfidence: 0.7,
    };
    expect(meetsThreshold(score, threshold)).toBe(false);
  });

  it('should fail when a dimension is below its minimum', () => {
    const score = {
      dimensions: [
        { dimension: 'completeness' as const, value: 0.3, confidence: 0.7, weight: 0.3 },
        { dimension: 'structure' as const, value: 0.7, confidence: 0.7, weight: 0.25 },
        { dimension: 'accuracy' as const, value: 0.8, confidence: 0.7, weight: 0.25 },
        { dimension: 'coherence' as const, value: 0.6, confidence: 0.7, weight: 0.1 },
        { dimension: 'safety' as const, value: 0.9, confidence: 0.7, weight: 0.1 },
      ],
      overall: 0.76,
      overallConfidence: 0.7,
    };
    expect(meetsThreshold(score, threshold)).toBe(false);
  });
});

// ─── CalibrationModel tests ─────────────────────────────────────────────────

describe('CalibrationModel', () => {
  it('should calibrate based on historical bias', () => {
    const model = new CalibrationModel();
    // Consistently over-predicting by 0.1
    model.update(0.8, 0.7);
    model.update(0.9, 0.8);
    model.update(0.7, 0.6);

    const calibrated = model.calibrate(0.85);
    expect(calibrated).toBeCloseTo(0.75, 1);
  });

  it('should return raw score with insufficient data', () => {
    const model = new CalibrationModel();
    model.update(0.8, 0.7);
    expect(model.calibrate(0.9)).toBe(0.9);
  });

  it('should compute Brier score', () => {
    const model = new CalibrationModel();
    model.update(0.8, 0.8); // perfect
    model.update(0.6, 0.6); // perfect
    expect(model.brierScore()).toBeCloseTo(0, 5);
  });

  it('should detect well-calibrated model', () => {
    const model = new CalibrationModel();
    model.update(0.8, 0.79);
    model.update(0.6, 0.61);
    model.update(0.9, 0.89);
    expect(model.isWellCalibrated()).toBe(true);
  });

  it('should detect poorly calibrated model', () => {
    const model = new CalibrationModel();
    model.update(0.9, 0.3);
    model.update(0.8, 0.2);
    model.update(0.7, 0.1);
    expect(model.isWellCalibrated()).toBe(false);
  });

  it('should produce calibration curve', () => {
    const model = new CalibrationModel();
    for (let i = 0; i < 100; i++) {
      const predicted = Math.random();
      model.update(predicted, predicted + (Math.random() - 0.5) * 0.1);
    }
    const curve = model.getCalibrationCurve();
    expect(curve.length).toBeGreaterThan(0);
    for (const point of curve) {
      expect(point.bucket).toBeGreaterThanOrEqual(0);
      expect(point.bucket).toBeLessThan(1);
    }
  });
});

// ─── generateFeedback tests ─────────────────────────────────────────────────

describe('generateFeedback', () => {
  it('should generate feedback for dimensions below threshold', () => {
    const score = {
      dimensions: [
        { dimension: 'completeness' as const, value: 0.5, confidence: 0.7, weight: 0.3 },
        { dimension: 'structure' as const, value: 0.8, confidence: 0.7, weight: 0.25 },
        { dimension: 'accuracy' as const, value: 0.4, confidence: 0.7, weight: 0.25 },
        { dimension: 'coherence' as const, value: 0.9, confidence: 0.7, weight: 0.1 },
        { dimension: 'safety' as const, value: 0.95, confidence: 0.7, weight: 0.1 },
      ],
      overall: 0.63,
      overallConfidence: 0.7,
    };

    const feedbacks = generateFeedback(score, 'test task');
    expect(feedbacks).toHaveLength(2); // completeness and accuracy below 0.7
    expect(feedbacks.map((f) => f.dimension)).toContain('completeness');
    expect(feedbacks.map((f) => f.dimension)).toContain('accuracy');
    expect(feedbacks.every((f) => f.suggestion.length > 0)).toBe(true);
  });

  it('should return empty for all-passing scores', () => {
    const score = {
      dimensions: [
        { dimension: 'completeness' as const, value: 0.9, confidence: 0.7, weight: 0.3 },
        { dimension: 'structure' as const, value: 0.8, confidence: 0.7, weight: 0.25 },
        { dimension: 'accuracy' as const, value: 0.85, confidence: 0.7, weight: 0.25 },
        { dimension: 'coherence' as const, value: 0.9, confidence: 0.7, weight: 0.1 },
        { dimension: 'safety' as const, value: 0.95, confidence: 0.7, weight: 0.1 },
      ],
      overall: 0.87,
      overallConfidence: 0.7,
    };

    const feedbacks = generateFeedback(score, 'test');
    expect(feedbacks).toHaveLength(0);
  });
});

// ─── buildContextDelta tests ────────────────────────────────────────────────

describe('buildContextDelta', () => {
  it('should compute quality trajectory from multiple scores', () => {
    const scores = [
      {
        dimensions: [
          { dimension: 'completeness' as const, value: 0.5, confidence: 0.7, weight: 0.3 },
        ],
        overall: 0.5,
        overallConfidence: 0.7,
      },
      {
        dimensions: [
          { dimension: 'completeness' as const, value: 0.7, confidence: 0.7, weight: 0.3 },
        ],
        overall: 0.7,
        overallConfidence: 0.7,
      },
    ];

    const delta = buildContextDelta(scores);
    expect(delta.qualityBefore).toBe(0.5);
    expect(delta.qualityAfter).toBe(0.7);
    expect(delta.newPatterns.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty scores', () => {
    const delta = buildContextDelta([]);
    expect(delta.qualityBefore).toBe(0);
    expect(delta.qualityAfter).toBe(0);
  });

  it('should increment iteration from previous delta', () => {
    const prev = {
      iteration: 3,
      newPatterns: ['pattern-1'],
      failingStrategies: [],
      qualityBefore: 0.5,
      qualityAfter: 0.6,
      steerDirection: 'test',
      discoveredTypes: [],
    };

    const scores = [
      {
        dimensions: [
          { dimension: 'completeness' as const, value: 0.7, confidence: 0.7, weight: 0.3 },
        ],
        overall: 0.7,
        overallConfidence: 0.7,
      },
    ];

    const delta = buildContextDelta(scores, prev);
    expect(delta.iteration).toBe(4);
    expect(delta.newPatterns).toContain('pattern-1');
  });
});

// ─── aggregateFeedback tests ────────────────────────────────────────────────

describe('aggregateFeedback', () => {
  it('should deduplicate by dimension (latest wins)', () => {
    const round1 = [
      { dimension: 'completeness' as const, score: 0.3, suggestion: 'old suggestion' },
    ];
    const round2 = [
      { dimension: 'completeness' as const, score: 0.5, suggestion: 'new suggestion' },
    ];

    const merged = aggregateFeedback([round1, round2]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.suggestion).toBe('new suggestion');
  });

  it('should merge different dimensions', () => {
    const round1 = [
      { dimension: 'completeness' as const, score: 0.3, suggestion: 'improve completeness' },
    ];
    const round2 = [
      { dimension: 'accuracy' as const, score: 0.4, suggestion: 'improve accuracy' },
    ];

    const merged = aggregateFeedback([round1, round2]);
    expect(merged).toHaveLength(2);
  });
});

// ─── JudgmentEngine tests ───────────────────────────────────────────────────

describe('JudgmentEngine', () => {
  it('should produce judgment with all fields', async () => {
    const engine = new JudgmentEngine();
    const result = await engine.judge(
      '# Analysis Report\n\nAccording to the research, the findings indicate significant improvements. Furthermore, the data supports the conclusion.\n\n## References\n[1] https://example.com',
      'Produce a comprehensive analysis report with references',
    );

    expect(result.taskRelevance).toBeGreaterThan(0);
    expect(result.synthesisCoherence).toBeGreaterThan(0);
    expect(result.sourceAttributionQuality).toBeGreaterThan(0);
    expect(result.overallJudgment).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.rationale.length).toBeGreaterThan(0);
    expect(result.timestamp).toBeInstanceOf(Date);
  });
});
