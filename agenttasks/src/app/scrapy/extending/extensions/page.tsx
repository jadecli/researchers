"use client";
import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function ExtensionsPage() {
  return (
    <ScrapyPage
      breadcrumb="Extensions"
      title="Extensions"
      subtitle="Extensions are singleton classes that hook into Scrapy's signal system to perform cross-cutting tasks: stats collection, logging, memory monitoring, and custom tracking."
      prev={{ label: "Spider MW", href: "/scrapy/extending/spider-middleware" }}
      next={{ label: "Signals", href: "/scrapy/extending/signals" }}
    >
      <Collapsible title="Built-in Extensions" defaultOpen>
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          Scrapy ships with extensions for telnet console, memory usage monitoring, close
          spider conditions, and stats collection. These are enabled by default and can be
          disabled by setting their priority to <Code>None</Code>.
        </p>
        <CodeBlock language="python" title="Disabling a built-in extension">
{`EXTENSIONS = {
    "scrapy.extensions.telnet.TelnetConsole": None,
    "scrapy.extensions.memusage.MemoryUsage": None,
}`}
        </CodeBlock>
      </Collapsible>

      <Callout type="note">
        Extensions are instantiated via <Code>from_crawler</Code>, giving them access to
        settings, stats, and the signal dispatcher. Unlike middleware, extensions do not
        process individual requests or items -- they observe the crawl lifecycle.
      </Callout>

      <Collapsible title="AgentTasks Quality Tracker">
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          Our <Code>CrawlQualityTracker</Code> extension listens for{" "}
          <Code>item_scraped</Code> signals and aggregates quality scores across the
          entire crawl. When the spider closes, it logs a summary report and pushes
          metrics to our monitoring stack.
        </p>
        <CodeBlock language="python" title="agenttasks/extensions.py">
{`from scrapy import signals

class CrawlQualityTracker:
    @classmethod
    def from_crawler(cls, crawler):
        ext = cls()
        crawler.signals.connect(
            ext.item_scraped, signal=signals.item_scraped
        )
        crawler.signals.connect(
            ext.spider_closed, signal=signals.spider_closed
        )
        return ext

    def item_scraped(self, item, response, spider):
        score = item.get("quality_score", 0)
        self.scores.append(score)

    def spider_closed(self, spider, reason):
        avg = sum(self.scores) / len(self.scores)
        spider.logger.info(f"Avg quality: {avg:.2f}")`}
        </CodeBlock>
      </Collapsible>

      <Callout type="tip">
        Keep extensions focused on a single responsibility. If you need to both filter
        items and track metrics, use a pipeline for filtering and an extension for metrics.
      </Callout>
    </ScrapyPage>
  );
}
