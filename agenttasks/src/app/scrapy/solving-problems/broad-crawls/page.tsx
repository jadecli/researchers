"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function BroadCrawlsPage() {
  return (
    <ScrapyPage
      breadcrumb="Broad Crawls"
      title="Broad Crawls"
      subtitle="Settings and strategies for crawling large documentation sites efficiently. Our Round 4 crawled 271 pages across 12 domains using these techniques."
      prev={{ label: "Common Practices", href: "/scrapy/solving-problems/common-practices" }}
      next={{ label: "Dev Tools", href: "/scrapy/solving-problems/dev-tools" }}
    >
      <div className="space-y-6">
        <Collapsible title="Broad Crawl Settings" defaultOpen>
          <p className="text-sm text-[#b0aea5] mb-3">
            Switch to breadth-first order and increase concurrency for broad crawls.
            These settings let AgentTasks sweep entire doc sites in minutes.
          </p>
          <CodeBlock language="python" title="settings.py">
{`# Breadth-first crawl order
DEPTH_PRIORITY = 1
SCHEDULER_DISK_QUEUE = "scrapy.squeues.PickleFifoDiskQueue"
SCHEDULER_MEMORY_QUEUE = "scrapy.squeues.FifoMemoryQueue"

# High concurrency
CONCURRENT_REQUESTS = 64
CONCURRENT_REQUESTS_PER_DOMAIN = 16
DOWNLOAD_DELAY = 0`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Memory and Performance">
          <p className="text-sm text-[#b0aea5] mb-3">
            Disable unused features to reduce memory overhead. For broad crawls,
            every megabyte counts.
          </p>
          <CodeBlock language="python" title="lean settings">
{`# Disable cookies and retries for speed
COOKIES_ENABLED = False
RETRY_ENABLED = False

# Reduce log verbosity
LOG_LEVEL = "INFO"

# Use disk queue to avoid OOM on large crawls
SCHEDULER_DISK_QUEUE = "scrapy.squeues.PickleFifoDiskQueue"`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Monitoring Broad Crawls">
          <p className="text-sm text-[#b0aea5] mb-3">
            Track progress with custom stats and the{" "}
            <Code>CLOSESPIDER_PAGECOUNT</Code> failsafe.
          </p>
          <CodeBlock language="python" title="monitoring">
{`# Safety limit: stop after 500 pages
CLOSESPIDER_PAGECOUNT = 500

# In spider
def parse(self, response):
    self.crawler.stats.inc_value("broad/domains_seen")
    self.logger.info("Queue depth: %d",
                     len(self.crawler.engine.slot.scheduler))`}
          </CodeBlock>
        </Collapsible>

        <Callout type="note">
          Our Round 4 broad crawl used <Code>CONCURRENT_REQUESTS = 32</Code> with
          AutoThrottle enabled, completing 271 pages in under 4 minutes.
        </Callout>
      </div>
    </ScrapyPage>
  );
}
