"use client";
import { motion } from "motion/react";
import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

const FEATURES = [
  { name: "Asynchronous I/O", desc: "Built on Twisted, Scrapy handles thousands of concurrent requests without blocking.", color: "#d97757" },
  { name: "Middleware Pipeline", desc: "Intercept and transform requests/responses at every stage of the crawl lifecycle.", color: "#6a9bcc" },
  { name: "Item Pipelines", desc: "Clean, validate, and persist extracted data through composable processing stages.", color: "#788c5d" },
  { name: "Extensible Architecture", desc: "Signals, extensions, and custom schedulers let you reshape Scrapy to fit any workflow.", color: "#d97757" },
];

const SPIDERS = [
  { name: "docs_spider", target: "General documentation sites", pages: "~800" },
  { name: "platform_spider", target: "Platform API references", pages: "~450" },
  { name: "llms_full_spider", target: "LLM provider docs (full crawl)", pages: "~600" },
  { name: "anthropic_spider", target: "Anthropic documentation", pages: "~320" },
  { name: "changelog_spider", target: "Release notes and changelogs", pages: "~180" },
  { name: "search_spider", target: "Search index pages", pages: "~127" },
];

export default function AtAGlancePage() {
  return (
    <ScrapyPage
      breadcrumb="At a Glance"
      title="Scrapy at a Glance"
      subtitle="Scrapy is an open-source framework for extracting structured data from websites. In AgentTasks, we use it to crawl documentation sites and feed content into our multi-agent research pipeline."
      next={{ label: "Installation", href: "/scrapy/first-steps/installation" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="text-lg font-semibold text-[#faf9f5] mb-4">Why Scrapy?</h2>
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-4">
          Documentation crawling demands speed, reliability, and fine-grained control over
          how pages are fetched and parsed. Scrapy provides all three out of the box.
          Its asynchronous engine can crawl hundreds of pages per second while respecting
          rate limits, and its middleware system lets us inject quality scoring and
          deduplication at the framework level.
        </p>
      </motion.div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[#faf9f5] mb-3">Key Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="p-4 rounded-xl border border-[#2a2a28] bg-[#1c1c1b]"
            >
              <div className="w-5 h-1 rounded-full mb-2" style={{ backgroundColor: f.color }} />
              <h3 className="text-sm font-semibold text-[#faf9f5] mb-1">{f.name}</h3>
              <p className="text-[11px] text-[#6b6961] leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <Callout type="tip">
        Scrapy is not a general-purpose HTTP client. It is purpose-built for web scraping
        and crawling, with built-in support for <Code>robots.txt</Code>, request throttling,
        and response caching.
      </Callout>

      <Collapsible title="Our 6 Spiders" accent="#6a9bcc">
        <p className="text-sm text-[#b0aea5] mb-3">
          AgentTasks runs 6 specialized spiders, each targeting a different category of
          documentation. Together they cover 2,477+ pages across multiple domains.
        </p>
        <div className="space-y-2">
          {SPIDERS.map((s) => (
            <div
              key={s.name}
              className="flex items-center justify-between p-3 rounded-lg border border-[#2a2a28] bg-[#141413]"
            >
              <div>
                <span className="text-sm font-mono text-[#d97757]">{s.name}</span>
                <span className="text-xs text-[#6b6961] ml-2">{s.target}</span>
              </div>
              <span className="text-xs font-mono text-[#6b6961]">{s.pages}</span>
            </div>
          ))}
        </div>
      </Collapsible>

      <CodeBlock language="bash" title="List all spiders">
{`cd claude-code && PYTHONPATH=. python3 -m scrapy list

# Output:
# docs_spider
# platform_spider
# llms_full_spider
# anthropic_spider
# changelog_spider
# search_spider`}
      </CodeBlock>

      <Collapsible title="How Scrapy Fits Into AgentTasks">
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          Scrapy sits at the ingestion layer of our pipeline. Spiders crawl target sites,
          extract structured content, and push items through pipelines that score quality,
          deduplicate, and store results in Postgres. Downstream, Claude agents consume
          this data for research tasks.
        </p>
        <div className="text-xs text-[#6b6961] font-mono p-3 bg-[#1c1c1b] rounded-lg border border-[#2a2a28]">
          Spider → Item Pipeline → Quality Scorer → Postgres → Claude Agents
        </div>
      </Collapsible>
    </ScrapyPage>
  );
}
