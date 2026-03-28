"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { CodeBlock } from "@/components/CodeBlock";

const PRACTICES = [
  {
    title: "Scope tasks narrowly",
    accent: "#d97757",
    content: "Each task should target a single documentation source or a single spider. Avoid tasks that crawl multiple unrelated sites — instead, create separate tasks and let the dispatch coordinator handle parallelism. A well-scoped task produces 10-200 pages with consistent quality.",
  },
  {
    title: "Set quality thresholds explicitly",
    accent: "#6a9bcc",
    content: "Define a minimum quality score (0.65 is the default threshold, 0.75 for production). Tasks that fall below the threshold should trigger a context delta for the next round rather than being accepted silently. Use the QualityScoringPipeline to enforce this.",
  },
  {
    title: "Use context deltas for iteration",
    accent: "#788c5d",
    content: "After each round, generate a context delta that captures new_patterns, failing_targets, and quality_trajectory. Feed this delta into the next round's spider configuration. This is the core improvement loop — without it, repeated crawls produce diminishing returns.",
  },
  {
    title: "Prefer llms.txt over sitemap crawling",
    accent: "#d97757",
    content: "When available, llms.txt and llms-full.txt files provide pre-structured content that scores 10-15% higher than HTML extraction. Always check for these files first (HEAD request to /llms.txt) before falling back to sitemap-based crawling.",
  },
  {
    title: "Design for idempotency",
    accent: "#6a9bcc",
    content: "Tasks should be safe to re-run. Use the DedupPipeline to skip already-crawled URLs and the DeltaFetch middleware to only process changed pages. Store content hashes in the Neon runtime schema and compare before writing.",
  },
];

export default function BestPracticesPage() {
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
          <span className="text-[#b0aea5]">Best Practices</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#faf9f5] mb-3">Best Practices</h1>
        <p className="text-[#b0aea5] text-base leading-relaxed">
          How to write tasks that are well-scoped, reliable, and calibrated to produce
          consistently high-quality structured outputs from documentation crawls.
        </p>
      </motion.div>

      <div className="space-y-2">
        {PRACTICES.map((practice, i) => (
          <motion.div
            key={practice.title}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: 0.05 + i * 0.05 }}
          >
            <Collapsible
              title={practice.title}
              defaultOpen={i === 0}
              accent={practice.accent}
            >
              <p className="text-sm text-[#b0aea5] leading-relaxed">
                {practice.content}
              </p>
            </Collapsible>
          </motion.div>
        ))}
      </div>

      <Callout type="warning">
        Avoid crawling more than 500 pages in a single task. Large crawls should be split
        across multiple rounds with quality checkpoints between each.
      </Callout>

      <CodeBlock language="json" title="Example: Well-scoped task">{`{
  "todos": [
    {
      "content": "Crawl code.claude.com llms-full.txt (docs only)",
      "status": "pending"
    },
    {
      "content": "Score quality — threshold 0.75",
      "status": "pending"
    },
    {
      "content": "Generate context delta for Round 2",
      "status": "pending"
    }
  ]
}`}</CodeBlock>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="text-[11px] text-[#6b6961] pt-4 border-t border-[#2a2a28]"
      >
        Next:{" "}
        <Link href="/task-creation/evaluating-tasks" className="text-[#b0aea5] hover:text-[#d97757]">
          Evaluating Tasks
        </Link>
        {" · "}
        <Link href="/task-creation/optimizing-targets" className="text-[#b0aea5] hover:text-[#d97757]">
          Optimizing Targets
        </Link>
      </motion.div>
    </div>
  );
}
