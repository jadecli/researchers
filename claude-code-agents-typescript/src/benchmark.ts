/**
 * Benchmark harness: runs all 3 crawlers N times each and compares.
 *
 * 1. Python Scrapy (releasebot.io sitemap)
 * 2. TypeScript Cheerio (anthropic.com/customers)
 * 3. TypeScript Crawlee + mnemonist + BAML (both targets)
 *
 * Measures: elapsed time, items extracted, quality scores, variance.
 * Usage: npx tsx src/benchmark.ts
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { CheerioCrawler as SimpleCrawler } from "./crawlers/cheerio-crawler.js";
import { CrawleeMnemonistCrawler } from "./crawlers/crawlee-crawler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const FIXTURES_DIR = join(ROOT, "claude-code", "test_fixtures");
const DATA_DIR = join(__dirname, "..", "data");
const ITERATIONS = 5;

// ── Fixture server ───────────────────────────────────────────────

function createFixtureServer(port: number): ReturnType<typeof createServer> {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url || "/";

    if (url === "/robots.txt") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("User-agent: *\nAllow: /\n");
      return;
    }
    if (url === "/sitemap-products.xml") {
      const file = join(FIXTURES_DIR, "sitemap-products.xml");
      if (existsSync(file)) {
        let content = readFileSync(file, "utf-8");
        content = content.replace(/http:\/\/localhost:8787/g, `http://127.0.0.1:${port}`);
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
}

// ── Stats helpers ────────────────────────────────────────────────

interface RunResult {
  elapsedMs: number;
  items: number;
  avgQuality: number;
  errors: number;
}

function computeStats(runs: RunResult[]) {
  const n = runs.length;
  const times = runs.map((r) => r.elapsedMs);
  const mean = times.reduce((a, b) => a + b, 0) / n;
  const variance = times.reduce((s, t) => s + (t - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);
  const cv = mean > 0 ? (stddev / mean) * 100 : 0; // coefficient of variation
  const min = Math.min(...times);
  const max = Math.max(...times);
  const avgItems = runs.reduce((s, r) => s + r.items, 0) / n;
  const avgQuality = runs.reduce((s, r) => s + r.avgQuality, 0) / n;
  const avgErrors = runs.reduce((s, r) => s + r.errors, 0) / n;

  return {
    n,
    meanMs: Math.round(mean * 100) / 100,
    stddevMs: Math.round(stddev * 100) / 100,
    cvPercent: Math.round(cv * 100) / 100,
    minMs: Math.round(min * 100) / 100,
    maxMs: Math.round(max * 100) / 100,
    avgItems: Math.round(avgItems * 100) / 100,
    avgQuality: Math.round(avgQuality * 10000) / 10000,
    avgErrors: Math.round(avgErrors * 100) / 100,
  };
}

// ── Benchmark runners ────────────────────────────────────────────

async function benchmarkPythonScrapy(port: number): Promise<RunResult[]> {
  const results: RunResult[] = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const outputFile = join(ROOT, "claude-code", "data", `bench_py_${i}.jsonl`);
    if (existsSync(outputFile)) rmSync(outputFile);

    const start = performance.now();
    try {
      execSync(
        `PYTHONPATH=. python3 -m scrapy crawl releasebot_spider ` +
        `-a start_url=http://127.0.0.1:${port}/sitemap-products.xml ` +
        `-s DELTAFETCH_ENABLED=False -s "EXTENSIONS={}" -s "DOWNLOADER_MIDDLEWARES={}" ` +
        `-s "ITEM_PIPELINES={}" -s ROBOTSTXT_OBEY=True -s HTTPCACHE_ENABLED=False ` +
        `-s DOWNLOAD_DELAY=0.05 -s AUTOTHROTTLE_ENABLED=False -s LOG_LEVEL=WARNING ` +
        `-s "FEEDS={}" ` +
        `-o ${outputFile}`,
        {
          cwd: join(ROOT, "claude-code"),
          env: { ...process.env, http_proxy: "", https_proxy: "", HTTP_PROXY: "", HTTPS_PROXY: "", PYTHONPATH: join(ROOT, "claude-code") },
          timeout: 60_000,
          stdio: "pipe",
        }
      );
    } catch {
      // Scrapy may exit non-zero on warnings
    }
    const elapsed = performance.now() - start;

    let items = 0;
    let totalQuality = 0;
    if (existsSync(outputFile)) {
      const lines = readFileSync(outputFile, "utf-8").trim().split("\n").filter(Boolean);
      items = lines.length;
      for (const line of lines) {
        try {
          const item = JSON.parse(line);
          totalQuality += item.quality_score || 0;
        } catch {}
      }
    }

    results.push({
      elapsedMs: elapsed,
      items,
      avgQuality: items > 0 ? totalQuality / items : 0,
      errors: 0,
    });
  }

  return results;
}

async function benchmarkTSCheerio(port: number): Promise<RunResult[]> {
  const results: RunResult[] = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const crawler = new SimpleCrawler({
      maxPages: 10,
      delayMs: 10,
      timeout: 10_000,
    });

    const start = performance.now();
    await crawler.crawlUrl(`http://127.0.0.1:${port}/customers`, "customers");
    const elapsed = performance.now() - start;
    const stats = crawler.getStats();

    results.push({
      elapsedMs: elapsed,
      items: stats.items,
      avgQuality: stats.avgQuality,
      errors: stats.errors,
    });
  }

  return results;
}

async function benchmarkCrawleeMnemonist(port: number): Promise<RunResult[]> {
  const results: RunResult[] = [];

  // Each iteration runs as a subprocess to avoid Crawlee's global state accumulation
  const workerScript = join(__dirname, "benchmark-crawlee-worker.ts");

  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    try {
      // execSync throws on non-zero exit; capture stdout+stderr
      let allOutput = "";
      try {
        allOutput = execSync(
          `npx tsx ${workerScript} ${port} 2>&1`,
          {
            cwd: join(__dirname, ".."),
            timeout: 120_000,
            env: { ...process.env, CRAWLEE_STORAGE_DIR: `/tmp/crawlee_bench_${Date.now()}_${i}` },
          }
        ).toString();
      } catch (e: any) {
        allOutput = e.stdout?.toString() || e.stderr?.toString() || "";
      }

      const elapsed = performance.now() - start;
      const match = allOutput.match(/__BENCHMARK_RESULT__(.+?)__END__/);
      if (match) {
        const data = JSON.parse(match[1]);
        results.push({
          elapsedMs: elapsed,
          items: data.items,
          avgQuality: data.avgQuality,
          errors: data.errors,
        });
      } else {
        results.push({ elapsedMs: elapsed, items: 0, avgQuality: 0, errors: 1 });
      }
    } catch (err: any) {
      const elapsed = performance.now() - start;
      results.push({ elapsedMs: elapsed, items: 0, avgQuality: 0, errors: 1 });
    }
  }

  return results;
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  const PORT = 8790;
  const server = createFixtureServer(PORT);
  await new Promise<void>((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  console.log(`Fixture server on http://127.0.0.1:${PORT}`);
  console.log(`Running ${ITERATIONS} iterations per crawler...\n`);

  // Run benchmarks
  console.log("1/3 Benchmarking Python Scrapy...");
  const pyResults = await benchmarkPythonScrapy(PORT);
  const pyStats = computeStats(pyResults);
  console.log(`     Done: mean=${pyStats.meanMs}ms, stddev=${pyStats.stddevMs}ms, CV=${pyStats.cvPercent}%`);

  console.log("2/3 Benchmarking TypeScript Cheerio...");
  const tsResults = await benchmarkTSCheerio(PORT);
  const tsStats = computeStats(tsResults);
  console.log(`     Done: mean=${tsStats.meanMs}ms, stddev=${tsStats.stddevMs}ms, CV=${tsStats.cvPercent}%`);

  console.log("3/3 Benchmarking Crawlee + mnemonist + BAML...");
  const refResults = await benchmarkCrawleeMnemonist(PORT);
  const refStats = computeStats(refResults);
  console.log(`     Done: mean=${refStats.meanMs}ms, stddev=${refStats.stddevMs}ms, CV=${refStats.cvPercent}%`);

  // ── Report ─────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(80));
  console.log("BENCHMARK RESULTS");
  console.log("=".repeat(80));
  console.log(`Iterations: ${ITERATIONS} per crawler`);
  console.log(`Fixture server: http://127.0.0.1:${PORT}`);
  console.log("");

  const table = [
    ["Metric", "Python Scrapy", "TS Cheerio", "Crawlee+mnemonist+BAML"],
    ["Mean (ms)", pyStats.meanMs, tsStats.meanMs, refStats.meanMs],
    ["Stddev (ms)", pyStats.stddevMs, tsStats.stddevMs, refStats.stddevMs],
    ["CV (%)", pyStats.cvPercent, tsStats.cvPercent, refStats.cvPercent],
    ["Min (ms)", pyStats.minMs, tsStats.minMs, refStats.minMs],
    ["Max (ms)", pyStats.maxMs, tsStats.maxMs, refStats.maxMs],
    ["Avg items", pyStats.avgItems, tsStats.avgItems, refStats.avgItems],
    ["Avg quality", pyStats.avgQuality, tsStats.avgQuality, refStats.avgQuality],
    ["Avg errors", pyStats.avgErrors, tsStats.avgErrors, refStats.avgErrors],
  ];

  // Print table
  const colWidths = [20, 16, 16, 26];
  for (const row of table) {
    const line = row.map((cell, i) => String(cell).padEnd(colWidths[i])).join(" | ");
    console.log(line);
    if (row === table[0]) {
      console.log(colWidths.map((w) => "-".repeat(w)).join("-+-"));
    }
  }

  // Variance analysis
  console.log("\n--- VARIANCE ANALYSIS ---");
  const allCVs = [
    { name: "Python Scrapy", cv: pyStats.cvPercent },
    { name: "TS Cheerio", cv: tsStats.cvPercent },
    { name: "Crawlee+mnemonist+BAML", cv: refStats.cvPercent },
  ];
  allCVs.sort((a, b) => a.cv - b.cv);
  console.log("Ranked by coefficient of variation (lower = more consistent):");
  for (const { name, cv } of allCVs) {
    const bar = "#".repeat(Math.min(Math.round(cv), 50));
    console.log(`  ${name.padEnd(25)} CV=${cv}% ${bar}`);
  }

  // Speed analysis
  console.log("\n--- SPEED ANALYSIS ---");
  const allMeans = [
    { name: "Python Scrapy", mean: pyStats.meanMs },
    { name: "TS Cheerio", mean: tsStats.meanMs },
    { name: "Crawlee+mnemonist+BAML", mean: refStats.meanMs },
  ];
  allMeans.sort((a, b) => a.mean - b.mean);
  const fastest = allMeans[0].mean;
  for (const { name, mean } of allMeans) {
    const ratio = mean / fastest;
    console.log(`  ${name.padEnd(25)} ${mean}ms (${ratio.toFixed(1)}x)`);
  }

  // Write full benchmark report
  const report = {
    iterations: ITERATIONS,
    timestamp: new Date().toISOString(),
    results: {
      python_scrapy: { runs: pyResults, stats: pyStats },
      typescript_cheerio: { runs: tsResults, stats: tsStats },
      crawlee_mnemonist_baml: { runs: refResults, stats: refStats },
    },
    ranking: {
      bySpeed: allMeans.map((m) => m.name),
      byConsistency: allCVs.map((c) => c.name),
    },
  };

  const reportFile = join(DATA_DIR, "benchmark_report.json");
  writeFileSync(reportFile, JSON.stringify(report, null, 2), "utf-8");
  console.log(`\nFull report written to ${reportFile}`);

  server.close();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
