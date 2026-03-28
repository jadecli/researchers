"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";
import { TabGroup } from "@/components/TabGroup";

export default function FeedExportsPage() {
  return (
    <ScrapyPage
      breadcrumb="Feed Exports"
      title="Feed Exports"
      subtitle="Serialize scraped items into structured output files. Scrapy supports JSONL, JSON, CSV, and XML out of the box."
      prev={{ label: "Item Pipeline", href: "/scrapy/basic-concepts/item-pipeline" }}
      next={{ label: "Requests & Responses", href: "/scrapy/basic-concepts/requests-responses" }}
    >
      <Collapsible title="Export Formats" defaultOpen>
        <p className="text-sm text-[#b0aea5] mb-3">
          Use the <Code>-o</Code> flag to export items. The file extension determines the format.
          Append <Code>-O</Code> (uppercase) to overwrite instead of append.
        </p>
        <CodeBlock language="bash" title="Command line">
{`# JSONL (one JSON object per line — our default)
scrapy crawl docs -o output.jsonl

# JSON (single array)
scrapy crawl docs -o output.json

# CSV (tabular)
scrapy crawl docs -o output.csv

# XML
scrapy crawl docs -o output.xml`}
        </CodeBlock>
      </Collapsible>

      <TabGroup tabs={[
        { label: "JSONL", content: (
          <div className="space-y-3">
            <p className="text-sm text-[#b0aea5]">
              One JSON object per line. Best for streaming, append-friendly, and easy to process with <Code>jq</Code>.
            </p>
            <CodeBlock language="json" title="output.jsonl">
{`{"url": "https://docs.example.com/intro", "title": "Introduction", "quality_score": 82}
{"url": "https://docs.example.com/setup", "title": "Setup Guide", "quality_score": 91}`}
            </CodeBlock>
          </div>
        )},
        { label: "JSON", content: (
          <div className="space-y-3">
            <p className="text-sm text-[#b0aea5]">
              A single JSON array. Must fit in memory. Not append-friendly across runs.
            </p>
            <CodeBlock language="json" title="output.json">
{`[
  {"url": "https://docs.example.com/intro", "title": "Introduction"},
  {"url": "https://docs.example.com/setup", "title": "Setup Guide"}
]`}
            </CodeBlock>
          </div>
        )},
        { label: "CSV", content: (
          <div className="space-y-3">
            <p className="text-sm text-[#b0aea5]">
              Flat tabular format. Works well for simple items but struggles with nested fields.
            </p>
            <CodeBlock language="csv" title="output.csv">
{`url,title,quality_score
https://docs.example.com/intro,Introduction,82
https://docs.example.com/setup,Setup Guide,91`}
            </CodeBlock>
          </div>
        )},
      ]} />

      <Callout type="tip">
        We use JSONL exclusively. It handles nested fields (like <Code>improvements</Code> arrays),
        supports append across iterative runs, and works naturally with line-oriented tools.
      </Callout>

      <Collapsible title="Our JSONL Output Pattern" accent="#788c5d">
        <p className="text-sm text-[#b0aea5] mb-3">
          Every crawl appends to a timestamped JSONL file. The quality pipeline enriches each line
          before it hits disk.
        </p>
        <CodeBlock language="bash" title="Typical invocation">
{`scrapy crawl llms_full \\
  -o "output/crawl_$(date +%Y%m%d_%H%M%S).jsonl" \\
  -s QUALITY_THRESHOLD=40 \\
  -s DELTAFETCH_ENABLED=true`}
        </CodeBlock>
      </Collapsible>

      <Collapsible title="Feed Settings" accent="#6a9bcc">
        <p className="text-sm text-[#b0aea5] mb-3">
          Configure exports programmatically via <Code>FEEDS</Code> in settings or per-spider <Code>custom_settings</Code>.
        </p>
        <CodeBlock language="python" title="settings.py">
{`FEEDS = {
    "output/%(name)s_%(time)s.jsonl": {
        "format": "jsonlines",
        "encoding": "utf-8",
        "overwrite": False,
        "fields": ["url", "title", "content", "quality_score"],
    },
}`}
        </CodeBlock>
      </Collapsible>

      <Callout type="note">
        The <Code>fields</Code> key controls which item fields are exported and in what order.
        Omit it to export all fields.
      </Callout>
    </ScrapyPage>
  );
}
