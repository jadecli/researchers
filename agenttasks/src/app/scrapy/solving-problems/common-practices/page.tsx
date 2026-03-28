"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function CommonPracticesPage() {
  return (
    <ScrapyPage
      breadcrumb="Common Practices"
      title="Common Practices"
      subtitle="Patterns for running Scrapy from scripts, distributing crawls across processes, and persisting crawl state between runs."
      prev={{ label: "Contracts", href: "/scrapy/solving-problems/contracts" }}
      next={{ label: "Broad Crawls", href: "/scrapy/solving-problems/broad-crawls" }}
    >
      <div className="space-y-6">
        <Collapsible title="Running from a Script" defaultOpen>
          <p className="text-sm text-[#b0aea5] mb-3">
            Use <Code>CrawlerProcess</Code> to embed Scrapy in a Python script.
            AgentTasks triggers crawls this way from its orchestration layer.
          </p>
          <CodeBlock language="python" title="script runner">
{`from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings

process = CrawlerProcess(get_project_settings())
process.crawl("docs", max_depth=3)
process.start()  # blocks until crawl finishes`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Distributing Crawls">
          <p className="text-sm text-[#b0aea5] mb-3">
            For large documentation sites, split URL lists across multiple spider
            instances using <Code>-a</Code> arguments or a shared queue.
          </p>
          <CodeBlock language="python" title="url partitioning">
{`class DocsSpider(scrapy.Spider):
    name = "docs"

    def __init__(self, partition=0, total=4, **kwargs):
        super().__init__(**kwargs)
        self.partition = int(partition)
        self.total = int(total)

    def start_requests(self):
        for i, url in enumerate(self.url_list):
            if i % self.total == self.partition:
                yield scrapy.Request(url)`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Keeping Crawl State">
          <p className="text-sm text-[#b0aea5] mb-3">
            Use <Code>JOBDIR</Code> to persist the request queue and visited URLs
            between runs. This enables pause-and-resume workflows.
          </p>
          <CodeBlock language="bash" title="stateful crawl">
{`scrapy crawl docs -s JOBDIR=crawls/docs-round4
# Ctrl+C to pause, re-run same command to resume`}
          </CodeBlock>
        </Collapsible>

        <Callout type="tip">
          AgentTasks stores crawl state in Postgres rather than JOBDIR, enabling
          multi-process resume across CI runs.
        </Callout>
      </div>
    </ScrapyPage>
  );
}
