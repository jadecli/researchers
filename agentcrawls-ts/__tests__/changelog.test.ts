// __tests__/changelog.test.ts — Tests for changelog parsing

import { describe, it, expect } from 'vitest';
import { parseChangelogSections } from '../src/crawlers/changelog.js';

const SAMPLE_CHANGELOG = `# Changelog

## [2.1.85] - 2025-05-20

### Features
- Conditional hook execution via permission rule syntax
- MCP OAuth RFC 9728 support
- Org-managed plugin blocking

### Fixes
- Fixed worktree session initialization

## [2.1.84] - 2025-05-18

### Features
- TaskCreated hook for task lifecycle
- PreToolUse hooks can provide headless answers
- Model capability detection env vars

## [2.1.83] - 2025-05-15

- Drop-in directory support for modular policy
- CwdChanged/FileChanged reactive hooks
- initialPrompt frontmatter for agents
`;

describe('parseChangelogSections', () => {
  it('extracts version sections from standard changelog', () => {
    const sections = parseChangelogSections(SAMPLE_CHANGELOG, 'claude-code');

    expect(sections).toHaveLength(3);
    expect(sections[0]!.version).toBe('2.1.85');
    expect(sections[1]!.version).toBe('2.1.84');
    expect(sections[2]!.version).toBe('2.1.83');
  });

  it('extracts release dates when present', () => {
    const sections = parseChangelogSections(SAMPLE_CHANGELOG, 'claude-code');

    expect(sections[0]!.releaseDate).toBe('2025-05-20');
    expect(sections[1]!.releaseDate).toBe('2025-05-18');
    expect(sections[2]!.releaseDate).toBe('2025-05-15');
  });

  it('sets repo on each section', () => {
    const sections = parseChangelogSections(SAMPLE_CHANGELOG, 'test-repo');
    for (const section of sections) {
      expect(section.repo).toBe('test-repo');
    }
  });

  it('captures raw markdown for each section', () => {
    const sections = parseChangelogSections(SAMPLE_CHANGELOG, 'claude-code');

    expect(sections[0]!.rawMarkdown).toContain('Conditional hook execution');
    expect(sections[0]!.rawMarkdown).toContain('Fixed worktree');
    expect(sections[0]!.rawMarkdown).not.toContain('TaskCreated');
  });

  it('handles changelog without brackets around version', () => {
    const noBrackets = `# Changelog

## 1.0.0 - 2025-01-01

- Initial release

## 0.9.0 - 2024-12-15

- Beta release
`;
    const sections = parseChangelogSections(noBrackets, 'test');

    expect(sections).toHaveLength(2);
    expect(sections[0]!.version).toBe('1.0.0');
    expect(sections[1]!.version).toBe('0.9.0');
  });

  it('returns empty array for changelog without version headers', () => {
    const noVersions = `# Changelog

Some introductory text without version headers.

- Random bullet point
`;
    const sections = parseChangelogSections(noVersions, 'test');
    expect(sections).toHaveLength(0);
  });

  it('handles pre-release versions', () => {
    const preRelease = `## [1.0.0-beta.1] - 2025-03-01

- Beta feature
`;
    const sections = parseChangelogSections(preRelease, 'test');

    expect(sections).toHaveLength(1);
    expect(sections[0]!.version).toBe('1.0.0-beta.1');
  });
});
