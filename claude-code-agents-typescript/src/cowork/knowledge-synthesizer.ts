// src/cowork/knowledge-synthesizer.ts — Synthesizes crawled results into structured knowledge
import type { ExtractionResult } from '../models/extraction-result.js';

// ── Quality Tier ────────────────────────────────────────────────
export type QualityTier = 'high' | 'medium' | 'low';

function qualityTier(overall: number): QualityTier {
  if (overall >= 0.8) return 'high';
  if (overall >= 0.5) return 'medium';
  return 'low';
}

// ── Synthesis Output ────────────────────────────────────────────
export interface KnowledgeSynthesis {
  readonly byPageType: Readonly<Record<string, readonly ExtractionResult[]>>;
  readonly byQualityTier: Readonly<Record<QualityTier, readonly ExtractionResult[]>>;
  readonly commonPatterns: readonly string[];
  readonly apiEndpoints: readonly string[];
  readonly statistics: SynthesisStats;
  readonly summaries: readonly string[];
}

export interface SynthesisStats {
  readonly totalResults: number;
  readonly averageQuality: number;
  readonly highQualityCount: number;
  readonly totalContentLength: number;
  readonly uniquePageTypes: number;
}

// ── Knowledge Synthesizer ───────────────────────────────────────
export class KnowledgeSynthesizer {
  synthesize(results: readonly ExtractionResult[]): KnowledgeSynthesis {
    const byPageType: Record<string, ExtractionResult[]> = {};
    const byQualityTier: Record<QualityTier, ExtractionResult[]> = {
      high: [],
      medium: [],
      low: [],
    };
    const apiEndpoints: string[] = [];

    for (const result of results) {
      // Group by page type
      const pt = result.pageType;
      if (!byPageType[pt]) byPageType[pt] = [];
      byPageType[pt]!.push(result);

      // Group by quality tier
      const tier = qualityTier(result.quality.overall as number);
      byQualityTier[tier].push(result);

      // Extract API endpoints from structured data
      const endpoints = this.extractEndpoints(result);
      apiEndpoints.push(...endpoints);
    }

    const commonPatterns = this.findCommonPatterns(results);
    const statistics = this.computeStats(results);
    const summaries = this.generateSummaries(results);

    return {
      byPageType,
      byQualityTier,
      commonPatterns,
      apiEndpoints: [...new Set(apiEndpoints)],
      statistics,
      summaries,
    };
  }

  private extractEndpoints(result: ExtractionResult): readonly string[] {
    const endpoints: string[] = [];
    const data = result.structuredData;

    if ('endpoints' in data && Array.isArray(data['endpoints'])) {
      for (const ep of data['endpoints']) {
        if (typeof ep === 'string') endpoints.push(ep);
      }
    }

    // Scan content for URL patterns
    const urlPattern = /(?:GET|POST|PUT|DELETE|PATCH)\s+(\/[\w/-]+)/g;
    let match;
    while ((match = urlPattern.exec(result.content)) !== null) {
      if (match[1]) endpoints.push(match[1]);
    }

    return endpoints;
  }

  private findCommonPatterns(
    results: readonly ExtractionResult[],
  ): readonly string[] {
    const selectorCounts = new Map<string, number>();
    for (const result of results) {
      for (const selector of result.selectorsUsed) {
        selectorCounts.set(selector, (selectorCounts.get(selector) ?? 0) + 1);
      }
    }
    return [...selectorCounts.entries()]
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .map(([selector]) => selector);
  }

  private computeStats(
    results: readonly ExtractionResult[],
  ): SynthesisStats {
    if (results.length === 0) {
      return {
        totalResults: 0,
        averageQuality: 0,
        highQualityCount: 0,
        totalContentLength: 0,
        uniquePageTypes: 0,
      };
    }

    const totalQuality = results.reduce(
      (sum, r) => sum + (r.quality.overall as number),
      0,
    );
    const pageTypes = new Set(results.map((r) => r.pageType));

    return {
      totalResults: results.length,
      averageQuality: totalQuality / results.length,
      highQualityCount: results.filter(
        (r) => (r.quality.overall as number) >= 0.8,
      ).length,
      totalContentLength: results.reduce(
        (sum, r) => sum + r.content.length,
        0,
      ),
      uniquePageTypes: pageTypes.size,
    };
  }

  private generateSummaries(
    results: readonly ExtractionResult[],
  ): readonly string[] {
    return results
      .filter((r) => (r.quality.overall as number) >= 0.5)
      .map(
        (r) =>
          `[${r.pageType}] ${r.title ?? r.url}: ${r.content.slice(0, 200)}`,
      );
  }
}
