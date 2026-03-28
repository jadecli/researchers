// devops-review/src/bloom-dedup.ts — BloomFilter check deduplication
//
// Dogfoods the mnemonist BloomFilter pattern from:
//   claude-code-agents-typescript/src/crawlers/crawlee-crawler.ts
//
// In crawlee-crawler.ts, BloomFilter deduplicates URLs across crawl rounds.
// Here we dedup check findings across multi-PR reviews to avoid
// reporting the same violation repeatedly when PRs overlap.

import mnemonist from 'mnemonist';
const { BloomFilter } = mnemonist;

import type { CheckFinding, CheckId, PRNumber } from './types.js';

// ── BloomFilter configuration (mirrors crawlee-crawler.ts defaults) ──
export interface DeduplicationConfig {
  readonly filterSize: number;      // bloom filter capacity (crawlee default: 10_000)
  readonly errorRate: number;        // false positive rate (crawlee default: 0.01)
}

const DEFAULT_DEDUP_CONFIG: DeduplicationConfig = {
  filterSize: 10_000,
  errorRate: 0.01,
};

// ── Fingerprint generation ─────────────────────────────────────────
// Creates a unique key for a finding so bloom filter can test membership.
// Pattern: "CHK-ID|severity|category-hash" — same finding across PRs dedupes.
function fingerprintFinding(finding: CheckFinding): string {
  return `${finding.checkId}|${finding.severity}|${finding.decisionId}|${finding.result}`;
}

// ── Check Deduplicator ─────────────────────────────────────────────
// Mirrors CrawleeMnemonistCrawler.isUrlSeen / markUrlSeen pattern.
export class CheckDeduplicator {
  private readonly filter: InstanceType<typeof BloomFilter>;
  private seen = 0;
  private dupes = 0;

  constructor(config: Partial<DeduplicationConfig> = {}) {
    const merged = { ...DEFAULT_DEDUP_CONFIG, ...config };
    this.filter = new BloomFilter(merged.filterSize);
  }

  /** Test if a finding has been seen before (probabilistic). */
  isSeen(finding: CheckFinding): boolean {
    const fp = fingerprintFinding(finding);
    return this.filter.test(fp);
  }

  /** Mark a finding as seen. */
  markSeen(finding: CheckFinding): void {
    const fp = fingerprintFinding(finding);
    this.filter.add(fp);
    this.seen++;
  }

  /** Deduplicate an array of findings, returning only novel ones. */
  dedup(findings: ReadonlyArray<CheckFinding>): ReadonlyArray<CheckFinding> {
    const novel: CheckFinding[] = [];
    for (const f of findings) {
      if (!this.isSeen(f)) {
        this.markSeen(f);
        novel.push(f);
      } else {
        this.dupes++;
      }
    }
    return novel;
  }

  /** Stats for logging/audit. */
  stats(): { seen: number; duplicatesFiltered: number } {
    return { seen: this.seen, duplicatesFiltered: this.dupes };
  }
}

// ── Multi-PR deduplication ─────────────────────────────────────────
// Deduplicates findings across multiple PR reviews.
// Used by orchestrator before generating executive summary.
export function deduplicateAcrossPRs(
  findingsPerPR: ReadonlyMap<PRNumber, ReadonlyArray<CheckFinding>>,
  config?: Partial<DeduplicationConfig>,
): {
  dedupedPerPR: Map<PRNumber, ReadonlyArray<CheckFinding>>;
  stats: { seen: number; duplicatesFiltered: number };
} {
  const deduplicator = new CheckDeduplicator(config);
  const dedupedPerPR = new Map<PRNumber, ReadonlyArray<CheckFinding>>();

  for (const [prNumber, findings] of findingsPerPR) {
    dedupedPerPR.set(prNumber, deduplicator.dedup(findings));
  }

  return { dedupedPerPR, stats: deduplicator.stats() };
}
