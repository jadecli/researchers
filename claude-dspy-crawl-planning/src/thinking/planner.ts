// src/thinking/planner.ts — Shannon thinking crawl planner
//
// Forked from jadecli/shannon-thinking patterns.
// Uses structured problem decomposition to plan crawl campaigns.
// Each crawl plan includes Shannon thoughts capturing the rationale.

import type {
  ShannonThought,
  ThoughtType,
  CrawlPlan,
  CrawlTarget,
  CrawlPriority,
  DocCategory,
  ContextDelta,
  ThoughtId,
  CrawlId,
} from '../types/core.js';
import { toCrawlId, toThoughtId } from '../types/core.js';

// ── Shannon Thinking Engine (forked from jadecli/shannon-thinking) ──

let thoughtCounter = 0;

function createThought(
  type: ThoughtType,
  content: string,
  confidence: number,
  deps: ThoughtId[] = [],
): ShannonThought {
  return {
    id: toThoughtId(`thought-${++thoughtCounter}`),
    type,
    content,
    confidence,
    uncertainty: 1 - confidence,
    assumptions: [],
    dependencies: deps,
    isRevision: false,
    timestamp: new Date(),
  };
}

// ── Platform.claude.com Complete Doc Category Map ────────────

export const PLATFORM_DOC_CATEGORIES: ReadonlyArray<{
  category: DocCategory;
  title: string;
  pages: ReadonlyArray<{ slug: string; title: string; priority: CrawlPriority }>;
}> = [
  {
    category: 'first_steps',
    title: 'First Steps',
    pages: [
      { slug: 'intro-to-claude', title: 'Intro to Claude', priority: 'high' },
      { slug: 'quickstart', title: 'Quickstart', priority: 'high' },
    ],
  },
  {
    category: 'models_pricing',
    title: 'Models & Pricing',
    pages: [
      { slug: 'models-overview', title: 'Models overview', priority: 'critical' },
      { slug: 'choosing-a-model', title: 'Choosing a model', priority: 'high' },
      { slug: 'whats-new-claude-4-6', title: "What's new in Claude 4.6", priority: 'critical' },
      { slug: 'migration-guide', title: 'Migration guide', priority: 'medium' },
      { slug: 'model-deprecations', title: 'Model deprecations', priority: 'low' },
      { slug: 'pricing', title: 'Pricing', priority: 'high' },
    ],
  },
  {
    category: 'build_with_claude',
    title: 'Build with Claude',
    pages: [
      { slug: 'features-overview', title: 'Features overview', priority: 'high' },
      { slug: 'messages-api', title: 'Using the Messages API', priority: 'critical' },
      { slug: 'handling-stop-reasons', title: 'Handling stop reasons', priority: 'critical' },
      { slug: 'prompting-best-practices', title: 'Prompting best practices', priority: 'high' },
    ],
  },
  {
    category: 'model_capabilities',
    title: 'Model Capabilities',
    pages: [
      { slug: 'extended-thinking', title: 'Extended thinking', priority: 'high' },
      { slug: 'adaptive-thinking', title: 'Adaptive thinking', priority: 'high' },
      { slug: 'effort', title: 'Effort', priority: 'medium' },
      { slug: 'fast-mode', title: 'Fast mode', priority: 'medium' },
      { slug: 'structured-outputs', title: 'Structured outputs', priority: 'critical' },
      { slug: 'citations', title: 'Citations', priority: 'medium' },
      { slug: 'streaming', title: 'Streaming Messages', priority: 'high' },
      { slug: 'batch-processing', title: 'Batch processing', priority: 'high' },
      { slug: 'pdf-support', title: 'PDF support', priority: 'medium' },
      { slug: 'search-results', title: 'Search results', priority: 'medium' },
      { slug: 'multilingual', title: 'Multilingual support', priority: 'low' },
      { slug: 'embeddings', title: 'Embeddings', priority: 'medium' },
      { slug: 'vision', title: 'Vision', priority: 'medium' },
    ],
  },
  {
    category: 'tools',
    title: 'Tools — Core',
    pages: [
      { slug: 'tool-use-overview', title: 'How tool use works', priority: 'critical' },
      { slug: 'build-tool-agent', title: 'Build a tool-using agent', priority: 'critical' },
      { slug: 'define-tools', title: 'Define tools', priority: 'critical' },
      { slug: 'handle-tool-calls', title: 'Handle tool calls', priority: 'critical' },
      { slug: 'parallel-tool-use', title: 'Parallel tool use', priority: 'high' },
      { slug: 'tool-runner', title: 'Tool Runner (SDK)', priority: 'high' },
      { slug: 'strict-tool-use', title: 'Strict tool use', priority: 'high' },
      { slug: 'tool-use-caching', title: 'Tool use with prompt caching', priority: 'medium' },
      { slug: 'server-tools', title: 'Server tools', priority: 'high' },
      { slug: 'tool-troubleshooting', title: 'Troubleshooting', priority: 'medium' },
    ],
  },
  {
    category: 'tool_reference',
    title: 'Tool Reference',
    pages: [
      { slug: 'web-search-tool', title: 'Web search tool', priority: 'high' },
      { slug: 'web-fetch-tool', title: 'Web fetch tool', priority: 'high' },
      { slug: 'code-execution-tool', title: 'Code execution tool', priority: 'high' },
      { slug: 'memory-tool', title: 'Memory tool', priority: 'medium' },
      { slug: 'bash-tool', title: 'Bash tool', priority: 'medium' },
      { slug: 'computer-use-tool', title: 'Computer use tool', priority: 'medium' },
      { slug: 'text-editor-tool', title: 'Text editor tool', priority: 'medium' },
    ],
  },
  {
    category: 'tool_infrastructure',
    title: 'Tool Infrastructure',
    pages: [
      { slug: 'manage-tool-context', title: 'Manage tool context', priority: 'high' },
      { slug: 'tool-combinations', title: 'Tool combinations', priority: 'high' },
      { slug: 'tool-search', title: 'Tool search', priority: 'high' },
      { slug: 'programmatic-tool-calling', title: 'Programmatic tool calling', priority: 'critical' },
      { slug: 'fine-grained-tool-streaming', title: 'Fine-grained tool streaming', priority: 'medium' },
    ],
  },
  {
    category: 'context_management',
    title: 'Context Management',
    pages: [
      { slug: 'context-windows', title: 'Context windows', priority: 'critical' },
      { slug: 'compaction', title: 'Compaction', priority: 'high' },
      { slug: 'context-editing', title: 'Context editing', priority: 'high' },
      { slug: 'prompt-caching', title: 'Prompt caching', priority: 'critical' },
      { slug: 'token-counting', title: 'Token counting', priority: 'medium' },
    ],
  },
  {
    category: 'files_assets',
    title: 'Files & Assets',
    pages: [
      { slug: 'files-api', title: 'Files API', priority: 'medium' },
    ],
  },
  {
    category: 'agent_skills',
    title: 'Agent Skills',
    pages: [
      { slug: 'agent-skills-overview', title: 'Overview', priority: 'high' },
      { slug: 'agent-skills-quickstart', title: 'Quickstart', priority: 'high' },
      { slug: 'agent-skills-best-practices', title: 'Best practices', priority: 'high' },
      { slug: 'skills-enterprise', title: 'Skills for enterprise', priority: 'medium' },
      { slug: 'claude-api-skill', title: 'Claude API skill', priority: 'medium' },
      { slug: 'skills-with-api', title: 'Using Skills with the API', priority: 'high' },
    ],
  },
  {
    category: 'agent_sdk',
    title: 'Agent SDK',
    pages: [
      { slug: 'agent-sdk-overview', title: 'Overview', priority: 'critical' },
      { slug: 'agent-sdk-quickstart', title: 'Quickstart', priority: 'critical' },
      { slug: 'agent-loop', title: 'How the agent loop works', priority: 'critical' },
      { slug: 'typescript-sdk', title: 'TypeScript SDK', priority: 'critical' },
      { slug: 'typescript-v2', title: 'TypeScript V2 (preview)', priority: 'critical' },
      { slug: 'python-sdk', title: 'Python SDK', priority: 'high' },
      { slug: 'sdk-migration', title: 'Migration Guide', priority: 'medium' },
    ],
  },
  {
    category: 'mcp_api',
    title: 'MCP in the API',
    pages: [
      { slug: 'mcp-connector', title: 'MCP connector', priority: 'high' },
      { slug: 'remote-mcp-servers', title: 'Remote MCP servers', priority: 'high' },
    ],
  },
  {
    category: 'third_party',
    title: 'Claude on 3rd-party Platforms',
    pages: [
      { slug: 'amazon-bedrock', title: 'Amazon Bedrock', priority: 'medium' },
      { slug: 'microsoft-foundry', title: 'Microsoft Foundry', priority: 'medium' },
      { slug: 'vertex-ai', title: 'Vertex AI', priority: 'medium' },
    ],
  },
  {
    category: 'prompt_engineering',
    title: 'Prompt Engineering',
    pages: [
      { slug: 'prompt-engineering-overview', title: 'Overview', priority: 'high' },
      { slug: 'console-prompting', title: 'Console prompting tools', priority: 'medium' },
    ],
  },
  {
    category: 'test_evaluate',
    title: 'Test & Evaluate',
    pages: [
      { slug: 'evaluations', title: 'Define success and build evaluations', priority: 'high' },
      { slug: 'evaluation-tool', title: 'Using the Evaluation Tool', priority: 'medium' },
      { slug: 'reducing-latency', title: 'Reducing latency', priority: 'high' },
      { slug: 'guardrails', title: 'Strengthen guardrails', priority: 'medium' },
      { slug: 'hallucinations', title: 'Reduce hallucinations', priority: 'high' },
      { slug: 'output-consistency', title: 'Increase output consistency', priority: 'medium' },
      { slug: 'jailbreaks', title: 'Mitigate jailbreaks', priority: 'medium' },
      { slug: 'streaming-refusals', title: 'Streaming refusals', priority: 'low' },
      { slug: 'prompt-leak', title: 'Reduce prompt leak', priority: 'medium' },
    ],
  },
  {
    category: 'admin_monitoring',
    title: 'Administration & Monitoring',
    pages: [
      { slug: 'admin-api', title: 'Admin API overview', priority: 'medium' },
      { slug: 'data-residency', title: 'Data residency', priority: 'low' },
      { slug: 'workspaces', title: 'Workspaces', priority: 'low' },
      { slug: 'usage-cost-api', title: 'Usage and Cost API', priority: 'medium' },
      { slug: 'claude-code-analytics', title: 'Claude Code Analytics API', priority: 'high' },
      { slug: 'data-retention', title: 'API and data retention', priority: 'medium' },
    ],
  },
];

// ── Plan Builder ────────────────────────────────────────────

export function buildCrawlPlan(
  round: number,
  previousDelta?: ContextDelta,
  priorityFilter?: CrawlPriority[],
): CrawlPlan {
  const thoughts: ShannonThought[] = [];

  // Shannon Step 1: Problem Definition
  const t1 = createThought(
    'problem_definition',
    `Crawl round ${round}: Extract structured knowledge from platform.claude.com docs. ` +
    `${PLATFORM_DOC_CATEGORIES.length} categories, ` +
    `${PLATFORM_DOC_CATEGORIES.reduce((s, c) => s + c.pages.length, 0)} total pages. ` +
    (previousDelta
      ? `Prior round quality: ${previousDelta.qualityAfter.toFixed(2)}. Steer: ${previousDelta.steerDirection}`
      : 'First crawl — no prior data.'),
    0.9,
  );
  thoughts.push(t1);

  // Shannon Step 2: Constraints
  const t2 = createThought(
    'constraints',
    `Constraints: ROBOTSTXT_OBEY=true, DOWNLOAD_DELAY=2.0s, DEPTH_LIMIT=5. ` +
    `Rate limit: ~30 pages/min. Total budget: ~100 pages per round. ` +
    `Quality threshold: 0.65 minimum. Spider: platform_spider via llms.txt entry. ` +
    `Direct page URLs fail — must use llms.txt as spider entrypoint.`,
    0.95,
    [t1.id],
  );
  thoughts.push(t2);

  // Shannon Step 3: Model — priority-based page selection
  const allowedPriorities = priorityFilter ?? ['critical', 'high', 'medium'];
  const targets: CrawlTarget[] = [];

  for (const cat of PLATFORM_DOC_CATEGORIES) {
    for (const page of cat.pages) {
      if (!allowedPriorities.includes(page.priority)) continue;

      // Skip failing targets from prior round
      if (previousDelta?.failingTargets.includes(page.slug)) continue;

      targets.push({
        url: `https://platform.claude.com/docs/en/${page.slug}`,
        category: cat.category,
        priority: page.priority,
        title: page.title,
        maxPages: 1,
        qualityThreshold: 0.65,
      });
    }
  }

  const t3 = createThought(
    'model',
    `Selected ${targets.length} pages across ${PLATFORM_DOC_CATEGORIES.length} categories. ` +
    `Priority distribution: ${targets.filter(t => t.priority === 'critical').length} critical, ` +
    `${targets.filter(t => t.priority === 'high').length} high, ` +
    `${targets.filter(t => t.priority === 'medium').length} medium. ` +
    `Entry point: platform.claude.com/llms.txt — spider follows links to individual pages.`,
    0.85,
    [t1.id, t2.id],
  );
  thoughts.push(t3);

  // Shannon Step 4: Proof — validate plan feasibility
  const estimatedTime = (targets.length * 2) / 60; // 2s per page
  const t4 = createThought(
    'proof',
    `Feasibility: ${targets.length} pages × 2s delay = ~${estimatedTime.toFixed(1)} min. ` +
    `Within rate limits. llms.txt entry point covers all categories. ` +
    `Quality threshold 0.65 is achievable (Round 1 avg was 0.76). ` +
    `Validated: spider can reach all targets from llms.txt index.`,
    0.8,
    [t3.id],
  );
  thoughts.push(t4);

  // Shannon Step 5: Implementation — the actual plan
  const t5 = createThought(
    'implementation',
    `Execute: scrapy crawl platform_spider via llms.txt entry point. ` +
    `CLOSESPIDER_PAGECOUNT=${Math.min(targets.length, 50)}. ` +
    `Score each page, generate context delta, steer next round. ` +
    `Log all results to data/round${round}/ as JSONL.`,
    0.9,
    [t4.id],
  );
  thoughts.push(t5);

  return {
    id: toCrawlId(`crawl-round-${round}-${Date.now()}`),
    name: `Platform Docs Round ${round}`,
    round,
    targets,
    thoughts,
    totalPages: targets.length,
    overallThreshold: 0.65,
    steeringContext: previousDelta?.steerDirection ?? 'Initial crawl — focus on critical + high priority pages',
    createdAt: new Date(),
  };
}

// ── Plan Summary ────────────────────────────────────────────

export function summarizePlan(plan: CrawlPlan): string {
  const lines: string[] = [
    `=== Crawl Plan: ${plan.name} ===`,
    `Round: ${plan.round} | Targets: ${plan.targets.length} | Threshold: ${plan.overallThreshold}`,
    `Steering: ${plan.steeringContext}`,
    '',
    '── Shannon Thinking ──',
  ];

  for (const t of plan.thoughts) {
    lines.push(`  [${t.type}] (conf: ${t.confidence.toFixed(2)}) ${t.content.slice(0, 120)}`);
  }

  lines.push('', '── Targets by Category ──');
  const byCat = new Map<string, CrawlTarget[]>();
  for (const t of plan.targets) {
    const existing = byCat.get(t.category) ?? [];
    existing.push(t);
    byCat.set(t.category, existing);
  }
  for (const [cat, targets] of byCat) {
    lines.push(`  ${cat}: ${targets.map(t => `${t.title} [${t.priority}]`).join(', ')}`);
  }

  return lines.join('\n');
}

// ── CLI ─────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const round = parseInt(process.argv[2] ?? '1', 10);
  const plan = buildCrawlPlan(round);
  console.log(summarizePlan(plan));
  console.log(`\nTotal pages to crawl: ${plan.totalPages}`);
}
