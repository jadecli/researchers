// src/dispatch/plugin-index.ts — Community Plugin Index
//
// Boris Cherny: readonly everything, no `any`, Result<T,E> for fallible ops.
// Kimball: Runtime layer — records plugin metadata for dispatch routing.

import { readFileSync } from 'node:fs';

// ── Plugin Entry Type ───────────────────────────────────────

export type PluginEntry = {
  readonly name: string;
  readonly description: string;
  readonly homepage: string;
  readonly category?: string | undefined;
  readonly keywords: ReadonlyArray<string>;
};

// ── Built-in Plugin Catalog ─────────────────────────────────
// 20 representative entries from the MCP community catalog.

export const BUILTIN_PLUGINS: ReadonlyArray<PluginEntry> = [
  // codegen — production-grade, spec-first
  {
    name: 'codegen-production',
    description: 'Production-grade code generation with type safety and error handling built in.',
    homepage: 'https://github.com/community/codegen-production',
    category: 'codegen',
    keywords: ['codegen', 'typescript', 'production', 'type-safe', 'generation'],
  },
  {
    name: 'spec-first-codegen',
    description: 'Generate code from OpenAPI and JSON Schema specs with full validation.',
    homepage: 'https://github.com/community/spec-first-codegen',
    category: 'codegen',
    keywords: ['codegen', 'openapi', 'spec', 'schema', 'generation', 'api'],
  },

  // security — aikido, ai-guard, railguard
  {
    name: 'aikido-security',
    description: 'Runtime application security monitoring and vulnerability detection for AI agents.',
    homepage: 'https://github.com/AikidoSec/firewall-node',
    category: 'security',
    keywords: ['security', 'vulnerability', 'scan', 'firewall', 'runtime', 'protection'],
  },
  {
    name: 'ai-guard',
    description: 'Guardrails for AI-generated code to prevent injection and unsafe patterns.',
    homepage: 'https://github.com/community/ai-guard',
    category: 'security',
    keywords: ['security', 'guardrails', 'injection', 'sanitization', 'safe'],
  },
  {
    name: 'railguard',
    description: 'Policy-as-code enforcement for LLM tool calls with deny-by-default posture.',
    homepage: 'https://github.com/community/railguard',
    category: 'security',
    keywords: ['security', 'policy', 'enforcement', 'deny', 'permissions', 'audit'],
  },

  // testing — playwright-pro, tdd-guard, bugbash
  {
    name: 'playwright-pro',
    description: 'Advanced Playwright test generation and execution with visual regression support.',
    homepage: 'https://github.com/community/playwright-pro',
    category: 'testing',
    keywords: ['testing', 'playwright', 'e2e', 'browser', 'visual', 'regression'],
  },
  {
    name: 'tdd-guard',
    description: 'Enforce test-driven development workflows: tests must exist before implementation.',
    homepage: 'https://github.com/community/tdd-guard',
    category: 'testing',
    keywords: ['testing', 'tdd', 'test-driven', 'guard', 'workflow', 'enforcement'],
  },
  {
    name: 'bugbash',
    description: 'Automated bug reproduction and minimal test case generation from issue reports.',
    homepage: 'https://github.com/community/bugbash',
    category: 'testing',
    keywords: ['testing', 'bug', 'reproduction', 'minimal', 'test-case', 'debug'],
  },

  // debugging — debug-skill, karellen-rr-mcp
  {
    name: 'debug-skill',
    description: 'Structured debugging workflows: bisect, trace, and root-cause analysis.',
    homepage: 'https://github.com/community/debug-skill',
    category: 'debugging',
    keywords: ['debug', 'debugging', 'bisect', 'trace', 'root-cause', 'analysis'],
  },
  {
    name: 'karellen-rr-mcp',
    description: 'Record-and-replay debugging via rr for deterministic failure reproduction.',
    homepage: 'https://github.com/nichochar/karellen-rr-mcp',
    category: 'debugging',
    keywords: ['debug', 'debugging', 'record', 'replay', 'rr', 'deterministic'],
  },

  // data — duckdb-skills, data-converter
  {
    name: 'duckdb-skills',
    description: 'In-process analytics with DuckDB: query CSV, Parquet, and JSON without a server.',
    homepage: 'https://github.com/community/duckdb-skills',
    category: 'data',
    keywords: ['data', 'duckdb', 'analytics', 'sql', 'parquet', 'csv', 'query'],
  },
  {
    name: 'data-converter',
    description: 'Convert between data formats: JSON, CSV, Parquet, Arrow, JSONL with schema inference.',
    homepage: 'https://github.com/community/data-converter',
    category: 'data',
    keywords: ['data', 'convert', 'format', 'json', 'csv', 'parquet', 'transform'],
  },

  // devops — astronomer, coderocket
  {
    name: 'astronomer',
    description: 'Airflow DAG generation, deployment, and monitoring for data pipeline orchestration.',
    homepage: 'https://github.com/community/astronomer',
    category: 'devops',
    keywords: ['devops', 'deploy', 'airflow', 'dag', 'pipeline', 'orchestration', 'ci'],
  },
  {
    name: 'coderocket',
    description: 'CI/CD pipeline configuration and deployment automation across cloud providers.',
    homepage: 'https://github.com/community/coderocket',
    category: 'devops',
    keywords: ['devops', 'deploy', 'ci', 'cd', 'pipeline', 'cloud', 'automation'],
  },

  // memory — agent-recall, engram, hipocampus
  {
    name: 'agent-recall',
    description: 'Persistent memory for AI agents: store and retrieve conversation context across sessions.',
    homepage: 'https://github.com/community/agent-recall',
    category: 'memory',
    keywords: ['memory', 'recall', 'context', 'persistent', 'session', 'agent'],
  },
  {
    name: 'engram',
    description: 'Semantic memory graph for agents with similarity search and temporal decay.',
    homepage: 'https://github.com/community/engram',
    category: 'memory',
    keywords: ['memory', 'semantic', 'graph', 'similarity', 'search', 'embeddings'],
  },
  {
    name: 'hipocampus',
    description: 'Long-term episodic memory with automatic summarization and priority-based retrieval.',
    homepage: 'https://github.com/community/hipocampus',
    category: 'memory',
    keywords: ['memory', 'episodic', 'long-term', 'summarization', 'retrieval', 'priority'],
  },

  // workflow — claude-workflow, groundwork, flow
  {
    name: 'claude-workflow',
    description: 'Multi-step workflow orchestration for Claude with checkpointing and rollback.',
    homepage: 'https://github.com/community/claude-workflow',
    category: 'workflow',
    keywords: ['workflow', 'orchestration', 'multi-step', 'checkpoint', 'rollback', 'agent'],
  },
  {
    name: 'groundwork',
    description: 'Project scaffolding and boilerplate generation from templates and conventions.',
    homepage: 'https://github.com/community/groundwork',
    category: 'workflow',
    keywords: ['workflow', 'scaffold', 'template', 'boilerplate', 'project', 'init'],
  },
  {
    name: 'flow',
    description: 'Visual workflow builder with conditional branching, loops, and parallel execution.',
    homepage: 'https://github.com/community/flow',
    category: 'workflow',
    keywords: ['workflow', 'flow', 'branching', 'parallel', 'visual', 'builder'],
  },
] as const;

// ── Plugin Index ────────────────────────────────────────────

export class PluginIndex {
  private readonly entries: ReadonlyArray<PluginEntry>;

  constructor(entries?: ReadonlyArray<PluginEntry>) {
    this.entries = entries ?? BUILTIN_PLUGINS;
  }

  /**
   * Load a PluginIndex from a JSONL file.
   * Each line is a JSON-encoded PluginEntry.
   * Falls back to BUILTIN_PLUGINS if the file cannot be read.
   */
  static fromJsonl(path: string): PluginIndex {
    try {
      const raw = readFileSync(path, 'utf-8');
      const lines = raw.split('\n').filter((line) => line.trim().length > 0);
      const parsed: PluginEntry[] = [];

      for (const line of lines) {
        const obj: unknown = JSON.parse(line);
        if (isPluginEntry(obj)) {
          parsed.push(obj);
        }
      }

      return new PluginIndex(parsed.length > 0 ? parsed : BUILTIN_PLUGINS);
    } catch {
      return new PluginIndex(BUILTIN_PLUGINS);
    }
  }

  /**
   * Search plugins by keywords with optional category filter.
   * Returns entries ranked by number of matching keywords (descending).
   */
  search(keywords: ReadonlyArray<string>, category?: string): ReadonlyArray<PluginEntry> {
    const lowerKeywords = keywords.map((k) => k.toLowerCase());

    const scored: Array<{ readonly entry: PluginEntry; readonly score: number }> = [];

    for (const entry of this.entries) {
      // Category filter
      if (category !== undefined && entry.category !== category) {
        continue;
      }

      // Score by keyword overlap
      const entryKeywords = entry.keywords.map((k) => k.toLowerCase());
      const descriptionLower = entry.description.toLowerCase();
      const nameLower = entry.name.toLowerCase();

      let score = 0;
      for (const kw of lowerKeywords) {
        // Direct keyword match
        if (entryKeywords.some((ek) => ek.includes(kw) || kw.includes(ek))) {
          score += 2;
        }
        // Description match
        if (descriptionLower.includes(kw)) {
          score += 1;
        }
        // Name match
        if (nameLower.includes(kw)) {
          score += 1;
        }
      }

      if (score > 0) {
        scored.push({ entry, score });
      }
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    return scored.map((s) => s.entry);
  }

  /**
   * Get a plugin by exact name match.
   */
  getByName(name: string): PluginEntry | undefined {
    return this.entries.find((e) => e.name === name);
  }

  /**
   * Return all unique categories present in the index.
   */
  getCategories(): ReadonlyArray<string> {
    const categories = new Set<string>();
    for (const entry of this.entries) {
      if (entry.category !== undefined) {
        categories.add(entry.category);
      }
    }
    return [...categories].sort();
  }

  /**
   * Number of plugins in the index.
   */
  size(): number {
    return this.entries.length;
  }
}

// ── Type Guard ──────────────────────────────────────────────

function isPluginEntry(value: unknown): value is PluginEntry {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['name'] === 'string' &&
    typeof obj['description'] === 'string' &&
    typeof obj['homepage'] === 'string' &&
    Array.isArray(obj['keywords']) &&
    (obj['keywords'] as unknown[]).every((k) => typeof k === 'string')
  );
}
