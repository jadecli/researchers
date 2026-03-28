/**
 * Refactored crawler using Crawlee + mnemonist + BAML-style typed extraction.
 *
 * Crawls both releasebot.io (sitemap) and anthropic.com/customers (page)
 * using local fixtures, producing BAML-typed structured output.
 *
 * Usage: npx tsx src/crawl-refactored.ts
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CrawleeMnemonistCrawler } from "./crawlers/crawlee-crawler.js";
import { printTypedCustomers, printTypedProducts } from "./crawlers/baml-extractor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "..", "claude-code", "test_fixtures");
const DATA_DIR = join(__dirname, "..", "data");
const PORT = 8789;

function serveFixtures(): ReturnType<typeof createServer> {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url || "/";

    if (url === "/robots.txt") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("User-agent: *\nAllow: /\n");
      return;
    }

    if (url === "/sitemap-products.xml") {
      const file = join(FIXTURES_DIR, "sitemap-products.xml");
      if (existsSync(file)) {
        // Rewrite URLs to point to local server
        let content = readFileSync(file, "utf-8");
        content = content.replace(/http:\/\/localhost:8787/g, `http://127.0.0.1:${PORT}`);
        res.writeHead(200, { "Content-Type": "application/xml" });
        res.end(content);
        return;
      }
    }

    if (url === "/customers" || url === "/customers/") {
      const file = join(FIXTURES_DIR, "customers.html");
      if (existsSync(file)) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(readFileSync(file, "utf-8"));
        return;
      }
    }

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

  const server = serveFixtures();
  await new Promise<void>((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  console.log(`Fixture server on http://127.0.0.1:${PORT}`);

  // ── Crawl 1: Products via sitemap ──────────────────────────────
  console.log("\n=== Crawling releasebot.io/sitemap-products.xml (Crawlee + mnemonist) ===");
  const productCrawler = new CrawleeMnemonistCrawler({
    maxPages: 10,
    maxConcurrency: 3,
    requestTimeout: 10,
    bloomFilterSize: 1000,
  });

  const productStart = performance.now();
  await productCrawler.crawlSitemap(`http://127.0.0.1:${PORT}/sitemap-products.xml`);
  const productElapsed = (performance.now() - productStart) / 1000;

  const productStats = productCrawler.getStats();
  console.log(`  Products crawled: ${productStats.pagesCrawled}, elapsed: ${productElapsed.toFixed(3)}s`);
  console.log(`  Avg quality: ${productStats.avgQuality.toFixed(4)}`);
  console.log(`  Bloom filter: ${JSON.stringify(productCrawler.getBloomFilterStats())}`);

  // ── Crawl 2: Customers page ────────────────────────────────────
  console.log("\n=== Crawling anthropic.com/customers (Crawlee + mnemonist) ===");
  const customerCrawler = new CrawleeMnemonistCrawler({
    maxPages: 10,
    maxConcurrency: 3,
    requestTimeout: 10,
    bloomFilterSize: 1000,
  });

  const customerStart = performance.now();
  await customerCrawler.crawlCustomers(`http://127.0.0.1:${PORT}/customers`);
  const customerElapsed = (performance.now() - customerStart) / 1000;

  const customerStats = customerCrawler.getStats();
  console.log(`  Pages crawled: ${customerStats.pagesCrawled}, elapsed: ${customerElapsed.toFixed(3)}s`);
  console.log(`  Avg quality: ${customerStats.avgQuality.toFixed(4)}`);
  console.log(`  Bloom filter: ${JSON.stringify(customerCrawler.getBloomFilterStats())}`);

  // ── BAML Typed Output ──────────────────────────────────────────
  productCrawler.printTypedSummary();
  customerCrawler.printTypedSummary();

  // Write typed outputs
  const typedCustomersMd = printTypedCustomers(customerCrawler.getTypedCustomers());
  writeFileSync(join(DATA_DIR, "typed_customers.md"), typedCustomersMd, "utf-8");

  const typedProductsMd = printTypedProducts(productCrawler.getTypedProducts());
  writeFileSync(join(DATA_DIR, "typed_products.md"), typedProductsMd, "utf-8");

  // ── Write results ──────────────────────────────────────────────
  const allResults = [...productCrawler.getResults(), ...customerCrawler.getResults()];
  const outputFile = join(DATA_DIR, "refactored_crawl.jsonl");
  const lines = allResults.map((r) => JSON.stringify(r));
  writeFileSync(outputFile, lines.join("\n") + "\n", "utf-8");

  const totalElapsed = productElapsed + customerElapsed;
  const totalStats = {
    pagesRequested: productStats.pagesRequested + customerStats.pagesRequested,
    pagesCrawled: productStats.pagesCrawled + customerStats.pagesCrawled,
    errors: productStats.errors + customerStats.errors,
    startTime: 0,
    endTime: 0,
    elapsedMs: totalElapsed * 1000,
    items: allResults.length,
    avgQuality:
      allResults.length > 0
        ? allResults.reduce((sum, r) => sum + r.qualityScore, 0) / allResults.length
        : 0,
  };

  // Write benchmark
  const benchmark = {
    crawler: "typescript-crawlee-mnemonist-baml",
    target: "releasebot.io + anthropic.com/customers",
    fixtureMode: true,
    elapsedSeconds: parseFloat(totalElapsed.toFixed(3)),
    stats: totalStats,
    timestamp: new Date().toISOString(),
  };
  const benchmarkFile = join(DATA_DIR, "benchmark_refactored.json");
  writeFileSync(benchmarkFile, JSON.stringify(benchmark, null, 2), "utf-8");

  console.log(`\n=== TOTAL ===`);
  console.log(`Total elapsed: ${totalElapsed.toFixed(3)}s`);
  console.log(`Total items: ${allResults.length}`);
  console.log(`Results: ${outputFile}`);
  console.log(`Benchmark: ${benchmarkFile}`);
  console.log(`Typed customers: ${join(DATA_DIR, "typed_customers.md")}`);
  console.log(`Typed products: ${join(DATA_DIR, "typed_products.md")}`);

  server.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
