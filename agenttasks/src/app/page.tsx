import Link from "next/link";

const STATS = {
  totalPages: 2807,
  totalChars: "41.2M",
  sources: 4,
  rounds: 5,
  avgQuality: 0.74,
  languages: 5,
  tests: 386,
  repos: 8,
};

const SOURCES = [
  { name: "Claude Code", domain: "code.claude.com", pages: 71, quality: 0.819 },
  { name: "Claude Platform", domain: "platform.claude.com", pages: 768, quality: 0.706 },
  { name: "Neon Postgres", domain: "neon.com", pages: 414, quality: 0.816 },
  { name: "Vercel", domain: "vercel.com", pages: 1224, quality: 0.792 },
];

const CARDS = [
  { title: "What are tasks?", description: "Learn about agent tasks, how they work with crawled data, and why they matter.", href: "/what-are-tasks", icon: "💡" },
  { title: "Specification", description: "The complete format specification for task schemas — TodoWrite and TaskCreate.", href: "/specification", icon: "📄" },
  { title: "Browse Pages", description: "Search and explore 2,807 crawled documentation pages with quality scores.", href: "/pages", icon: "📚" },
  { title: "View Rounds", description: "Track quality improvement across 5 iterative crawl rounds.", href: "/rounds", icon: "🔄" },
  { title: "Task Queue", description: "View and manage tasks following Claude Code's canonical task schema.", href: "/tasks", icon: "✅" },
  { title: "Integration Guide", description: "Add task support to your agent or tool.", href: "/integration/adding-task-support", icon: "⚙️" },
];

export default function Home() {
  return (
    <div className="space-y-12">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-white">AgentTasks</h1>
        <p className="text-xl text-zinc-400 max-w-2xl">
          A data-driven task orchestration platform for AI agents. Built on{" "}
          <strong className="text-white">{STATS.totalPages.toLocaleString()}</strong> crawled
          documentation pages from Claude, Neon, and Vercel — with iterative quality
          improvement across {STATS.rounds} rounds.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Pages Crawled", value: STATS.totalPages.toLocaleString() },
          { label: "Content", value: STATS.totalChars + " chars" },
          { label: "Avg Quality", value: STATS.avgQuality.toFixed(2) },
          { label: "Tests Passing", value: STATS.tests + "/386" },
        ].map((stat) => (
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-sm text-zinc-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Data Sources</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left p-3 text-zinc-500 font-medium">Source</th>
                <th className="text-left p-3 text-zinc-500 font-medium">Domain</th>
                <th className="text-right p-3 text-zinc-500 font-medium">Pages</th>
                <th className="text-right p-3 text-zinc-500 font-medium">Quality</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map((s) => (
                <tr key={s.domain} className="border-b border-zinc-800/50">
                  <td className="p-3 text-white font-medium">{s.name}</td>
                  <td className="p-3 text-zinc-400">{s.domain}</td>
                  <td className="p-3 text-right text-zinc-300">{s.pages.toLocaleString()}</td>
                  <td className="p-3 text-right">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      s.quality >= 0.8 ? "bg-green-900/50 text-green-400"
                        : s.quality >= 0.7 ? "bg-yellow-900/50 text-yellow-400"
                          : "bg-red-900/50 text-red-400"
                    }`}>{s.quality.toFixed(3)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Get Started</h2>
        <div className="grid grid-cols-3 gap-4">
          {CARDS.map((card) => (
            <Link key={card.href} href={card.href}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 hover:border-zinc-600 transition-colors group">
              <div className="text-2xl mb-2">{card.icon}</div>
              <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors">{card.title}</h3>
              <p className="text-sm text-zinc-500 mt-1">{card.description}</p>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Architecture</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <pre className="text-xs text-zinc-400 font-mono overflow-x-auto">{`8 repos │ 39 commits │ 708 source files │ 386 tests │ 2,807 pages

claude-code                 → Scrapy spiders + 12 language extractors
claude-code-agents-python   → DSPy pipeline + plugin generation
claude-code-actions         → GitHub Actions + Chrome + Slack
claude-code-security-review → SSRF/PII/injection scanners
claude-multi-agent-sdk      → Branded types + agent loop + MCP
claude-multi-agent-dispatch → 10-round system + Shannon thinking
claude-channel-dispatch     → Channels + Neon PG18 + routing
claude-dspy-crawl-planning  → Shannon planner + crawl runner

Data: Kimball 3-layer (Runtime → Reporting → Semantic)
DB:   Neon Postgres 18 (pgvector, bloom, timescaledb, pg_cron)
LSP:  Python, TypeScript, Go, C/C++, Swift (5 installed)`}</pre>
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-6 text-sm text-zinc-600">
        Built with Next.js + Neon Postgres 18. Data from iterative Scrapy crawls
        with quality scoring. Open format following{" "}
        <a href="https://agentskills.io" className="text-zinc-400 hover:text-white">Agent Skills</a> patterns.
      </div>
    </div>
  );
}
