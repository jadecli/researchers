"use client";
import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function ComponentsPage() {
  return (
    <ScrapyPage
      breadcrumb="Components"
      title="Components"
      subtitle="Scrapy components follow a consistent interface pattern: the from_crawler class method for dependency injection, giving every component access to settings, stats, and signals."
      prev={{ label: "Download Handlers", href: "/scrapy/extending/download-handlers" }}
      next={{ label: "Core API", href: "/scrapy/extending/core-api" }}
    >
      <Collapsible title="The from_crawler Pattern" defaultOpen>
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          Almost every Scrapy component -- middleware, pipeline, extension -- is
          instantiated through <Code>from_crawler(cls, crawler)</Code>. The crawler
          object provides access to settings, stats, and the signal dispatcher.
        </p>
        <CodeBlock language="python" title="Standard component pattern">
{`class MyComponent:
    def __init__(self, db_url, timeout):
        self.db_url = db_url
        self.timeout = timeout

    @classmethod
    def from_crawler(cls, crawler):
        return cls(
            db_url=crawler.settings.get("DATABASE_URL"),
            timeout=crawler.settings.getint("TIMEOUT", 30),
        )`}
        </CodeBlock>
      </Collapsible>

      <Callout type="note">
        If a component does not define <Code>from_crawler</Code>, Scrapy falls back
        to calling the constructor with no arguments. Always prefer{" "}
        <Code>from_crawler</Code> for components that need configuration.
      </Callout>

      <Collapsible title="Dependency Injection in AgentTasks">
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          In AgentTasks, every custom component pulls its configuration from crawler
          settings. This means we can change behavior per-spider by overriding
          settings in the spider's <Code>custom_settings</Code> dict.
        </p>
        <CodeBlock language="python" title="Per-spider configuration">
{`class AnthropicSpider(scrapy.Spider):
    name = "anthropic_spider"
    custom_settings = {
        "DATABASE_URL": "postgresql://...",
        "QUALITY_THRESHOLD": 0.7,
        "DOWNLOAD_DELAY": 1.5,
    }

# Components automatically pick up these overrides:
class QualityScorePipeline:
    @classmethod
    def from_crawler(cls, crawler):
        threshold = crawler.settings.getfloat(
            "QUALITY_THRESHOLD", 0.5
        )
        return cls(threshold=threshold)`}
        </CodeBlock>
      </Collapsible>

      <Callout type="tip">
        Use <Code>crawler.stats</Code> inside components to record metrics. Stats
        are available after the crawl finishes and are included in the log output
        automatically.
      </Callout>
    </ScrapyPage>
  );
}
