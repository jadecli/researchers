"use client";
import { motion } from "motion/react";
import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";

const GUARANTEES = [
  { scope: "Patch (2.14.x)", policy: "Bug fixes only. No API changes. Safe to upgrade without code changes.", color: "#788c5d" },
  { scope: "Minor (2.x.0)", policy: "New features, deprecation warnings added. Existing APIs remain functional.", color: "#6a9bcc" },
  { scope: "Major (x.0.0)", policy: "Breaking changes. Deprecated APIs removed. Migration guide provided.", color: "#d97757" },
];

export default function VersioningPage() {
  return (
    <ScrapyPage
      breadcrumb="Versioning"
      title="Versioning and API Stability"
      subtitle="Scrapy follows semantic versioning with clear deprecation policies, giving you confidence when upgrading across releases."
      prev={{ label: "Contributing", href: "/scrapy/reference/contributing" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="text-lg font-semibold text-[#faf9f5] mb-4">Semantic Versioning</h2>
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-4">
          Scrapy uses a three-part version scheme: <span className="font-mono text-[#d97757]">MAJOR.MINOR.PATCH</span>.
          Each segment communicates the scope and risk of changes, so teams can make informed
          upgrade decisions without reading every commit.
        </p>
      </motion.div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[#faf9f5] mb-3">Compatibility Guarantees</h2>
        {GUARANTEES.map((g, i) => (
          <motion.div
            key={g.scope}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.06 }}
            className="p-4 rounded-xl border border-[#2a2a28] bg-[#1c1c1b]"
          >
            <div className="w-5 h-1 rounded-full mb-2" style={{ backgroundColor: g.color }} />
            <h3 className="text-sm font-semibold text-[#faf9f5] mb-1">{g.scope}</h3>
            <p className="text-[11px] text-[#6b6961] leading-relaxed">{g.policy}</p>
          </motion.div>
        ))}
      </div>

      <Callout type="note">
        Deprecated APIs emit warnings for at least two minor releases before removal.
        Run your spiders with <span className="font-mono">python -W all</span> to surface
        any deprecation notices early.
      </Callout>

      <CodeBlock language="python" title="Pin versions in requirements.txt">
{`# Pin to minor version for stability
scrapy>=2.14,<2.15

# Or pin exact version for reproducibility
scrapy==2.14.0

# Check for outdated packages
# pip list --outdated`}
      </CodeBlock>

      <Callout type="warning">
        AgentTasks pins exact Scrapy versions in production to avoid unexpected behavior
        from upstream patches. Always test crawls in staging before bumping versions.
      </Callout>
    </ScrapyPage>
  );
}
