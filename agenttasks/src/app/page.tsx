"use client";

import { motion } from "motion/react";
import Link from "next/link";

const SOURCES = [
  { name: "Claude Code", pages: 71, quality: 0.819, color: "#d97757" },
  { name: "Claude Platform", pages: 768, quality: 0.706, color: "#6a9bcc" },
  { name: "Neon Postgres", pages: 414, quality: 0.816, color: "#788c5d" },
  { name: "Vercel", pages: 1224, quality: 0.792, color: "#b0aea5" },
];

const TOTAL_PAGES = SOURCES.reduce((s, src) => s + src.pages, 0);

const STATS = [
  { label: "Pages", value: TOTAL_PAGES.toLocaleString() },
  { label: "Quality", value: "0.74" },
  { label: "Tests", value: "386" },
  { label: "Repos", value: "9" },
];

const CARDS = [
  { title: "What are tasks?", href: "/what-are-tasks", desc: "How agent tasks work with crawled data" },
  { title: "Specification", href: "/specification", desc: "TodoWrite + TaskCreate schemas" },
  { title: "Crawl Rounds", href: "/rounds", desc: "Quality progression across 5 rounds" },
  { title: "Task Queue", href: "/tasks", desc: "Interactive task management" },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-3">
        <h1 className="text-2xl md:text-4xl font-bold text-[#faf9f5] tracking-tight">
          Agent<span className="text-[#d97757]">Tasks</span>
        </h1>
        <p className="text-sm md:text-base text-[#b0aea5] leading-relaxed">
          Data-driven task orchestration built on <span className="text-[#faf9f5] font-medium">{TOTAL_PAGES.toLocaleString()}</span> crawled documentation pages with iterative quality improvement.
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="grid grid-cols-4 gap-2 md:gap-4">
        {STATS.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + i * 0.05 }}
            className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl p-3 md:p-4 text-center">
            <div className="text-lg md:text-2xl font-bold text-[#faf9f5]">{stat.value}</div>
            <div className="text-[10px] md:text-xs text-[#6b6961] mt-0.5">{stat.label}</div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 }}>
        <h2 className="text-xs font-semibold text-[#6b6961] uppercase tracking-wider mb-3">Data Sources</h2>
        <div className="space-y-2">
          {SOURCES.map((s, i) => (
            <motion.div key={s.name} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.5 + i * 0.08 }}
              whileHover={{ backgroundColor: "#1c1c1b" }} whileTap={{ scale: 0.98 }}
              className="flex items-center justify-between p-3 rounded-xl border border-[#2a2a28] bg-[#141413]">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-sm text-[#faf9f5]">{s.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#6b6961] tabular-nums">{s.pages.toLocaleString()}</span>
                <span className={`text-xs font-medium tabular-nums px-2 py-0.5 rounded-full ${
                  s.quality >= 0.8 ? "bg-[#788c5d]/20 text-[#788c5d]" :
                  s.quality >= 0.7 ? "bg-[#d97757]/20 text-[#d97757]" : "bg-[#C15F3C]/20 text-[#C15F3C]"
                }`}>{s.quality.toFixed(3)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.7 }}>
        <h2 className="text-xs font-semibold text-[#6b6961] uppercase tracking-wider mb-3">Explore</h2>
        <div className="grid grid-cols-2 gap-2 md:gap-3">
          {CARDS.map((card, i) => (
            <motion.div key={card.href} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: 0.8 + i * 0.06 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link href={card.href}
                className="block p-4 rounded-xl border border-[#2a2a28] bg-[#1c1c1b] hover:border-[#d97757]/30 transition-colors h-full">
                <h3 className="text-sm font-semibold text-[#faf9f5]">{card.title}</h3>
                <p className="text-[11px] text-[#6b6961] mt-1 leading-relaxed">{card.desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
        <h2 className="text-xs font-semibold text-[#6b6961] uppercase tracking-wider mb-3">Architecture</h2>
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          {[
            { label: "Crawl", sub: "Scrapy · 6 spiders", color: "#d97757", href: "/scrapy" },
            { label: "Dispatch", sub: "Shannon · 10 rounds", color: "#6a9bcc", href: "/rounds" },
            { label: "Webapp", sub: "Next.js · Vercel · Neon", color: "#788c5d", href: "/" },
          ].map((layer, i) => (
            <motion.div
              key={layer.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + i * 0.08 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
            >
              <Link
                href={layer.href}
                className="block p-4 rounded-xl border border-[#2a2a28] bg-[#1c1c1b] hover:border-[#d97757]/30 transition-colors text-center h-full"
              >
                <div className="w-8 h-1 rounded-full mx-auto mb-3" style={{ backgroundColor: layer.color }} />
                <div className="text-sm font-semibold text-[#faf9f5]">{layer.label}</div>
                <div className="text-[10px] text-[#6b6961] mt-1 leading-relaxed">{layer.sub}</div>
              </Link>
            </motion.div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 mt-3 text-[10px] text-[#6b6961] font-mono">
          <span>9 repos</span><span>·</span><span>468 files</span><span>·</span><span>386 tests</span><span>·</span><span>Neon PG18</span>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
        className="text-[11px] text-[#6b6961] pt-4 border-t border-[#2a2a28]">
        Built with Next.js + Neon PG18. Animations by <a href="https://motion.dev" className="text-[#b0aea5] hover:text-[#d97757]">motion.dev</a>. Design inspired by Anthropic.
      </motion.div>
    </div>
  );
}
