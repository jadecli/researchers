"use client";
import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function SignalsPage() {
  return (
    <ScrapyPage
      breadcrumb="Signals"
      title="Signals"
      subtitle="Scrapy uses a signal dispatch system inspired by Django. Extensions, middleware, and pipelines can connect to signals to react to crawl events without tight coupling."
      prev={{ label: "Extensions", href: "/scrapy/extending/extensions" }}
      next={{ label: "Scheduler", href: "/scrapy/extending/scheduler" }}
    >
      <Collapsible title="Core Signals" defaultOpen>
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          The most commonly used signals are <Code>spider_opened</Code>,{" "}
          <Code>spider_closed</Code>, <Code>item_scraped</Code>, and{" "}
          <Code>item_dropped</Code>. These fire at predictable points in the crawl
          lifecycle.
        </p>
        <CodeBlock language="python" title="Available signals">
{`from scrapy import signals

# Crawl lifecycle
signals.engine_started
signals.engine_stopped

# Spider lifecycle
signals.spider_opened
signals.spider_idle
signals.spider_closed

# Item events
signals.item_scraped
signals.item_dropped
signals.item_error

# Request events
signals.request_scheduled
signals.request_dropped
signals.response_received`}
        </CodeBlock>
      </Collapsible>

      <Callout type="note">
        Signals are sent synchronously by default. If your handler performs I/O (like
        writing to a database), consider deferring the work to avoid blocking the
        reactor loop.
      </Callout>

      <Collapsible title="Quality Feedback via Signals">
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          In AgentTasks, we use <Code>item_scraped</Code> and{" "}
          <Code>item_dropped</Code> signals to build a real-time quality feedback
          loop. Dropped items trigger alerts; scraped items update running averages.
        </p>
        <CodeBlock language="python" title="Signal-driven quality tracking">
{`class QualityFeedback:
    @classmethod
    def from_crawler(cls, crawler):
        obj = cls(crawler.stats)
        crawler.signals.connect(
            obj.on_scraped, signal=signals.item_scraped
        )
        crawler.signals.connect(
            obj.on_dropped, signal=signals.item_dropped
        )
        return obj

    def on_scraped(self, item, response, spider):
        self.stats.inc_value("quality/scraped_count")

    def on_dropped(self, item, response, exception, spider):
        self.stats.inc_value("quality/dropped_count")
        spider.logger.warning(f"Dropped: {exception}")`}
        </CodeBlock>
      </Collapsible>

      <Callout type="tip">
        Use <Code>spider_idle</Code> to schedule additional requests when the spider
        runs out of work. This is how AgentTasks implements iterative crawling --
        re-crawling pages whose quality score dropped below threshold.
      </Callout>
    </ScrapyPage>
  );
}
