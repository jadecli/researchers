"use client";
import { motion } from "motion/react";
import Link from "next/link";

const SECTIONS = [
  { title: "First Steps", desc: "Get started with Scrapy — installation, tutorial, examples", href: "/scrapy/first-steps/at-a-glance", count: 4, color: "#d97757" },
  { title: "Basic Concepts", desc: "Spiders, selectors, items, pipelines, settings", href: "/scrapy/basic-concepts/spiders", count: 12, color: "#6a9bcc" },
  { title: "Built-in Services", desc: "Logging, stats collection, telnet console", href: "/scrapy/built-in/logging", count: 3, color: "#788c5d" },
  { title: "Solving Problems", desc: "Debugging, broad crawls, deployment, async patterns", href: "/scrapy/solving-problems/faq", count: 15, color: "#d97757" },
  { title: "Extending Scrapy", desc: "Architecture, middleware, extensions, signals, scheduler", href: "/scrapy/extending/architecture", count: 11, color: "#6a9bcc" },
  { title: "Reference", desc: "Release notes, contributing, versioning", href: "/scrapy/reference/release-notes", count: 3, color: "#788c5d" },
];

export default function ScrapyIndexPage() {
  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-2xl md:text-3xl font-bold text-[#faf9f5] mb-3">Scrapy Documentation</h1>
        <p className="text-[#b0aea5] text-base leading-relaxed">
          Learn Scrapy through the lens of AgentTasks — how we use Scrapy 2.14 to power
          iterative documentation crawling with quality scoring across 2,477+ pages.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SECTIONS.map((s, i) => (
          <motion.div key={s.title} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.06 }} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}>
            <Link href={s.href} className="block p-4 rounded-xl border border-[#2a2a28] bg-[#1c1c1b] hover:border-[#d97757]/30 transition-colors h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="w-6 h-1 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-[10px] text-[#6b6961] font-mono">{s.count} pages</span>
              </div>
              <h3 className="text-sm font-semibold text-[#faf9f5]">{s.title}</h3>
              <p className="text-[11px] text-[#6b6961] mt-1 leading-relaxed">{s.desc}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl p-4">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-[#6b6961]">Scrapy version:</span>
          <span className="text-[#faf9f5] font-mono">2.14</span>
          <span className="text-[#6b6961]">·</span>
          <span className="text-[#6b6961]">Python:</span>
          <span className="text-[#faf9f5] font-mono">3.12+</span>
          <span className="text-[#6b6961]">·</span>
          <span className="text-[#6b6961]">Pages:</span>
          <span className="text-[#faf9f5] font-mono">48</span>
        </div>
      </div>
    </div>
  );
}
