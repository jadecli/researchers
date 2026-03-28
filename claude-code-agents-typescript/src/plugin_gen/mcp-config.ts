// src/plugin_gen/mcp-config.ts — Generates MCP server configuration
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ConnectorSpec } from '../models/plugin-spec.js';
import { assertNever } from '../types.js';

interface McpServerEntry {
  readonly command?: string;
  readonly args?: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  readonly url?: string;
}

function connectorToMcpEntry(
  connector: ConnectorSpec,
): McpServerEntry {
  const config = connector.serverConfig;

  switch (connector.type) {
    case 'stdio':
      return {
        command: (config['command'] as string) ?? connector.name,
        args: (config['args'] as string[]) ?? [],
        env: (config['env'] as Record<string, string>) ?? {},
      };
    case 'sse':
      return {
        url: (config['url'] as string) ?? `http://localhost:3000/${connector.name}`,
      };
    case 'streamable-http':
      return {
        url: (config['url'] as string) ?? `http://localhost:3000/${connector.name}/mcp`,
      };
    default:
      return assertNever(connector.type);
  }
}

export function writeMcpConfig(
  connectors: readonly ConnectorSpec[],
  pluginDir: string,
): void {
  const mcpServers: Record<string, McpServerEntry> = {};

  for (const connector of connectors) {
    mcpServers[connector.name] = connectorToMcpEntry(connector);
  }

  fs.writeFileSync(
    path.join(pluginDir, '.mcp.json'),
    JSON.stringify({ mcpServers }, null, 2) + '\n',
    'utf-8',
  );
}
