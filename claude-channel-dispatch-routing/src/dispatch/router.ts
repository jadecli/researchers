// src/dispatch/router.ts — Dispatch Routing Engine
//
// Boris Cherny: branded types, readonly everything, no `any`, exhaustive switches.
// Kimball: Runtime layer — classifies events and logs routing decisions as JSONL.

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ChannelEvent } from '../channel/types.js';
import { PluginIndex, type PluginEntry } from './plugin-index.js';

// ── Task Type (Discriminated Union) ─────────────────────────

export type TaskType =
  | 'codegen'
  | 'research'
  | 'review'
  | 'deploy'
  | 'debug'
  | 'data'
  | 'security'
  | 'general';

// ── Complexity Level ────────────────────────────────────────

export type Complexity = 'simple' | 'moderate' | 'complex';

// ── Task Classification ─────────────────────────────────────

export type TaskClassification = {
  readonly taskType: TaskType;
  readonly complexity: Complexity;
  readonly keywords: ReadonlyArray<string>;
  readonly confidence: number;
};

// ── Agent Recommendation ────────────────────────────────────

export type ModelTier = 'opus' | 'sonnet' | 'haiku';

export type AgentRecommendation = {
  readonly agentId: string;
  readonly model: ModelTier;
  readonly tools: ReadonlyArray<string>;
  readonly rationale: string;
};

// ── Plugin Recommendation ───────────────────────────────────

export type PluginRecommendation = {
  readonly pluginName: string;
  readonly description: string;
  readonly homepage: string;
  readonly matchScore: number;
  readonly matchReason: string;
};

// ── Routing Decision ────────────────────────────────────────

export type RoutingDecision = {
  readonly event: ChannelEvent;
  readonly classification: TaskClassification;
  readonly agentRecommendation: AgentRecommendation;
  readonly pluginRecommendations: ReadonlyArray<PluginRecommendation>;
  readonly timestamp: string;
};

// ── Keyword Patterns ────────────────────────────────────────
// Each task type has trigger keywords and associated tool sets.

type TaskPattern = {
  readonly keywords: ReadonlyArray<string>;
  readonly agentId: string;
  readonly model: ModelTier;
  readonly tools: ReadonlyArray<string>;
  readonly rationale: string;
  readonly pluginCategory: string;
};

const TASK_PATTERNS: Readonly<Record<TaskType, TaskPattern>> = {
  codegen: {
    keywords: ['write', 'function', 'implement', 'code', 'generate', 'create class', 'build', 'scaffold', 'refactor', 'module'],
    agentId: 'agent-codegen',
    model: 'sonnet',
    tools: ['Edit', 'Write', 'Read', 'Bash', 'Glob', 'Grep'],
    rationale: 'Code generation tasks need fast, accurate code output with file editing tools.',
    pluginCategory: 'codegen',
  },
  research: {
    keywords: ['compare', 'research', 'analyze', 'investigate', 'summarize', 'explain', 'evaluate', 'study', 'review literature', 'survey'],
    agentId: 'agent-research',
    model: 'opus',
    tools: ['WebSearch', 'Read', 'WebFetch', 'Grep'],
    rationale: 'Research tasks require deep reasoning and web access for comprehensive analysis.',
    pluginCategory: 'memory',
  },
  review: {
    keywords: ['review', 'pr', 'pull request', 'code review', 'audit code', 'check quality', 'lint', 'feedback'],
    agentId: 'agent-review',
    model: 'sonnet',
    tools: ['Read', 'Grep', 'Glob', 'Bash'],
    rationale: 'Code review needs thorough reading with pattern matching across the codebase.',
    pluginCategory: 'testing',
  },
  deploy: {
    keywords: ['deploy', 'release', 'ci', 'cd', 'pipeline', 'ship', 'publish', 'rollout', 'infrastructure', 'provision'],
    agentId: 'agent-deploy',
    model: 'sonnet',
    tools: ['Bash', 'Read', 'Write', 'Edit'],
    rationale: 'Deployment tasks need shell access and config file manipulation.',
    pluginCategory: 'devops',
  },
  debug: {
    keywords: ['debug', 'fix', 'bug', 'error', 'crash', 'traceback', 'stack trace', 'broken', 'failing', 'diagnose'],
    agentId: 'agent-debug',
    model: 'sonnet',
    tools: ['Read', 'Grep', 'Bash', 'Edit', 'Glob'],
    rationale: 'Debugging requires reading logs, searching for patterns, and applying targeted fixes.',
    pluginCategory: 'debugging',
  },
  data: {
    keywords: ['data', 'query', 'sql', 'csv', 'parquet', 'transform', 'etl', 'pipeline', 'analytics', 'aggregate'],
    agentId: 'agent-data',
    model: 'sonnet',
    tools: ['Bash', 'Read', 'Write', 'Grep'],
    rationale: 'Data tasks need query execution and file format manipulation.',
    pluginCategory: 'data',
  },
  security: {
    keywords: ['security', 'vulnerability', 'vulnerabilities', 'scan', 'cve', 'audit', 'penetration', 'injection', 'xss', 'csrf', 'secrets'],
    agentId: 'agent-security',
    model: 'opus',
    tools: ['Read', 'Grep', 'Bash', 'Glob', 'WebSearch'],
    rationale: 'Security analysis requires deep reasoning, thorough scanning, and vulnerability database lookups.',
    pluginCategory: 'security',
  },
  general: {
    keywords: [],
    agentId: 'agent-general',
    model: 'haiku',
    tools: ['Read', 'Bash'],
    rationale: 'General tasks use a lightweight model for quick, straightforward responses.',
    pluginCategory: 'workflow',
  },
};

// ── Complexity Heuristics ───────────────────────────────────

const COMPLEX_SIGNALS: ReadonlyArray<string> = [
  'architecture', 'design', 'system', 'migrate', 'rewrite',
  'multi-step', 'comprehensive', 'end-to-end', 'full',
];

const SIMPLE_SIGNALS: ReadonlyArray<string> = [
  'simple', 'quick', 'small', 'tiny', 'one-liner', 'trivial',
  'basic', 'hello world',
];

// ── assertNever ─────────────────────────────────────────────

function assertNever(_value: never): never {
  throw new Error('Unexpected value in exhaustive check');
}

// ── Dispatch Router ─────────────────────────────────────────

export class DispatchRouter {
  private readonly logPath: string | undefined;

  constructor(logPath?: string) {
    this.logPath = logPath;
    if (logPath !== undefined) {
      mkdirSync(dirname(logPath), { recursive: true });
    }
  }

  /**
   * Classify an inbound channel event by task type, complexity, and confidence.
   */
  classifyEvent(event: ChannelEvent): TaskClassification {
    const contentLower = event.content.toLowerCase();

    let bestType: TaskType = 'general';
    let bestScore = 0;
    const matchedKeywords: string[] = [];

    const taskTypes: ReadonlyArray<TaskType> = [
      'codegen', 'research', 'review', 'deploy', 'debug', 'data', 'security', 'general',
    ];

    for (const taskType of taskTypes) {
      const pattern = TASK_PATTERNS[taskType];
      let score = 0;
      const hits: string[] = [];

      for (const keyword of pattern.keywords) {
        if (contentLower.includes(keyword)) {
          score += 1;
          hits.push(keyword);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestType = taskType;
        matchedKeywords.length = 0;
        matchedKeywords.push(...hits);
      }
    }

    // Compute complexity
    const complexity = this.assessComplexity(contentLower);

    // Compute confidence (0-1)
    const totalKeywords = TASK_PATTERNS[bestType].keywords.length;
    const rawConfidence = totalKeywords > 0 ? bestScore / totalKeywords : 0;
    const confidence = Math.min(1, Math.max(0, bestScore > 0 ? 0.3 + rawConfidence * 0.7 : 0.1));

    return {
      taskType: bestType,
      complexity,
      keywords: matchedKeywords,
      confidence,
    };
  }

  /**
   * Route a classified task to the best agent + model + tools.
   */
  routeToAgent(classification: TaskClassification): AgentRecommendation {
    const pattern = TASK_PATTERNS[classification.taskType];

    // Upgrade model for complex tasks
    let model: ModelTier = pattern.model;
    if (classification.complexity === 'complex' && model !== 'opus') {
      model = 'opus';
    }

    return {
      agentId: pattern.agentId,
      model,
      tools: pattern.tools,
      rationale: pattern.rationale,
    };
  }

  /**
   * Find top 3 community plugins matching the task classification.
   */
  routeToPlugin(
    classification: TaskClassification,
    pluginIndex: PluginIndex,
  ): ReadonlyArray<PluginRecommendation> {
    const pattern = TASK_PATTERNS[classification.taskType];

    // Search by classification keywords + task-type-specific keywords
    const searchTerms = [
      ...classification.keywords,
      classification.taskType,
    ];

    const results = pluginIndex.search(searchTerms, pattern.pluginCategory);
    const top3 = results.slice(0, 3);

    return top3.map((entry: PluginEntry, index: number) => ({
      pluginName: entry.name,
      description: entry.description,
      homepage: entry.homepage,
      matchScore: Math.max(0.1, 1 - index * 0.25),
      matchReason: `Matched on keywords [${searchTerms.join(', ')}] in category "${pattern.pluginCategory}".`,
    }));
  }

  /**
   * Log a routing decision as a JSONL line.
   */
  logDecision(decision: RoutingDecision): void {
    if (this.logPath === undefined) {
      return;
    }

    const line = JSON.stringify({
      timestamp: decision.timestamp,
      taskType: decision.classification.taskType,
      complexity: decision.classification.complexity,
      confidence: decision.classification.confidence,
      agentId: decision.agentRecommendation.agentId,
      model: decision.agentRecommendation.model,
      pluginCount: decision.pluginRecommendations.length,
      source: decision.event.source,
      contentPreview: decision.event.content.slice(0, 100),
    });

    appendFileSync(this.logPath, line + '\n', 'utf-8');
  }

  // ── Private Helpers ─────────────────────────────────────────

  private assessComplexity(contentLower: string): Complexity {
    const hasComplex = COMPLEX_SIGNALS.some((s) => contentLower.includes(s));
    const hasSimple = SIMPLE_SIGNALS.some((s) => contentLower.includes(s));

    if (hasComplex && !hasSimple) return 'complex';
    if (hasSimple && !hasComplex) return 'simple';

    // Word count heuristic
    const wordCount = contentLower.split(/\s+/).length;
    if (wordCount > 50) return 'complex';
    if (wordCount < 10) return 'simple';

    return 'moderate';
  }
}
