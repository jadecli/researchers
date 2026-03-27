// src/plugin_gen/skill-writer.ts — Generates markdown skill files with YAML frontmatter
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SkillSpec } from '../models/plugin-spec.js';
import { skillFileName } from '../models/plugin-spec.js';

export function writeSkill(spec: SkillSpec, skillsDir: string): void {
  const lines: string[] = [];

  // YAML frontmatter
  lines.push('---');
  lines.push(`description: ${spec.description || spec.name}`);
  if (Object.keys(spec.frontmatter).length > 0) {
    for (const [key, value] of Object.entries(spec.frontmatter)) {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  lines.push('---');
  lines.push('');

  // Body
  if (spec.content) {
    lines.push(spec.content);
  } else {
    lines.push(`# ${spec.name}`);
    lines.push('');
    lines.push('## Usage');
    lines.push(`Use this skill for ${spec.description || spec.name} tasks.`);
    lines.push('');

    if (spec.scripts.length > 0) {
      lines.push('## Scripts');
      for (const script of spec.scripts) {
        lines.push(`- \`${script}\``);
      }
      lines.push('');
    }

    if (spec.references.length > 0) {
      lines.push('## References');
      for (const ref of spec.references) {
        lines.push(`- ${ref}`);
      }
      lines.push('');
    }

    lines.push('## Instructions');
    lines.push(`Follow the instructions for the ${spec.name} skill.`);
  }

  fs.writeFileSync(
    path.join(skillsDir, skillFileName(spec)),
    lines.join('\n') + '\n',
    'utf-8',
  );
}
