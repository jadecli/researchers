// devops-review/src/connectors.ts — Connector configuration for both surfaces
//
// Maps MCP connectors to their DevOps roles.
// Claude Code uses these via MCP tool calls.
// Claude Cowork uses these via built-in connectors (same underlying MCP).

import type { Surface } from './types.js';

// ── Connector Definition ────────────────────────────────────
export interface ConnectorConfig {
  readonly name: string;
  readonly required: boolean;
  readonly role: string;
  readonly codeTool: string;
  readonly coworkConnector: string;
  readonly capabilities: ReadonlyArray<string>;
}

// ── DevOps Connector Registry ───────────────────────────────
export const DEVOPS_CONNECTORS: ReadonlyArray<ConnectorConfig> = [
  {
    name: 'GitHub',
    required: true,
    role: 'Read PRs, diffs, post review comments',
    codeTool: 'mcp__github__*',
    coworkConnector: 'GitHub',
    capabilities: [
      'list_pull_requests',
      'pull_request_read',
      'add_issue_comment',
      'search_code',
      'get_file_contents',
    ],
  },
  {
    name: 'Slack',
    required: false,
    role: 'Post review summaries to team channel',
    codeTool: 'mcp__slack__*',
    coworkConnector: 'Slack',
    capabilities: [
      'send_message',
      'search_channels',
      'create_canvas',
    ],
  },
  {
    name: 'Linear',
    required: false,
    role: 'Create issues for blocker findings',
    codeTool: 'mcp__linear__*',
    coworkConnector: 'Linear',
    capabilities: [
      'save_issue',
      'list_issues',
      'get_team',
    ],
  },
  {
    name: 'Vercel',
    required: false,
    role: 'Check deployment preview status for frontend PRs',
    codeTool: 'mcp__vercel__*',
    coworkConnector: 'Vercel',
    capabilities: [
      'list_deployments',
      'get_deployment',
      'get_deployment_build_logs',
    ],
  },
  {
    name: 'Supabase',
    required: false,
    role: 'Validate migration SQL against existing schema',
    codeTool: 'mcp__supabase__*',
    coworkConnector: 'Supabase',
    capabilities: [
      'list_tables',
      'list_migrations',
      'execute_sql',
    ],
  },
];

// ── Get connectors for a surface ────────────────────────────
export function getConnectorsForSurface(
  surface: Surface,
  enabledOptional: ReadonlyArray<string> = [],
): ReadonlyArray<ConnectorConfig> {
  return DEVOPS_CONNECTORS.filter(
    (c) => c.required || enabledOptional.includes(c.name),
  );
}

// ── Generate connector summary (for Cowork skill description) ─
export function describeConnectors(
  connectors: ReadonlyArray<ConnectorConfig>,
): string {
  return connectors
    .map(
      (c) =>
        `- **${c.name}** (${c.required ? 'required' : 'optional'}): ${c.role}`,
    )
    .join('\n');
}
