"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function TelnetConsolePage() {
  return (
    <ScrapyPage
      breadcrumb="Telnet Console"
      title="Telnet Console"
      subtitle="Scrapy includes a built-in telnet console for runtime inspection of running crawls. Inspect engine state, pause spiders, and debug live."
      prev={{ label: "Stats Collection", href: "/scrapy/built-in/stats-collection" }}
      next={{ label: "FAQ", href: "/scrapy/solving-problems/faq" }}
    >
      <div className="space-y-6">
        <Collapsible title="Enabling the Console" defaultOpen>
          <p className="text-sm text-[#b0aea5] mb-3">
            The telnet console is enabled by default on port 6023. Toggle it with{" "}
            <Code>TELNETCONSOLE_ENABLED</Code> and set the port
            with <Code>TELNETCONSOLE_PORT</Code>.
          </p>
          <CodeBlock language="python" title="settings.py">
{`TELNETCONSOLE_ENABLED = True
TELNETCONSOLE_PORT = [6023, 6073]
TELNETCONSOLE_HOST = "127.0.0.1"`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Connecting and Inspecting">
          <p className="text-sm text-[#b0aea5] mb-3">
            Connect via telnet and use the <Code>engine</Code> object to inspect
            the running crawler state.
          </p>
          <CodeBlock language="bash" title="runtime inspection">
{`telnet localhost 6023
>>> engine.spider.name
'docs'
>>> len(engine.slot.scheduler)
42
>>> engine.spider.crawler.stats.get_stats()
{'item_scraped_count': 128, ...}`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Pausing and Resuming">
          <p className="text-sm text-[#b0aea5] mb-3">
            You can pause and resume the engine directly from the console, useful
            when investigating a misbehaving spider in production.
          </p>
          <CodeBlock language="bash" title="pause/resume">
{`>>> engine.pause()
>>> # inspect state, check memory, etc.
>>> engine.unpause()`}
          </CodeBlock>
        </Collapsible>

        <Callout type="warning">
          Disable the telnet console in production deployments. It provides
          unauthenticated access to the crawl engine and Python interpreter.
        </Callout>
      </div>
    </ScrapyPage>
  );
}
