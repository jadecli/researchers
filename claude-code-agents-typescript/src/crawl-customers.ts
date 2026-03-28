/**
 * Crawl anthropic.com/customers using the Cheerio-based crawler.
 *
 * Due to network restrictions, uses local fixtures served via a local HTTP server.
 * Usage: npx tsx src/crawl-customers.ts
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CheerioCrawler } from "./crawlers/cheerio-crawler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "..", "claude-code", "test_fixtures");
const DATA_DIR = join(__dirname, "..", "data");
const PORT = 8788;

function serveFixtures(): ReturnType<typeof createServer> {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url || "/";

    if (url === "/robots.txt") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("User-agent: *\nAllow: /\n");
      return;
    }

    if (url === "/customers" || url === "/customers/") {
      const file = join(FIXTURES_DIR, "customers.html");
      if (existsSync(file)) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(readFileSync(file, "utf-8"));
        return;
      }
    }

    // Serve product pages too for link following
    if (url.startsWith("/products/")) {
      const productName = url.replace("/products/", "").replace(/\/$/, "");
      const file = join(FIXTURES_DIR, "products", `${productName}.html`);
      if (existsSync(file)) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(readFileSync(file, "utf-8"));
        return;
      }
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  return server;
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  // Start local fixture server
  const server = serveFixtures();
  await new Promise<void>((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  console.log(`Fixture server on http://127.0.0.1:${PORT}`);

  // Run the crawler
  const crawler = new CheerioCrawler({
    maxPages: 10,
    delayMs: 50,
    timeout: 10_000,
  });

  console.log("\n=== Crawling anthropic.com/customers (via fixtures) ===");
  const startTime = performance.now();

  await crawler.crawlUrl(`http://127.0.0.1:${PORT}/customers`, "customers");

  const elapsed = (performance.now() - startTime) / 1000;
  const stats = crawler.getStats();
  const results = crawler.getResults();
  const customers = crawler.getCustomers();

  console.log(`\n=== CRAWL COMPLETE ===`);
  console.log(`Elapsed: ${elapsed.toFixed(3)}s`);
  console.log(`Pages crawled: ${stats.pagesCrawled}`);
  console.log(`Items: ${stats.items}`);
  console.log(`Avg quality: ${stats.avgQuality.toFixed(4)}`);
  console.log(`Errors: ${stats.errors}`);

  if (customers.length > 0) {
    console.log(`\nCustomers extracted: ${customers.length}`);
    for (const c of customers) {
      console.log(`  - ${c.name} (${c.industry}): ${c.metrics.length} metrics`);
    }
  }

  // Write results
  const outputFile = join(DATA_DIR, "customers_crawl.jsonl");
  const lines = results.map((r) => JSON.stringify(r));
  writeFileSync(outputFile, lines.join("\n") + "\n", "utf-8");
  console.log(`\nResults written to ${outputFile}`);

  // Write benchmark
  const benchmark = {
    crawler: "typescript-cheerio",
    target: "anthropic.com/customers",
    fixtureMode: true,
    elapsedSeconds: parseFloat(elapsed.toFixed(3)),
    stats,
    timestamp: new Date().toISOString(),
  };
  const benchmarkFile = join(DATA_DIR, "benchmark_typescript.json");
  writeFileSync(benchmarkFile, JSON.stringify(benchmark, null, 2), "utf-8");
  console.log(`Benchmark written to ${benchmarkFile}`);

  server.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
