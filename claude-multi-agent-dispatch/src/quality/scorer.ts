import type {
  QualityDimension,
  DimensionScore,
  QualityScore,
  QualityThreshold,
} from '../types/quality.js';

// ─── Dimension Weights ──────────────────────────────────────────────────────

export const DIMENSION_WEIGHTS: Record<QualityDimension, number> = {
  completeness: 0.30,
  structure: 0.25,
  accuracy: 0.25,
  coherence: 0.10,
  safety: 0.10,
};

// ─── Scoring Heuristics ─────────────────────────────────────────────────────
// Each dimension is scored independently via keyword/structural analysis.

function scoreCompleteness(output: string, taskSpec: string): DimensionScore {
  const requirements = taskSpec.split(/[.!?\n]/).filter((s) => s.trim().length > 10);
  let matched = 0;
  for (const req of requirements) {
    const keywords = req
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);
    const found = keywords.filter((kw) => output.toLowerCase().includes(kw));
    if (found.length >= keywords.length * 0.3) matched++;
  }
  const ratio = requirements.length > 0 ? matched / requirements.length : 0.5;
  const value = Math.min(1, Math.max(0, ratio));
  return {
    dimension: 'completeness',
    value,
    confidence: Math.min(0.9, 0.5 + requirements.length * 0.05),
    weight: DIMENSION_WEIGHTS.completeness,
  };
}

function scoreStructure(output: string): DimensionScore {
  let score = 0.3; // baseline
  // Reward headings
  const headings = (output.match(/^#{1,3}\s/gm) ?? []).length;
  score += Math.min(0.2, headings * 0.05);
  // Reward lists
  const listItems = (output.match(/^[\s]*[-*\d.]+\s/gm) ?? []).length;
  score += Math.min(0.2, listItems * 0.02);
  // Reward paragraphs (multi-line breaks)
  const paragraphs = output.split(/\n\n+/).length;
  score += Math.min(0.15, paragraphs * 0.03);
  // Reward code blocks
  const codeBlocks = (output.match(/```/g) ?? []).length / 2;
  score += Math.min(0.15, codeBlocks * 0.05);

  return {
    dimension: 'structure',
    value: Math.min(1, Math.max(0, score)),
    confidence: 0.7,
    weight: DIMENSION_WEIGHTS.structure,
  };
}

function scoreAccuracy(output: string, taskSpec: string): DimensionScore {
  // Heuristic: penalize contradictions and unsupported claims
  let score = 0.7; // assume mostly accurate
  const contradictionPatterns = [
    /however.*(?:actually|in fact)/gi,
    /this is (?:wrong|incorrect|false)/gi,
  ];
  for (const pattern of contradictionPatterns) {
    if (pattern.test(output)) score -= 0.1;
  }
  // Reward references and citations
  const refs = (output.match(/\[[\d]+\]|https?:\/\/\S+/g) ?? []).length;
  score += Math.min(0.2, refs * 0.03);
  // Reward alignment with task keywords
  const taskKeywords = taskSpec
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 5);
  const alignedCount = taskKeywords.filter((kw) =>
    output.toLowerCase().includes(kw),
  ).length;
  const alignment =
    taskKeywords.length > 0 ? alignedCount / taskKeywords.length : 0.5;
  score += alignment * 0.1;

  return {
    dimension: 'accuracy',
    value: Math.min(1, Math.max(0, score)),
    confidence: 0.6,
    weight: DIMENSION_WEIGHTS.accuracy,
  };
}

function scoreCoherence(output: string): DimensionScore {
  let score = 0.6;
  const sentences = output
    .split(/[.!?]+/)
    .filter((s) => s.trim().length > 5);
  // Reward reasonable sentence count
  if (sentences.length >= 3 && sentences.length <= 200) score += 0.15;
  // Penalize very short or very long outputs
  if (output.length < 50) score -= 0.3;
  if (output.length > 100000) score -= 0.1;
  // Reward transition words
  const transitions = [
    'therefore',
    'however',
    'furthermore',
    'additionally',
    'consequently',
    'moreover',
    'specifically',
    'in summary',
  ];
  const transitionCount = transitions.filter((t) =>
    output.toLowerCase().includes(t),
  ).length;
  score += Math.min(0.2, transitionCount * 0.04);

  return {
    dimension: 'coherence',
    value: Math.min(1, Math.max(0, score)),
    confidence: 0.65,
    weight: DIMENSION_WEIGHTS.coherence,
  };
}

function scoreSafety(output: string): DimensionScore {
  let score = 1.0;
  // Penalize dangerous patterns
  const dangerPatterns = [
    /rm\s+-rf\s+\//i,
    /sudo\s+rm/i,
    /DROP\s+TABLE/i,
    /exec\s*\(/i,
    /eval\s*\(/i,
    /<script>/i,
    /password\s*[:=]\s*["'][^"']+["']/i,
  ];
  for (const pattern of dangerPatterns) {
    if (pattern.test(output)) score -= 0.15;
  }
  // Check for PII-like patterns
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(output)) score -= 0.2; // SSN
  if (/\b(?:sk-|pk_)[a-zA-Z0-9]{20,}\b/.test(output)) score -= 0.2; // API key

  return {
    dimension: 'safety',
    value: Math.min(1, Math.max(0, score)),
    confidence: 0.85,
    weight: DIMENSION_WEIGHTS.safety,
  };
}

// ─── Main scoring function ──────────────────────────────────────────────────

export async function scoreOutput(
  output: string,
  taskSpec: string,
): Promise<QualityScore> {
  const dimensions: DimensionScore[] = [
    scoreCompleteness(output, taskSpec),
    scoreStructure(output),
    scoreAccuracy(output, taskSpec),
    scoreCoherence(output),
    scoreSafety(output),
  ];

  const overall = dimensions.reduce(
    (sum, d) => sum + d.value * d.weight,
    0,
  );

  const overallConfidence =
    dimensions.reduce((sum, d) => sum + d.confidence * d.weight, 0);

  return {
    dimensions,
    overall,
    overallConfidence,
  };
}

// ─── Threshold check ────────────────────────────────────────────────────────

export function meetsThreshold(
  score: QualityScore,
  threshold: QualityThreshold,
): boolean {
  if (score.overall < threshold.minOverall) return false;

  for (const dim of score.dimensions) {
    const minDim = threshold.minPerDimension[dim.dimension];
    if (minDim !== undefined && dim.value < minDim) return false;
  }

  return true;
}
