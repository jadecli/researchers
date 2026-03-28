"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";
import { TabGroup } from "@/components/TabGroup";

export default function ItemPipelinePage() {
  return (
    <ScrapyPage
      breadcrumb="Item Pipeline"
      title="Item Pipeline"
      subtitle="Process, validate, and persist items after extraction. Pipelines are the bridge between raw scraped data and your storage layer."
      prev={{ label: "Shell", href: "/scrapy/basic-concepts/shell" }}
      next={{ label: "Feed Exports", href: "/scrapy/basic-concepts/feed-exports" }}
    >
      <Collapsible title="Pipeline Methods" defaultOpen>
        <p className="text-sm text-[#b0aea5] mb-3">
          Every pipeline implements one or more of these methods. The <Code>process_item</Code> method
          is required; <Code>open_spider</Code> and <Code>close_spider</Code> are optional lifecycle hooks.
        </p>
        <CodeBlock language="python" title="Pipeline skeleton">
{`class MyPipeline:
    def open_spider(self, spider):
        """Called when the spider opens — init resources."""
        self.conn = db_connect()

    def close_spider(self, spider):
        """Called when the spider closes — cleanup."""
        self.conn.close()

    def process_item(self, item, spider):
        """Called for every item. Must return item or raise DropItem."""
        if not item.get("url"):
            raise DropItem("Missing URL")
        return item`}
        </CodeBlock>
      </Collapsible>

      <Callout type="note">
        Pipelines run in the order defined by <Code>ITEM_PIPELINES</Code> — lower numbers execute first.
        A pipeline returning an item passes it to the next pipeline in the chain.
      </Callout>

      <Collapsible title="Our DedupPipeline" accent="#6a9bcc">
        <p className="text-sm text-[#b0aea5] mb-3">
          Prevents re-processing pages we have already crawled in previous runs by tracking URL fingerprints.
        </p>
        <CodeBlock language="python" title="pipelines/dedup.py">
{`class DedupPipeline:
    def open_spider(self, spider):
        self.seen = set()

    def process_item(self, item, spider):
        fp = fingerprint(item["url"])
        if fp in self.seen:
            raise DropItem(f"Duplicate: {item['url']}")
        self.seen.add(fp)
        return item`}
        </CodeBlock>
      </Collapsible>

      <Collapsible title="Our QualityScoringPipeline" accent="#788c5d">
        <p className="text-sm text-[#b0aea5] mb-3">
          Assigns a quality score (0-100) based on content length, heading structure, and code example density.
          Items below <Code>QUALITY_THRESHOLD</Code> are dropped.
        </p>
        <CodeBlock language="python" title="pipelines/quality.py">
{`class QualityScoringPipeline:
    def process_item(self, item, spider):
        score = compute_quality(item)
        item["quality_score"] = score
        threshold = spider.settings.getint("QUALITY_THRESHOLD", 40)
        if score < threshold:
            raise DropItem(f"Low quality ({score}): {item['url']}")
        return item`}
        </CodeBlock>
      </Collapsible>

      <Collapsible title="Our ImprovementFeedbackPipeline" accent="#d97757">
        <p className="text-sm text-[#b0aea5] mb-3">
          Emits structured improvement suggestions into the JSONL output for pages that score below 70.
        </p>
        <CodeBlock language="python" title="pipelines/feedback.py">
{`class ImprovementFeedbackPipeline:
    def process_item(self, item, spider):
        if item.get("quality_score", 100) < 70:
            item["improvements"] = suggest_improvements(item)
        return item`}
        </CodeBlock>
      </Collapsible>

      <TabGroup tabs={[
        { label: "Pipeline Order", content: (
          <CodeBlock language="python" title="settings.py">
{`ITEM_PIPELINES = {
    "pipelines.dedup.DedupPipeline": 100,
    "pipelines.quality.QualityScoringPipeline": 200,
    "pipelines.feedback.ImprovementFeedbackPipeline": 300,
}`}
          </CodeBlock>
        )},
        { label: "Enabling Per-Spider", content: (
          <CodeBlock language="python" title="spiders/llms_full.py">
{`class LlmsFullSpider(scrapy.Spider):
    custom_settings = {
        "ITEM_PIPELINES": {
            "pipelines.quality.QualityScoringPipeline": 200,
        }
    }`}
          </CodeBlock>
        )},
      ]} />

      <Callout type="tip">
        Keep pipelines small and focused. Each should do one thing — dedup, score, persist — so you
        can reorder or disable them independently per spider.
      </Callout>
    </ScrapyPage>
  );
}
