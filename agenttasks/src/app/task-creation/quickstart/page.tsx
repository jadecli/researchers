"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

const STEPS = [
  {
    num: 1,
    title: "Define your task",
    desc: "Create a task definition using the TodoWrite schema. Each task needs a content description and a status.",
  },
  {
    num: 2,
    title: "Configure a spider",
    desc: "Point a Scrapy spider at your target documentation URL. The spider handles extraction automatically.",
  },
  {
    num: 3,
    title: "Run the crawl",
    desc: "Execute the spider with quality scoring enabled. Results are stored as JSONL in data/roundN/.",
  },
  {
    num: 4,
    title: "Review quality scores",
    desc: "Check the 5-dimension quality scores. Scores above 0.65 pass; aim for 0.75+ for production use.",
  },
];

export default function QuickstartPage() {
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
          <span className="text-[#b0aea5]">Quickstart</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#faf9f5] mb-3">Quickstart</h1>
        <p className="text-[#b0aea5] text-base leading-relaxed">
          Create your first Agent Task and see it execute a documentation crawl. This guide takes about 5 minutes.
        </p>
      </motion.div>

      <Callout type="note">
        You&apos;ll need Python 3.12+ with <Code>uv</Code> and Node.js 20+ installed. The crawl engine uses Scrapy 2.14.
      </Callout>

      {/* Steps */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h2 className="text-xs font-semibold text-[#6b6961] uppercase tracking-wider mb-3">Steps</h2>
        <div className="space-y-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
              className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl p-4 flex gap-4"
            >
              <span className="text-2xl font-bold text-[#d97757] shrink-0">{step.num}</span>
              <div>
                <h3 className="text-sm font-semibold text-[#faf9f5]">{step.title}</h3>
                <p className="text-sm text-[#b0aea5] mt-1 leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Task definition example */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h2 className="text-xs font-semibold text-[#6b6961] uppercase tracking-wider mb-3">
          Task Definition
        </h2>
        <p className="text-sm text-[#b0aea5] mb-4">
          Create a <Code>task.json</Code> file with your crawl task:
        </p>
        <CodeBlock language="json">{`{
  "todos": [
    {
      "content": "Crawl code.claude.com/docs/llms.txt",
      "status": "pending"
    }
  ]
}`}</CodeBlock>
      </motion.div>

      {/* Run command */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h2 className="text-xs font-semibold text-[#6b6961] uppercase tracking-wider mb-3">
          Run the Crawl
        </h2>
        <CodeBlock language="bash">{`cd claude-code
uv pip install -r requirements.txt
PYTHONPATH=. scrapy crawl docs_spider -a url=https://code.claude.com/docs/llms.txt -o data/round1/output.jsonl`}</CodeBlock>
      </motion.div>

      {/* Output example */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h2 className="text-xs font-semibold text-[#6b6961] uppercase tracking-wider mb-3">
          Example Output
        </h2>
        <p className="text-sm text-[#b0aea5] mb-4">
          Each crawled page produces a structured JSONL item with quality scores:
        </p>
        <CodeBlock language="json">{`{
  "url": "https://code.claude.com/docs/en/skills",
  "title": "Extend Claude with skills",
  "content_markdown": "# Skills\\n\\nSkills extend what Claude can do...",
  "quality_score": 0.81,
  "metadata": {
    "source": "llms-full-code",
    "word_count": 3420,
    "code_block_count": 8
  }
}`}</CodeBlock>
      </motion.div>

      <Callout type="tip">
        A quality score above <strong className="text-[#faf9f5]">0.75</strong> is good for production use.
        If your scores are lower, see{" "}
        <Link href="/task-creation/optimizing-targets" className="text-[#d97757] hover:underline">
          Optimizing Targets
        </Link>.
      </Callout>

      {/* Next steps */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="text-[11px] text-[#6b6961] pt-4 border-t border-[#2a2a28]"
      >
        Next:{" "}
        <Link href="/task-creation/best-practices" className="text-[#b0aea5] hover:text-[#d97757]">
          Best Practices
        </Link>
        {" · "}
        <Link href="/task-creation/using-spiders" className="text-[#b0aea5] hover:text-[#d97757]">
          Using Spiders
        </Link>
      </motion.div>
    </div>
  );
}
