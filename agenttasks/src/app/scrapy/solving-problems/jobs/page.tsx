"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function JobsPage() {
  return (
    <ScrapyPage
      breadcrumb="Jobs"
      title="Jobs: Pause and Resume"
      subtitle="Use JOBDIR to persist crawl state between runs. Pause a crawl with Ctrl+C and resume exactly where you left off."
      prev={{ label: "Benchmarking", href: "/scrapy/solving-problems/benchmarking" }}
      next={{ label: "Coroutines", href: "/scrapy/solving-problems/coroutines" }}
    >
      <div className="space-y-6">
        <Collapsible title="Enabling Job Persistence" defaultOpen>
          <p className="text-sm text-[#b0aea5] mb-3">
            Set <Code>JOBDIR</Code> to a directory path. Scrapy stores the request
            queue, visited URLs, and spider state there.
          </p>
          <CodeBlock language="bash" title="JOBDIR usage">
{`# Start a crawl with persistence
scrapy crawl docs -s JOBDIR=crawls/docs-001

# Press Ctrl+C to pause gracefully
# Scrapy saves pending requests and visited URLs

# Resume by running the same command
scrapy crawl docs -s JOBDIR=crawls/docs-001
# Picks up where it left off`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="What Gets Persisted">
          <p className="text-sm text-[#b0aea5] mb-3">
            JOBDIR stores the scheduler queue (pending requests) and the
            duplicate filter state (visited URLs). Spider attributes are not
            persisted automatically.
          </p>
          <CodeBlock language="bash" title="JOBDIR contents">
{`ls crawls/docs-001/
# requests.queue/    — pending requests (pickle)
# requests.seen      — visited URL fingerprints`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Custom State Persistence">
          <p className="text-sm text-[#b0aea5] mb-3">
            Use <Code>spider.state</Code> dict to persist custom data across
            pause/resume cycles.
          </p>
          <CodeBlock language="python" title="spider state">
{`class DocsSpider(scrapy.Spider):
    name = "docs"

    def parse(self, response):
        # spider.state is auto-persisted with JOBDIR
        self.state.setdefault("processed_count", 0)
        self.state["processed_count"] += 1
        self.logger.info("Total processed: %d",
                         self.state["processed_count"])`}
          </CodeBlock>
        </Collapsible>

        <Callout type="tip">
          For long-running AgentTasks crawls, we use JOBDIR as a safety net.
          If the CI runner times out, the next run resumes automatically.
        </Callout>
      </div>
    </ScrapyPage>
  );
}
