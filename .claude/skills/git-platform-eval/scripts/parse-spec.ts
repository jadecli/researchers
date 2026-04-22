#!/usr/bin/env npx tsx
// Parse the git-platform-decision spec XML into a typed JSON structure.
//
// Intentionally zero-dep: uses a small regex-driven parser sufficient for the
// spec's well-defined shape. A full XML parser would pull in a heavy dep for
// no gain — the spec is hand-authored and validated by the evaluator.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Criterion = {
  readonly id: string;
  readonly weight: number;
  readonly question: string;
  readonly signals: readonly string[];
};

type RubricCheck = {
  readonly id: string;
  readonly severity: 'block' | 'warn';
  readonly description: string;
};

type ParsedSpec = {
  readonly id: string;
  readonly version: string;
  readonly criteria: readonly Criterion[];
  readonly rubric: readonly RubricCheck[];
  readonly evaluatorModel: string;
};

function extractAttr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`${name}="([^"]+)"`));
  return m?.[1];
}

function extractAllBlocks(src: string, tagName: string): string[] {
  const re = new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?</${tagName}>`, 'g');
  return src.match(re) ?? [];
}

function innerText(block: string, tagName: string): string {
  const re = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`);
  return (block.match(re)?.[1] ?? '').trim();
}

export function parseSpec(xml: string): ParsedSpec {
  const rootTag = xml.match(/<spec\b[^>]*>/)?.[0] ?? '';
  const id = extractAttr(rootTag, 'id') ?? 'unknown';
  const version = extractAttr(rootTag, 'version') ?? '0.0.0';

  const criteria = extractAllBlocks(xml, 'criterion').map<Criterion>((block) => {
    const open = block.match(/<criterion\b[^>]*>/)?.[0] ?? '';
    const signalBlocks = extractAllBlocks(block, 'signal');
    return {
      id: extractAttr(open, 'id') ?? '',
      weight: Number.parseInt(extractAttr(open, 'weight') ?? '1', 10),
      question: innerText(block, 'question'),
      signals: signalBlocks.map((s) => innerText(s, 'signal')),
    };
  });

  const rubric = extractAllBlocks(xml, 'check').map<RubricCheck>((block) => {
    const open = block.match(/<check\b[^>]*>/)?.[0] ?? '';
    const sev = extractAttr(open, 'severity');
    return {
      id: extractAttr(open, 'id') ?? '',
      severity: sev === 'block' ? 'block' : 'warn',
      description: block
        .replace(/<check\b[^>]*>/, '')
        .replace(/<\/check>/, '')
        .trim(),
    };
  });

  const evaluatorBlock = xml.match(/<evaluator>[\s\S]*?<\/evaluator>/)?.[0] ?? '';
  const evaluatorModel = innerText(evaluatorBlock, 'model') || 'claude-opus-4-7';

  return { id, version, criteria, rubric, evaluatorModel };
}

function cli(): void {
  const path = process.argv[2];
  if (!path) {
    process.stderr.write('usage: parse-spec.ts <spec.xml>\n');
    process.exit(2);
  }
  const xml = readFileSync(resolve(path), 'utf8');
  const spec = parseSpec(xml);
  process.stdout.write(JSON.stringify(spec, null, 2) + '\n');
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('parse-spec.ts') || entry.endsWith('parse-spec.js')) {
  cli();
}
