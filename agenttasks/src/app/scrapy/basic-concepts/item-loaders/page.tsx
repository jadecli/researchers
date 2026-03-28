"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function ItemLoadersPage() {
  return (
    <ScrapyPage
      breadcrumb="Item Loaders"
      title="Item Loaders"
      subtitle="Item Loaders provide a declarative way to populate Items, applying input and output processors to clean and normalize scraped data."
      prev={{ label: "Items", href: "/scrapy/basic-concepts/items" }}
      next={{ label: "Shell", href: "/scrapy/basic-concepts/shell" }}
    >
      <div className="space-y-6">
        <div className="text-sm text-[#b0aea5] space-y-3">
          <p>
            Instead of manually assigning each field, <Code>ItemLoader</Code> collects
            raw values with <Code>add_css</Code>, <Code>add_xpath</Code>, and{" "}
            <Code>add_value</Code>, then applies processors when you call{" "}
            <Code>load_item()</Code>.
          </p>
        </div>

        <CodeBlock language="python" title="basic loader usage">
{`from scrapy.loader import ItemLoader
from myproject.items import DocPageItem

def parse_page(self, response):
    loader = ItemLoader(item=DocPageItem(), response=response)
    loader.add_css("title", "h1::text")
    loader.add_css("content", "article::text")
    loader.add_value("url", response.url)
    loader.add_value("timestamp", datetime.utcnow().isoformat())
    yield loader.load_item()`}
        </CodeBlock>

        <h2 className="text-lg font-semibold text-[#faf9f5]">Processors</h2>
        <p className="text-sm text-[#b0aea5]">
          Processors transform collected values. Input processors run when values
          are added; output processors run at <Code>load_item()</Code> time.
        </p>

        <CodeBlock language="python" title="built-in processors">
{`from itemloaders.processors import TakeFirst, MapCompose, Join
from w3lib.html import remove_tags

class DocPageLoader(ItemLoader):
    default_item_class = DocPageItem

    # Output: take the first non-null value
    title_out = TakeFirst()

    # Input: strip HTML tags, then strip whitespace
    content_in = MapCompose(remove_tags, str.strip)

    # Output: join all fragments into one string
    content_out = Join("\\n")

    # Always take first for URL
    url_out = TakeFirst()`}
        </CodeBlock>

        <Callout type="tip">
          <Code>TakeFirst</Code> is the most common output processor. It returns
          the first non-empty value, matching the behavior of{" "}
          <Code>.get()</Code> on selectors.
        </Callout>

        <h2 className="text-lg font-semibold text-[#faf9f5]">AgentTasks Loader</h2>
        <p className="text-sm text-[#b0aea5]">
          Our loaders add markdown conversion as an input processor and quality
          scoring as a post-load step.
        </p>

        <CodeBlock language="python" title="custom loader">
{`class CrawlItemLoader(ItemLoader):
    default_item_class = CrawlItem
    title_out = TakeFirst()
    url_out = TakeFirst()
    content_markdown_in = MapCompose(remove_tags, to_markdown)
    content_markdown_out = Join("\\n\\n")
    quality_score_out = TakeFirst()`}
        </CodeBlock>

        <div className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl p-4">
          <p className="text-xs text-[#6b6961]">
            Loaders keep spider code clean by separating extraction logic from
            data cleaning. Define processors once, reuse across spiders.
          </p>
        </div>
      </div>
    </ScrapyPage>
  );
}
