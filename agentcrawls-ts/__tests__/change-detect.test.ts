// __tests__/change-detect.test.ts — Tests for bloom filter change detection

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createChangeDetector, sectionHash } from '../src/filters/change-detect.js';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ChangelogSection } from '../src/crawlers/changelog.js';

function makeSection(version: string, repo = 'test-repo'): ChangelogSection {
  return {
    repo,
    version,
    rawMarkdown: `## [${version}]\n\n- Change for ${version}`,
    headerLine: `## [${version}]`,
  };
}

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'bloom-test-'));
});

afterEach(() => {
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true });
  }
});

describe('sectionHash', () => {
  it('produces consistent hashes for same input', () => {
    const section = makeSection('1.0.0');
    expect(sectionHash(section)).toBe(sectionHash(section));
  });

  it('produces different hashes for different versions', () => {
    const s1 = makeSection('1.0.0');
    const s2 = makeSection('2.0.0');
    expect(sectionHash(s1)).not.toBe(sectionHash(s2));
  });

  it('produces different hashes for different repos', () => {
    const s1 = makeSection('1.0.0', 'repo-a');
    const s2 = makeSection('1.0.0', 'repo-b');
    expect(sectionHash(s1)).not.toBe(sectionHash(s2));
  });
});

describe('createChangeDetector', () => {
  it('marks sections as seen and detects them', () => {
    const bloomPath = join(tempDir, 'bloom.json');
    const detector = createChangeDetector(bloomPath);

    const section = makeSection('1.0.0');
    expect(detector.isSeen(section)).toBe(false);

    detector.markSeen(section);
    expect(detector.isSeen(section)).toBe(true);
  });

  it('filters new sections correctly', () => {
    const bloomPath = join(tempDir, 'bloom.json');
    const detector = createChangeDetector(bloomPath);

    const s1 = makeSection('1.0.0');
    const s2 = makeSection('2.0.0');
    const s3 = makeSection('3.0.0');

    detector.markSeen(s1);
    detector.markSeen(s2);

    const newSections = detector.filterNew([s1, s2, s3]);
    expect(newSections).toHaveLength(1);
    expect(newSections[0]!.version).toBe('3.0.0');
  });

  it('persists and restores state from file', () => {
    const bloomPath = join(tempDir, 'bloom.json');

    // Create detector and add items
    const detector1 = createChangeDetector(bloomPath);
    detector1.markSeen(makeSection('1.0.0'));
    detector1.markSeen(makeSection('2.0.0'));
    detector1.save();

    // Create new detector from same file
    const detector2 = createChangeDetector(bloomPath);
    expect(detector2.isSeen(makeSection('1.0.0'))).toBe(true);
    expect(detector2.isSeen(makeSection('2.0.0'))).toBe(true);
    expect(detector2.isSeen(makeSection('3.0.0'))).toBe(false);
    expect(detector2.itemCount).toBe(2);
  });

  it('tracks item count', () => {
    const bloomPath = join(tempDir, 'bloom.json');
    const detector = createChangeDetector(bloomPath);

    expect(detector.itemCount).toBe(0);
    detector.markSeen(makeSection('1.0.0'));
    expect(detector.itemCount).toBe(1);
    detector.markSeen(makeSection('2.0.0'));
    expect(detector.itemCount).toBe(2);

    // Marking same section again doesn't increment
    detector.markSeen(makeSection('1.0.0'));
    expect(detector.itemCount).toBe(2);
  });

  it('handles corrupted state file gracefully', () => {
    const bloomPath = join(tempDir, 'bloom.json');
    const { writeFileSync } = require('node:fs');
    writeFileSync(bloomPath, 'NOT VALID JSON', 'utf-8');

    // Should not throw — creates fresh filter
    const detector = createChangeDetector(bloomPath);
    expect(detector.itemCount).toBe(0);
    expect(detector.isSeen(makeSection('1.0.0'))).toBe(false);
  });

  it('creates directory for state file if missing', () => {
    const nestedPath = join(tempDir, 'nested', 'deep', 'bloom.json');
    const detector = createChangeDetector(nestedPath);

    detector.markSeen(makeSection('1.0.0'));
    detector.save();

    expect(existsSync(nestedPath)).toBe(true);
  });
});
