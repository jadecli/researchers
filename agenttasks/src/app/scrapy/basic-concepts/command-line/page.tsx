"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Code } from "@/components/Code";

export default function CommandLinePage() {
  return (
    <ScrapyPage
      breadcrumb="Command Line"
      title="Command Line Tool"
      subtitle="Scrapy ships with a powerful CLI for creating projects, generating spiders, running crawls, and debugging selectors interactively."
      prev={{ label: "Examples", href: "/scrapy/first-steps/examples" }}
      next={{ label: "Spiders", href: "/scrapy/basic-concepts/spiders" }}
    >
      <div className="space-y-6">
        <Collapsible title="Creating a Project" defaultOpen>
          <p className="text-sm text-[#b0aea5] mb-3">
            The <Code>startproject</Code> command scaffolds a full Scrapy project with settings,
            pipelines, and middleware boilerplate. AgentTasks uses this as the foundation for
            every documentation crawler.
          </p>
          <CodeBlock language="bash" title="scaffolding">
{`scrapy startproject agenttasks_crawler
cd agenttasks_crawler`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Generating Spiders">
          <p className="text-sm text-[#b0aea5] mb-3">
            Use <Code>genspider</Code> to create a spider file pre-populated with the target
            domain and a basic template.
          </p>
          <CodeBlock language="bash" title="generate">
{`scrapy genspider docs_spider docs.example.com
# Creates spiders/docs_spider.py with allowed_domains set`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Running a Crawl">
          <p className="text-sm text-[#b0aea5] mb-3">
            The <Code>crawl</Code> command launches a spider by name. Pass <Code>-a</Code> for
            spider arguments and <Code>-o</Code> to write output to a file.
          </p>
          <CodeBlock language="bash" title="crawl">
{`# Basic crawl
scrapy crawl docs_spider

# With arguments and JSON Lines output
scrapy crawl docs_spider -a max_depth=3 -o results.jsonl

# Override settings inline
scrapy crawl docs_spider -s CLOSESPIDER_PAGECOUNT=50`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Listing Spiders">
          <p className="text-sm text-[#b0aea5] mb-3">
            Quickly verify which spiders are registered in the current project.
          </p>
          <CodeBlock language="bash" title="list">
{`scrapy list
# docs_spider
# api_spider
# changelog_spider`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Interactive Shell">
          <p className="text-sm text-[#b0aea5] mb-3">
            The <Code>shell</Code> command opens an interactive session where you can test
            selectors against a live page before writing spider code.
          </p>
          <CodeBlock language="bash" title="shell">
{`scrapy shell "https://docs.scrapy.org/en/latest/"
>>> response.css('title::text').get()
'Scrapy 2.14 documentation'
>>> response.xpath('//h1/text()').getall()`}
          </CodeBlock>
        </Collapsible>

        <div className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl p-4">
          <p className="text-xs text-[#6b6961]">
            All commands accept <Code>--help</Code> for detailed usage. Run{" "}
            <Code>scrapy --version</Code> to confirm your installation.
          </p>
        </div>
      </div>
    </ScrapyPage>
  );
}
