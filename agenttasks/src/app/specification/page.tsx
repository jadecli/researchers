export default function SpecificationPage() {
  return (
    <div className="prose prose-invert max-w-none">
      <h1>Specification</h1>
      <p className="text-zinc-400 text-lg">
        The complete format specification for Agent Tasks — covering both the TodoWrite
        (headless/SDK) and TaskCreate (interactive) schemas used by Claude Code.
      </p>

      <h2>Two Interfaces, Same Concept</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Interface</th>
              <th>Tools</th>
              <th>When</th>
              <th>How</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Interactive (terminal, desktop, IDE)</td>
              <td><code>TaskCreate, TaskGet, TaskList, TaskUpdate, TaskStop</code></td>
              <td>Session is interactive</td>
              <td>Incremental — one tool call per action</td>
            </tr>
            <tr>
              <td>Headless/SDK (<code>claude -p</code>, Agent SDK)</td>
              <td><code>TodoWrite</code></td>
              <td>Non-interactive or SDK</td>
              <td>Atomic — writes the entire todo list each call</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>TodoWrite Schema (the canonical structure)</h2>
      <p>From the Agent SDK docs, each <code>TodoWrite</code> call replaces the full list:</p>
      <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm">{`{
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
}`}</pre>

      <h3>Fields</h3>
      <table>
        <thead>
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Purpose</th></tr>
        </thead>
        <tbody>
          <tr><td><code>content</code></td><td>string</td><td>Yes</td><td>Task description</td></tr>
          <tr><td><code>status</code></td><td>{`"pending" | "in_progress" | "completed"`}</td><td>Yes</td><td>Current state</td></tr>
          <tr><td><code>activeForm</code></td><td>string</td><td>No</td><td>Spinner text while in_progress (falls back to content since v2.1.69)</td></tr>
        </tbody>
      </table>

      <h2>TaskCreate Schema (interactive mode)</h2>
      <table>
        <thead>
          <tr><th>Field</th><th>Purpose</th></tr>
        </thead>
        <tbody>
          <tr><td><code>subject</code></td><td>Short task title</td></tr>
          <tr><td><code>description</code></td><td>Detailed description (optional)</td></tr>
          <tr><td><code>activeForm</code></td><td>Spinner text (optional since v2.1.69 — falls back to subject)</td></tr>
        </tbody>
      </table>

      <h2>TaskUpdate Capabilities</h2>
      <ul>
        <li>Status transitions: <code>pending → in_progress → completed</code></li>
        <li>Dependencies: <code>addBlockedBy</code> / <code>addBlocks</code></li>
        <li>Task deletion via <code>status: &quot;deleted&quot;</code></li>
        <li>Owner assignment for team workflows</li>
        <li>Metadata for arbitrary key-value storage</li>
      </ul>

      <h2>Lifecycle: 3 States</h2>
      <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm text-center">{`pending → in_progress → completed`}</pre>

      <h2>Crawl Data Schema</h2>
      <p>Pages crawled by our Scrapy spiders produce items with this structure:</p>
      <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm">{`{
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
}`}</pre>

      <h2>Kimball Data Architecture</h2>
      <p>All data follows the three-layer Kimball architecture:</p>
      <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm">{`RUNTIME (write)    → 3NF, append-only, BRIN indexes
REPORTING (read)   → Star schema, SCD Type 2, bloom indexes
SEMANTIC (consume) → Business metric views only`}</pre>
    </div>
  );
}
