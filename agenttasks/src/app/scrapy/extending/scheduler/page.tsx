"use client";
import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function SchedulerPage() {
  return (
    <ScrapyPage
      breadcrumb="Scheduler"
      title="Scheduler"
      subtitle="The Scheduler manages the queue of pending requests. It decides which request to process next, handles deduplication, and optionally persists queues to disk for resumable crawls."
      prev={{ label: "Signals", href: "/scrapy/extending/signals" }}
      next={{ label: "Item Exporters", href: "/scrapy/extending/item-exporters" }}
    >
      <Collapsible title="Priority Queues" defaultOpen>
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          Scrapy uses a priority queue where lower values mean higher priority. By
          default all requests get priority <Code>0</Code>. You can set{" "}
          <Code>request.priority</Code> to control ordering.
        </p>
        <CodeBlock language="python" title="Setting request priority">
{`import scrapy

class DocSpider(scrapy.Spider):
    name = "docs"

    def parse(self, response):
        for link in response.css("a::attr(href)").getall():
            priority = -1 if "/api/" in link else 0
            yield response.follow(
                link,
                callback=self.parse_page,
                priority=priority,
            )`}
        </CodeBlock>
      </Collapsible>

      <Callout type="note">
        The default scheduler uses an in-memory queue. For large crawls that may be
        interrupted, enable disk queues with <Code>SCHEDULER_DISK_QUEUE</Code> and{" "}
        <Code>JOBDIR</Code> to resume where you left off.
      </Callout>

      <Collapsible title="Disk Queues and Resumable Crawls">
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          AgentTasks enables disk queues for long documentation crawls. If a crawl is
          interrupted, restarting with the same <Code>JOBDIR</Code> picks up from the
          last checkpoint.
        </p>
        <CodeBlock language="python" title="settings.py">
{`# Enable disk-backed queues for resumability
SCHEDULER_DISK_QUEUE = "scrapy.squeues.PickleFifoDiskQueue"
SCHEDULER_MEMORY_QUEUE = "scrapy.squeues.FifoMemoryQueue"
JOBDIR = "crawls/docs-crawl-001"

# Duplicate filter persists to disk too
DUPEFILTER_CLASS = "scrapy.dupefilters.RFPDupeFilter"`}
        </CodeBlock>
      </Collapsible>

      <Callout type="tip">
        Use negative priority values for high-value pages like API references and
        changelogs. In AgentTasks, seed URLs get <Code>priority=-10</Code> to ensure
        they are crawled before any discovered links.
      </Callout>
    </ScrapyPage>
  );
}
