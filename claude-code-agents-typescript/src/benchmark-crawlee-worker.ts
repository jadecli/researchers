/**
 * Worker subprocess for a single Crawlee benchmark iteration.
 * Outputs JSON on stdout: { items, avgQuality, errors }
 */

import { CrawleeMnemonistCrawler } from "./crawlers/crawlee-crawler.js";
import { log, LogLevel } from "crawlee";

log.setLevel(LogLevel.WARNING);

const port = parseInt(process.argv[2] || "8790", 10);

async function run() {
  const crawler = new CrawleeMnemonistCrawler({
    maxPages: 10,
    maxConcurrency: 3,
    requestTimeout: 10,
    bloomFilterSize: 1000,
  });
  await crawler.crawlSitemap(`http://127.0.0.1:${port}/sitemap-products.xml`);

  const crawler2 = new CrawleeMnemonistCrawler({
    maxPages: 10,
    maxConcurrency: 3,
    requestTimeout: 10,
    bloomFilterSize: 1000,
  });
  await crawler2.crawlCustomers(`http://127.0.0.1:${port}/customers`);

  const stats1 = crawler.getStats();
  const stats2 = crawler2.getStats();

  const result = {
    items: stats1.items + stats2.items,
    avgQuality: (stats1.avgQuality + stats2.avgQuality) / 2,
    errors: stats1.errors + stats2.errors,
  };

  // Output only the JSON result to stderr (stdout has Crawlee logs)
  // Use a unique marker so parent can parse it
  console.error(`__BENCHMARK_RESULT__${JSON.stringify(result)}__END__`);
}

run().catch(() => {
  console.error(`__BENCHMARK_RESULT__${JSON.stringify({ items: 0, avgQuality: 0, errors: 1 })}__END__`);
  process.exit(1);
});
