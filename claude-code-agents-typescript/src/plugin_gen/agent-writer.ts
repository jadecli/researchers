// src/plugin_gen/agent-writer.ts — Generates markdown agent files
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AgentSpec } from '../models/plugin-spec.js';
import { agentFileName } from '../models/plugin-spec.js';

export function writeAgent(spec: AgentSpec, agentsDir: string): void {
  const lines: string[] = [];

  lines.push(`# ${spec.name}`);
  lines.push('');
  lines.push(`${spec.description || `Agent for ${spec.name} tasks.`}`);
  lines.push('');

  // Configuration section
  lines.push('## Configuration');
  lines.push(`- **Model**: ${spec.model}`);
  if (spec.tools.length > 0) {
    lines.push(`- **Tools**: ${spec.tools.join(', ')}`);
  }
  lines.push('');

  // System prompt
  lines.push('## System Prompt');
  lines.push(
    spec.systemPrompt ||
      `You are the ${spec.name} agent. ${spec.description || 'Help the user with their task.'}`,
  );
  lines.push('');

  // Behavior
  lines.push('## Behavior');
  lines.push(
    `This agent specializes in ${spec.description || spec.name}. ` +
      'It follows structured reasoning and provides clear, actionable output.',
  );
  lines.push('');

  // Available tools
  if (spec.tools.length > 0) {
    lines.push('## Available Tools');
    for (const tool of spec.tools) {
      lines.push(`- \`${tool}\``);
    }
    lines.push('');
  }

  fs.writeFileSync(
    path.join(agentsDir, agentFileName(spec)),
    lines.join('\n') + '\n',
    'utf-8',
  );
}
