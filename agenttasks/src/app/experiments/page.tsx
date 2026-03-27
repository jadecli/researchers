import Link from "next/link";

const EXPERIMENTS = [
  {
    id: "spotify-tool-strategy-v1",
    name: "Spotify Tool Strategy Comparison",
    status: "completed",
    variants: 4,
    winner: "Programmatic Tool Calling",
    winnerStrategy: "ptc",
    confidence: 78,
    targetOrg: "spotify",
    categories: ["experimentation", "metrics", "statistics", "data-quality"],
    hypothesis:
      "PTC and tool search strategies will achieve lower tool_calls/pages_crawled ratios than standard tool loop when crawling statistical packages.",
    results: {
      totalPages: 40,
      totalToolCalls: 135,
      overallRatio: 3.38,
      bestRatio: 1.5,
      worstRatio: 5.0,
    },
  },
  {
    id: "spotify-ptc-h2h-v1",
    name: "PTC vs Standard Head-to-Head",
    status: "completed",
    variants: 2,
    winner: "Programmatic Tool Calling",
    winnerStrategy: "ptc",
    confidence: 92,
    targetOrg: "spotify",
    categories: ["experimentation", "metrics"],
    hypothesis:
      "Programmatic tool calling will reduce tool call overhead by 60%+ compared to standard tool loop for batch GitHub API operations.",
    results: {
      totalPages: 20,
      totalToolCalls: 65,
      overallRatio: 3.25,
      bestRatio: 1.5,
      worstRatio: 5.0,
    },
  },
  {
    id: "spotify-quality-v1",
    name: "Thinking vs Tool Search Quality",
    status: "completed",
    variants: 2,
    winner: "Tool Search with Embeddings",
    winnerStrategy: "tool_search",
    confidence: 64,
    targetOrg: "spotify",
    categories: ["statistics", "data-quality", "ml-evaluation"],
    hypothesis:
      "Extended thinking will produce higher quality extractions while tool search will be more efficient.",
    results: {
      totalPages: 20,
      totalToolCalls: 70,
      overallRatio: 3.5,
      bestRatio: 3.0,
      worstRatio: 4.0,
    },
  },
];

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-900/50 text-green-400";
    case "running":
      return "bg-yellow-900/50 text-yellow-400";
    case "draft":
      return "bg-zinc-800 text-zinc-500";
    default:
      return "bg-zinc-800 text-zinc-500";
  }
}

function confidenceColor(c: number) {
  if (c >= 80) return "text-green-400";
  if (c >= 60) return "text-yellow-400";
  return "text-red-400";
}

export default function ExperimentsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">A/B Experiments</h1>
        <p className="text-zinc-400 mt-2">
          Split-testing crawl strategies across tool calling approaches.
          Comparing standard, extended thinking, tool search, and programmatic
          tool calling (PTC) on Spotify&apos;s statistical packages.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Experiments", value: EXPERIMENTS.length },
          {
            label: "Total Variants",
            value: EXPERIMENTS.reduce((s, e) => s + e.variants, 0),
          },
          {
            label: "Pages Crawled",
            value: EXPERIMENTS.reduce((s, e) => s + e.results.totalPages, 0),
          },
          {
            label: "Best Ratio",
            value:
              Math.min(...EXPERIMENTS.map((e) => e.results.bestRatio)).toFixed(
                1
              ) + "x",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
          >
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-sm text-zinc-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Experiment cards */}
      <div className="space-y-4">
        {EXPERIMENTS.map((exp) => (
          <Link
            key={exp.id}
            href={`/experiments/${exp.id}`}
            className="block bg-zinc-900 border border-zinc-800 rounded-lg p-5 hover:border-zinc-600 transition-colors group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                  {exp.name}
                </h3>
                <p className="text-sm text-zinc-500 mt-1">{exp.hypothesis}</p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ml-4 shrink-0 ${statusBadge(
                  exp.status
                )}`}
              >
                {exp.status}
              </span>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <span className="text-zinc-500">
                <span className="text-zinc-300">{exp.variants}</span> variants
              </span>
              <span className="text-zinc-500">
                <span className="text-zinc-300">
                  {exp.results.totalPages}
                </span>{" "}
                pages
              </span>
              <span className="text-zinc-500">
                Ratio:{" "}
                <span className="text-zinc-300">
                  {exp.results.overallRatio.toFixed(1)}x
                </span>
              </span>
              <span className="text-zinc-500">
                Winner:{" "}
                <span className="text-zinc-300">{exp.winner}</span>
              </span>
              <span className={`${confidenceColor(exp.confidence)}`}>
                {exp.confidence}% conf.
              </span>
            </div>

            <div className="flex gap-2 mt-3">
              {exp.categories.map((cat) => (
                <span
                  key={cat}
                  className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded"
                >
                  {cat}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>

      {/* Strategy comparison table */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">
          Strategy Benchmark
        </h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left p-3 text-zinc-500 font-medium">
                  Strategy
                </th>
                <th className="text-right p-3 text-zinc-500 font-medium">
                  Tool Calls/Page
                </th>
                <th className="text-right p-3 text-zinc-500 font-medium">
                  Token Reduction
                </th>
                <th className="text-right p-3 text-zinc-500 font-medium">
                  Cost/Page
                </th>
                <th className="text-left p-3 text-zinc-500 font-medium">
                  Source
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  name: "Standard",
                  ratio: 5.0,
                  tokenReduction: "baseline",
                  cost: "$0.015",
                  source: "Control",
                },
                {
                  name: "Extended Thinking",
                  ratio: 4.0,
                  tokenReduction: "~20%",
                  cost: "$0.020",
                  source: "Cookbook: extended-thinking",
                },
                {
                  name: "Tool Search",
                  ratio: 3.0,
                  tokenReduction: "~90%",
                  cost: "$0.006",
                  source: "Cookbook: tool-search-embeddings",
                },
                {
                  name: "PTC",
                  ratio: 1.5,
                  tokenReduction: "~85%",
                  cost: "$0.002",
                  source: "Cookbook: programmatic-tool-calling",
                },
              ].map((s) => (
                <tr key={s.name} className="border-b border-zinc-800/50">
                  <td className="p-3 text-white font-medium">{s.name}</td>
                  <td className="p-3 text-right">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        s.ratio <= 2.0
                          ? "bg-green-900/50 text-green-400"
                          : s.ratio <= 4.0
                          ? "bg-yellow-900/50 text-yellow-400"
                          : "bg-red-900/50 text-red-400"
                      }`}
                    >
                      {s.ratio.toFixed(1)}x
                    </span>
                  </td>
                  <td className="p-3 text-right text-zinc-300">
                    {s.tokenReduction}
                  </td>
                  <td className="p-3 text-right text-zinc-300">{s.cost}</td>
                  <td className="p-3 text-zinc-400">{s.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
