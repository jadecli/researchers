"use client";
import { motion } from "motion/react";
import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

const STEPS = [
  { num: "01", title: "Create a Project", color: "#d97757" },
  { num: "02", title: "Write Your First Spider", color: "#6a9bcc" },
  { num: "03", title: "Run the Spider", color: "#788c5d" },
  { num: "04", title: "Export Data", color: "#d97757" },
];

export default function TutorialPage() {
  return (
    <ScrapyPage
      breadcrumb="Tutorial"
      title="Scrapy Tutorial"
      subtitle="Build your first spider in four steps. By the end, you will have a working crawler that extracts documentation pages and exports them as JSON."
      prev={{ label: "Installation", href: "/scrapy/first-steps/installation" }}
      next={{ label: "Examples", href: "/scrapy/first-steps/examples" }}
    >
      <div className="flex gap-2 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.num}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#2a2a28] bg-[#1c1c1b] shrink-0"
          >
            <span className="text-xs font-mono" style={{ color: s.color }}>{s.num}</span>
            <span className="text-xs text-[#b0aea5]">{s.title}</span>
          </motion.div>
        ))}
      </div>

      {/* Step 1 */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-[#faf9f5] flex items-center gap-2">
          <span className="text-[#d97757] font-mono text-sm">01</span>
          Create a Project
        </h2>
        <p className="text-sm text-[#b0aea5] leading-relaxed">
          Scrapy uses a project structure with settings, pipelines, and spider modules.
          The <Code>startproject</Code> command scaffolds everything you need.
        </p>
      </div>

      <CodeBlock language="bash" title="Scaffold a new project">
{`scrapy startproject docs_crawler
cd docs_crawler

# Project structure:
# docs_crawler/
#   scrapy.cfg
#   docs_crawler/
#     __init__.py
#     items.py
#     middlewares.py
#     pipelines.py
#     settings.py
#     spiders/`}
      </CodeBlock>

      {/* Step 2 */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-[#faf9f5] flex items-center gap-2">
          <span className="text-[#6a9bcc] font-mono text-sm">02</span>
          Write Your First Spider
        </h2>
        <p className="text-sm text-[#b0aea5] leading-relaxed">
          A spider is a class that defines how to crawl a site and extract data.
          At minimum, you need <Code>start_urls</Code> and a <Code>parse</Code> method.
        </p>
      </div>

      <CodeBlock language="python" title="spiders/docs_spider.py">
{`import scrapy


class DocsSpider(scrapy.Spider):
    name = "docs"
    start_urls = ["https://docs.example.com/"]

    def parse(self, response):
        # Extract the page title and body text
        yield {
            "url": response.url,
            "title": response.css("h1::text").get(""),
            "content": response.css("article ::text").getall(),
            "word_count": len(
                " ".join(response.css("article ::text").getall()).split()
            ),
        }

        # Follow links to other documentation pages
        for href in response.css("a[href]::attr(href)").getall():
            if href.startswith("/docs/"):
                yield response.follow(href, self.parse)`}
      </CodeBlock>

      <Callout type="tip">
        The <Code>response.follow()</Code> method automatically resolves relative URLs.
        You do not need to build absolute URLs manually — Scrapy handles this
        using the response's base URL.
      </Callout>

      {/* Step 3 */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-[#faf9f5] flex items-center gap-2">
          <span className="text-[#788c5d] font-mono text-sm">03</span>
          Run the Spider
        </h2>
        <p className="text-sm text-[#b0aea5] leading-relaxed">
          Use <Code>scrapy crawl</Code> to run your spider. Scrapy will manage the request
          queue, handle retries, and respect <Code>robots.txt</Code> by default.
        </p>
      </div>

      <CodeBlock language="bash" title="Run the spider">
{`# Basic run — output goes to stdout
scrapy crawl docs

# Run with logging level
scrapy crawl docs --loglevel=INFO

# Limit pages for testing
scrapy crawl docs -s CLOSESPIDER_PAGECOUNT=10`}
      </CodeBlock>

      <Collapsible title="Understanding the Log Output">
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          Scrapy logs every request, response, and item during a crawl. Key lines to watch for:
        </p>
        <div className="space-y-2 text-xs font-mono text-[#6b6961]">
          <div className="p-2 bg-[#141413] rounded border border-[#2a2a28]">
            <span className="text-[#788c5d]">[scrapy.core.engine]</span> Spider opened
          </div>
          <div className="p-2 bg-[#141413] rounded border border-[#2a2a28]">
            <span className="text-[#6a9bcc]">[scrapy.core.scraper]</span> Scraped from &lt;200 https://...&gt;
          </div>
          <div className="p-2 bg-[#141413] rounded border border-[#2a2a28]">
            <span className="text-[#d97757]">[scrapy.statscollectors]</span> Dumping Scrapy stats
          </div>
        </div>
      </Collapsible>

      {/* Step 4 */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-[#faf9f5] flex items-center gap-2">
          <span className="text-[#d97757] font-mono text-sm">04</span>
          Export Data
        </h2>
        <p className="text-sm text-[#b0aea5] leading-relaxed">
          Scrapy supports multiple output formats. Use the <Code>-O</Code> flag to write
          results to a file, or configure feed exports in <Code>settings.py</Code>.
        </p>
      </div>

      <CodeBlock language="bash" title="Export to JSON or CSV">
{`# Export as JSON (overwrites existing file)
scrapy crawl docs -O output.json

# Export as JSON Lines (one JSON object per line)
scrapy crawl docs -O output.jsonl

# Export as CSV
scrapy crawl docs -O output.csv`}
      </CodeBlock>

      <Callout type="note">
        In AgentTasks, we do not use file exports. Instead, our item pipelines
        write directly to Postgres via <Code>psycopg2</Code>, with quality scores
        computed inline during the crawl.
      </Callout>

      <Collapsible title="Next Steps">
        <p className="text-sm text-[#b0aea5] leading-relaxed">
          Now that you have a working spider, explore the <strong className="text-[#faf9f5]">Examples</strong> page
          to see how AgentTasks structures its production spiders. From there, dive into
          Basic Concepts to learn about selectors, items, and pipelines in depth.
        </p>
      </Collapsible>
    </ScrapyPage>
  );
}
