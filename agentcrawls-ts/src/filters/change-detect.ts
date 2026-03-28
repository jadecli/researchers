// src/filters/change-detect.ts — Bloom filter for changelog section change detection
//
// Uses bloom-filters to detect which changelog sections are NEW vs already seen.
// Persists filter state to file (upgradeable to Neon PG18 via storage/neon.ts).

import { BloomFilter } from 'bloom-filters';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ChangelogSection } from '../crawlers/changelog.js';

// ── Types ────────────────────────────────────────────────────────
export interface ChangeDetector {
  /** Check if a section has been seen before */
  isSeen(section: ChangelogSection): boolean;
  /** Mark a section as seen */
  markSeen(section: ChangelogSection): void;
  /** Filter sections to only new (unseen) ones */
  filterNew(sections: ChangelogSection[]): ChangelogSection[];
  /** Persist the bloom filter state */
  save(): void;
  /** Number of items added to the filter */
  readonly itemCount: number;
}

interface BloomState {
  filterData: ReturnType<BloomFilter['saveAsJSON']>;
  itemCount: number;
  updatedAt: string;
}

// ── Hash function ────────────────────────────────────────────────
/**
 * Compute a deterministic hash for a changelog section.
 * Uses repo + version + first 500 chars of content for uniqueness.
 */
export function sectionHash(section: ChangelogSection): string {
  const content = `${section.repo}::${section.version}::${section.rawMarkdown.slice(0, 500)}`;
  return createHash('sha256').update(content).digest('hex');
}

// ── Bloom filter factory ─────────────────────────────────────────
/**
 * Create a change detector backed by a bloom filter.
 *
 * @param statePath - File path for persisting bloom filter state.
 *   If the file exists, the filter is restored from it.
 * @param expectedItems - Expected number of items (default: 10000 sections)
 * @param falsePositiveRate - Acceptable false positive rate (default: 0.01)
 */
export function createChangeDetector(
  statePath: string,
  expectedItems = 10000,
  falsePositiveRate = 0.01,
): ChangeDetector {
  let filter: BloomFilter;
  let itemCount = 0;

  // Try to restore from persisted state
  if (existsSync(statePath)) {
    try {
      const raw = readFileSync(statePath, 'utf-8');
      const state = JSON.parse(raw) as BloomState;
      filter = BloomFilter.fromJSON(state.filterData);
      itemCount = state.itemCount;
    } catch {
      // Corrupted state — start fresh
      filter = BloomFilter.create(expectedItems, falsePositiveRate);
    }
  } else {
    filter = BloomFilter.create(expectedItems, falsePositiveRate);
  }

  return {
    isSeen(section: ChangelogSection): boolean {
      return filter.has(sectionHash(section));
    },

    markSeen(section: ChangelogSection): void {
      const hash = sectionHash(section);
      if (!filter.has(hash)) {
        filter.add(hash);
        itemCount++;
      }
    },

    filterNew(sections: ChangelogSection[]): ChangelogSection[] {
      return sections.filter((s) => !filter.has(sectionHash(s)));
    },

    save(): void {
      const dir = dirname(statePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const state: BloomState = {
        filterData: filter.saveAsJSON(),
        itemCount,
        updatedAt: new Date().toISOString(),
      };

      writeFileSync(statePath, JSON.stringify(state), 'utf-8');
    },

    get itemCount() {
      return itemCount;
    },
  };
}
