import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ThinkingEngine } from './engine.js';
import type { ThoughtType, Assumption, ShannonThought } from '../types/thinking.js';

// ─── Shannon Thinking MCP Server ─────────────────────────────────────────────

const engine = new ThinkingEngine();

const server = new McpServer({
  name: 'shannon-thinking',
  version: '0.1.0',
});

// ─── Tools ───────────────────────────────────────────────────────────────────

server.tool(
  'create_thought',
  'Create a new structured thought in the Shannon thinking chain',
  {
    type: z.enum(['problem_definition', 'constraints', 'model', 'proof', 'implementation']),
    content: z.string().min(1),
    confidence: z.number().min(0).max(1),
    assumptions: z.array(z.object({
      id: z.string(),
      description: z.string(),
      status: z.enum(['active', 'challenged', 'invalidated']).default('active'),
      evidence: z.string().optional(),
    })).default([]),
    dependencies: z.array(z.string()).default([]),
  },
  async ({ type, content, confidence, assumptions, dependencies }) => {
    const thoughtId = `thought-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const thought: ShannonThought = {
      id: thoughtId,
      type: type as ThoughtType,
      content,
      confidence,
      uncertainty: 1 - confidence,
      assumptions: assumptions.map((a) => ({
        id: a.id,
        description: a.description,
        status: a.status as Assumption['status'],
        evidence: a.evidence,
      })),
      dependencies,
      isRevision: false,
      timestamp: new Date(),
    };

    try {
      engine.addThought(thought);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            thoughtId,
            confidence,
            dependencyCount: dependencies.length,
            assumptionCount: assumptions.length,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }, null, 2),
        }],
        isError: true,
      };
    }
  },
);

server.tool(
  'chain_thoughts',
  'Retrieve thoughts in dependency-resolved order, optionally synthesizing a summary',
  {
    thoughtIds: z.array(z.string()).optional(),
    synthesize: z.boolean().default(false),
  },
  async ({ thoughtIds, synthesize }) => {
    try {
      const resolvedOrder = engine.resolveOrder();
      const relevantOrder = thoughtIds
        ? resolvedOrder.filter((id) => thoughtIds.includes(id))
        : resolvedOrder;

      const thoughts = relevantOrder
        .map((id) => engine.getThought(id))
        .filter((t): t is ShannonThought => t !== undefined);

      let synthesis = '';
      if (synthesize && thoughts.length > 0) {
        const byType = new Map<string, ShannonThought[]>();
        for (const t of thoughts) {
          const existing = byType.get(t.type) ?? [];
          existing.push(t);
          byType.set(t.type, existing);
        }

        const sections: string[] = [];
        for (const [type, groupThoughts] of byType) {
          sections.push(`## ${type.toUpperCase()}`);
          for (const t of groupThoughts) {
            sections.push(`- [${(t.confidence * 100).toFixed(0)}%] ${t.content}`);
            if (t.assumptions.length > 0) {
              sections.push(`  Assumptions: ${t.assumptions.map((a) => `${a.description} (${a.status})`).join(', ')}`);
            }
          }
        }
        synthesis = sections.join('\n');
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            resolvedOrder: relevantOrder,
            thoughtCount: thoughts.length,
            thoughts: thoughts.map((t) => ({
              id: t.id,
              type: t.type,
              confidence: t.confidence,
              content: t.content.slice(0, 200),
              dependencies: t.dependencies,
            })),
            ...(synthesize ? { synthesis } : {}),
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }, null, 2),
        }],
        isError: true,
      };
    }
  },
);

server.tool(
  'track_assumption',
  'Register a new assumption to be tracked across the thinking chain',
  {
    description: z.string().min(1),
    evidence: z.string().optional(),
  },
  async ({ description, evidence }) => {
    const assumptionId = `assumption-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const assumption: Assumption = {
      id: assumptionId,
      description,
      status: 'active',
      evidence,
    };

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          success: true,
          assumption,
          note: 'Assumption tracked. Attach it to thoughts via create_thought to include it in the chain.',
        }, null, 2),
      }],
    };
  },
);

server.tool(
  'challenge_assumption',
  'Challenge an existing assumption with new evidence, reducing confidence of dependent thoughts',
  {
    assumptionId: z.string().min(1),
    evidence: z.string().min(1),
  },
  async ({ assumptionId, evidence }) => {
    try {
      engine.challengeAssumption(assumptionId, evidence);

      const allAssumptions = engine.getAssumptions();
      const challenged = allAssumptions.find((a) => a.id === assumptionId);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            assumptionId,
            newStatus: challenged?.status ?? 'unknown',
            evidence,
            overallConfidence: engine.computeOverallConfidence(),
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }, null, 2),
        }],
        isError: true,
      };
    }
  },
);

server.tool(
  'compute_confidence',
  'Compute the overall confidence of the current thinking chain',
  {},
  async () => {
    const overallConfidence = engine.computeOverallConfidence();
    const assumptions = engine.getAssumptions();

    const statusCounts = { active: 0, challenged: 0, invalidated: 0 };
    for (const a of assumptions) {
      statusCounts[a.status]++;
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          overallConfidence,
          thoughtCount: engine.size,
          assumptions: {
            total: assumptions.length,
            ...statusCounts,
          },
        }, null, 2),
      }],
    };
  },
);

server.tool(
  'get_report',
  'Generate a full thinking report with chain analysis, confidence scores, and unresolved assumptions',
  {},
  async () => {
    try {
      const report = engine.getReport();

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            overallConfidence: report.overallConfidence,
            thoughtCount: report.chain.thoughts.length,
            resolvedOrder: report.chain.resolvedOrder,
            thoughts: report.chain.thoughts.map((t) => ({
              id: t.id,
              type: t.type,
              confidence: t.confidence,
              uncertainty: t.uncertainty,
              content: t.content,
              dependencies: t.dependencies,
              isRevision: t.isRevision,
              revisesThoughtId: t.revisesThoughtId,
              assumptionCount: t.assumptions.length,
            })),
            unresolvedAssumptions: report.unresolvedAssumptions.map((a) => ({
              id: a.id,
              description: a.description,
              status: a.status,
              evidence: a.evidence,
            })),
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }, null, 2),
        }],
        isError: true,
      };
    }
  },
);

// ─── Resources ───────────────────────────────────────────────────────────────

server.resource(
  'methodology',
  'shannon://methodology',
  async () => ({
    contents: [{
      uri: 'shannon://methodology',
      mimeType: 'text/markdown',
      text: `# Shannon Thinking Framework

## Overview
A structured approach to problem-solving inspired by Claude Shannon's methodology.
The framework decomposes complex problems into a chain of thoughts with explicit
dependencies, assumptions, and confidence tracking.

## Thought Types

1. **problem_definition** — Clearly state what you are trying to solve.
   Define the boundaries, inputs, outputs, and success criteria.

2. **constraints** — Identify all constraints: technical, resource, time,
   and domain-specific limitations that bound the solution space.

3. **model** — Build a mental or formal model of the problem. This is where
   you simplify, abstract, and find the essential structure.

4. **proof** — Verify your model. Prove properties, test edge cases,
   identify failure modes. Challenge your assumptions here.

5. **implementation** — Translate the verified model into a concrete plan
   or working solution. Map abstract concepts to real artifacts.

## Key Principles

- **Explicit assumptions**: Every thought declares its assumptions.
  Assumptions can be active, challenged, or invalidated.

- **Dependency tracking**: Thoughts form a DAG (directed acyclic graph).
  A thought's confidence is influenced by its dependencies.

- **Confidence calibration**: Confidence is continuously recalibrated
  based on assumption health and dependency confidence.

- **Revision support**: Thoughts can be revised without losing the original.
  Revisions are linked to what they replace.

- **Uncertainty quantification**: Every thought carries both confidence
  (belief in correctness) and uncertainty (awareness of unknowns).

## Usage Pattern

1. Start with a \`problem_definition\` thought.
2. Add \`constraints\` thoughts that depend on the problem definition.
3. Build \`model\` thoughts that synthesize constraints.
4. Create \`proof\` thoughts to verify the model.
5. Finish with \`implementation\` thoughts.
6. Challenge assumptions as new evidence arrives.
7. Generate revisions when thoughts need updating.
8. Use \`get_report\` to see the full picture.
`,
    }],
  }),
);

// ─── Start Server ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Shannon Thinking MCP server running on stdio');
}

main().catch((error) => {
  console.error('Failed to start Shannon Thinking server:', error);
  process.exit(1);
});
