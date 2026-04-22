// Read git diffs the evaluator needs to decide whether the report's
// <diff-summary> matches reality.

import { execSync } from 'node:child_process';

export type DiffSnapshot = {
  readonly branch: string;
  readonly baseRef: string;
  readonly commitsAhead: number;
  readonly filesChanged: number;
  readonly additions: number;
  readonly deletions: number;
  readonly paths: readonly string[];
};

function sh(cmd: string): string {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function safe(cmd: string, fallback = ''): string {
  try {
    return sh(cmd);
  } catch {
    return fallback;
  }
}

export function readSessionDiff(): DiffSnapshot {
  const branch = safe('git rev-parse --abbrev-ref HEAD', 'HEAD');
  const override = process.env.SESSION_BASE_REF;
  const baseRef =
    override && override.length > 0
      ? override
      : safe('git merge-base HEAD origin/main', 'HEAD~1');
  const commitsAhead = Number.parseInt(
    safe(`git rev-list --count ${baseRef}..HEAD`, '0'),
    10
  );
  const numstat = safe(`git diff --numstat ${baseRef}..HEAD`);
  const lines = numstat ? numstat.split('\n') : [];
  let additions = 0;
  let deletions = 0;
  const paths: string[] = [];
  for (const line of lines) {
    const [a, d, p] = line.split('\t');
    additions += Number.parseInt(a ?? '0', 10) || 0;
    deletions += Number.parseInt(d ?? '0', 10) || 0;
    if (p) paths.push(p);
  }
  return {
    branch,
    baseRef,
    commitsAhead,
    filesChanged: paths.length,
    additions,
    deletions,
    paths,
  };
}
