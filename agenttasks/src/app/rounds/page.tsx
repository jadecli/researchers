"use client";

import { motion } from "motion/react";

const ROUNDS = [
  { round: 1, target: "code.claude.com/docs/llms.txt", pages: 4, quality: 0.75, status: "PASS" },
  { round: 2, target: "code + platform llms.txt", pages: 17, quality: 0.76, status: "PASS" },
  { round: 3, target: "platform.claude.com (full)", pages: 38, quality: 0.73, status: "PASS" },
  { round: 4, target: "llms-full.txt (code 71 + platform 200)", pages: 271, quality: 0.74, status: "PASS" },
  { round: 5, target: "All 4 llms-full.txt files", pages: 2477, quality: 0.77, status: "PASS" },
];

const MIN_Q = 0.65; // threshold baseline
const MAX_Q = 0.85; // visual ceiling

export default function RoundsPage() {
  return (
    <div className="space-y-8">
      {/* Hero section — fade up */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl md:text-3xl font-bold text-[#faf9f5]">Crawl Rounds</h1>
        <p className="text-[#b0aea5] mt-2">
          Quality progression across 5 iterative crawl rounds. Each round builds
          on the previous with context delta steering.
        </p>
      </motion.div>

      {/* Quality trend — fade in with delay */}
      <motion.div
        className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h2 className="text-xs font-semibold text-[#6b6961] uppercase tracking-wider mb-4">
          Quality Trend
        </h2>
        <div className="relative flex items-end gap-2 h-40">
          {/* Dashed threshold line at 0% mark (the 0.65 baseline) */}
          <div
            className="absolute left-0 right-0 border-t border-dashed border-[#6b6961]/50"
            style={{ bottom: 0 }}
          />
          {ROUNDS.map((r, i) => {
            const barHeight = ((r.quality - MIN_Q) / (MAX_Q - MIN_Q)) * 100;
            return (
              <div key={r.round} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-xs text-[#6b6961]">{r.quality.toFixed(2)}</div>
                <motion.div
                  className="w-full bg-[#788c5d] rounded-t"
                  style={{ height: `${barHeight}%`, transformOrigin: "bottom" }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: 0.4 + i * 0.12, type: "spring", stiffness: 120 }}
                />
                <div className="text-xs text-[#b0aea5]">R{r.round}</div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-[#6b6961] mt-2">
          <span>Threshold: 0.65</span>
          <span>All rounds PASS</span>
        </div>
      </motion.div>

      {/* Round details — table for md+, cards for mobile */}
      <motion.div
        className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        {/* Desktop table — hidden on small screens */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a28]">
                <th className="text-left p-3 text-[#6b6961] font-medium">Round</th>
                <th className="text-left p-3 text-[#6b6961] font-medium">Target</th>
                <th className="text-right p-3 text-[#6b6961] font-medium">Pages</th>
                <th className="text-right p-3 text-[#6b6961] font-medium">Avg Quality</th>
                <th className="text-right p-3 text-[#6b6961] font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {ROUNDS.map((r, i) => (
                <motion.tr
                  key={r.round}
                  className="border-b border-[#2a2a28]/50"
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.6 + i * 0.06 }}
                >
                  <td className="p-3 text-[#faf9f5] font-mono">Round {r.round}</td>
                  <td className="p-3 text-[#b0aea5]">{r.target}</td>
                  <td className="p-3 text-right text-[#faf9f5]/80">{r.pages.toLocaleString()}</td>
                  <td className="p-3 text-right">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium tabular-nums ${
                      r.quality >= 0.75 ? "bg-[#788c5d]/20 text-[#788c5d]" : "bg-[#d97757]/20 text-[#d97757]"
                    }`}>{r.quality.toFixed(2)}</span>
                  </td>
                  <td className="p-3 text-right">
                    <span className="text-[#788c5d] font-medium">{r.status}</span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
            <tfoot>
              <motion.tr
                className="border-t border-[#2a2a28]"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.9 }}
              >
                <td className="p-3 text-[#faf9f5] font-bold">Total</td>
                <td className="p-3 text-[#b0aea5]">All sources</td>
                <td className="p-3 text-right text-[#faf9f5] font-bold">
                  {ROUNDS.reduce((s, r) => s + r.pages, 0).toLocaleString()}
                </td>
                <td className="p-3 text-right text-[#faf9f5] font-bold">0.74</td>
                <td className="p-3 text-right text-[#788c5d] font-bold">ALL PASS</td>
              </motion.tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile card layout — visible only on small screens */}
        <div className="md:hidden divide-y divide-[#2a2a28]/50">
          {ROUNDS.map((r, i) => (
            <motion.div
              key={r.round}
              className="p-4 space-y-2"
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.6 + i * 0.06 }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[#faf9f5] font-mono font-medium">Round {r.round}</span>
                <span className="text-[#788c5d] font-medium text-sm">{r.status}</span>
              </div>
              <p className="text-[#b0aea5] text-sm">{r.target}</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#6b6961]">Pages: <span className="text-[#faf9f5]/80">{r.pages.toLocaleString()}</span></span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium tabular-nums ${
                  r.quality >= 0.75 ? "bg-[#788c5d]/20 text-[#788c5d]" : "bg-[#d97757]/20 text-[#d97757]"
                }`}>{r.quality.toFixed(2)}</span>
              </div>
            </motion.div>
          ))}

          {/* Mobile footer */}
          <motion.div
            className="p-4"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.9 }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[#faf9f5] font-bold">Total</span>
              <span className="text-[#788c5d] font-bold">ALL PASS</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-[#b0aea5]">All sources</span>
              <span className="text-[#faf9f5] font-bold">{ROUNDS.reduce((s, r) => s + r.pages, 0).toLocaleString()} pages — 0.74 avg</span>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
