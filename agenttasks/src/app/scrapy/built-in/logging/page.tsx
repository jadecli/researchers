"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function LoggingPage() {
  return (
    <ScrapyPage
      breadcrumb="Logging"
      title="Logging"
      subtitle="Scrapy uses Python's built-in logging module. Control verbosity per-spider or globally to keep AgentTasks crawl output actionable."
      prev={{ label: "Exceptions", href: "/scrapy/basic-concepts/exceptions" }}
      next={{ label: "Stats Collection", href: "/scrapy/built-in/stats-collection" }}
    >
      <div className="space-y-6">
        <Collapsible title="Log Levels" defaultOpen>
          <p className="text-sm text-[#b0aea5] mb-3">
            Set <Code>LOG_LEVEL</Code> in settings to filter output. Common levels
            from most to least verbose: <Code>DEBUG</Code>, <Code>INFO</Code>,{" "}
            <Code>WARNING</Code>, <Code>ERROR</Code>, <Code>CRITICAL</Code>.
          </p>
          <CodeBlock language="python" title="settings.py">
{`# Only show warnings and above in production
LOG_LEVEL = "WARNING"

# Write logs to file instead of stdout
LOG_FILE = "crawl.log"
LOG_FILE_APPEND = False`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Per-Spider Logging">
          <p className="text-sm text-[#b0aea5] mb-3">
            Each spider has a <Code>self.logger</Code> instance. Use it to emit
            structured messages tied to the spider name.
          </p>
          <CodeBlock language="python" title="spider logging">
{`import scrapy

class DocsSpider(scrapy.Spider):
    name = "docs"

    def parse(self, response):
        self.logger.info("Parsing %s (%d bytes)",
                         response.url, len(response.body))
        if response.status != 200:
            self.logger.warning("Non-200: %s", response.url)`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Custom Log Format">
          <p className="text-sm text-[#b0aea5] mb-3">
            Override <Code>LOG_FORMAT</Code> and <Code>LOG_DATEFORMAT</Code> to
            match your observability stack.
          </p>
          <CodeBlock language="python" title="settings.py">
{`LOG_FORMAT = "%(asctime)s [%(name)s] %(levelname)s: %(message)s"
LOG_DATEFORMAT = "%Y-%m-%d %H:%M:%S"`}
          </CodeBlock>
        </Collapsible>

        <Callout type="tip">
          In AgentTasks, we set <Code>LOG_LEVEL = &quot;INFO&quot;</Code> during development
          and <Code>WARNING</Code> in CI to keep GitHub Actions logs clean.
        </Callout>
      </div>
    </ScrapyPage>
  );
}
