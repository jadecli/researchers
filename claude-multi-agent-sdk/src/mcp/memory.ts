// src/mcp/memory.ts — Cross-session memory persistence via MCP tools
//
// Extracted from richlira/compass-mcp (MIT), refactored with:
// - Branded types (MemoryDomain)
// - Result<T,E> error handling
// - File-backed storage (upgradeable to Neon PG18 via agentdata Tier 4)
//
// Three tools: save_memory, recall_memory, list_memories

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { z } from 'zod';
import { type Result, Ok, Err } from '../types/core.js';

// ── Branded Types ──────────────────────────────────────────────
type Brand<K, T> = K & { readonly __brand: T };

export type MemoryDomain = Brand<string, 'MemoryDomain'>;

export function toMemoryDomain(raw: string): MemoryDomain {
  // Slugify: lowercase, replace spaces with hyphens, strip non-alphanumeric
  return raw
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '') as MemoryDomain;
}

// ── Storage Layer (swappable to SQL) ───────────────────────────
function getMemoryDir(): string {
  return (
    process.env.MEMORY_DATA_DIR ||
    path.join(process.env.COMPASS_DATA_DIR || path.join(os.homedir(), 'compass-data'), 'memories')
  );
}

export async function saveMemory(
  domain: MemoryDomain,
  content: string,
): Promise<Result<{ domain: MemoryDomain; path: string }>> {
  try {
    await fs.mkdir(getMemoryDir(), { recursive: true });
    const filepath = path.join(getMemoryDir(), `${domain}.md`);
    await fs.writeFile(filepath, content, 'utf-8');
    return Ok({ domain, path: filepath });
  } catch (e) {
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
}

export async function recallMemory(
  domain: MemoryDomain,
): Promise<Result<{ domain: MemoryDomain; content: string; updatedAt: Date }>> {
  try {
    const filepath = path.join(getMemoryDir(), `${domain}.md`);
    const content = await fs.readFile(filepath, 'utf-8');
    const stat = await fs.stat(filepath);
    return Ok({ domain, content, updatedAt: stat.mtime });
  } catch (e) {
    if (e instanceof Error && 'code' in e && (e as NodeJS.ErrnoException).code === 'ENOENT') {
      return Err(new Error(`No memory found for domain "${domain}"`));
    }
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
}

export async function listMemories(): Promise<
  Result<Array<{ domain: MemoryDomain; updatedAt: Date; sizeBytes: number }>>
> {
  try {
    await fs.mkdir(getMemoryDir(), { recursive: true });
    const files = await fs.readdir(getMemoryDir());
    const memories: Array<{ domain: MemoryDomain; updatedAt: Date; sizeBytes: number }> = [];

    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const filepath = path.join(getMemoryDir(), file);
      const stat = await fs.stat(filepath);
      const domain = toMemoryDomain(file.replace(/\.md$/, ''));
      memories.push({ domain, updatedAt: stat.mtime, sizeBytes: stat.size });
    }

    return Ok(memories.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
  } catch (e) {
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
}

// ── MCP Tool Registration ──────────────────────────────────────
export function addMemoryTools(server: McpServer): void {
  server.tool(
    'save_memory',
    'Save or update a memory for a domain (project, topic, or context). Persists across sessions and surfaces.',
    {
      domain: z.string().describe('Domain name — will be slugified (e.g. "Impact Lab" → "impact-lab")'),
      content: z.string().describe('Markdown content to persist for this domain'),
    },
    async ({ domain, content }) => {
      const slug = toMemoryDomain(domain);
      const result = await saveMemory(slug, content);
      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: `Error saving memory: ${result.error.message}` }] };
      }
      return {
        content: [
          { type: 'text' as const, text: `Memory saved for "${domain}" (${slug}) at ${result.value.path}` },
        ],
      };
    },
  );

  server.tool(
    'recall_memory',
    'Recall a previously saved memory by domain name. Returns the full content.',
    {
      domain: z.string().describe('Domain name to recall'),
    },
    async ({ domain }) => {
      const slug = toMemoryDomain(domain);
      const result = await recallMemory(slug);
      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: result.error.message }] };
      }
      const { content, updatedAt } = result.value;
      return {
        content: [
          {
            type: 'text' as const,
            text: `# Memory: ${domain}\n_Last updated: ${updatedAt.toISOString()}_\n\n${content}`,
          },
        ],
      };
    },
  );

  server.tool(
    'list_memories',
    'List all saved memory domains with metadata.',
    {},
    async () => {
      const result = await listMemories();
      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: `Error listing memories: ${result.error.message}` }] };
      }
      if (result.value.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No memories saved yet.' }] };
      }
      const lines = result.value.map(
        (m) => `- **${m.domain}** (${m.sizeBytes} bytes, updated ${m.updatedAt.toISOString().split('T')[0]})`,
      );
      return { content: [{ type: 'text' as const, text: `# Saved Memories\n\n${lines.join('\n')}` }] };
    },
  );

  // Resource: memory architecture documentation
  server.resource('memory-architecture', 'memory://architecture', async () => ({
    contents: [
      {
        uri: 'memory://architecture',
        text: MEMORY_ARCHITECTURE,
        mimeType: 'text/markdown',
      },
    ],
  }));
}

const MEMORY_ARCHITECTURE = `# Memory Persistence Architecture

## Current: File-backed
Memories stored as markdown files in ~/compass-data/memories/.
Each domain = one .md file. Human-readable, git-versionable.

## Future: Neon PG18 (agentdata Tier 4)
When DATABASE_URL is set, swap to:
  INSERT INTO agentdata.memories (domain, content, version)
  SELECT content FROM agentdata.memories WHERE domain = $1

MCP tool interface stays identical. Callers never see the swap.

## Design Principles
- Derived from richlira/compass-mcp (MIT), skeptically evaluated
- Branded types (MemoryDomain) prevent domain confusion
- Result<T,E> — no thrown exceptions
- File I/O errors are typed, not swallowed
- No fuzzy matching — exact domain slugs only
`;
