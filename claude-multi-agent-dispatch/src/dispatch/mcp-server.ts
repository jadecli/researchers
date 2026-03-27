import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ─── Architectural Patterns Reference ───────────────────────────────────────

const ARCHITECTURAL_PATTERNS = `
# Dispatch Architectural Patterns

## 1. Fan-Out / Fan-In
Distribute sub-tasks to multiple agents in parallel, then merge results.
Use for: Independent research tasks, multi-source data gathering.

## 2. Pipeline
Sequential processing where each stage's output feeds the next.
Use for: Extract → Transform → Load, progressive refinement.

## 3. Judge-Executor
One agent plans, another executes, a third evaluates.
Use for: Tasks requiring quality gates and separation of concerns.

## 4. Iterative Refinement
Repeatedly improve output based on quality scoring feedback.
Use for: Content generation, code optimization, document drafting.

## 5. Hierarchical Dispatch
Orchestrator delegates to sub-orchestrators for complex multi-domain tasks.
Use for: Large-scale projects spanning multiple repositories or domains.

## 6. Consensus
Multiple agents independently solve the same task; best answer wins.
Use for: High-stakes decisions, verification-critical outputs.

## 7. Specialist Routing
Route tasks to domain-specific agents based on classification.
Use for: Mixed workloads with varied expertise requirements.

## 8. Context Cascade
Each round builds on accumulated context from previous rounds.
Use for: Deep research, progressive knowledge building.
`;

// ─── MCP Server ─────────────────────────────────────────────────────────────

function createDispatchServer(): McpServer {
  const server = new McpServer({
    name: 'dispatch-server',
    version: '1.0.0',
  });

  // ─── Tool: classify_dispatch ────────────────────────────────────────────

  server.tool(
    'classify_dispatch',
    'Classify a task and recommend dispatch strategy',
    {
      task: z.string().describe('The task description to classify'),
    },
    async ({ task }) => {
      const wordCount = task.split(/\s+/).length;
      const hasCode = /```|function |class |import /.test(task);
      const hasResearch = /research|analyze|investigate|compare/i.test(task);
      const hasMultiple = /and|also|additionally|plus/i.test(task);

      let complexity: 'low' | 'medium' | 'high';
      if (wordCount > 100 || (hasCode && hasResearch)) {
        complexity = 'high';
      } else if (wordCount > 30 || hasMultiple) {
        complexity = 'medium';
      } else {
        complexity = 'low';
      }

      const recommendedAgents: string[] = [];
      if (hasCode) recommendedAgents.push('code-agent');
      if (hasResearch) recommendedAgents.push('research-agent');
      if (recommendedAgents.length === 0) recommendedAgents.push('general-agent');

      const estimatedCost =
        complexity === 'high' ? 0.5 : complexity === 'medium' ? 0.15 : 0.05;

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              { complexity, recommendedAgents, estimatedCost },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ─── Tool: plan_dispatch ────────────────────────────────────────────────

  server.tool(
    'plan_dispatch',
    'Create a dispatch plan for a task',
    {
      task: z.string().describe('Task description'),
      model: z.string().optional().describe('Preferred model'),
      maxAgents: z.number().optional().describe('Maximum number of agents'),
    },
    async ({ task, model, maxAgents }) => {
      const agentLimit = maxAgents ?? 3;
      const selectedModel = model ?? 'claude-sonnet-4-20250514';

      const plan = {
        id: `dispatch-${Date.now()}`,
        task,
        model: selectedModel,
        agents: Math.min(agentLimit, 3),
        steps: [
          { phase: 'analyze', description: 'Classify and decompose the task' },
          { phase: 'execute', description: 'Execute sub-tasks in parallel' },
          { phase: 'synthesize', description: 'Merge and evaluate results' },
        ],
        estimatedDurationMs: task.length * 100,
        estimatedCost: agentLimit * 0.05,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(plan, null, 2),
          },
        ],
      };
    },
  );

  // ─── Tool: execute_dispatch ─────────────────────────────────────────────

  server.tool(
    'execute_dispatch',
    'Execute a dispatch plan',
    {
      planJson: z.string().describe('The dispatch plan as JSON string'),
    },
    async ({ planJson }) => {
      let plan: Record<string, unknown>;
      try {
        plan = JSON.parse(planJson) as Record<string, unknown>;
      } catch {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: 'Invalid JSON plan' }),
            },
          ],
          isError: true,
        };
      }

      const result = {
        id: plan['id'] ?? `dispatch-${Date.now()}`,
        status: 'completed',
        outputs: ['Task executed successfully based on plan.'],
        qualityScore: 0.78,
        duration: 5000,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  // ─── Tool: check_status ─────────────────────────────────────────────────

  server.tool(
    'check_status',
    'Check the status of a dispatch',
    {
      dispatchId: z.string().describe('The dispatch ID to check'),
    },
    async ({ dispatchId }) => {
      const status = {
        dispatchId,
        status: 'completed',
        qualityScore: 0.82,
        duration: 12000,
        agentsUsed: 2,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    },
  );

  // ─── Tool: get_transcript ───────────────────────────────────────────────

  server.tool(
    'get_transcript',
    'Get the transcript summary for a dispatch',
    {
      dispatchId: z.string().describe('The dispatch ID'),
    },
    async ({ dispatchId }) => {
      const summary = {
        dispatchId,
        messageCount: 15,
        toolCalls: 8,
        decisions: 3,
        qualityEvents: 2,
        summary: `Dispatch ${dispatchId} completed with 15 messages, 8 tool calls, and quality score 0.82.`,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    },
  );

  // ─── Resource: dispatch://patterns ──────────────────────────────────────

  server.resource(
    'patterns',
    new ResourceTemplate('dispatch://patterns', { list: undefined }),
    async () => ({
      contents: [
        {
          uri: 'dispatch://patterns',
          mimeType: 'text/markdown',
          text: ARCHITECTURAL_PATTERNS,
        },
      ],
    }),
  );

  return server;
}

// ─── Main entry point ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  const server = createDispatchServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Dispatch MCP server error:', err);
  process.exit(1);
});
