#!/usr/bin/env npx tsx
// devops-review/src/run.ts — CLI entry point for both surfaces
//
// Usage:
//   npx tsx devops-review/src/run.ts                    # defaults to code surface
//   npx tsx devops-review/src/run.ts --surface cowork   # cowork deliverable output
//   npx tsx devops-review/src/run.ts --pr 7             # single PR review
//
// Claude Code invokes this directly or via the devops-reviewer agent.
// Claude Cowork's skill sub-agent invokes this with --surface cowork.
//
// Note: This runner uses mock PR data for demonstration.
// In production, the devops-reviewer agent uses GitHub MCP tools directly
// to fetch real PR data, then passes it to the review engine.

import { orchestrateReview, toCoworkDeliverable, buildDevOpsRun } from './orchestrator.js';
import type { Surface } from './types.js';

// ── Parse CLI args ──────────────────────────────────────────
const args = process.argv.slice(2);
const surfaceArg = args.find((a) => a === '--surface');
const surfaceIdx = args.indexOf('--surface');
const surface: Surface =
  surfaceIdx >= 0 && args[surfaceIdx + 1] === 'cowork'
    ? 'claude-cowork'
    : 'claude-code';

const prArg = args.indexOf('--pr');
const targetPR = prArg >= 0 ? parseInt(args[prArg + 1] ?? '', 10) : undefined;

// ── Example: how the agent would use this ───────────────────
// In real usage, the devops-reviewer agent:
// 1. Calls mcp__github__list_pull_requests to get open PRs
// 2. Calls mcp__github__pull_request_read for each PR to get files
// 3. Passes the data to orchestrateReview()
// 4. Posts results via mcp__github__add_issue_comment (Code surface)
//    or returns deliverable for approval (Cowork surface)

console.log(`[devops-review] Surface: ${surface}`);
console.log(`[devops-review] Target PR: ${targetPR ?? 'all open'}`);
console.log(`[devops-review] Engine ready — awaiting PR data from GitHub MCP`);
console.log('');
console.log('To run a full review, invoke the devops-reviewer agent:');
console.log('  claude --agent devops-reviewer');
console.log('');
console.log('Or from Claude Cowork:');
console.log('  "Review all open PRs and tell me what needs attention"');
