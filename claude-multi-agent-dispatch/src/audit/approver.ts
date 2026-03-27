import { Ok, Err, type Result } from '../types/index.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export type FlagReason =
  | 'hallucination'
  | 'unsupported_claim'
  | 'logical_inconsistency'
  | 'factual_error';

export interface FlaggedSection {
  readonly text: string;
  readonly reason: FlagReason;
  readonly confidence: number;
}

export interface ApprovalResult {
  readonly approved: boolean;
  readonly confidence: number;
  readonly flaggedSections: readonly FlaggedSection[];
}

// ─── Hallucination detection patterns ───────────────────────────────────────

// URLs that look fabricated (common patterns in LLM hallucinations)
const FAKE_URL_PATTERN = /https?:\/\/(?:www\.)?(?:example-(?:site|page|doc|blog|api)\d*\.(?:com|org|io|net))/gi;

// Fabricated statistics: very precise percentages with no source
const FABRICATED_STAT_PATTERN = /(?:exactly|precisely)\s+\d{1,3}\.\d{2,}%/gi;

// Impossible dates (e.g., future dates presented as past, Feb 30, etc.)
const IMPOSSIBLE_DATE_PATTERNS = [
  /(?:February|Feb)\s+(?:3[0-9]|29(?:,?\s+(?:19|20)\d{2})?)/gi,  // Feb 30+
  /(?:April|Jun|September|November|Apr|Sep|Nov)\s+31/gi,           // 31st of 30-day months
  /(?:13|14|15)\/\d{1,2}\/\d{2,4}/g,                               // Month > 12
];

// Citations to non-existent papers/sources
const FAKE_CITATION_PATTERN = /(?:according to|as shown in|cited in)\s+[""][^""]{10,}[""]\s+\(\d{4}\)/gi;

// Made-up organization names with common hallucination patterns
const FAKE_ORG_PATTERN = /(?:the\s+)?(?:International|Global|World)\s+(?:Institute|Foundation|Council|Society)\s+(?:for|of)\s+\w+\s+\w+/gi;

/**
 * Check output for common hallucination patterns and factual issues.
 * In production, this would use an LLM for deeper analysis.
 * Currently uses pattern-based detection for deterministic behavior.
 */
export async function realismApprover(
  output: string,
  context: string,
): Promise<Result<ApprovalResult, Error>> {
  try {
    if (!output || output.trim().length === 0) {
      return Ok({
        approved: true,
        confidence: 1.0,
        flaggedSections: [],
      });
    }

    const flaggedSections: FlaggedSection[] = [];

    // Check for fabricated URLs
    const fakeUrls = output.match(FAKE_URL_PATTERN);
    if (fakeUrls) {
      for (const url of fakeUrls) {
        flaggedSections.push({
          text: url,
          reason: 'hallucination',
          confidence: 0.85,
        });
      }
    }

    // Check for fabricated statistics
    const fakeStats = output.match(FABRICATED_STAT_PATTERN);
    if (fakeStats) {
      for (const stat of fakeStats) {
        flaggedSections.push({
          text: stat,
          reason: 'unsupported_claim',
          confidence: 0.7,
        });
      }
    }

    // Check for impossible dates
    for (const pattern of IMPOSSIBLE_DATE_PATTERNS) {
      const matches = output.match(pattern);
      if (matches) {
        for (const match of matches) {
          flaggedSections.push({
            text: match,
            reason: 'factual_error',
            confidence: 0.95,
          });
        }
      }
    }

    // Check for fake citations
    const fakeCitations = output.match(FAKE_CITATION_PATTERN);
    if (fakeCitations) {
      for (const citation of fakeCitations) {
        flaggedSections.push({
          text: citation,
          reason: 'hallucination',
          confidence: 0.6,
        });
      }
    }

    // Check for logical inconsistencies: contradictions within the output
    const sentences = output.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[i]!.toLowerCase();
      for (let j = i + 1; j < sentences.length; j++) {
        const t = sentences[j]!.toLowerCase();
        // Simple contradiction detection: "X is Y" followed by "X is not Y"
        if (
          (s.includes('is not') && t.includes(s.replace('is not', 'is').trim())) ||
          (t.includes('is not') && s.includes(t.replace('is not', 'is').trim()))
        ) {
          flaggedSections.push({
            text: `"${sentences[i]!.trim()}" contradicts "${sentences[j]!.trim()}"`,
            reason: 'logical_inconsistency',
            confidence: 0.65,
          });
        }
      }
    }

    // Check context consistency: if context provides facts, verify output doesn't contradict
    if (context.trim().length > 0) {
      const contextLower = context.toLowerCase();
      const outputLower = output.toLowerCase();

      // Check for numbers in context that are different in output
      const contextNumbers = contextLower.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
      const outputNumbers = outputLower.match(/\b\d+(?:\.\d+)?\b/g) ?? [];

      // Simple heuristic: if a specific number appears in context but a very different
      // number appears in the same sentence context in output, flag it
      for (const ctxNum of contextNumbers) {
        const num = parseFloat(ctxNum);
        if (num > 100) {
          // Only check significant numbers
          for (const outNum of outputNumbers) {
            const oNum = parseFloat(outNum);
            if (oNum > 100 && Math.abs(num - oNum) / num > 0.5 && Math.abs(num - oNum) > 100) {
              // More than 50% difference for significant numbers
              flaggedSections.push({
                text: `Number ${outNum} in output may conflict with ${ctxNum} in context`,
                reason: 'factual_error',
                confidence: 0.5,
              });
              break; // One flag per context number
            }
          }
        }
      }
    }

    // Calculate overall confidence based on number and severity of flags
    const totalFlags = flaggedSections.length;
    const avgFlagConfidence =
      totalFlags > 0
        ? flaggedSections.reduce((sum, f) => sum + f.confidence, 0) / totalFlags
        : 0;

    // Approved if no high-confidence flags
    const highConfidenceFlags = flaggedSections.filter((f) => f.confidence >= 0.8);
    const approved = highConfidenceFlags.length === 0;

    // Overall confidence inversely related to flag count and severity
    const confidence = Math.max(0.1, 1.0 - totalFlags * 0.15 * avgFlagConfidence);

    return Ok({
      approved,
      confidence: Math.round(confidence * 100) / 100,
      flaggedSections,
    });
  } catch (err) {
    return Err(err instanceof Error ? err : new Error(String(err)));
  }
}
