"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";

const steps = [
  {
    num: 1,
    title: "Planning",
    desc: "Shannon 5-step thinking decomposes the goal into structured tasks with confidence scores.",
  },
  {
    num: 2,
    title: "Execution",
    desc: "Each task dispatches to the appropriate spider, agent, or platform.",
  },
  {
    num: 3,
    title: "Scoring",
    desc: "Quality is measured across 5 dimensions: completeness, structure, accuracy, coherence, safety.",
  },
  {
    num: 4,
    title: "Steering",
    desc: "Context deltas from each round steer the next iteration toward improvement.",
  },
];

const dataSources = [
  { name: "Claude Code", pages: 71, color: "#d97757", detail: "Skills, agents, hooks, plugins, MCP, channels" },
  { name: "Claude Platform", pages: 768, color: "#6a9bcc", detail: "API, SDKs, tools, Agent SDK, structured output" },
  { name: "Neon Postgres", pages: 414, color: "#788c5d", detail: "Branching, extensions, serverless driver" },
  { name: "Vercel", pages: 1224, color: "#b0aea5", detail: "Deployment, Edge, ISR, frameworks" },
];

const TOTAL_PAGES = dataSources.reduce((s, src) => s + src.pages, 0);

const differences = [
  ["Static SKILL.md files", "Dynamic tasks with status lifecycle"],
  ["User installs skills", "System discovers and assigns tasks"],
  ["Progressive disclosure of instructions", "Progressive improvement via quality scoring"],
  ["Single agent activation", "Multi-agent dispatch with coordinator"],
  ["Markdown + YAML", "JSONL + Neon PG18 + Kimball schema"],
];

const nextSteps = [
  { label: "View the specification", desc: "Complete task schema", href: "/specification" },
  { label: "Create your first task", desc: "Quickstart guide", href: "/task-creation/quickstart" },
  { label: "Browse crawl rounds", desc: "Quality progression", href: "/rounds" },
  { label: "Manage tasks", desc: "Interactive task queue", href: "/tasks" },
];

export default function WhatAreTasksPage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl md:text-3xl font-bold text-[#faf9f5] mb-3">
          What are tasks?
        </h1>
        <p className="text-[#b0aea5] text-base leading-relaxed">
          Agent Tasks are a structured format for orchestrating AI agent work — from crawling
          documentation to dispatching multi-agent workflows. Built on Claude Code&apos;s canonical
          task system (TodoWrite + TaskCreate) and extended with iterative quality improvement.
        </p>
      </motion.div>

      {/* How tasks work */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <h2 className="text-xs font-semibold text-[#6b6961] uppercase tracking-wider mb-3">
          How tasks work
        </h2>
        <p className="text-sm text-[#b0aea5] mb-4">
          Tasks use <strong className="text-[#faf9f5]">progressive disclosure</strong> — the same pattern as Agent Skills:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.05 + i * 0.05 }}
              whileHover={{ y: -2 }}
              className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl p-4"
            >
              <span className="text-2xl font-bold text-[#d97757]">{step.num}</span>
              <h3 className="text-sm font-semibold text-[#faf9f5] mt-1">{step.title}</h3>
              <p className="text-sm text-[#b0aea5] mt-1 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Task lifecycle */}
      <Collapsible title="Task Lifecycle Diagram" defaultOpen={false} accent="#6a9bcc">
        <CodeBlock language="text" title="Plan → Execute → Score → Steer">
          {`Plan (Shannon Thinking)
  │
  ├─ problem_definition → strip to fundamentals
  ├─ constraints → system limitations
  ├─ model → structural framework
  ├─ proof → validate feasibility
  └─ implementation → practical execution
        │
        ▼
Execute (Scrapy Spiders)
  │
  ├─ docs_spider → code.claude.com/docs
  ├─ platform_spider → platform.claude.com
  ├─ llms_full_spider → 25MB+ full-text parser
  └─ Custom spiders (neon, vercel)
        │
        ▼
Score (Quality Pipeline)
  │
  ├─ completeness (0.30 weight)
  ├─ structure (0.25 weight)
  ├─ accuracy (0.25 weight)
  ├─ coherence (0.10 weight)
  └─ safety (0.10 weight)
        │
        ▼
Steer (Context Delta)
  │
  ├─ new_patterns discovered
  ├─ failing_targets identified
  ├─ quality_trajectory tracked
  └─ steer_direction for next round`}
        </CodeBlock>
      </Collapsible>

      {/* Data sources */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <h2 className="text-xs font-semibold text-[#6b6961] uppercase tracking-wider mb-3">
          Data sources
        </h2>
        <p className="text-sm text-[#b0aea5] mb-4">
          Our crawlers have processed <strong className="text-[#faf9f5]">{TOTAL_PAGES.toLocaleString()} pages</strong> from 4 documentation sites:
        </p>
        <div className="space-y-2">
          {dataSources.map((src, i) => (
            <motion.div
              key={src.name}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.05 + i * 0.05 }}
              className="flex items-center justify-between bg-[#1c1c1b] border border-[#2a2a28] rounded-xl px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: src.color }}
                />
                <span className="text-sm text-[#faf9f5] font-medium">{src.name}</span>
                <span className="text-sm text-[#6b6961] truncate hidden sm:inline">
                  {src.detail}
                </span>
              </div>
              <span className="text-xs text-[#6b6961] font-mono shrink-0 ml-3">
                {src.pages.toLocaleString()} pages
              </span>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Key differences */}
      <Collapsible title="Key Differences from Agent Skills" defaultOpen={false} accent="#d97757">
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#252524]">
                  <th className="text-xs text-[#6b6961] uppercase tracking-wider font-semibold px-4 py-2.5">
                    Agent Skills
                  </th>
                  <th className="text-xs text-[#6b6961] uppercase tracking-wider font-semibold px-4 py-2.5">
                    Agent Tasks
                  </th>
                </tr>
              </thead>
              <tbody>
                {differences.map(([skill, task], i) => (
                  <tr
                    key={i}
                    className={i < differences.length - 1 ? "border-b border-[#2a2a28]" : ""}
                  >
                    <td className="text-sm text-[#b0aea5] px-4 py-2.5">{skill}</td>
                    <td className="text-sm text-[#b0aea5] px-4 py-2.5">{task}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Collapsible>

      {/* Next steps */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <h2 className="text-xs font-semibold text-[#6b6961] uppercase tracking-wider mb-3">
          Next steps
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {nextSteps.map((item, i) => (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.05 + i * 0.05 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link
                href={item.href}
                className="block bg-[#1c1c1b] border border-[#2a2a28] rounded-xl p-4 hover:border-[#d97757]/30 transition-colors"
              >
                <span className="text-sm font-medium text-[#faf9f5]">{item.label}</span>
                <p className="text-xs text-[#6b6961] mt-1">{item.desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
