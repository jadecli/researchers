"use client";
import { motion } from "motion/react";
import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";

const HIGHLIGHTS = [
  { version: "2.14", change: "Dropped BaseItem — all items must now be dicts, dataclasses, or attrs objects.", color: "#d97757" },
  { version: "2.14", change: "Full async/await support across downloader middlewares and signal handlers.", color: "#6a9bcc" },
  { version: "2.14", change: "New asyncio reactor is the default — Twisted reactor must be opted-in explicitly.", color: "#788c5d" },
  { version: "2.14", change: "Feed exports support async storage backends via StorageFeedStorage protocol.", color: "#d97757" },
  { version: "2.14", change: "Improved HTTP/2 support with connection pooling and multiplexed streams.", color: "#6a9bcc" },
  { version: "2.14", change: "Request fingerprinting made configurable through REQUEST_FINGERPRINTER_CLASS.", color: "#788c5d" },
];

export default function ReleaseNotesPage() {
  return (
    <ScrapyPage
      breadcrumb="Release Notes"
      title="Release Notes"
      subtitle="Key changes and improvements in Scrapy 2.14, the version powering AgentTasks documentation crawlers."
      prev={{ label: "Core API", href: "/scrapy/extending/core-api" }}
      next={{ label: "Contributing", href: "/scrapy/reference/contributing" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="text-lg font-semibold text-[#faf9f5] mb-4">Scrapy 2.14 Highlights</h2>
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-4">
          Scrapy 2.14 is a significant release that completes the multi-year migration to
          native async/await patterns and removes long-deprecated APIs. If you are upgrading
          from an older version, pay close attention to the BaseItem removal.
        </p>
      </motion.div>

      <Callout type="warning">
        BaseItem has been removed in 2.14. If your spiders or pipelines subclass BaseItem,
        migrate to dataclasses or plain dicts before upgrading.
      </Callout>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[#faf9f5] mb-3">Version Highlights</h2>
        {HIGHLIGHTS.map((h, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.06 }}
            className="flex items-start gap-3 p-3 rounded-lg border border-[#2a2a28] bg-[#1c1c1b]"
          >
            <div className="w-1 h-full min-h-[24px] rounded-full flex-shrink-0" style={{ backgroundColor: h.color }} />
            <div>
              <span className="text-[10px] font-mono text-[#6b6961] mr-2">v{h.version}</span>
              <span className="text-sm text-[#b0aea5]">{h.change}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <CodeBlock language="bash" title="Verify your Scrapy version">
{`scrapy version
# Scrapy 2.14.0

# Check for deprecated usage in your project
python -W all -m scrapy check`}
      </CodeBlock>

      <Callout type="tip">
        AgentTasks pins Scrapy 2.14 in requirements.txt to ensure reproducible crawls
        across all environments. Always test spiders after any framework upgrade.
      </Callout>
    </ScrapyPage>
  );
}
