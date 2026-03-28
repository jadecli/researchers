"use client";
import { motion } from "motion/react";
import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";

const STEPS = [
  { label: "Fork & Clone", desc: "Fork the repository on GitHub, then clone your fork locally." },
  { label: "Branch", desc: "Create a feature branch from main with a descriptive name." },
  { label: "Implement", desc: "Write code, add tests, and update documentation as needed." },
  { label: "Test", desc: "Run the full test suite and ensure all checks pass." },
  { label: "Submit PR", desc: "Push your branch and open a pull request against main." },
];

export default function ContributingPage() {
  return (
    <ScrapyPage
      breadcrumb="Contributing"
      title="Contributing to Scrapy"
      subtitle="How to contribute code, documentation, and bug reports to both upstream Scrapy and the AgentTasks crawling infrastructure."
      prev={{ label: "Release Notes", href: "/scrapy/reference/release-notes" }}
      next={{ label: "Versioning", href: "/scrapy/reference/versioning" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="text-lg font-semibold text-[#faf9f5] mb-4">Contribution Workflow</h2>
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-4">
          AgentTasks follows a standard fork-and-PR workflow. Every contribution — whether
          a new spider, pipeline fix, or documentation update — goes through code review
          before merging into main.
        </p>
      </motion.div>

      <div className="space-y-2">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.06 }}
            className="flex items-start gap-3 p-3 rounded-lg border border-[#2a2a28] bg-[#1c1c1b]"
          >
            <span className="text-xs font-mono text-[#d97757] flex-shrink-0 mt-0.5">{i + 1}</span>
            <div>
              <h3 className="text-sm font-semibold text-[#faf9f5]">{s.label}</h3>
              <p className="text-[11px] text-[#6b6961] leading-relaxed">{s.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <Callout type="tip">
        For bug reports, include the Scrapy version, spider name, the URL being crawled,
        and the full traceback. This helps maintainers reproduce the issue quickly.
      </Callout>

      <CodeBlock language="bash" title="Local development setup">
{`# Clone and install in development mode
git clone https://github.com/your-fork/researchers.git
cd researchers/claude-code
pip install -e ".[dev]"

# Run the test suite
PYTHONPATH=. python -m pytest tests/ -v

# Lint before committing
ruff check . && ruff format --check .`}
      </CodeBlock>

      <Callout type="note">
        Documentation contributions are equally valued. If you spot unclear instructions
        or missing examples in any spider or pipeline, open a PR with improvements.
      </Callout>
    </ScrapyPage>
  );
}
