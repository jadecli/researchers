// Load and lightly parse the git-platform-decision spec XML.
//
// The spec is hand-authored and validated by the evaluator; we only extract
// the fields the evaluator needs for deterministic checks and for the LLM
// prompt. Zero deps by design.

import { readFileSync } from 'node:fs';

export type Criterion = {
  readonly id: string;
  readonly weight: number;
  readonly question: string;
  readonly signals: readonly string[];
};

export type RubricCheck = {
  readonly id: string;
  readonly severity: 'block' | 'warn';
  readonly description: string;
};

export type Spec = {
  readonly id: string;
  readonly version: string;
  readonly criteria: readonly Criterion[];
  readonly rubric: readonly RubricCheck[];
  readonly evaluatorModel: string;
};

function attr(open: string, name: string): string | undefined {
  return open.match(new RegExp(`${name}="([^"]+)"`))?.[1];
}

function blocks(src: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'g');
  return src.match(re) ?? [];
}

function inner(block: string, tag: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`);
  return (block.match(re)?.[1] ?? '').trim();
}

export function loadSpec(path: string): Spec {
  const xml = readFileSync(path, 'utf8');
  const rootOpen = xml.match(/<spec\b[^>]*>/)?.[0] ?? '';
  const criteria: Criterion[] = blocks(xml, 'criterion').map((b) => {
    const open = b.match(/<criterion\b[^>]*>/)?.[0] ?? '';
    return {
      id: attr(open, 'id') ?? '',
      weight: Number.parseInt(attr(open, 'weight') ?? '1', 10),
      question: inner(b, 'question'),
      signals: blocks(b, 'signal').map((s) => inner(s, 'signal')),
    };
  });
  const rubric: RubricCheck[] = blocks(xml, 'check').map((b) => {
    const open = b.match(/<check\b[^>]*>/)?.[0] ?? '';
    const sev = attr(open, 'severity');
    return {
      id: attr(open, 'id') ?? '',
      severity: sev === 'block' ? 'block' : 'warn',
      description: b.replace(/<check\b[^>]*>/, '').replace(/<\/check>/, '').trim(),
    };
  });
  const evaluatorBlock = xml.match(/<evaluator>[\s\S]*?<\/evaluator>/)?.[0] ?? '';
  return {
    id: attr(rootOpen, 'id') ?? 'unknown',
    version: attr(rootOpen, 'version') ?? '0.0.0',
    criteria,
    rubric,
    evaluatorModel: inner(evaluatorBlock, 'model') || 'claude-opus-4-7',
  };
}
