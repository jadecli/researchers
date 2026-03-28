"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function StatsCollectionPage() {
  return (
    <ScrapyPage
      breadcrumb="Stats Collection"
      title="Stats Collection"
      subtitle="Scrapy collects stats during every crawl. Access them via spider.crawler.stats to track quality metrics and crawl health in AgentTasks."
      prev={{ label: "Logging", href: "/scrapy/built-in/logging" }}
      next={{ label: "Telnet Console", href: "/scrapy/built-in/telnet-console" }}
    >
      <div className="space-y-6">
        <Collapsible title="Accessing Stats" defaultOpen>
          <p className="text-sm text-[#b0aea5] mb-3">
            The stats collector is available at <Code>self.crawler.stats</Code>.
            Use <Code>get_value</Code>, <Code>set_value</Code>, and{" "}
            <Code>inc_value</Code> to read and write counters.
          </p>
          <CodeBlock language="python" title="reading stats">
{`def closed(self, reason):
    stats = self.crawler.stats
    pages = stats.get_value("item_scraped_count", 0)
    errors = stats.get_value("log_count/ERROR", 0)
    self.logger.info("Crawled %d pages, %d errors", pages, errors)`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Custom Stats for Quality Tracking">
          <p className="text-sm text-[#b0aea5] mb-3">
            AgentTasks adds custom stats to measure documentation quality scores
            and content completeness per crawl round.
          </p>
          <CodeBlock language="python" title="custom stats">
{`def parse(self, response):
    word_count = len(response.css("article *::text").getall())
    self.crawler.stats.inc_value("agenttasks/total_words", word_count)
    self.crawler.stats.inc_value("agenttasks/pages_processed")

    if word_count < 50:
        self.crawler.stats.inc_value("agenttasks/thin_pages")`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Dumping Stats">
          <p className="text-sm text-[#b0aea5] mb-3">
            Scrapy dumps all stats at the end of a crawl when{" "}
            <Code>STATS_DUMP = True</Code> (the default). You can also access
            the full dict via <Code>stats.get_stats()</Code>.
          </p>
          <CodeBlock language="python" title="pipeline stats">
{`class StatsPipeline:
    def close_spider(self, spider):
        all_stats = spider.crawler.stats.get_stats()
        # Post stats to monitoring dashboard
        post_to_dashboard(all_stats)`}
          </CodeBlock>
        </Collapsible>

        <Callout type="note">
          Stats are stored in memory by default. For distributed crawls, consider
          writing stats to your database in <Code>close_spider</Code>.
        </Callout>
      </div>
    </ScrapyPage>
  );
}
