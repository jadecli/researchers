"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function MemoryLeaksPage() {
  return (
    <ScrapyPage
      breadcrumb="Memory Leaks"
      title="Memory Leaks"
      subtitle="Identify and fix memory leaks in Scrapy spiders using trackref, resource monitoring, and streaming patterns for large responses."
      prev={{ label: "Dynamic Content", href: "/scrapy/solving-problems/dynamic-content" }}
      next={{ label: "Files & Images", href: "/scrapy/solving-problems/files-images" }}
    >
      <div className="space-y-6">
        <Collapsible title="Detecting Leaks with trackref" defaultOpen>
          <p className="text-sm text-[#b0aea5] mb-3">
            Scrapy includes <Code>trackref</Code> to monitor live Request and
            Response objects. Use it via the telnet console to spot accumulation.
          </p>
          <CodeBlock language="python" title="trackref">
{`# In telnet console
>>> import scrapy.utils.trackref as trackref
>>> trackref.print_live_refs()
HtmlResponse    alive: 3    oldest: 12.4s
Request         alive: 47   oldest: 45.2s`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Common Causes">
          <p className="text-sm text-[#b0aea5] mb-3">
            The most frequent causes: storing responses in spider attributes,
            unbounded lists, and keeping references to parsed items.
          </p>
          <CodeBlock language="python" title="leak pattern">
{`# BAD: accumulates all responses in memory
class LeakySpider(scrapy.Spider):
    all_responses = []

    def parse(self, response):
        self.all_responses.append(response)  # leak!

# GOOD: yield items, let Scrapy handle lifecycle
class CleanSpider(scrapy.Spider):
    def parse(self, response):
        yield {"url": response.url, "title": response.css("h1::text").get()}`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Streaming Large Files">
          <p className="text-sm text-[#b0aea5] mb-3">
            For large responses (our 25MB documentation dumps), avoid loading the
            full body into memory. Stream and process in chunks.
          </p>
          <CodeBlock language="python" title="streaming">
{`# settings.py
DOWNLOAD_MAXSIZE = 50 * 1024 * 1024  # 50MB limit
DOWNLOAD_WARNSIZE = 10 * 1024 * 1024  # warn at 10MB

# Use FEEDS with batching
FEEDS = {
    "output/%(batch_id)d.jsonl": {
        "format": "jsonlines",
        "batch_item_count": 100,
    }
}`}
          </CodeBlock>
        </Collapsible>

        <Callout type="warning">
          Monitor RSS memory during long crawls. Set{" "}
          <Code>MEMUSAGE_LIMIT_MB</Code> to auto-shutdown if memory exceeds a
          threshold.
        </Callout>
      </div>
    </ScrapyPage>
  );
}
