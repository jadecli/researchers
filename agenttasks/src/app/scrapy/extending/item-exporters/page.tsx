"use client";
import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function ItemExportersPage() {
  return (
    <ScrapyPage
      breadcrumb="Item Exporters"
      title="Item Exporters"
      subtitle="Item Exporters serialize scraped items into output formats like JSON Lines, CSV, or XML. Scrapy provides built-in exporters and supports custom implementations."
      prev={{ label: "Scheduler", href: "/scrapy/extending/scheduler" }}
      next={{ label: "Download Handlers", href: "/scrapy/extending/download-handlers" }}
    >
      <Collapsible title="Built-in Exporters" defaultOpen>
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          Scrapy ships with <Code>JsonLinesItemExporter</Code>,{" "}
          <Code>JsonItemExporter</Code>, <Code>CsvItemExporter</Code>, and{" "}
          <Code>XmlItemExporter</Code>. The JSON Lines format is most common for
          large crawls because it supports streaming writes.
        </p>
        <CodeBlock language="bash" title="Feed export via CLI">
{`# Export to JSON Lines
scrapy crawl docs -O output.jsonl

# Export to CSV
scrapy crawl docs -O output.csv

# Multiple outputs simultaneously
scrapy crawl docs -O items.jsonl -O items.csv`}
        </CodeBlock>
      </Collapsible>

      <Callout type="note">
        The <Code>-O</Code> flag overwrites existing files. Use <Code>-o</Code> (lowercase)
        to append. For production crawls, AgentTasks always uses <Code>-O</Code> to ensure
        clean output per run.
      </Callout>

      <Collapsible title="Our JSONL Format">
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          AgentTasks uses a custom JSONL exporter that adds crawl metadata to every
          line: timestamp, spider name, and quality score. Downstream Claude agents
          parse this format directly.
        </p>
        <CodeBlock language="python" title="agenttasks/exporters.py">
{`from scrapy.exporters import JsonLinesItemExporter
from datetime import datetime, timezone

class AgentTasksExporter(JsonLinesItemExporter):
    def export_item(self, item):
        item["_crawled_at"] = datetime.now(timezone.utc).isoformat()
        item["_spider"] = self.spider_name
        item["_quality"] = item.get("quality_score", 0)
        return super().export_item(item)`}
        </CodeBlock>
      </Collapsible>

      <Callout type="tip">
        Configure feed exports in <Code>settings.py</Code> with the <Code>FEEDS</Code> dict
        for more control over format, encoding, and storage backend. You can export to
        S3, GCS, or FTP in addition to local files.
      </Callout>
    </ScrapyPage>
  );
}
