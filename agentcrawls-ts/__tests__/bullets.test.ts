// __tests__/bullets.test.ts — Tests for bullet extraction

import { describe, it, expect } from 'vitest';
import { extractBulletsRegex } from '../src/extractors/bullets.js';
import type { ChangelogSection } from '../src/crawlers/changelog.js';

function makeSection(rawMarkdown: string, overrides?: Partial<ChangelogSection>): ChangelogSection {
  return {
    repo: 'test-repo',
    version: '1.0.0',
    rawMarkdown,
    headerLine: '## [1.0.0]',
    ...overrides,
  };
}

describe('extractBulletsRegex', () => {
  it('extracts simple bullet points', () => {
    const section = makeSection(`## [1.0.0] - 2025-01-01

- Added new feature
- Fixed a bug
- Updated dependencies
`);

    const bullets = extractBulletsRegex(section);

    expect(bullets).toHaveLength(3);
    expect(bullets[0]!.description).toBe('Added new feature');
    expect(bullets[0]!.category).toBe('feat');
    expect(bullets[1]!.description).toBe('Fixed a bug');
    expect(bullets[1]!.category).toBe('fix');
    expect(bullets[2]!.description).toBe('Updated dependencies');
    expect(bullets[2]!.category).toBe('chore');
  });

  it('extracts categorized bullets with bold markers', () => {
    const section = makeSection(`## [1.0.0]

- **feat**: Add dark mode support
- **fix**: Resolve memory leak in worker pool
- **docs**: Update API reference
- **refactor**: Simplify auth middleware
`);

    const bullets = extractBulletsRegex(section);

    expect(bullets).toHaveLength(4);
    expect(bullets[0]!.category).toBe('feat');
    expect(bullets[1]!.category).toBe('fix');
    expect(bullets[2]!.category).toBe('docs');
    expect(bullets[3]!.category).toBe('refactor');
  });

  it('detects breaking changes', () => {
    const section = makeSection(`## [2.0.0]

- **breaking**: Remove deprecated API endpoints
- Regular change
- BREAKING CHANGE: new auth flow required
`);

    const bullets = extractBulletsRegex(section);

    expect(bullets[0]!.breaking).toBe(true);
    expect(bullets[1]!.breaking).toBe(false);
    expect(bullets[2]!.breaking).toBe(true);
  });

  it('sets repo and version from section', () => {
    const section = makeSection(`## [3.2.1]

- Some change
`, { repo: 'my-lib', version: '3.2.1', releaseDate: '2025-06-01' });

    const bullets = extractBulletsRegex(section);

    expect(bullets[0]!.sourceRepo).toBe('my-lib');
    expect(bullets[0]!.version).toBe('3.2.1');
    expect(bullets[0]!.releaseDate).toBe('2025-06-01');
  });

  it('handles asterisk bullets', () => {
    const section = makeSection(`## [1.0.0]

* First change
* Second change
`);

    const bullets = extractBulletsRegex(section);
    expect(bullets).toHaveLength(2);
  });

  it('returns empty array for section without bullets', () => {
    const section = makeSection(`## [1.0.0]

No bullet points here, just prose.
This is a paragraph of text.
`);

    const bullets = extractBulletsRegex(section);
    expect(bullets).toHaveLength(0);
  });

  it('maps common category aliases', () => {
    const section = makeSection(`## [1.0.0]

- **added**: New endpoint
- **fixed**: Login crash
- **maintenance**: Cleanup old logs
- **performance**: Faster query execution
`);

    const bullets = extractBulletsRegex(section);

    expect(bullets[0]!.category).toBe('feat');
    expect(bullets[1]!.category).toBe('fix');
    expect(bullets[2]!.category).toBe('chore');
    expect(bullets[3]!.category).toBe('perf');
  });
});
