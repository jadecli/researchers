#!/usr/bin/env npx tsx
// Emit a JSON summary of git state relevant to the current session.
//
// Resolution order for "session start":
//   1. SESSION_BASE_REF env var (explicit override)
//   2. merge-base with `main` (fallback — matches pre-pr-gate.sh)
//
// Output shape consumed by the git-platform-eval skill and the platform-eval
// Agent SDK. Keep the shape flat and stable — changing it forces a spec bump.

import { execSync } from 'node:child_process';

type DiffFile = {
  readonly status: string;
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
};

type DiffSummary = {
  readonly branch: string;
  readonly baseRef: string;
  readonly commitsAhead: number;
  readonly filesChanged: number;
  readonly additions: number;
  readonly deletions: number;
  readonly files: readonly DiffFile[];
  readonly staged: number;
  readonly unstaged: number;
  readonly untracked: number;
};

function sh(cmd: string): string {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function resolveBaseRef(): string {
  const override = process.env.SESSION_BASE_REF;
  if (override && override.length > 0) return override;
  try {
    return sh('git merge-base HEAD origin/main');
  } catch {
    return sh('git rev-parse HEAD~1');
  }
}

function parseNumstat(output: string): readonly DiffFile[] {
  if (!output) return [];
  return output.split('\n').map((line) => {
    const [adds, dels, path] = line.split('\t');
    return {
      status: 'M',
      path: path ?? '',
      additions: Number.parseInt(adds ?? '0', 10) || 0,
      deletions: Number.parseInt(dels ?? '0', 10) || 0,
    };
  });
}

function main(): void {
  const branch = sh('git rev-parse --abbrev-ref HEAD');
  const baseRef = resolveBaseRef();
  const commitsAhead = Number.parseInt(
    sh(`git rev-list --count ${baseRef}..HEAD`) || '0',
    10
  );
  const numstat = sh(`git diff --numstat ${baseRef}..HEAD`);
  const files = parseNumstat(numstat);
  const staged = sh('git diff --cached --name-only')
    .split('\n')
    .filter((s) => s.length > 0).length;
  const unstaged = sh('git diff --name-only')
    .split('\n')
    .filter((s) => s.length > 0).length;
  const untracked = sh('git ls-files --others --exclude-standard')
    .split('\n')
    .filter((s) => s.length > 0).length;

  const summary: DiffSummary = {
    branch,
    baseRef,
    commitsAhead,
    filesChanged: files.length,
    additions: files.reduce((s, f) => s + f.additions, 0),
    deletions: files.reduce((s, f) => s + f.deletions, 0),
    files,
    staged,
    unstaged,
    untracked,
  };

  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
}

main();
