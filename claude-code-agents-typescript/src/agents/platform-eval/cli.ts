#!/usr/bin/env npx tsx
// CLI for the platform-eval Agent SDK evaluator.
//
// Usage:
//   npx tsx src/agents/platform-eval/cli.ts \
//     --spec refs/git-platform-decision-spec.xml \
//     --report refs/out/git-platform-decision-report.xml
//
// Exit codes:
//   0  pass
//   1  needs-revision (with JSON diagnostic on stdout)
//   2  error (bad input, missing file, SDK failure)

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadSpec } from './xml-spec.js';
import { readSessionDiff } from './diff-reader.js';
import { runDeterministicChecks, shouldBlock } from './deterministic-checks.js';
import { evaluateReport } from './eval-loop.js';

type Args = {
  readonly spec: string;
  readonly report: string;
  readonly deterministicOnly: boolean;
};

function parseArgs(argv: readonly string[]): Args {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const cur = argv[i];
    if (cur?.startsWith('--')) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[cur.slice(2)] = next;
        i += 1;
      } else {
        args[cur.slice(2)] = 'true';
      }
    }
  }
  const spec = args['spec'];
  const report = args['report'];
  if (!spec || !report) {
    process.stderr.write('usage: cli.ts --spec <path> --report <path> [--deterministic-only]\n');
    process.exit(2);
  }
  return {
    spec: resolve(spec),
    report: resolve(report),
    deterministicOnly: args['deterministic-only'] === 'true',
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const specXml = readFileSync(args.spec, 'utf8');
  const spec = loadSpec(args.spec);
  const reportXml = readFileSync(args.report, 'utf8');
  const diff = readSessionDiff();

  const deterministic = runDeterministicChecks(reportXml, spec, diff);
  const blocked = shouldBlock(deterministic);

  const logDeterministic = {
    mode: 'deterministic',
    blocked,
    results: deterministic,
  };

  if (blocked || args.deterministicOnly) {
    process.stdout.write(JSON.stringify(logDeterministic, null, 2) + '\n');
    process.exit(blocked ? 1 : 0);
  }

  const verdict = await evaluateReport({
    spec,
    specXml,
    reportXml,
    diff,
    deterministicResults: deterministic,
  });

  const payload = {
    mode: 'full',
    model: spec.evaluatorModel,
    deterministic,
    verdict,
  };
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  if (verdict.kind === 'pass') process.exit(0);
  if (verdict.kind === 'needs-revision') process.exit(1);
  process.exit(2);
}

main().catch((err) => {
  process.stderr.write(`platform-eval cli failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(2);
});
