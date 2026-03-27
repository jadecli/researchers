// src/plugin_gen/manifest.ts — Generates plugin.json manifest
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PluginSpec } from '../models/plugin-spec.js';
import { skillFileName } from '../models/plugin-spec.js';
import { agentFileName } from '../models/plugin-spec.js';

export function writeManifest(spec: PluginSpec, pluginDir: string): void {
  const manifest = {
    name: spec.name,
    version: spec.version,
    description: spec.description,
    author: spec.author,
    skills: spec.skills.map((s) => ({
      name: s.name,
      file: `skills/${skillFileName(s)}`,
    })),
    agents: spec.agents.map((a) => ({
      name: a.name,
      file: `agents/${agentFileName(a)}`,
    })),
    connectors: spec.connectors.map((c) => ({
      name: c.name,
      type: c.type,
    })),
    hooks: Object.keys(spec.hooks),
    lsp_servers: spec.lspServers,
    _generated: true,
  };

  fs.writeFileSync(
    path.join(pluginDir, 'plugin.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf-8',
  );
}
