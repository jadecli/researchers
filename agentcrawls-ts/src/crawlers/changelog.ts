// src/crawlers/changelog.ts — CheerioCrawler for GitHub changelog pages
//
// Crawls CHANGELOG.md files from GitHub repos, extracts raw markdown
// sections per version, and passes them to the extraction pipeline.

import { CheerioCrawler, type CheerioCrawlingContext } from 'crawlee';
import { z } from 'zod';

// ── Types ────────────────────────────────────────────────────────
export const ChangelogSectionSchema = z.object({
  repo: z.string(),
  version: z.string(),
  releaseDate: z.string().optional(),
  rawMarkdown: z.string(),
  headerLine: z.string(),
});

export type ChangelogSection = z.infer<typeof ChangelogSectionSchema>;

export interface CrawlTarget {
  repo: string;
  url: string;
}

// ── Default targets ──────────────────────────────────────────────
export const DEFAULT_TARGETS: readonly CrawlTarget[] = [
  {
    repo: 'claude-code',
    url: 'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md',
  },
  {
    repo: 'claude-agents-sdk-python',
    url: 'https://raw.githubusercontent.com/anthropics/claude-code-sdk-python/main/CHANGELOG.md',
  },
  {
    repo: 'claude-agents-sdk-typescript',
    url: 'https://raw.githubusercontent.com/anthropics/claude-code-sdk-node/main/CHANGELOG.md',
  },
] as const;

// ── Parse markdown into version sections ─────────────────────────
/**
 * Split a CHANGELOG.md into sections by version header.
 * Handles both `## [version]` and `## version` formats.
 */
export function parseChangelogSections(
  markdown: string,
  repo: string,
): ChangelogSection[] {
  const sections: ChangelogSection[] = [];
  // Match ## headers that look like version entries
  const versionPattern = /^##\s+\[?(\d+\.\d+[\w.-]*)\]?(?:\s*[-–—]\s*(.+))?$/gm;

  let match: RegExpExecArray | null;
  const matches: Array<{ version: string; date?: string; index: number; headerLine: string }> = [];

  while ((match = versionPattern.exec(markdown)) !== null) {
    matches.push({
      version: match[1]!,
      date: match[2]?.trim(),
      index: match.index,
      headerLine: match[0],
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]!;
    const next = matches[i + 1];
    const endIndex = next ? next.index : markdown.length;
    const rawMarkdown = markdown.slice(current.index, endIndex).trim();

    sections.push({
      repo,
      version: current.version,
      releaseDate: current.date,
      rawMarkdown,
      headerLine: current.headerLine,
    });
  }

  return sections;
}

// ── Crawler factory ──────────────────────────────────────────────
export interface CrawlResult {
  repo: string;
  sections: ChangelogSection[];
  crawledAt: Date;
}

/**
 * Create a CheerioCrawler that fetches raw CHANGELOG.md files
 * and parses them into version sections.
 */
export function createChangelogCrawler(
  onResult: (result: CrawlResult) => void | Promise<void>,
): CheerioCrawler {
  return new CheerioCrawler({
    maxRequestsPerCrawl: 10,
    requestHandlerTimeoutSecs: 30,

    async requestHandler(context: CheerioCrawlingContext) {
      const { request, body } = context;
      const repo = request.userData?.['repo'] as string | undefined;

      if (!repo) {
        throw new Error(`Missing repo in userData for ${request.url}`);
      }

      // raw.githubusercontent.com returns plain text markdown
      const markdown = typeof body === 'string' ? body : body.toString('utf-8');
      const sections = parseChangelogSections(markdown, repo);

      await onResult({
        repo,
        sections,
        crawledAt: new Date(),
      });
    },
  });
}

/**
 * Crawl all default changelog targets and collect results.
 */
export async function crawlChangelogs(
  targets: readonly CrawlTarget[] = DEFAULT_TARGETS,
): Promise<CrawlResult[]> {
  const results: CrawlResult[] = [];

  const crawler = createChangelogCrawler((result) => {
    results.push(result);
  });

  await crawler.run(
    targets.map((t) => ({
      url: t.url,
      userData: { repo: t.repo },
    })),
  );

  return results;
}
