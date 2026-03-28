"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

// ── Experiment data ─────────────────────────────────────────────

type Variant = {
  id: string;
  name: string;
  strategy: string;
  pages: number;
  toolCalls: number;
  ratio: number;
  quality: number;
  cost: number;
  durationMs: number;
  isWinner: boolean;
  // Time series data (simulated 1-minute windows)
  timeSeries: { minute: number; pages: number; toolCalls: number; ratio: number }[];
};

type Experiment = {
  id: string;
  name: string;
  hypothesis: string;
  status: string;
  confidence: number;
  targetOrg: string;
  categories: string[];
  winnerId: string;
  variants: Variant[];
  createdAt: string;
  completedAt: string;
};

const EXPERIMENTS: Record<string, Experiment> = {
  "spotify-tool-strategy-v1": {
    id: "spotify-tool-strategy-v1",
    name: "Spotify Tool Strategy Comparison",
    hypothesis:
      "PTC and tool search strategies will achieve lower tool_calls/pages_crawled ratios than standard tool loop when crawling statistical packages, while maintaining equivalent or better extraction quality.",
    status: "completed",
    confidence: 78,
    targetOrg: "spotify",
    categories: ["experimentation", "metrics", "statistics", "data-quality", "feature-engineering", "ml-evaluation", "observability", "streaming"],
    winnerId: "spotify-ptc",
    createdAt: "2026-03-27T06:00:00Z",
    completedAt: "2026-03-27T06:45:00Z",
    variants: [
      {
        id: "spotify-control",
        name: "Standard Tool Loop",
        strategy: "standard",
        pages: 10,
        toolCalls: 50,
        ratio: 5.0,
        quality: 0.72,
        cost: 0.15,
        durationMs: 12400,
        isWinner: false,
        timeSeries: [
          { minute: 1, pages: 2, toolCalls: 12, ratio: 6.0 },
          { minute: 2, pages: 3, toolCalls: 14, ratio: 4.67 },
          { minute: 3, pages: 3, toolCalls: 13, ratio: 4.33 },
          { minute: 4, pages: 2, toolCalls: 11, ratio: 5.5 },
        ],
      },
      {
        id: "spotify-thinking",
        name: "Extended Thinking",
        strategy: "extended_thinking",
        pages: 10,
        toolCalls: 40,
        ratio: 4.0,
        quality: 0.78,
        cost: 0.20,
        durationMs: 14200,
        isWinner: false,
        timeSeries: [
          { minute: 1, pages: 2, toolCalls: 10, ratio: 5.0 },
          { minute: 2, pages: 3, toolCalls: 11, ratio: 3.67 },
          { minute: 3, pages: 3, toolCalls: 10, ratio: 3.33 },
          { minute: 4, pages: 2, toolCalls: 9, ratio: 4.5 },
        ],
      },
      {
        id: "spotify-tool-search",
        name: "Tool Search",
        strategy: "tool_search",
        pages: 10,
        toolCalls: 30,
        ratio: 3.0,
        quality: 0.74,
        cost: 0.06,
        durationMs: 10800,
        isWinner: false,
        timeSeries: [
          { minute: 1, pages: 3, toolCalls: 9, ratio: 3.0 },
          { minute: 2, pages: 3, toolCalls: 8, ratio: 2.67 },
          { minute: 3, pages: 2, toolCalls: 7, ratio: 3.5 },
          { minute: 4, pages: 2, toolCalls: 6, ratio: 3.0 },
        ],
      },
      {
        id: "spotify-ptc",
        name: "Programmatic Tool Calling",
        strategy: "ptc",
        pages: 10,
        toolCalls: 15,
        ratio: 1.5,
        quality: 0.73,
        cost: 0.015,
        durationMs: 8200,
        isWinner: true,
        timeSeries: [
          { minute: 1, pages: 3, toolCalls: 5, ratio: 1.67 },
          { minute: 2, pages: 3, toolCalls: 4, ratio: 1.33 },
          { minute: 3, pages: 2, toolCalls: 3, ratio: 1.5 },
          { minute: 4, pages: 2, toolCalls: 3, ratio: 1.5 },
        ],
      },
    ],
  },
  "spotify-ptc-h2h-v1": {
    id: "spotify-ptc-h2h-v1",
    name: "PTC vs Standard Head-to-Head",
    hypothesis:
      "Programmatic tool calling will reduce tool call overhead by 60%+ compared to standard tool loop for batch GitHub API operations.",
    status: "completed",
    confidence: 92,
    targetOrg: "spotify",
    categories: ["experimentation", "metrics"],
    winnerId: "spotify-ptc",
    createdAt: "2026-03-27T07:00:00Z",
    completedAt: "2026-03-27T07:20:00Z",
    variants: [
      {
        id: "spotify-control",
        name: "Standard Tool Loop",
        strategy: "standard",
        pages: 10,
        toolCalls: 50,
        ratio: 5.0,
        quality: 0.72,
        cost: 0.15,
        durationMs: 12400,
        isWinner: false,
        timeSeries: [
          { minute: 1, pages: 2, toolCalls: 12, ratio: 6.0 },
          { minute: 2, pages: 3, toolCalls: 14, ratio: 4.67 },
          { minute: 3, pages: 3, toolCalls: 13, ratio: 4.33 },
          { minute: 4, pages: 2, toolCalls: 11, ratio: 5.5 },
        ],
      },
      {
        id: "spotify-ptc",
        name: "Programmatic Tool Calling",
        strategy: "ptc",
        pages: 10,
        toolCalls: 15,
        ratio: 1.5,
        quality: 0.73,
        cost: 0.015,
        durationMs: 8200,
        isWinner: true,
        timeSeries: [
          { minute: 1, pages: 3, toolCalls: 5, ratio: 1.67 },
          { minute: 2, pages: 3, toolCalls: 4, ratio: 1.33 },
          { minute: 3, pages: 2, toolCalls: 3, ratio: 1.5 },
          { minute: 4, pages: 2, toolCalls: 3, ratio: 1.5 },
        ],
      },
    ],
  },
  "spotify-quality-v1": {
    id: "spotify-quality-v1",
    name: "Thinking vs Tool Search Quality",
    hypothesis:
      "Extended thinking will produce higher quality extractions (accuracy dimension) while tool search will be more efficient (lower cost per page).",
    status: "completed",
    confidence: 64,
    targetOrg: "spotify",
    categories: ["statistics", "data-quality", "ml-evaluation"],
    winnerId: "spotify-tool-search",
    createdAt: "2026-03-27T07:30:00Z",
    completedAt: "2026-03-27T07:50:00Z",
    variants: [
      {
        id: "spotify-thinking",
        name: "Extended Thinking",
        strategy: "extended_thinking",
        pages: 10,
        toolCalls: 40,
        ratio: 4.0,
        quality: 0.78,
        cost: 0.20,
        durationMs: 14200,
        isWinner: false,
        timeSeries: [
          { minute: 1, pages: 2, toolCalls: 10, ratio: 5.0 },
          { minute: 2, pages: 3, toolCalls: 11, ratio: 3.67 },
          { minute: 3, pages: 3, toolCalls: 10, ratio: 3.33 },
          { minute: 4, pages: 2, toolCalls: 9, ratio: 4.5 },
        ],
      },
      {
        id: "spotify-tool-search",
        name: "Tool Search with Embeddings",
        strategy: "tool_search",
        pages: 10,
        toolCalls: 30,
        ratio: 3.0,
        quality: 0.74,
        cost: 0.06,
        durationMs: 10800,
        isWinner: true,
        timeSeries: [
          { minute: 1, pages: 3, toolCalls: 9, ratio: 3.0 },
          { minute: 2, pages: 3, toolCalls: 8, ratio: 2.67 },
          { minute: 3, pages: 2, toolCalls: 7, ratio: 3.5 },
          { minute: 4, pages: 2, toolCalls: 6, ratio: 3.0 },
        ],
      },
    ],
  },
};

// ── Chart components (pure CSS, no deps, iPhone-optimized) ──────

function MiniBarChart({
  data,
  valueKey,
  label,
  color,
}: {
  data: { minute: number; [key: string]: number }[];
  valueKey: string;
  label: string;
  color: string;
}) {
  const maxVal = Math.max(...data.map((d) => d[valueKey] as number), 1);
  return (
    <div className="space-y-1">
      <div className="text-xs text-zinc-500 font-medium">{label}</div>
      <div className="flex items-end gap-1 h-16">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div className="text-[10px] text-zinc-500 mb-0.5">
              {d[valueKey]}
            </div>
            <div
              className={`w-full rounded-t ${color}`}
              style={{
                height: `${((d[valueKey] as number) / maxVal) * 100}%`,
                minHeight: "2px",
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-zinc-600">
            {d.minute}m
          </div>
        ))}
      </div>
    </div>
  );
}

function RatioSparkline({
  data,
  highlightGaps,
}: {
  data: { minute: number; ratio: number }[];
  highlightGaps: boolean;
}) {
  const maxRatio = Math.max(...data.map((d) => d.ratio), 1);
  const avgRatio = data.reduce((s, d) => s + d.ratio, 0) / data.length;

  return (
    <div className="space-y-1">
      <div className="text-xs text-zinc-500 font-medium">
        Tool Calls / Page (per minute)
      </div>
      <div className="flex items-end gap-1 h-20">
        {data.map((d, i) => {
          const isGap = highlightGaps && d.ratio > avgRatio * 1.3;
          return (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div
                className={`text-[10px] mb-0.5 ${
                  isGap ? "text-red-400 font-bold" : "text-zinc-500"
                }`}
              >
                {d.ratio.toFixed(1)}
              </div>
              <div
                className={`w-full rounded-t ${
                  isGap ? "bg-red-500" : "bg-blue-500"
                }`}
                style={{
                  height: `${(d.ratio / maxRatio) * 100}%`,
                  minHeight: "2px",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-zinc-600">
        <span>Avg: {avgRatio.toFixed(1)}x</span>
        {highlightGaps && (
          <span className="text-red-400">Red = gap (&gt;1.3x avg)</span>
        )}
      </div>
    </div>
  );
}

function ComparisonBars({ variants }: { variants: Variant[] }) {
  const maxRatio = Math.max(...variants.map((v) => v.ratio));

  return (
    <div className="space-y-2">
      {variants.map((v) => (
        <div key={v.id} className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span
              className={
                v.isWinner ? "text-green-400 font-medium" : "text-zinc-400"
              }
            >
              {v.name} {v.isWinner && "★"}
            </span>
            <span className="text-zinc-500">{v.ratio.toFixed(1)}x</span>
          </div>
          <div className="h-6 bg-zinc-800 rounded overflow-hidden">
            <div
              className={`h-full rounded transition-all ${
                v.isWinner ? "bg-green-600" : "bg-zinc-600"
              }`}
              style={{ width: `${(v.ratio / maxRatio) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────

export default function ExperimentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const experiment = EXPERIMENTS[id];

  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [showGaps, setShowGaps] = useState(true);

  if (!experiment) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-white">Experiment Not Found</h1>
        <p className="text-zinc-400">
          No experiment with ID &quot;{id}&quot;.
        </p>
        <Link href="/experiments" className="text-blue-400 hover:text-blue-300">
          Back to experiments
        </Link>
      </div>
    );
  }

  const activeVariant = selectedVariant
    ? experiment.variants.find((v) => v.id === selectedVariant)
    : null;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/experiments"
        className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        ← All Experiments
      </Link>

      {/* Header — stacks on mobile */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            {experiment.name}
          </h1>
          <span
            className={`text-xs px-2 py-0.5 rounded font-medium ${
              experiment.status === "completed"
                ? "bg-green-900/50 text-green-400"
                : "bg-yellow-900/50 text-yellow-400"
            }`}
          >
            {experiment.status}
          </span>
        </div>
        <p className="text-sm text-zinc-400">{experiment.hypothesis}</p>
      </div>

      {/* Key metrics — 2x2 grid on mobile, 4 cols on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Winner",
            value:
              experiment.variants.find((v) => v.id === experiment.winnerId)
                ?.name ?? "—",
          },
          { label: "Confidence", value: `${experiment.confidence}%` },
          {
            label: "Total Pages",
            value: experiment.variants
              .reduce((s, v) => s + v.pages, 0)
              .toString(),
          },
          {
            label: "Best Ratio",
            value:
              Math.min(...experiment.variants.map((v) => v.ratio)).toFixed(1) +
              "x",
          },
        ].map((m) => (
          <div
            key={m.label}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-3"
          >
            <div className="text-lg sm:text-xl font-bold text-white">
              {m.value}
            </div>
            <div className="text-xs text-zinc-500">{m.label}</div>
          </div>
        ))}
      </div>

      {/* ── moment.dev-style analytics iPhone card ────────────── */}
      {/* Single scrollable card optimized for 375px viewport */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {/* Card header — mimics iOS grouped style */}
        <div className="px-4 pt-4 pb-3 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">
                Efficiency Analytics
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                moment.dev — tool calls vs pages crawled
              </p>
            </div>
            <button
              onClick={() => setShowGaps(!showGaps)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                showGaps
                  ? "bg-red-900/50 text-red-400"
                  : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {showGaps ? "Gaps ON" : "Gaps OFF"}
            </button>
          </div>

          {/* Category pills — horizontally scrollable on iPhone */}
          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            {experiment.categories.map((cat) => (
              <span
                key={cat}
                className="shrink-0 text-[11px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>

        {/* Comparison overview — large touch target bars */}
        <div className="px-4 py-4 border-b border-zinc-800">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Ratio Comparison
          </h3>
          <ComparisonBars variants={experiment.variants} />
        </div>

        {/* Variant selector — pill tabs, touch friendly */}
        <div className="px-4 py-3 border-b border-zinc-800">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {experiment.variants.map((v) => (
              <button
                key={v.id}
                onClick={() =>
                  setSelectedVariant(selectedVariant === v.id ? null : v.id)
                }
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors ${
                  selectedVariant === v.id
                    ? v.isWinner
                      ? "bg-green-900/70 text-green-300 ring-1 ring-green-700"
                      : "bg-blue-900/70 text-blue-300 ring-1 ring-blue-700"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {v.name}
                {v.isWinner && " ★"}
              </button>
            ))}
          </div>
        </div>

        {/* Selected variant detail — time series charts */}
        {activeVariant ? (
          <div className="px-4 py-4 space-y-5">
            {/* KPI row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Quality", value: activeVariant.quality.toFixed(2) },
                {
                  label: "Cost",
                  value: `$${activeVariant.cost.toFixed(3)}`,
                },
                {
                  label: "Duration",
                  value: `${(activeVariant.durationMs / 1000).toFixed(1)}s`,
                },
              ].map((k) => (
                <div
                  key={k.label}
                  className="bg-zinc-800/50 rounded-lg p-2 text-center"
                >
                  <div className="text-sm font-bold text-white">{k.value}</div>
                  <div className="text-[10px] text-zinc-500">{k.label}</div>
                </div>
              ))}
            </div>

            {/* Ratio sparkline with gap highlighting */}
            <RatioSparkline
              data={activeVariant.timeSeries}
              highlightGaps={showGaps}
            />

            {/* Pages per minute */}
            <MiniBarChart
              data={activeVariant.timeSeries}
              valueKey="pages"
              label="Pages Crawled (per minute)"
              color="bg-emerald-500"
            />

            {/* Tool calls per minute */}
            <MiniBarChart
              data={activeVariant.timeSeries}
              valueKey="toolCalls"
              label="Tool Calls (per minute)"
              color="bg-amber-500"
            />

            {/* Efficiency summary */}
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="text-xs text-zinc-500 font-medium mb-2">
                Efficiency Summary
              </div>
              <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                <span className="text-zinc-500">Strategy</span>
                <span className="text-zinc-300 text-right">
                  {activeVariant.strategy.replace("_", " ")}
                </span>
                <span className="text-zinc-500">Total pages</span>
                <span className="text-zinc-300 text-right">
                  {activeVariant.pages}
                </span>
                <span className="text-zinc-500">Total tool calls</span>
                <span className="text-zinc-300 text-right">
                  {activeVariant.toolCalls}
                </span>
                <span className="text-zinc-500">Ratio</span>
                <span
                  className={`text-right font-medium ${
                    activeVariant.ratio <= 2.0
                      ? "text-green-400"
                      : activeVariant.ratio <= 4.0
                      ? "text-yellow-400"
                      : "text-red-400"
                  }`}
                >
                  {activeVariant.ratio.toFixed(1)}x
                </span>
                <span className="text-zinc-500">Pages/second</span>
                <span className="text-zinc-300 text-right">
                  {(
                    (activeVariant.pages / activeVariant.durationMs) *
                    1000
                  ).toFixed(2)}
                </span>
                <span className="text-zinc-500">Cost/page</span>
                <span className="text-zinc-300 text-right">
                  ${(activeVariant.cost / activeVariant.pages).toFixed(4)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-zinc-600">
            Tap a variant above to see detailed time-series analytics
          </div>
        )}

        {/* Footer — timestamp + org badge */}
        <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-600">
          <span>
            {new Date(experiment.completedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span className="bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">
            {experiment.targetOrg}
          </span>
        </div>
      </div>

      {/* Variant comparison table — full data */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">
          Variant Results
        </h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left p-3 text-zinc-500 font-medium">
                  Variant
                </th>
                <th className="text-right p-3 text-zinc-500 font-medium">
                  Pages
                </th>
                <th className="text-right p-3 text-zinc-500 font-medium">
                  Tool Calls
                </th>
                <th className="text-right p-3 text-zinc-500 font-medium">
                  Ratio
                </th>
                <th className="text-right p-3 text-zinc-500 font-medium">
                  Quality
                </th>
                <th className="text-right p-3 text-zinc-500 font-medium">
                  Cost
                </th>
              </tr>
            </thead>
            <tbody>
              {experiment.variants.map((v) => (
                <tr
                  key={v.id}
                  className={`border-b border-zinc-800/50 ${
                    v.isWinner ? "bg-green-950/20" : ""
                  }`}
                >
                  <td className="p-3">
                    <span
                      className={
                        v.isWinner
                          ? "text-green-400 font-medium"
                          : "text-white"
                      }
                    >
                      {v.name} {v.isWinner && "★"}
                    </span>
                    <div className="text-xs text-zinc-600">{v.strategy}</div>
                  </td>
                  <td className="p-3 text-right text-zinc-300">{v.pages}</td>
                  <td className="p-3 text-right text-zinc-300">
                    {v.toolCalls}
                  </td>
                  <td className="p-3 text-right">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        v.ratio <= 2.0
                          ? "bg-green-900/50 text-green-400"
                          : v.ratio <= 4.0
                          ? "bg-yellow-900/50 text-yellow-400"
                          : "bg-red-900/50 text-red-400"
                      }`}
                    >
                      {v.ratio.toFixed(1)}x
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        v.quality >= 0.75
                          ? "bg-green-900/50 text-green-400"
                          : "bg-yellow-900/50 text-yellow-400"
                      }`}
                    >
                      {v.quality.toFixed(2)}
                    </span>
                  </td>
                  <td className="p-3 text-right text-zinc-300">
                    ${v.cost.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
