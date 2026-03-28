"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function FAQPage() {
  return (
    <ScrapyPage
      breadcrumb="FAQ"
      title="Frequently Asked Questions"
      subtitle="Common questions about using Scrapy with AgentTasks, from spider configuration to production deployment."
      prev={{ label: "Telnet Console", href: "/scrapy/built-in/telnet-console" }}
      next={{ label: "Debugging Spiders", href: "/scrapy/solving-problems/debugging-spiders" }}
    >
      <div className="space-y-6">
        <Collapsible title="How do I run multiple spiders at once?" defaultOpen>
          <p className="text-sm text-[#b0aea5] mb-3">
            Use <Code>CrawlerProcess</Code> to run multiple spiders in one process.
            AgentTasks dispatches up to 4 spiders concurrently per crawl round.
          </p>
          <CodeBlock language="python" title="multi-spider">
{`from scrapy.crawler import CrawlerProcess
process = CrawlerProcess()
process.crawl(DocsSpider)
process.crawl(ChangelogSpider)
process.start()`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Why does my spider get blocked?">
          <p className="text-sm text-[#b0aea5] mb-3">
            Set <Code>DOWNLOAD_DELAY</Code>, rotate user agents, and
            respect <Code>robots.txt</Code> via <Code>ROBOTSTXT_OBEY = True</Code>.
          </p>
        </Collapsible>

        <Collapsible title="How do I handle pagination?">
          <p className="text-sm text-[#b0aea5] mb-3">
            Follow next-page links with <Code>response.follow</Code>. Scrapy
            deduplicates URLs automatically via the <Code>DUPEFILTER_CLASS</Code>.
          </p>
          <CodeBlock language="python" title="pagination">
{`def parse(self, response):
    yield from response.follow_all(css="a.next-page")`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Can I store items directly in a database?">
          <p className="text-sm text-[#b0aea5] mb-3">
            Yes. Write an item pipeline with <Code>process_item</Code> that inserts
            into your database. AgentTasks uses a pipeline that writes to Postgres.
          </p>
        </Collapsible>

        <Collapsible title="How do I limit crawl depth?">
          <p className="text-sm text-[#b0aea5] mb-3">
            Set <Code>DEPTH_LIMIT</Code> in settings. AgentTasks uses depth 3 for
            focused crawls and depth 0 (unlimited) for broad documentation sweeps.
          </p>
        </Collapsible>

        <Collapsible title="What Python version does Scrapy require?">
          <p className="text-sm text-[#b0aea5] mb-3">
            Scrapy 2.14 requires Python 3.9+. AgentTasks runs on Python 3.12.
          </p>
        </Collapsible>

        <Callout type="tip">
          Check the Scrapy GitHub issues and Stack Overflow for edge cases not
          covered here.
        </Callout>
      </div>
    </ScrapyPage>
  );
}
