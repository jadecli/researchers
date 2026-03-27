#!/usr/bin/env npx tsx
// classify-query.ts — Query classification for research orchestration
// Usage: echo "compare React vs Vue vs Svelte" | npx tsx scripts/classify-query.ts

import { classifyQuery, determineScale } from '../../../src/agent/orchestrator.js';

async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const query = Buffer.concat(chunks).toString('utf-8').trim();

  if (!query) {
    console.error('Usage: echo "your query" | npx tsx classify-query.ts');
    process.exit(1);
  }

  const classification = classifyQuery(query);
  const scale = determineScale(classification);

  console.log(JSON.stringify({ query, classification, scale }, null, 2));
}

main().catch(console.error);
