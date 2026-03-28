"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";
import { TabGroup } from "@/components/TabGroup";

export default function ExceptionsPage() {
  return (
    <ScrapyPage
      breadcrumb="Exceptions"
      title="Exceptions"
      subtitle="Control flow in Scrapy pipelines and middleware using built-in exceptions. Each exception signals a specific action to the engine."
      prev={{ label: "Settings", href: "/scrapy/basic-concepts/settings" }}
      next={{ label: "Logging", href: "/scrapy/built-in/logging" }}
    >
      <Collapsible title="DropItem" defaultOpen>
        <p className="text-sm text-[#b0aea5] mb-3">
          Raised in a pipeline&apos;s <Code>process_item</Code> to discard an item. The item is not passed
          to subsequent pipelines and is not exported.
        </p>
        <CodeBlock language="python" title="DropItem usage">
{`from scrapy.exceptions import DropItem

class ValidationPipeline:
    def process_item(self, item, spider):
        if not item.get("title"):
            raise DropItem(f"Missing title: {item['url']}")
        return item`}
        </CodeBlock>
      </Collapsible>

      <TabGroup tabs={[
        { label: "IgnoreRequest", content: (
          <div className="space-y-3">
            <p className="text-sm text-[#b0aea5]">
              Raised in downloader middleware to skip a request entirely.
              The request is dropped without downloading.
            </p>
            <CodeBlock language="python">
{`from scrapy.exceptions import IgnoreRequest

class FilterMiddleware:
    def process_request(self, request, spider):
        if request.url.endswith(".pdf"):
            raise IgnoreRequest(f"Skipping PDF: {request.url}")`}
            </CodeBlock>
          </div>
        )},
        { label: "NotConfigured", content: (
          <div className="space-y-3">
            <p className="text-sm text-[#b0aea5]">
              Raised in <Code>from_crawler</Code> to disable a component gracefully.
              The extension or middleware is silently skipped.
            </p>
            <CodeBlock language="python">
{`from scrapy.exceptions import NotConfigured

class OptionalExtension:
    @classmethod
    def from_crawler(cls, crawler):
        if not crawler.settings.getbool("MY_EXT_ENABLED"):
            raise NotConfigured("MY_EXT_ENABLED is False")
        return cls()`}
            </CodeBlock>
          </div>
        )},
        { label: "CloseSpider", content: (
          <div className="space-y-3">
            <p className="text-sm text-[#b0aea5]">
              Raised to shut down the spider immediately. Accepts a <Code>reason</Code> string
              for the close message.
            </p>
            <CodeBlock language="python">
{`from scrapy.exceptions import CloseSpider

class QuotaSpider(scrapy.Spider):
    name = "quota"
    item_count = 0

    def parse(self, response):
        self.item_count += 1
        if self.item_count >= 1000:
            raise CloseSpider("Reached 1000 item quota")
        yield {"url": response.url}`}
            </CodeBlock>
          </div>
        )},
      ]} />

      <Collapsible title="When We Use DropItem" accent="#d97757">
        <p className="text-sm text-[#b0aea5] mb-3">
          Our quality pipeline drops items that score below the configurable threshold. This keeps
          the output JSONL clean and focused on high-value pages.
        </p>
        <CodeBlock language="python" title="Quality gate">
{`from scrapy.exceptions import DropItem

class QualityScoringPipeline:
    def process_item(self, item, spider):
        score = compute_quality(item)
        item["quality_score"] = score

        threshold = spider.settings.getint("QUALITY_THRESHOLD", 40)
        if score < threshold:
            spider.logger.info(
                f"Dropped (score={score}): {item['url']}"
            )
            raise DropItem(f"Quality {score} < {threshold}")

        return item`}
        </CodeBlock>
      </Collapsible>

      <Callout type="note">
        Dropped items are still counted in <Code>scrapy.stats</Code> under the
        key <Code>item_dropped_count</Code>. Use stats to monitor your drop rate.
      </Callout>

      <Collapsible title="Exception Summary" accent="#6a9bcc">
        <p className="text-sm text-[#b0aea5] mb-3">
          Quick reference for where each exception is used and what it does.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-[#2a2a28]">
                <th className="py-2 pr-4 text-[#faf9f5] font-medium">Exception</th>
                <th className="py-2 pr-4 text-[#faf9f5] font-medium">Where</th>
                <th className="py-2 text-[#faf9f5] font-medium">Effect</th>
              </tr>
            </thead>
            <tbody className="text-[#b0aea5]">
              <tr className="border-b border-[#2a2a28]/50">
                <td className="py-2 pr-4"><Code>DropItem</Code></td>
                <td className="py-2 pr-4">Pipeline</td>
                <td className="py-2">Discards the item</td>
              </tr>
              <tr className="border-b border-[#2a2a28]/50">
                <td className="py-2 pr-4"><Code>IgnoreRequest</Code></td>
                <td className="py-2 pr-4">Middleware</td>
                <td className="py-2">Skips the download</td>
              </tr>
              <tr className="border-b border-[#2a2a28]/50">
                <td className="py-2 pr-4"><Code>NotConfigured</Code></td>
                <td className="py-2 pr-4">from_crawler</td>
                <td className="py-2">Disables the component</td>
              </tr>
              <tr>
                <td className="py-2 pr-4"><Code>CloseSpider</Code></td>
                <td className="py-2 pr-4">Spider / Pipeline</td>
                <td className="py-2">Shuts down the spider</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Collapsible>

      <Callout type="tip">
        Always include a descriptive message when raising exceptions. It appears in logs and makes
        debugging much easier during large crawls.
      </Callout>
    </ScrapyPage>
  );
}
