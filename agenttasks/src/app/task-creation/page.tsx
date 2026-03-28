"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Callout } from "@/components/Callout";

const GUIDES = [
  {
    title: "Quickstart",
    desc: "Create your first agent task and see it execute in under 5 minutes.",
    href: "/task-creation/quickstart",
    accent: "#d97757",
  },
  {
    title: "Best Practices",
    desc: "How to write tasks that are well-scoped, reliable, and calibrated to your crawl targets.",
    href: "/task-creation/best-practices",
    accent: "#6a9bcc",
  },
  {
    title: "Evaluating Tasks",
    desc: "How to test whether your tasks produce good outputs using eval-driven quality scoring.",
    href: "/task-creation/evaluating-tasks",
    accent: "#788c5d",
  },
  {
    title: "Optimizing Targets",
    desc: "How to improve your crawl targets so spiders extract high-quality, complete content.",
    href: "/task-creation/optimizing-targets",
    accent: "#d97757",
  },
  {
    title: "Using Spiders",
    desc: "How to run Scrapy spiders and bundle custom extractors in your tasks.",
    href: "/task-creation/using-spiders",
    accent: "#6a9bcc",
  },
];

export default function TaskCreationPage() {
  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl md:text-3xl font-bold text-[#faf9f5] mb-3">
          Creating Tasks
        </h1>
        <p className="text-[#b0aea5] text-base leading-relaxed">
          Agent Tasks are the building blocks of automated documentation crawling and
          multi-agent dispatch. Learn how to create, evaluate, and optimize tasks
          that produce high-quality structured outputs.
        </p>
      </motion.div>

      <Callout type="tip">
        New to AgentTasks? Start with the{" "}
        <Link href="/task-creation/quickstart" className="text-[#d97757] hover:underline">
          Quickstart
        </Link>{" "}
        to create and run your first task in under 5 minutes.
      </Callout>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <h2 className="text-xs font-semibold text-[#6b6961] uppercase tracking-wider mb-3">
          Guides
        </h2>
        <div className="space-y-3">
          {GUIDES.map((guide, i) => (
            <motion.div
              key={guide.href}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.06 }}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link
                href={guide.href}
                className="flex items-center gap-4 p-4 rounded-xl border border-[#2a2a28] bg-[#1c1c1b] hover:border-[#d97757]/30 transition-colors"
              >
                <div
                  className="w-1 h-10 rounded-full shrink-0"
                  style={{ backgroundColor: guide.accent }}
                />
                <div>
                  <h3 className="text-sm font-semibold text-[#faf9f5]">
                    {guide.title}
                  </h3>
                  <p className="text-xs text-[#6b6961] mt-0.5 leading-relaxed">
                    {guide.desc}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="text-[11px] text-[#6b6961] pt-4 border-t border-[#2a2a28]"
      >
        See also:{" "}
        <Link href="/what-are-tasks" className="text-[#b0aea5] hover:text-[#d97757]">
          What are tasks?
        </Link>
        {" · "}
        <Link href="/specification" className="text-[#b0aea5] hover:text-[#d97757]">
          Specification
        </Link>
      </motion.div>
    </div>
  );
}
