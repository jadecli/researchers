"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function BenchmarkingPage() {
  return (
    <ScrapyPage
      breadcrumb="Benchmarking"
      title="Benchmarking"
      subtitle="Measure spider performance with scrapy bench, custom timing, and stats analysis to optimize crawl throughput."
      prev={{ label: "AutoThrottle", href: "/scrapy/solving-problems/autothrottle" }}
      next={{ label: "Jobs", href: "/scrapy/solving-problems/jobs" }}
    >
      <div className="space-y-6">
        <Collapsible title="scrapy bench" defaultOpen>
          <p className="text-sm text-[#b0aea5] mb-3">
            The built-in <Code>scrapy bench</Code> command measures raw crawling
            speed against a local test server.
          </p>
          <CodeBlock language="bash" title="benchmark">
{`scrapy bench
# Crawls a synthetic page at maximum speed
# Output: pages/min, items/min, response time stats`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Custom Timing">
          <p className="text-sm text-[#b0aea5] mb-3">
            Add timing stats to your spider to measure parse callback performance
            and identify bottlenecks.
          </p>
          <CodeBlock language="python" title="timing">
{`import time

class DocsSpider(scrapy.Spider):
    name = "docs"

    def parse(self, response):
        start = time.monotonic()
        items = self._extract_items(response)
        elapsed = time.monotonic() - start

        self.crawler.stats.inc_value(
            "benchmark/parse_time_total", elapsed)
        self.crawler.stats.max_value(
            "benchmark/parse_time_max", elapsed)

        yield from items`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Comparing Crawl Rounds">
          <p className="text-sm text-[#b0aea5] mb-3">
            Track key metrics across crawl rounds to detect regressions in speed
            or quality.
          </p>
          <CodeBlock language="python" title="metrics">
{`def closed(self, reason):
    stats = self.crawler.stats.get_stats()
    metrics = {
        "pages": stats.get("item_scraped_count", 0),
        "errors": stats.get("log_count/ERROR", 0),
        "duration": stats.get("elapsed_time_seconds", 0),
        "pages_per_min": stats.get("item_scraped_count", 0)
            / max(stats.get("elapsed_time_seconds", 1), 1) * 60,
    }
    self.logger.info("Benchmark: %s", metrics)`}
          </CodeBlock>
        </Collapsible>

        <Callout type="note">
          AgentTasks logs benchmark metrics to Postgres after every crawl round
          for trend analysis across the 2,477+ page corpus.
        </Callout>
      </div>
    </ScrapyPage>
  );
}
