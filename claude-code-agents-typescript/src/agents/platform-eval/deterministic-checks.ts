// Pure, deterministic validation of a <decision-report> against a spec.
//
// Runs before the LLM. If any `block`-severity check fails, the evaluator
// short-circuits — no need to spend Opus tokens telling the caller the XML
// is malformed.

import type { Spec } from './xml-spec.js';
import type { DiffSnapshot } from './diff-reader.js';

export type CheckResult = {
  readonly id: string;
  readonly severity: 'block' | 'warn';
  readonly passed: boolean;
  readonly detail: string;
};

function findBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'g');
  return xml.match(re) ?? [];
}

function attrVal(open: string, name: string): string | undefined {
  return open.match(new RegExp(`${name}="([^"]+)"`))?.[1];
}

function inner(block: string, tag: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`);
  return (block.match(re)?.[1] ?? '').trim();
}

export function runDeterministicChecks(
  reportXml: string,
  spec: Spec,
  diff: DiffSnapshot
): readonly CheckResult[] {
  const results: CheckResult[] = [];
  const record = (
    id: string,
    severity: 'block' | 'warn',
    passed: boolean,
    detail: string
  ): void => {
    results.push({ id, severity, passed, detail });
  };

  // all-criteria-scored: 2 platforms × N criteria
  const platformBlocks = findBlocks(reportXml, 'platform');
  const expectedPlatforms = new Set(['github', 'gitlab']);
  const seenPlatforms = new Set<string>();
  const criterionIds = new Set(spec.criteria.map((c) => c.id));
  const scoredByPlatform: Record<string, Map<string, number>> = {};
  for (const pb of platformBlocks) {
    const pid = attrVal(pb.match(/<platform\b[^>]*>/)?.[0] ?? '', 'id') ?? '';
    if (!pid) continue;
    seenPlatforms.add(pid);
    const m = new Map<string, number>();
    for (const cb of findBlocks(pb, 'criterion')) {
      const cOpen = cb.match(/<criterion\b[^>]*>/)?.[0] ?? '';
      const cid = attrVal(cOpen, 'id') ?? '';
      const score = Number.parseInt(attrVal(cOpen, 'score') ?? '0', 10);
      if (cid) m.set(cid, score);
    }
    scoredByPlatform[pid] = m;
  }

  const missingPlatforms = [...expectedPlatforms].filter((p) => !seenPlatforms.has(p));
  record(
    'all-criteria-scored',
    'block',
    missingPlatforms.length === 0 &&
      [...expectedPlatforms].every(
        (p) => scoredByPlatform[p] !== undefined && scoredByPlatform[p].size === criterionIds.size
      ),
    missingPlatforms.length > 0
      ? `missing platforms: ${missingPlatforms.join(', ')}`
      : `github=${scoredByPlatform['github']?.size ?? 0}/${criterionIds.size}, gitlab=${scoredByPlatform['gitlab']?.size ?? 0}/${criterionIds.size}`
  );

  // scores-in-range
  const allScores: number[] = [];
  for (const m of Object.values(scoredByPlatform)) allScores.push(...m.values());
  const outOfRange = allScores.filter((n) => !Number.isInteger(n) || n < 1 || n > 5);
  record(
    'scores-in-range',
    'block',
    outOfRange.length === 0,
    outOfRange.length === 0 ? 'all scores in [1,5]' : `out of range: ${outOfRange.join(', ')}`
  );

  // rationales-non-empty (≥ 40 chars)
  let shortRationales = 0;
  for (const pb of platformBlocks) {
    for (const cb of findBlocks(pb, 'criterion')) {
      const r = inner(cb, 'rationale');
      if (r.length < 40) shortRationales += 1;
    }
  }
  record(
    'rationales-non-empty',
    'block',
    shortRationales === 0,
    `short rationales: ${shortRationales}`
  );

  // final-score-computed
  const totalWeight = spec.criteria.reduce((s, c) => s + c.weight, 0);
  const computeExpected = (platform: string): number => {
    const scores = scoredByPlatform[platform];
    if (!scores) return 0;
    const sum = spec.criteria.reduce((s, c) => s + (scores.get(c.id) ?? 0) * c.weight, 0);
    return totalWeight === 0 ? 0 : sum / totalWeight;
  };
  const readClaimed = (platform: string): number => {
    const pb = platformBlocks.find((b) =>
      (b.match(/<platform\b[^>]*>/)?.[0] ?? '').includes(`id="${platform}"`)
    );
    return pb ? Number.parseFloat(inner(pb, 'final-score')) : Number.NaN;
  };
  const deltas = [...expectedPlatforms].map((p) => ({
    p,
    claimed: readClaimed(p),
    expected: computeExpected(p),
  }));
  const badDelta = deltas.find((d) => Math.abs(d.claimed - d.expected) > 0.06);
  record(
    'final-score-computed',
    'block',
    !badDelta,
    badDelta
      ? `${badDelta.p}: claimed ${badDelta.claimed.toFixed(2)} vs expected ${badDelta.expected.toFixed(2)}`
      : deltas.map((d) => `${d.p}=${d.expected.toFixed(2)}`).join(', ')
  );

  // recommendation-matches-winner
  const recOpen =
    reportXml.match(/<recommendation\b[^>]*>/)?.[0] ?? '';
  const choice = attrVal(recOpen, 'choice') ?? '';
  const winner =
    deltas[0] && deltas[1]
      ? deltas[0].expected > deltas[1].expected
        ? deltas[0].p
        : deltas[1].expected > deltas[0].expected
          ? deltas[1].p
          : 'tie'
      : 'tie';
  const hedgeText = inner(reportXml, 'hedge');
  record(
    'recommendation-matches-winner',
    'block',
    winner === 'tie' || choice === winner || hedgeText.length >= 40,
    `choice=${choice} winner=${winner} hedge_len=${hedgeText.length}`
  );

  // diff-summary-present
  const diffSummary = inner(reportXml, 'diff-summary');
  const realFiles = diff.filesChanged;
  const summaryHasFileMention =
    diffSummary.includes(String(realFiles)) ||
    /file/i.test(diffSummary) ||
    realFiles === 0;
  record(
    'diff-summary-present',
    'block',
    diffSummary.length > 0 && diffSummary !== 'N/A' && summaryHasFileMention,
    `len=${diffSummary.length}, realFiles=${realFiles}`
  );

  // hedge-present (warn)
  record('hedge-present', 'warn', hedgeText.length >= 40, `hedge_len=${hedgeText.length}`);

  // next-actions-minimum (warn)
  const actions = findBlocks(reportXml, 'action').length;
  record('next-actions-minimum', 'warn', actions >= 3, `actions=${actions}`);

  return results;
}

export function shouldBlock(results: readonly CheckResult[]): boolean {
  return results.some((r) => r.severity === 'block' && !r.passed);
}
