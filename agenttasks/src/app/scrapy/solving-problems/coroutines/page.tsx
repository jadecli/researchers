"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function CoroutinesPage() {
  return (
    <ScrapyPage
      breadcrumb="Coroutines"
      title="Coroutines"
      subtitle="Scrapy supports async def callbacks and Deferred-based patterns. Use coroutines for cleaner async code in spiders and middlewares."
      prev={{ label: "Jobs", href: "/scrapy/solving-problems/jobs" }}
      next={{ label: "asyncio", href: "/scrapy/solving-problems/asyncio" }}
    >
      <div className="space-y-6">
        <Collapsible title="Async Callbacks" defaultOpen>
          <p className="text-sm text-[#b0aea5] mb-3">
            Define spider callbacks as <Code>async def</Code> to use{" "}
            <Code>await</Code> for async operations within parse methods.
          </p>
          <CodeBlock language="python" title="async spider">
{`import scrapy

class AsyncDocsSpider(scrapy.Spider):
    name = "async_docs"

    async def parse(self, response):
        title = response.css("h1::text").get()
        # Can await async operations
        yield {"title": title, "url": response.url}

        for href in response.css("a::attr(href)").getall():
            yield response.follow(href, self.parse)`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Async Pipelines">
          <p className="text-sm text-[#b0aea5] mb-3">
            Item pipelines can also be async. Use <Code>async def process_item</Code>{" "}
            for non-blocking database writes.
          </p>
          <CodeBlock language="python" title="async pipeline">
{`class AsyncDBPipeline:
    async def process_item(self, item, spider):
        await self.db.insert(item)
        return item

    async def open_spider(self, spider):
        self.db = await connect_to_database()

    async def close_spider(self, spider):
        await self.db.close()`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Deferred vs Coroutine">
          <p className="text-sm text-[#b0aea5] mb-3">
            Scrapy traditionally uses Twisted Deferreds. Coroutines are the modern
            alternative and work seamlessly alongside Deferreds.
          </p>
          <CodeBlock language="python" title="comparison">
{`# Twisted Deferred style (legacy)
from twisted.internet import defer

@defer.inlineCallbacks
def process_item(self, item, spider):
    yield self.db.insert(item)
    defer.returnValue(item)

# Coroutine style (modern, preferred)
async def process_item(self, item, spider):
    await self.db.insert(item)
    return item`}
          </CodeBlock>
        </Collapsible>

        <Callout type="tip">
          AgentTasks uses <Code>async def</Code> for all new spider callbacks and
          pipelines. It produces cleaner code and better error tracebacks.
        </Callout>
      </div>
    </ScrapyPage>
  );
}
