"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { TabGroup } from "@/components/TabGroup";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

const SPIDERS = [
  {
    name: "docs_spider",
    target: "code.claude.com/docs",
    desc: "Crawls Claude Code documentation via llms.txt endpoints. Handles pagination and section splitting.",
  },
  {
    name: "platform_spider",
    target: "platform.claude.com",
    desc: "Crawls Claude Platform docs including API references, SDKs, and Agent SDK documentation.",
  },
  {
    name: "llms_full_spider",
    target: "25MB+ llms-full.txt files",
    desc: "Streams large llms-full.txt files to disk, splits on page boundaries, applies per-segment quality scoring.",
  },
  {
    name: "anthropic_spider",
    target: "anthropic.com sitemap",
    desc: "Full sitemap crawl of anthropic.com. Uses sitemap.xml for URL discovery and respects robots.txt.",
  },
];

export default function UsingSpidersPage() {
  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-2 text-xs text-[#6b6961] mb-3">
          <Link href="/task-creation" className="hover:text-[#d97757]">Creating Tasks</Link>
          <span>/</span>
          <span className="text-[#b0aea5]">Using Spiders</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#faf9f5] mb-3">Using Spiders</h1>
        <p className="text-[#b0aea5] text-base leading-relaxed">
          How to run Scrapy spiders, choose the right spider for your target,
          and bundle custom extractors in your tasks.
        </p>
      </motion.div>

      <Callout type="note">
        All spiders live in <Code>claude-code/scrapy_researchers/spiders/</Code> and extend{" "}
        <Code>base_spider.py</Code> which provides quality scoring hooks and improvement loop integration.
      </Callout>

      {/* Available spiders */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h2 className="text-xs font-semibold text-[#6b6961] uppercase tracking-wider mb-3">
          Available Spiders
        </h2>
        <div className="space-y-3">
          {SPIDERS.map((spider, i) => (
            <motion.div
              key={spider.name}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.06 }}
              className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-mono font-semibold text-[#d97757]">{spider.name}</span>
                <span className="text-[10px] text-[#6b6961] font-mono">{spider.target}</span>
              </div>
              <p className="text-sm text-[#b0aea5] leading-relaxed">{spider.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Running spiders */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h2 className="text-xs font-semibold text-[#6b6961] uppercase tracking-wider mb-3">
          Running a Spider
        </h2>
        <TabGroup tabs={[
          {
            label: "Basic",
            content: (
              <CodeBlock language="bash">{`cd claude-code
PYTHONPATH=. scrapy crawl docs_spider \\
  -o data/round1/output.jsonl`}</CodeBlock>
            ),
          },
          {
            label: "With URL",
            content: (
              <CodeBlock language="bash">{`cd claude-code
PYTHONPATH=. scrapy crawl docs_spider \\
  -a url=https://code.claude.com/docs/llms-full.txt \\
  -o data/round1/output.jsonl`}</CodeBlock>
            ),
          },
          {
            label: "With Quality Gate",
            content: (
              <CodeBlock language="bash">{`cd claude-code
PYTHONPATH=. scrapy crawl docs_spider \\
  -a url=https://code.claude.com/docs/llms.txt \\
  -s QUALITY_THRESHOLD=0.75 \\
  -s DELTAFETCH_ENABLED=True \\
  -o data/round1/output.jsonl`}</CodeBlock>
            ),
          },
        ]} />
      </motion.div>

      {/* Pipeline */}
      <Collapsible title="Extraction Pipeline" defaultOpen={false} accent="#6a9bcc">
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-4">
          Every spider response flows through this pipeline in order:
        </p>
        <CodeBlock language="text" title="Pipeline stages">{`Spider Response
  │
  ├─ MarkdownExtractor    → HTML to clean markdown
  ├─ MetadataExtractor    → title, word count, headings, links
  ├─ SkillExtractor       → detect skill/plugin patterns
  └─ QualityScorer        → 5-dimension score (0.0-1.0)
       │
  DedupPipeline           → skip already-seen URLs
  QualityScoringPipeline  → enforce threshold
  ImprovementFeedback     → generate context delta
       │
  JSONL output → data/roundN/`}</CodeBlock>
      </Collapsible>

      {/* Custom extractors */}
      <Collapsible title="Custom Extractors" defaultOpen={false} accent="#788c5d">
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-4">
          The system includes extractors in 12 languages. Each uses its platform&apos;s idiomatic
          HTML parsing library:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            ["Python", "BeautifulSoup"],
            ["TypeScript", "Cheerio"],
            ["Go", "goquery"],
            ["Rust", "scraper"],
            ["Java", "Jsoup"],
            ["C#", "AngleSharp"],
            ["Kotlin", "coroutines"],
            ["PHP", "DOMDocument"],
            ["Ruby", "Nokogiri"],
            ["Swift", "SwiftSoup"],
            ["Lua", "patterns"],
            ["C++", "libxml2"],
          ].map(([lang, lib]) => (
            <div key={lang} className="bg-[#252524] rounded-lg px-3 py-2">
              <div className="text-xs font-semibold text-[#faf9f5]">{lang}</div>
              <div className="text-[10px] text-[#6b6961] font-mono">{lib}</div>
            </div>
          ))}
        </div>
      </Collapsible>

      <Callout type="tip">
        List all registered spiders with{" "}
        <Code>PYTHONPATH=. python3 -m scrapy list</Code>.
        Currently 4 spiders are available.
      </Callout>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="text-[11px] text-[#6b6961] pt-4 border-t border-[#2a2a28]"
      >
        Back to:{" "}
        <Link href="/task-creation" className="text-[#b0aea5] hover:text-[#d97757]">
          Creating Tasks
        </Link>
        {" · "}
        <Link href="/task-creation/quickstart" className="text-[#b0aea5] hover:text-[#d97757]">
          Quickstart
        </Link>
      </motion.div>
    </div>
  );
}
