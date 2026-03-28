"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function AsyncioPage() {
  return (
    <ScrapyPage
      breadcrumb="asyncio"
      title="asyncio"
      subtitle="Scrapy can run on the asyncio event loop via TWISTED_REACTOR. This enables integration with asyncio libraries like aiohttp and asyncpg."
      prev={{ label: "Coroutines", href: "/scrapy/solving-problems/coroutines" }}
      next={{ label: "Architecture", href: "/scrapy/extending/architecture" }}
    >
      <div className="space-y-6">
        <Collapsible title="Enabling asyncio Reactor" defaultOpen>
          <p className="text-sm text-[#b0aea5] mb-3">
            Set <Code>TWISTED_REACTOR</Code> in settings to switch from the
            default Twisted reactor to the asyncio-based one.
          </p>
          <CodeBlock language="python" title="settings.py">
{`TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"

# Must be set before Scrapy starts — typically in settings.py
# Cannot be changed at runtime`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Using asyncio Libraries">
          <p className="text-sm text-[#b0aea5] mb-3">
            With the asyncio reactor, you can use any asyncio-compatible library
            directly in your spider callbacks and pipelines.
          </p>
          <CodeBlock language="python" title="asyncio integration">
{`import asyncpg

class AsyncPGPipeline:
    async def open_spider(self, spider):
        self.pool = await asyncpg.create_pool(
            "postgresql://user:pass@localhost/agenttasks"
        )

    async def process_item(self, item, spider):
        async with self.pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO pages (url, title) VALUES ($1, $2)",
                item["url"], item["title"],
            )
        return item

    async def close_spider(self, spider):
        await self.pool.close()`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Compatibility Notes">
          <p className="text-sm text-[#b0aea5] mb-3">
            Most Scrapy extensions work with the asyncio reactor. Some older
            Twisted-only extensions may need updates.
          </p>
          <CodeBlock language="python" title="event loop access">
{`import asyncio

class MySpider(scrapy.Spider):
    name = "my_spider"

    async def parse(self, response):
        loop = asyncio.get_event_loop()
        # Use asyncio primitives directly
        result = await asyncio.gather(
            self.fetch_metadata(response.url),
            self.check_links(response),
        )
        yield {"url": response.url, "metadata": result[0]}`}
          </CodeBlock>
        </Collapsible>

        <Callout type="note">
          AgentTasks runs with the asyncio reactor to leverage <Code>asyncpg</Code>{" "}
          for high-throughput database writes during crawl rounds.
        </Callout>
      </div>
    </ScrapyPage>
  );
}
