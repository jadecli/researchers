// src/index.ts — CLI entry point for agentcrawls-ts
//
// Crawl changelog sources, detect changes via bloom filter,
// extract structured bullets, and optionally persist to Neon PG18.

import { crawlChangelogs, DEFAULT_TARGETS } from './crawlers/changelog.js';
import { extractBulletsRegex } from './extractors/bullets.js';
import { createChangeDetector } from './filters/change-detect.js';
import { createNeonStorage } from './storage/neon.js';
import path from 'node:path';
import os from 'node:os';

async function main(): Promise<void> {
  const dataDir = process.env['CRAWL_DATA_DIR'] ?? path.join(os.homedir(), '.agentcrawls');
  const bloomPath = path.join(dataDir, 'changelog-bloom.json');

  console.log(`Crawling ${DEFAULT_TARGETS.length} changelog sources...`);

  // Step 1: Crawl changelogs
  const results = await crawlChangelogs();
  const totalSections = results.reduce((sum, r) => sum + r.sections.length, 0);
  console.log(`Crawled ${results.length} repos, found ${totalSections} version sections`);

  // Step 2: Detect new sections via bloom filter
  const detector = createChangeDetector(bloomPath);
  let newSectionCount = 0;
  const allNewBullets = [];

  for (const result of results) {
    const newSections = detector.filterNew(result.sections);
    newSectionCount += newSections.length;

    console.log(`  ${result.repo}: ${newSections.length}/${result.sections.length} new sections`);

    // Step 3: Extract bullets from new sections
    for (const section of newSections) {
      const bullets = extractBulletsRegex(section);
      allNewBullets.push(...bullets);
      detector.markSeen(section);
    }
  }

  console.log(`Extracted ${allNewBullets.length} new bullets from ${newSectionCount} sections`);

  // Step 4: Persist bloom filter state
  detector.save();
  console.log(`Bloom filter saved (${detector.itemCount} items tracked)`);

  // Step 5: Persist to Neon if DATABASE_URL is set
  if (process.env['DATABASE_URL']) {
    const storage = createNeonStorage();
    try {
      const inserted = await storage.insertBullets(allNewBullets);
      console.log(`Inserted ${inserted} bullets into Neon PG18`);
    } finally {
      await storage.close();
    }
  } else {
    console.log('DATABASE_URL not set — skipping Neon persistence');
    // Print bullets to stdout as JSON
    if (allNewBullets.length > 0) {
      console.log(JSON.stringify(allNewBullets, null, 2));
    }
  }
}

main().catch((err) => {
  console.error('Crawl failed:', err);
  process.exit(1);
});
