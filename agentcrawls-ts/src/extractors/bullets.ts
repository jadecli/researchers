// src/extractors/bullets.ts — Structured bullet extraction from changelog sections
//
// Uses @ax-llm/ax (TypeScript DSPy equivalent) to extract structured
// changelog bullets from raw markdown sections.

import { AxAI, AxGen, AxAIAnthropicModel } from '@ax-llm/ax';
import { z } from 'zod';
import type { ChangelogSection } from '../crawlers/changelog.js';

// ── Types ────────────────────────────────────────────────────────
export const ChangelogBulletSchema = z.object({
  sourceRepo: z.string(),
  version: z.string(),
  releaseDate: z.string().optional(),
  category: z.enum(['feat', 'fix', 'chore', 'docs', 'refactor', 'test', 'ci', 'perf', 'breaking']),
  description: z.string(),
  breaking: z.boolean(),
});

export type ChangelogBullet = z.infer<typeof ChangelogBulletSchema>;

// ── Ax Signature for bullet extraction ───────────────────────────
const EXTRACT_SIG =
  'repoName:string, versionNum:string, rawContent:string -> extractedBullets:string "JSON array of extracted bullets with category, description, and breaking flag"';

// ── Extraction without AI (regex-based fallback) ─────────────────
/**
 * Extract bullets from a changelog section using regex patterns.
 * This is the primary extraction method — fast, deterministic, no API calls.
 */
export function extractBulletsRegex(section: ChangelogSection): ChangelogBullet[] {
  const bullets: ChangelogBullet[] = [];
  const lines = section.rawMarkdown.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Match bullet points: "- ", "* ", or "- **category**: description"
    const bulletMatch = trimmed.match(/^[-*]\s+(?:\*\*(\w+)\*\*:\s*)?(.+)/);
    if (!bulletMatch) continue;

    const rawCategory = bulletMatch[1]?.toLowerCase();
    const description = bulletMatch[2]?.trim();
    if (!description) continue;

    // Skip sub-bullets (indented more than one level)
    if (line.match(/^\s{4,}[-*]/)) continue;

    const category = categorize(rawCategory, description);
    const breaking = isBreaking(description, rawCategory);

    bullets.push({
      sourceRepo: section.repo,
      version: section.version,
      releaseDate: section.releaseDate,
      category,
      description,
      breaking,
    });
  }

  return bullets;
}

// ── Category classification ──────────────────────────────────────
function categorize(
  rawCategory: string | undefined,
  description: string,
): ChangelogBullet['category'] {
  if (rawCategory) {
    const normalized = rawCategory.toLowerCase();
    const categoryMap: Record<string, ChangelogBullet['category']> = {
      feat: 'feat', feature: 'feat', added: 'feat', new: 'feat',
      fix: 'fix', fixed: 'fix', bug: 'fix', bugfix: 'fix',
      chore: 'chore', maintenance: 'chore', deps: 'chore', dependency: 'chore',
      docs: 'docs', documentation: 'docs', doc: 'docs',
      refactor: 'refactor', refactoring: 'refactor',
      test: 'test', tests: 'test', testing: 'test',
      ci: 'ci', build: 'ci',
      perf: 'perf', performance: 'perf',
      breaking: 'breaking',
    };
    const mapped = categoryMap[normalized];
    if (mapped) return mapped;
  }

  // Infer from description
  const desc = description.toLowerCase();
  if (desc.includes('breaking change') || desc.includes('breaking:')) return 'breaking';
  if (desc.startsWith('fix') || desc.includes('bug')) return 'fix';
  if (desc.startsWith('add') || desc.startsWith('new') || desc.startsWith('implement')) return 'feat';
  if (desc.startsWith('refactor')) return 'refactor';
  if (desc.startsWith('update') || desc.startsWith('upgrade') || desc.startsWith('bump')) return 'chore';
  if (desc.startsWith('doc') || desc.includes('readme')) return 'docs';
  if (desc.startsWith('test')) return 'test';
  if (desc.includes('performance') || desc.includes('optimize')) return 'perf';

  return 'chore';
}

function isBreaking(description: string, rawCategory?: string): boolean {
  const text = `${rawCategory ?? ''} ${description}`.toLowerCase();
  return text.includes('breaking') || text.includes('BREAKING');
}

// ── Extraction with AI (ax-llm/ax) ──────────────────────────────
/**
 * Extract bullets using @ax-llm/ax AxGen (DSPy-style generation).
 * Requires ANTHROPIC_API_KEY env var.
 * Falls back to regex extraction if no API key is available.
 */
export async function extractBulletsAI(
  section: ChangelogSection,
  options?: { apiKey?: string; model?: AxAIAnthropicModel },
): Promise<ChangelogBullet[]> {
  const apiKey = options?.apiKey ?? process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    return extractBulletsRegex(section);
  }

  const ai = new AxAI({
    name: 'anthropic',
    apiKey,
    config: { model: options?.model ?? AxAIAnthropicModel.Claude45Haiku },
  });

  const extractor = new AxGen(EXTRACT_SIG, {
    description: 'Extract structured changelog bullets from raw markdown',
  });

  const result = await extractor.forward(ai, {
    repoName: section.repo,
    versionNum: section.version,
    rawContent: section.rawMarkdown,
  });

  const bulletJson = result['extractedBullets'] as string | undefined;
  if (!bulletJson) return extractBulletsRegex(section);

  try {
    const parsed = JSON.parse(bulletJson) as Array<{
      category?: string;
      description?: string;
      breaking?: boolean;
    }>;

    return parsed
      .filter((b) => b.description)
      .map((b) => ({
        sourceRepo: section.repo,
        version: section.version,
        releaseDate: section.releaseDate,
        category: categorize(b.category, b.description ?? ''),
        description: b.description ?? '',
        breaking: b.breaking ?? false,
      }));
  } catch {
    // JSON parse failed, fall back to regex
    return extractBulletsRegex(section);
  }
}
