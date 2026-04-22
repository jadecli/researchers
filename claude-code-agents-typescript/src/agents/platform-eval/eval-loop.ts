// Opus 4.7 evaluator loop.
//
// Uses @anthropic-ai/claude-agent-sdk to run Opus 4.7 as the evaluator of a
// <decision-report> against a spec's rubric. Deterministic checks run first
// (free, fast) — the LLM is only consulted for semantic rationale quality
// and to draft the final verdict.
//
// Caching: the spec + rubric are the same across runs, so we pin them in the
// system prompt where the Agent SDK's underlying CLI applies automatic
// prefix caching. Only the report under review varies per turn.

import { query, type Options, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { Spec } from './xml-spec.js';
import type { CheckResult } from './deterministic-checks.js';
import type { DiffSnapshot } from './diff-reader.js';

export type EvaluatorVerdict =
  | { readonly kind: 'pass'; readonly notes: string }
  | { readonly kind: 'needs-revision'; readonly failures: readonly string[]; readonly guidance: string }
  | { readonly kind: 'error'; readonly message: string };

export type EvaluatorInput = {
  readonly spec: Spec;
  readonly specXml: string;
  readonly reportXml: string;
  readonly diff: DiffSnapshot;
  readonly deterministicResults: readonly CheckResult[];
};

function buildSystemPrompt(specXml: string): string {
  return [
    'You are the deterministic evaluator for a git-platform decision report.',
    'Your sole job is to judge whether a <decision-report> document satisfies',
    'the rubric declared in the spec. Be strict and structural.',
    '',
    '# Spec under evaluation',
    specXml,
    '',
    '# Output contract',
    'Respond with ONE XML element only, no prose before or after:',
    '',
    '<eval-verdict kind="pass|needs-revision">',
    '  <failures>',
    '    <!-- zero or more <failure rubric-id="..."> elements -->',
    '  </failures>',
    '  <guidance><!-- 1-3 sentences of actionable guidance, even on pass --></guidance>',
    '</eval-verdict>',
    '',
    'Only raise "needs-revision" for issues the deterministic checks missed',
    '(e.g. rationale that restates the question without citing a signal,',
    'hedge that contradicts the recommendation, next-actions that are vague).',
  ].join('\n');
}

function buildUserPrompt(input: EvaluatorInput): string {
  const det = input.deterministicResults
    .map((r) => `- [${r.severity}] ${r.id}: ${r.passed ? 'PASS' : 'FAIL'} — ${r.detail}`)
    .join('\n');
  return [
    '# Deterministic pre-check results',
    det,
    '',
    '# Git diff snapshot (ground truth for the report\'s <diff-summary>)',
    `branch=${input.diff.branch} base=${input.diff.baseRef} commitsAhead=${input.diff.commitsAhead}`,
    `filesChanged=${input.diff.filesChanged} +${input.diff.additions}/-${input.diff.deletions}`,
    input.diff.paths.slice(0, 20).map((p) => `  ${p}`).join('\n'),
    '',
    '# Decision report under review',
    input.reportXml,
    '',
    'Produce the <eval-verdict> now.',
  ].join('\n');
}

function extractVerdict(text: string): EvaluatorVerdict {
  const block = text.match(/<eval-verdict\b[^>]*>[\s\S]*?<\/eval-verdict>/)?.[0];
  if (!block) {
    return { kind: 'error', message: 'evaluator returned no <eval-verdict> block' };
  }
  const kindMatch = block.match(/kind="([^"]+)"/)?.[1] ?? '';
  const guidance = block.match(/<guidance>([\s\S]*?)<\/guidance>/)?.[1]?.trim() ?? '';
  const failures = [...block.matchAll(/<failure\b[^>]*>[\s\S]*?<\/failure>/g)].map((m) =>
    m[0].replace(/<\/?failure[^>]*>/g, '').trim()
  );
  if (kindMatch === 'pass') return { kind: 'pass', notes: guidance };
  if (kindMatch === 'needs-revision') return { kind: 'needs-revision', failures, guidance };
  return { kind: 'error', message: `unknown verdict kind: ${kindMatch}` };
}

export async function evaluateReport(input: EvaluatorInput): Promise<EvaluatorVerdict> {
  const options: Options = {
    model: input.spec.evaluatorModel || 'claude-opus-4-7',
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code',
      append: buildSystemPrompt(input.specXml),
    },
    maxTurns: 1,
    settingSources: [],
    allowedTools: [],
  };

  let assistantText = '';
  try {
    const iter = query({ prompt: buildUserPrompt(input), options });
    for await (const msg of iter as AsyncIterable<SDKMessage>) {
      if (msg.type === 'assistant') {
        const content = msg.message.content;
        for (const part of content) {
          if (part.type === 'text') assistantText += part.text;
        }
      }
    }
  } catch (err) {
    return {
      kind: 'error',
      message: `agent-sdk query failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!assistantText) {
    return { kind: 'error', message: 'evaluator produced no assistant text' };
  }
  return extractVerdict(assistantText);
}
