// src/mcp/server.ts — MCP server with typed tool wrappers
//
// Anthropic's "Code Execution with MCP" pattern: 98.7% token reduction
// by presenting MCP tools as typed TypeScript functions.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { classifyQuery, determineScale, buildSubagentTasks } from '../agent/orchestrator.js';
import { addMemoryTools } from './memory.js';

// ── Response Format ─────────────────────────────────────────────
const ResponseFormat = z.enum(['concise', 'detailed', 'json']);

// ── Research MCP Server ─────────────────────────────────────────
export function createResearchMcpServer(): InstanceType<typeof McpServer> {
  const server = new McpServer({
    name: 'multi-agent-research',
    version: '1.0.0',
  });

  // Tool: Classify a research query into complexity tiers
  server.tool(
    'classify_query',
    {
      query: z.string().describe('The user research query to classify'),
      context: z.string().optional().describe('Additional context about the query'),
    },
    async ({ query }) => {
      const classification = classifyQuery(query);
      const scale = determineScale(classification);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ classification, scale }, null, 2),
          },
        ],
      };
    },
  );

  // Tool: Generate subagent tasks from a classified query
  server.tool(
    'generate_tasks',
    {
      query: z.string().describe('The research query'),
      queryType: z.enum(['straightforward', 'depth_first', 'breadth_first']),
      subtopics: z.array(z.string()).optional(),
      model: z.enum(['opus', 'sonnet', 'haiku']).default('sonnet'),
      maxTurns: z.number().int().min(1).max(50).default(15),
      responseFormat: ResponseFormat.default('concise'),
    },
    async ({ query, queryType, subtopics, model, maxTurns, responseFormat }) => {
      const classification =
        queryType === 'straightforward'
          ? ({ type: 'straightforward' as const, approach: query })
          : queryType === 'depth_first'
            ? ({
                type: 'depth_first' as const,
                perspectives: ['technical', 'strategic', 'empirical', 'comparative'],
              })
            : ({
                type: 'breadth_first' as const,
                subtopics: subtopics ?? [query],
              });

      const tasks = buildSubagentTasks(classification, [], model as 'sonnet' | 'opus' | 'haiku', maxTurns);

      const output =
        responseFormat === 'concise'
          ? tasks.map((t) => `${t.id}: ${t.objective}`).join('\n')
          : JSON.stringify(tasks, null, 2);

      return { content: [{ type: 'text' as const, text: output }] };
    },
  );

  // Tool: Synthesize subagent results into a research report
  server.tool(
    'synthesize_results',
    {
      query: z.string().describe('Original research query'),
      results: z.array(
        z.object({
          agentId: z.string(),
          summary: z.string(),
          confidence: z.number().min(0).max(1),
          sources: z.array(z.string()).optional(),
        }),
      ),
      outputStyle: z.enum(['narrative', 'structured', 'bluf']).default('bluf'),
    },
    async ({ query, results, outputStyle }) => {
      const synthesis = synthesizeFindings(query, results, outputStyle);
      return { content: [{ type: 'text' as const, text: synthesis }] };
    },
  );

  // Tool: Estimate costs for a research plan
  server.tool(
    'estimate_costs',
    {
      agentCount: z.number().int().min(1).max(20),
      model: z.enum(['opus', 'sonnet', 'haiku']).default('sonnet'),
      estimatedTurnsPerAgent: z.number().int().min(1).max(50).default(10),
      estimatedTokensPerTurn: z.number().int().default(4000),
    },
    async ({ agentCount, model, estimatedTurnsPerAgent, estimatedTokensPerTurn }) => {
      const rates: Record<string, { input: number; output: number }> = {
        opus: { input: 15 / 1_000_000, output: 75 / 1_000_000 },
        sonnet: { input: 3 / 1_000_000, output: 15 / 1_000_000 },
        haiku: { input: 0.8 / 1_000_000, output: 4 / 1_000_000 },
      };
      const rate = rates[model] ?? rates['sonnet']!;
      const totalTokens = agentCount * estimatedTurnsPerAgent * estimatedTokensPerTurn;
      const inputCost = totalTokens * 0.7 * rate.input; // ~70% input
      const outputCost = totalTokens * 0.3 * rate.output; // ~30% output
      const totalCost = inputCost + outputCost;

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                agentCount,
                model,
                totalTokens,
                estimatedCostUsd: `$${totalCost.toFixed(4)}`,
                breakdown: {
                  inputCost: `$${inputCost.toFixed(4)}`,
                  outputCost: `$${outputCost.toFixed(4)}`,
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // Resource: Available research patterns
  server.resource(
    'research-patterns',
    'research://patterns',
    async () => ({
      contents: [
        {
          uri: 'research://patterns',
          text: RESEARCH_PATTERNS,
          mimeType: 'text/markdown',
        },
      ],
    }),
  );

  // Memory persistence tools (cross-session, cross-surface)
  // Derived from richlira/compass-mcp, refactored with branded types + Result<T,E>
  addMemoryTools(server);

  return server;
}

// ── Synthesis Implementation ────────────────────────────────────
function synthesizeFindings(
  query: string,
  results: ReadonlyArray<{
    agentId: string;
    summary: string;
    confidence: number;
    sources?: string[];
  }>,
  style: string,
): string {
  const highConfidence = results.filter((r) => r.confidence > 0.7);
  const lowConfidence = results.filter((r) => r.confidence <= 0.7);

  if (style === 'bluf') {
    let output = `**Bottom Line**: Research on "${query}" yielded ${highConfidence.length} high-confidence and ${lowConfidence.length} lower-confidence findings.\n\n`;
    for (const r of highConfidence) {
      output += `### ${r.agentId} (${(r.confidence * 100).toFixed(0)}% confidence)\n${r.summary}\n`;
      if (r.sources?.length) {
        output += `Sources: ${r.sources.join(', ')}\n`;
      }
      output += '\n';
    }
    if (lowConfidence.length > 0) {
      output += '### Lower Confidence Findings\n';
      for (const r of lowConfidence) {
        output += `- **${r.agentId}** (${(r.confidence * 100).toFixed(0)}%): ${r.summary}\n`;
      }
    }
    return output;
  }

  return (
    `# Research Synthesis: ${query}\n\n` +
    results.map((r) => `## ${r.agentId}\n${r.summary}`).join('\n\n')
  );
}

// ── Research Patterns Reference ─────────────────────────────────
const RESEARCH_PATTERNS = `# Anthropic's Eight Architectural Patterns (by complexity)

1. **Single LLM call + retrieval** — simplest, no loop
2. **Prompt chaining** — fixed sequential steps
3. **Routing** — classify then dispatch
4. **Parallelization** — fan-out / fan-in
5. **Agentic loop** — while + tools + stop_reason check
6. **Multi-agent coordinator** — lead + workers
7. **Tool Search + progressive disclosure** — 85% token reduction
8. **Code execution with MCP** — 98.7% token reduction

## Measured Impacts
- Tool Search Tool: 85% token reduction, +25% accuracy on Opus 4
- Programmatic Tool Calling: 37% token reduction
- Code execution with MCP: 98.7% token reduction
- Contextual Retrieval + reranking: 67% less retrieval failure
- Multi-agent architecture: 90.2% improvement over single-agent (15x token cost)

## Key Finding
Token usage explains 80% of performance variance. More tokens = more exploration = better results.
The orchestrator's job is allocating token budget efficiently across subagents.
`;

// ── Start Server ────────────────────────────────────────────────
async function main(): Promise<void> {
  const server = createResearchMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
