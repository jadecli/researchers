"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function ItemsPage() {
  return (
    <ScrapyPage
      breadcrumb="Items"
      title="Items"
      subtitle="Scrapy Items provide a structured container for scraped data, enforcing a schema and enabling validation through Item Pipelines."
      prev={{ label: "Selectors", href: "/scrapy/basic-concepts/selectors" }}
      next={{ label: "Item Loaders", href: "/scrapy/basic-concepts/item-loaders" }}
    >
      <div className="space-y-6">
        <div className="text-sm text-[#b0aea5] space-y-3">
          <p>
            While you can yield plain Python dicts from spiders, <Code>Item</Code> classes
            give you a declared schema, IDE autocompletion, and compatibility with
            item loaders and exporters.
          </p>
          <p>
            Define items by subclassing <Code>scrapy.Item</Code> and declaring each
            field with <Code>scrapy.Field()</Code>.
          </p>
        </div>

        <CodeBlock language="python" title="basic Item definition">
{`import scrapy

class DocPageItem(scrapy.Item):
    url = scrapy.Field()
    title = scrapy.Field()
    content = scrapy.Field()
    timestamp = scrapy.Field()`}
        </CodeBlock>

        <h2 className="text-lg font-semibold text-[#faf9f5]">AgentTasks Crawl Item</h2>
        <p className="text-sm text-[#b0aea5]">
          Our crawl pipeline defines a richer schema with quality scoring and
          structured metadata for downstream processing.
        </p>

        <CodeBlock language="python" title="agenttasks item schema">
{`class CrawlItem(scrapy.Item):
    url = scrapy.Field()
    title = scrapy.Field()
    content_markdown = scrapy.Field()
    quality_score = scrapy.Field()
    metadata = scrapy.Field()  # dict: depth, timestamp, spider_name

    # Usage in a spider:
    # item = CrawlItem()
    # item["url"] = response.url
    # item["title"] = response.css("title::text").get("")
    # item["quality_score"] = compute_score(item["content_markdown"])
    # yield item`}
        </CodeBlock>

        <Callout type="note">
          Items behave like dicts — use <Code>item["field"]</Code> to get and set
          values. Accessing an undeclared field raises <Code>KeyError</Code>, which
          catches typos early.
        </Callout>

        <h2 className="text-lg font-semibold text-[#faf9f5]">Dataclass Items</h2>
        <p className="text-sm text-[#b0aea5]">
          Scrapy 2.7+ also supports Python dataclasses and attrs as item types,
          giving you type hints and default values.
        </p>

        <CodeBlock language="python" title="dataclass item">
{`import scrapy
from dataclasses import dataclass, field

@dataclass
class DocItem:
    url: str = ""
    title: str = ""
    content_markdown: str = ""
    quality_score: float = 0.0
    metadata: dict = field(default_factory=dict)`}
        </CodeBlock>

        <div className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl p-4">
          <p className="text-xs text-[#6b6961]">
            Items flow through the pipeline: Spider yields Item, then each
            pipeline stage can validate, transform, or persist it.
          </p>
        </div>
      </div>
    </ScrapyPage>
  );
}
