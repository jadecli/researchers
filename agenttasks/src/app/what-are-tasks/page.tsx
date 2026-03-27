export default function WhatAreTasksPage() {
  return (
    <div className="prose prose-invert max-w-none">
      <h1>What are tasks?</h1>
      <p className="text-zinc-400 text-lg">
        Agent Tasks are a structured format for orchestrating AI agent work — from crawling
        documentation to dispatching multi-agent workflows. Built on Claude Code&apos;s canonical
        task system (TodoWrite + TaskCreate) and extended with iterative quality improvement.
      </p>

      <h2>How tasks work</h2>
      <p>Tasks use <strong>progressive disclosure</strong> — the same pattern as Agent Skills:</p>
      <ol>
        <li><strong>Planning</strong> — Shannon 5-step thinking decomposes the goal into structured tasks with confidence scores.</li>
        <li><strong>Execution</strong> — Each task dispatches to the appropriate spider, agent, or platform.</li>
        <li><strong>Scoring</strong> — Quality is measured across 5 dimensions: completeness, structure, accuracy, coherence, safety.</li>
        <li><strong>Steering</strong> — Context deltas from each round steer the next iteration toward improvement.</li>
      </ol>

      <h2>The task lifecycle</h2>
      <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm">{`
Plan (Shannon Thinking)
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
  └─ steer_direction for next round
`}</pre>

      <h2>Data sources</h2>
      <p>Our crawlers have processed <strong>2,807 pages</strong> from 4 documentation sites:</p>
      <ul>
        <li><strong>Claude Code</strong> (71 pages) — Skills, agents, hooks, plugins, MCP, channels</li>
        <li><strong>Claude Platform</strong> (768 pages) — API, SDKs, tools, Agent SDK, structured output</li>
        <li><strong>Neon Postgres</strong> (414 pages) — Branching, extensions, serverless driver</li>
        <li><strong>Vercel</strong> (1,224 pages) — Deployment, Edge, ISR, frameworks</li>
      </ul>

      <h2>Key differences from Agent Skills</h2>
      <table>
        <thead>
          <tr><th>Agent Skills</th><th>Agent Tasks</th></tr>
        </thead>
        <tbody>
          <tr><td>Static SKILL.md files</td><td>Dynamic tasks with status lifecycle</td></tr>
          <tr><td>User installs skills</td><td>System discovers and assigns tasks</td></tr>
          <tr><td>Progressive disclosure of instructions</td><td>Progressive improvement via quality scoring</td></tr>
          <tr><td>Single agent activation</td><td>Multi-agent dispatch with coordinator</td></tr>
          <tr><td>Markdown + YAML</td><td>JSONL + Neon PG18 + Kimball schema</td></tr>
        </tbody>
      </table>

      <h2>Next steps</h2>
      <ul>
        <li><a href="/specification">View the specification</a> for the complete task schema.</li>
        <li><a href="/task-creation/quickstart">Create your first task</a> with the quickstart guide.</li>
        <li><a href="/pages">Browse crawled pages</a> to see the data.</li>
        <li><a href="/rounds">View quality trends</a> across crawl rounds.</li>
      </ul>
    </div>
  );
}
