"use client";

import { motion } from "motion/react";
import { Code } from "@/components/Code";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { TabGroup } from "@/components/TabGroup";

const td = "text-sm text-[#b0aea5] px-4 py-3";
const th = "text-[#6b6961] text-xs uppercase tracking-wider font-semibold px-4 py-3 text-left";

export default function SpecificationPage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl md:text-3xl font-bold text-[#faf9f5] mb-2">Specification</h1>
        <p className="text-[#b0aea5] text-lg leading-relaxed">
          The complete format specification for Agent Tasks — covering both the TodoWrite
          (headless/SDK) and TaskCreate (interactive) schemas used by Claude Code.
        </p>
      </motion.div>

      {/* Two Interfaces, Same Concept */}
      <Collapsible title="Two Interfaces, Same Concept" defaultOpen accent="#d97757">
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl overflow-hidden">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="bg-[#252524]">
                  <th className={th}>Interface</th>
                  <th className={th}>Tools</th>
                  <th className={th}>When</th>
                  <th className={th}>How</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[#2a2a28]">
                  <td className={td}>Interactive (terminal, desktop, IDE)</td>
                  <td className={td}><Code>TaskCreate, TaskGet, TaskList, TaskUpdate, TaskStop</Code></td>
                  <td className={td}>Session is interactive</td>
                  <td className={td}>Incremental — one tool call per action</td>
                </tr>
                <tr className="border-t border-[#2a2a28]">
                  <td className={td}>Headless/SDK (<Code>claude -p</Code>, Agent SDK)</td>
                  <td className={td}><Code>TodoWrite</Code></td>
                  <td className={td}>Non-interactive or SDK</td>
                  <td className={td}>Atomic — writes the entire todo list each call</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Collapsible>

      {/* TodoWrite Schema */}
      <Collapsible title="TodoWrite Schema" defaultOpen accent="#6a9bcc">
        <p className="text-sm text-[#b0aea5] mb-4">
          From the Agent SDK docs, each <Code>TodoWrite</Code> call replaces the full list:
        </p>
        <TabGroup tabs={[
          {
            label: "Schema",
            content: <CodeBlock language="json">{`{
  "todos": [
    {
      "content": "Create migration",
      "status": "completed",
      "activeForm": "Creating migration..."
    },
    {
      "content": "Write tests",
      "status": "in_progress",
      "activeForm": "Writing tests..."
    },
    {
      "content": "Update docs",
      "status": "pending"
    }
  ]
}`}</CodeBlock>
          },
          {
            label: "Fields",
            content: (
              <div className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl overflow-hidden">
                <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="bg-[#252524]">
                        <th className={th}>Field</th>
                        <th className={th}>Type</th>
                        <th className={th}>Required</th>
                        <th className={th}>Purpose</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-[#2a2a28]">
                        <td className={td}><Code>content</Code></td>
                        <td className={td}>string</td>
                        <td className={td}>Yes</td>
                        <td className={td}>Task description</td>
                      </tr>
                      <tr className="border-t border-[#2a2a28]">
                        <td className={td}><Code>status</Code></td>
                        <td className={td}>{`"pending" | "in_progress" | "completed"`}</td>
                        <td className={td}>Yes</td>
                        <td className={td}>Current state</td>
                      </tr>
                      <tr className="border-t border-[#2a2a28]">
                        <td className={td}><Code>activeForm</Code></td>
                        <td className={td}>string</td>
                        <td className={td}>No</td>
                        <td className={td}>Spinner text while in_progress (falls back to content since v2.1.69)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          }
        ]} />
      </Collapsible>

      {/* TaskCreate Schema */}
      <Collapsible title="TaskCreate Schema" defaultOpen={false} accent="#788c5d">
        <div className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#252524]">
                <th className={th}>Field</th>
                <th className={th}>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[#2a2a28]">
                <td className={td}><Code>subject</Code></td>
                <td className={td}>Short task title</td>
              </tr>
              <tr className="border-t border-[#2a2a28]">
                <td className={td}><Code>description</Code></td>
                <td className={td}>Detailed description (optional)</td>
              </tr>
              <tr className="border-t border-[#2a2a28]">
                <td className={td}><Code>activeForm</Code></td>
                <td className={td}>Spinner text (optional since v2.1.69 — falls back to subject)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Collapsible>

      {/* TaskUpdate Capabilities */}
      <Collapsible title="TaskUpdate Capabilities" defaultOpen={false} accent="#d97757">
        <ul className="space-y-2">
          <li className="flex items-start gap-2 text-sm text-[#b0aea5]">
            <span className="text-[#6a9bcc] mt-1 shrink-0">&#9654;</span>
            <span>Status transitions: <Code>pending → in_progress → completed</Code></span>
          </li>
          <li className="flex items-start gap-2 text-sm text-[#b0aea5]">
            <span className="text-[#6a9bcc] mt-1 shrink-0">&#9654;</span>
            <span>Dependencies: <Code>addBlockedBy</Code> / <Code>addBlocks</Code></span>
          </li>
          <li className="flex items-start gap-2 text-sm text-[#b0aea5]">
            <span className="text-[#6a9bcc] mt-1 shrink-0">&#9654;</span>
            <span>Task deletion via <Code>status: &quot;deleted&quot;</Code></span>
          </li>
          <li className="flex items-start gap-2 text-sm text-[#b0aea5]">
            <span className="text-[#6a9bcc] mt-1 shrink-0">&#9654;</span>
            <span>Owner assignment for team workflows</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-[#b0aea5]">
            <span className="text-[#6a9bcc] mt-1 shrink-0">&#9654;</span>
            <span>Metadata for arbitrary key-value storage</span>
          </li>
        </ul>
      </Collapsible>

      {/* Lifecycle: 3 States */}
      <div>
        <h2 className="text-lg font-semibold text-[#faf9f5] mb-3">
          <span className="text-[#6a9bcc] mr-2">—</span>
          Lifecycle: 3 States
        </h2>
        <motion.pre
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl p-4 text-sm font-mono text-[#b0aea5] text-center"
        >{`pending → in_progress → completed`}</motion.pre>
      </div>

      {/* Data Architecture */}
      <Collapsible title="Data Architecture" defaultOpen={false} accent="#788c5d">
        <TabGroup tabs={[
          {
            label: "Crawl Item",
            content: (
              <>
                <p className="text-sm text-[#b0aea5] mb-4">
                  Pages crawled by our Scrapy spiders produce items with this structure:
                </p>
                <CodeBlock language="json">{`{
  "url": "https://code.claude.com/docs/en/skills",
  "title": "Extend Claude with skills",
  "content_markdown": "# Skills\\n\\nSkills extend what Claude can do...",
  "quality_score": 0.81,
  "metadata": {
    "source": "llms-full-code",
    "content_hash": "a1b2c3d4e5f6",
    "word_count": 3420,
    "heading_count": 12,
    "code_block_count": 8,
    "link_count": 25
  },
  "extraction_timestamp": "2026-03-26T18:53:00Z"
}`}</CodeBlock>
              </>
            )
          },
          {
            label: "Kimball Layers",
            content: (
              <>
                <p className="text-sm text-[#b0aea5] mb-4">
                  All data follows the three-layer Kimball architecture:
                </p>
                <CodeBlock language="text" title="Three-Layer Architecture">{`RUNTIME (write)    → 3NF, append-only, BRIN indexes
REPORTING (read)   → Star schema, SCD Type 2, bloom indexes
SEMANTIC (consume) → Business metric views only`}</CodeBlock>
              </>
            )
          }
        ]} />
      </Collapsible>
    </div>
  );
}
