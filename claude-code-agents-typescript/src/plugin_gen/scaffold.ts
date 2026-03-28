// src/plugin_gen/scaffold.ts — Main plugin scaffold generator
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PluginSpec } from '../models/plugin-spec.js';
import { pluginDirName } from '../models/plugin-spec.js';
import { writeManifest } from './manifest.js';
import { writeSkill } from './skill-writer.js';
import { writeAgent } from './agent-writer.js';
import { writeConnectors } from './connectors-writer.js';
import { writeHooks } from './hooks-writer.js';
import { writeLspConfig } from './lsp-config.js';
import { writeMcpConfig } from './mcp-config.js';

export function generatePlugin(spec: PluginSpec, outputDir: string): string {
  const dirName = pluginDirName(spec);
  const pluginDir = path.join(outputDir, dirName);

  // Create directory structure
  const dirs = [
    pluginDir,
    path.join(pluginDir, 'skills'),
    path.join(pluginDir, 'agents'),
    path.join(pluginDir, 'connectors'),
    path.join(pluginDir, 'hooks'),
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write manifest
  writeManifest(spec, pluginDir);

  // Write skills
  for (const skill of spec.skills) {
    writeSkill(skill, path.join(pluginDir, 'skills'));
  }

  // Write agents
  for (const agent of spec.agents) {
    writeAgent(agent, path.join(pluginDir, 'agents'));
  }

  // Write connectors
  if (spec.connectors.length > 0) {
    writeConnectors(spec.connectors, path.join(pluginDir, 'connectors'));
  }

  // Write hooks
  if (Object.keys(spec.hooks).length > 0) {
    writeHooks(spec.hooks, path.join(pluginDir, 'hooks'));
  }

  // Write LSP config
  if (spec.lspServers.length > 0) {
    writeLspConfig(spec.lspServers, pluginDir);
  }

  // Write MCP config
  if (spec.connectors.length > 0) {
    writeMcpConfig(spec.connectors, pluginDir);
  }

  return pluginDir;
}
