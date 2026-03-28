"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Collapsible } from "@/components/Collapsible";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { TabGroup } from "@/components/TabGroup";

const STRATEGIES = [
  {
    title: "Prefer llms.txt over HTML scraping",
    accent: "#d97757",
    defaultOpen: true,
    content: (
      <>
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-4">
          Sites that publish <strong className="text-[#faf9f5]">llms.txt</strong> or{" "}
          <strong className="text-[#faf9f5]">llms-full.txt</strong> provide pre-structured
          content optimized for LLM consumption. These files consistently score 10-15% higher
          than equivalent HTML extraction because the content is already cleaned and formatted.
        </p>
        <CodeBlock language="bash">{`# Check if a site has llms.txt
curl -sI https://code.claude.com/docs/llms.txt | head -5
# HTTP/2 200 → use llms_full_spider
# HTTP/2 404 → fall back to docs_spider`}</CodeBlock>
      </>
    ),
  },
  {
    title: "Use HEAD requests to check file sizes",
    accent: "#6a9bcc",
    defaultOpen: false,
    content: (
      <>
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-4">
          Some llms-full.txt files exceed 25MB. The llms_full_spider uses HEAD requests
          to check Content-Length before downloading, then streams to disk rather than
          loading into memory. This prevents context window crashes.
        </p>
        <CodeBlock language="python">{`# The spider does this automatically:
resp = requests.head(url)
size_mb = int(resp.headers.get('Content-Length', 0)) / 1_048_576
if size_mb > 10:
    # Stream to disk, split on page boundaries
    self.download_to_disk(url)`}</CodeBlock>
      </>
    ),
  },
  {
    title: "Filter by content type and language",
    accent: "#788c5d",
    defaultOpen: false,
    content: (
      <p className="text-sm text-[#b0aea5] leading-relaxed">
        Not all pages on a documentation site are useful. Filter by content type
        (guides, API references, tutorials) and language (English by default). The
        platform_spider supports a <strong className="text-[#faf9f5]">-a lang=en</strong> argument
        that filters on the URL path prefix. For llms-full.txt files, the parser splits
        on <strong className="text-[#faf9f5]">Source:</strong> and <strong className="text-[#faf9f5]">---</strong> page
        boundaries and applies language detection per segment.
      </p>
    ),
  },
  {
    title: "Tune the DeltaFetch window",
    accent: "#d97757",
    defaultOpen: false,
    content: (
      <>
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-4">
          The DeltaFetch middleware skips pages that haven&apos;t changed since the last crawl.
          The default window is 24 hours. For rapidly-changing docs, reduce to 6 hours.
          For stable reference docs, increase to 7 days.
        </p>
        <CodeBlock language="python">{`# In scrapy settings or spider args:
DELTAFETCH_ENABLED = True
DELTAFETCH_RESET = False
DELTAFETCH_TTL = 86400  # seconds (24h default)`}</CodeBlock>
      </>
    ),
  },
];

export default function OptimizingTargetsPage() {
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
          <span className="text-[#b0aea5]">Optimizing Targets</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#faf9f5] mb-3">Optimizing Targets</h1>
        <p className="text-[#b0aea5] text-base leading-relaxed">
          How to improve your crawl target URLs and spider configuration so extractors produce
          high-quality, complete content with minimal wasted requests.
        </p>
      </motion.div>

      <div className="space-y-2">
        {STRATEGIES.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: 0.05 + i * 0.05 }}
          >
            <Collapsible title={s.title} defaultOpen={s.defaultOpen} accent={s.accent}>
              {s.content}
            </Collapsible>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h2 className="text-xs font-semibold text-[#6b6961] uppercase tracking-wider mb-3">
          Quality by Source Type
        </h2>
        <TabGroup tabs={[
          {
            label: "llms.txt",
            content: (
              <div className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#faf9f5]">Average quality</span>
                  <span className="text-sm font-mono text-[#788c5d]">0.82</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#faf9f5]">Best for</span>
                  <span className="text-sm text-[#b0aea5]">LLM-optimized docs</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#faf9f5]">Spider</span>
                  <span className="text-xs font-mono text-[#d97757] bg-[#d97757]/10 px-2 py-0.5 rounded">llms_full_spider</span>
                </div>
              </div>
            ),
          },
          {
            label: "Sitemap",
            content: (
              <div className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#faf9f5]">Average quality</span>
                  <span className="text-sm font-mono text-[#d97757]">0.71</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#faf9f5]">Best for</span>
                  <span className="text-sm text-[#b0aea5]">Full site coverage</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#faf9f5]">Spider</span>
                  <span className="text-xs font-mono text-[#d97757] bg-[#d97757]/10 px-2 py-0.5 rounded">anthropic_spider</span>
                </div>
              </div>
            ),
          },
        ]} />
      </motion.div>

      <Callout type="tip">
        Always start with a HEAD request to check for llms.txt before configuring a sitemap crawl.
        The quality difference (0.82 vs 0.71 average) is significant.
      </Callout>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="text-[11px] text-[#6b6961] pt-4 border-t border-[#2a2a28]"
      >
        Next:{" "}
        <Link href="/task-creation/using-spiders" className="text-[#b0aea5] hover:text-[#d97757]">
          Using Spiders
        </Link>
        {" · "}
        <Link href="/task-creation/evaluating-tasks" className="text-[#b0aea5] hover:text-[#d97757]">
          Evaluating Tasks
        </Link>
      </motion.div>
    </div>
  );
}
