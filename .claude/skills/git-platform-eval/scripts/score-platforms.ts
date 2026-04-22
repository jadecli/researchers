#!/usr/bin/env npx tsx
// Compute weighted final scores per platform from a scores map.
//
// Input shape (stdin JSON or --input file):
//   {
//     "criteria": [{ "id": "...", "weight": 5 }, ...],
//     "scores": {
//       "github": { "<criterion-id>": <1..5>, ... },
//       "gitlab": { "<criterion-id>": <1..5>, ... }
//     }
//   }
//
// Output (stdout JSON):
//   { "final": { "github": number, "gitlab": number }, "winner": "github" | "gitlab" | "tie" }
//
// Keep the arithmetic here so the skill prompt can't "estimate" a final-score
// inconsistent with its per-criterion scores — the evaluator's
// `final-score-computed` check reruns this.

import { readFileSync } from 'node:fs';

type Input = {
  readonly criteria: ReadonlyArray<{ readonly id: string; readonly weight: number }>;
  readonly scores: Readonly<Record<'github' | 'gitlab', Readonly<Record<string, number>>>>;
};

type Output = {
  readonly final: Readonly<Record<'github' | 'gitlab', number>>;
  readonly winner: 'github' | 'gitlab' | 'tie';
};

export function scorePlatforms(input: Input): Output {
  const totalWeight = input.criteria.reduce((s, c) => s + c.weight, 0);
  const weighted = (platform: 'github' | 'gitlab'): number => {
    const scores = input.scores[platform];
    const sum = input.criteria.reduce((s, c) => {
      const v = scores[c.id] ?? 0;
      return s + v * c.weight;
    }, 0);
    return totalWeight === 0 ? 0 : Math.round((sum / totalWeight) * 100) / 100;
  };
  const gh = weighted('github');
  const gl = weighted('gitlab');
  const winner = gh > gl ? 'github' : gl > gh ? 'gitlab' : 'tie';
  return { final: { github: gh, gitlab: gl }, winner };
}

function readInput(): string {
  const flagIdx = process.argv.indexOf('--input');
  if (flagIdx > -1) {
    const path = process.argv[flagIdx + 1];
    if (!path) throw new Error('--input requires a path');
    return readFileSync(path, 'utf8');
  }
  return readFileSync(0, 'utf8');
}

function cli(): void {
  const raw = readInput();
  const input = JSON.parse(raw) as Input;
  const out = scorePlatforms(input);
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('score-platforms.ts') || entry.endsWith('score-platforms.js')) {
  cli();
}
