"use client";
import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function CoreApiPage() {
  return (
    <ScrapyPage
      breadcrumb="Core API"
      title="Core API"
      subtitle="The Core API provides programmatic access to Scrapy's crawl engine. Use Crawler, CrawlerProcess, and CrawlerRunner to run spiders from Python scripts instead of the command line."
      prev={{ label: "Components", href: "/scrapy/extending/components" }}
      next={{ label: "Release Notes", href: "/scrapy/reference/release-notes" }}
    >
      <Collapsible title="CrawlerProcess vs CrawlerRunner" defaultOpen>
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          <Code>CrawlerProcess</Code> manages the Twisted reactor for you -- use it
          in standalone scripts. <Code>CrawlerRunner</Code> assumes you manage the
          reactor yourself, which is better for integration into existing applications.
        </p>
        <CodeBlock language="python" title="Running a spider programmatically">
{`from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings

process = CrawlerProcess(get_project_settings())
process.crawl("docs_spider")
process.start()  # blocks until crawl finishes`}
        </CodeBlock>
      </Collapsible>

      <Callout type="note">
        <Code>CrawlerProcess.start()</Code> can only be called once per Python process
        because the Twisted reactor cannot be restarted. Use <Code>CrawlerRunner</Code> with
        an external reactor if you need to run multiple sequential crawls.
      </Callout>

      <Collapsible title="Running Multiple Spiders">
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          AgentTasks runs all 6 spiders in a single process using{" "}
          <Code>CrawlerRunner</Code>. Each spider gets its own Crawler instance with
          independent settings, stats, and signal dispatchers.
        </p>
        <CodeBlock language="python" title="agenttasks/run_crawl.py">
{`from twisted.internet import reactor, defer
from scrapy.crawler import CrawlerRunner
from scrapy.utils.project import get_project_settings

SPIDERS = [
    "docs_spider", "platform_spider",
    "llms_full_spider", "anthropic_spider",
    "changelog_spider", "search_spider",
]

@defer.inlineCallbacks
def crawl_all():
    runner = CrawlerRunner(get_project_settings())
    for spider_name in SPIDERS:
        yield runner.crawl(spider_name)
    reactor.stop()

crawl_all()
reactor.run()`}
        </CodeBlock>
      </Collapsible>

      <Callout type="tip">
        Access the <Code>Crawler</Code> object after a crawl to inspect stats:
        use <Code>crawler.stats.get_stats()</Code> to get a dict of all collected
        metrics, including item counts, response status codes, and timing data.
      </Callout>
    </ScrapyPage>
  );
}
