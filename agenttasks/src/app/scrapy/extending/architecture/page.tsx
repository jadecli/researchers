"use client";
import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function ArchitecturePage() {
  return (
    <ScrapyPage
      breadcrumb="Architecture"
      title="Architecture Overview"
      subtitle="Scrapy's component architecture is built around five core pieces: Engine, Scheduler, Downloader, Spider, and Item Pipeline. Understanding this data flow is essential for extending Scrapy in AgentTasks."
      prev={{ label: "Asyncio", href: "/scrapy/solving-problems/asyncio" }}
      next={{ label: "Add-ons", href: "/scrapy/extending/addons" }}
    >
      <Collapsible title="Data Flow Diagram" defaultOpen>
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          Every request in Scrapy follows a well-defined path through the engine.
          In AgentTasks, we hook into each stage to add quality scoring, deduplication,
          and rate limiting.
        </p>
        <CodeBlock language="text" title="Scrapy architecture flow">
{`Spider           Engine           Scheduler
  |  start_requests  |                 |
  |----------------->| enqueue_request |
  |                  |---------------->|
  |                  | next_request    |
  |                  |<----------------|
  |                  |                 |
  |                  |   Downloader    |
  |                  |---------------->|
  |                  |   Response      |
  |                  |<----------------|
  |   response       |                 |
  |<-----------------|                 |
  |   yield items    |                 |
  |----------------->|  Item Pipeline  |
  |                  |---------------->|`}
        </CodeBlock>
      </Collapsible>

      <Callout type="note">
        The <Code>Engine</Code> is the central coordinator. It connects the Scheduler,
        Downloader, Spider, and Item Pipeline, orchestrating the flow of requests
        and responses through middleware chains at each boundary.
      </Callout>

      <Collapsible title="How AgentTasks Extends Each Component">
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          We customize every layer of the architecture. The Scheduler gets priority
          overrides for high-value documentation pages. The Downloader middleware
          handles DeltaFetch deduplication. Spider middleware injects quality scores.
          Item Pipelines persist to Postgres and trigger downstream Claude agents.
        </p>
        <CodeBlock language="python" title="settings.py (component wiring)">
{`DOWNLOADER_MIDDLEWARES = {
    "agenttasks.middlewares.DeltaFetchMiddleware": 100,
    "agenttasks.middlewares.RateLimitMiddleware": 200,
}

ITEM_PIPELINES = {
    "agenttasks.pipelines.QualityScorePipeline": 100,
    "agenttasks.pipelines.PostgresPipeline": 300,
}

EXTENSIONS = {
    "agenttasks.extensions.CrawlQualityTracker": 500,
}`}
        </CodeBlock>
      </Collapsible>

      <Callout type="tip">
        Run <Code>scrapy settings --get DOWNLOADER_MIDDLEWARES_BASE</Code> to see all
        built-in middleware that Scrapy registers by default. Combine with your custom
        middleware using numeric priority ordering.
      </Callout>
    </ScrapyPage>
  );
}
