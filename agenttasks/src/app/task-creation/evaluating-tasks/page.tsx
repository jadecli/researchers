"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { TabGroup } from "@/components/TabGroup";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";

const DIMENSIONS = [
  { name: "Completeness", weight: "0.30", desc: "Does the extracted content cover the full scope of the source page? Missing sections, truncated code blocks, or dropped navigation elements reduce completeness." },
  { name: "Structure", weight: "0.25", desc: "Is the markdown well-organized with proper heading hierarchy, code fencing, and list formatting? Flat text dumps with no structure score low." },
  { name: "Accuracy", weight: "0.25", desc: "Does the extracted content faithfully represent the source? Garbled text, broken links, or merged sections from different pages indicate accuracy problems." },
  { name: "Coherence", weight: "0.10", desc: "Does the content read naturally as a standalone document? Orphaned references, dangling cross-links, and context-dependent phrases without context reduce coherence." },
  { name: "Safety", weight: "0.10", desc: "Is the content free of PII, credentials, internal URLs, and other sensitive data that shouldn't be in crawl output? The security scanner flags these automatically." },
];

export default function EvaluatingTasksPage() {
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
          <span className="text-[#b0aea5]">Evaluating Tasks</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#faf9f5] mb-3">Evaluating Tasks</h1>
        <p className="text-[#b0aea5] text-base leading-relaxed">
          How to test whether your tasks produce good outputs using eval-driven iteration
          and the 5-dimension quality scoring pipeline.
        </p>
      </motion.div>

      <Callout type="note">
        Quality scores range from 0.0 to 1.0. The default pass threshold is <strong className="text-[#faf9f5]">0.65</strong>.
        Production tasks should target <strong className="text-[#faf9f5]">0.75+</strong>.
      </Callout>

      {/* Scoring dimensions */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h2 className="text-xs font-semibold text-[#6b6961] uppercase tracking-wider mb-3">
          5 Scoring Dimensions
        </h2>
        <div className="space-y-3">
          {DIMENSIONS.map((dim, i) => (
            <motion.div
              key={dim.name}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.06 }}
              className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-[#faf9f5]">{dim.name}</h3>
                <span className="text-xs font-mono text-[#d97757] bg-[#d97757]/10 px-2 py-0.5 rounded-full">
                  {dim.weight} weight
                </span>
              </div>
              <p className="text-sm text-[#b0aea5] leading-relaxed">{dim.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Scoring formula */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h2 className="text-xs font-semibold text-[#6b6961] uppercase tracking-wider mb-3">
          Scoring Formula
        </h2>
        <CodeBlock language="text" title="Weighted average">{`quality_score = (
  completeness * 0.30 +
  structure    * 0.25 +
  accuracy     * 0.25 +
  coherence    * 0.10 +
  safety       * 0.10
)`}</CodeBlock>
      </motion.div>

      {/* Eval workflow */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h2 className="text-xs font-semibold text-[#6b6961] uppercase tracking-wider mb-3">
          Running an Eval
        </h2>
        <TabGroup tabs={[
          {
            label: "Command",
            content: (
              <CodeBlock language="bash">{`cd claude-code
PYTHONPATH=. scrapy crawl docs_spider \\
  -a url=https://code.claude.com/docs/llms.txt \\
  -s QUALITY_THRESHOLD=0.75 \\
  -o data/eval/output.jsonl`}</CodeBlock>
            ),
          },
          {
            label: "Check Results",
            content: (
              <CodeBlock language="bash">{`# View quality scores from the output
cat data/eval/output.jsonl | python3 -c "
import json, sys
scores = [json.loads(l)['quality_score'] for l in sys.stdin]
print(f'Pages: {len(scores)}')
print(f'Avg:   {sum(scores)/len(scores):.3f}')
print(f'Min:   {min(scores):.3f}')
print(f'Pass:  {sum(1 for s in scores if s >= 0.75)}/{len(scores)}')
"`}</CodeBlock>
            ),
          },
        ]} />
      </motion.div>

      <Callout type="tip">
        Run evals on a small sample (10-20 pages) before committing to a full crawl.
        This catches spider configuration issues early.
      </Callout>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="text-[11px] text-[#6b6961] pt-4 border-t border-[#2a2a28]"
      >
        Next:{" "}
        <Link href="/task-creation/optimizing-targets" className="text-[#b0aea5] hover:text-[#d97757]">
          Optimizing Targets
        </Link>
        {" · "}
        <Link href="/task-creation/using-spiders" className="text-[#b0aea5] hover:text-[#d97757]">
          Using Spiders
        </Link>
      </motion.div>
    </div>
  );
}
