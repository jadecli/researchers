import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  toMemoryDomain,
  saveMemory,
  recallMemory,
  listMemories,
} from '../src/mcp/memory.js';

describe('MemoryDomain branded type', () => {
  it('slugifies domain names', () => {
    expect(toMemoryDomain('Impact Lab')).toBe('impact-lab');
    expect(toMemoryDomain('My Project 2026')).toBe('my-project-2026');
    expect(toMemoryDomain('eval-results')).toBe('eval-results');
    expect(toMemoryDomain('UPPERCASE')).toBe('uppercase');
    expect(toMemoryDomain('special!@#chars')).toBe('specialchars');
  });
});

describe('Memory persistence (file-backed)', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `memory-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    process.env.MEMORY_DATA_DIR = testDir;
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    delete process.env.MEMORY_DATA_DIR;
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('saves and recalls a memory', async () => {
    const domain = toMemoryDomain('test-project');
    const content = '# Test Project\n\nThis is a test memory.';

    const saveResult = await saveMemory(domain, content);
    expect(saveResult.ok).toBe(true);
    if (saveResult.ok) {
      expect(saveResult.value.domain).toBe('test-project');
    }

    const recallResult = await recallMemory(domain);
    expect(recallResult.ok).toBe(true);
    if (recallResult.ok) {
      expect(recallResult.value.content).toBe(content);
      expect(recallResult.value.domain).toBe('test-project');
      expect(recallResult.value.updatedAt).toBeInstanceOf(Date);
    }
  });

  it('returns Err for nonexistent domain', async () => {
    const domain = toMemoryDomain('does-not-exist');
    const result = await recallMemory(domain);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('No memory found');
    }
  });

  it('overwrites existing memory on re-save', async () => {
    const domain = toMemoryDomain('overwrite-test');

    await saveMemory(domain, 'version 1');
    await saveMemory(domain, 'version 2');

    const result = await recallMemory(domain);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.content).toBe('version 2');
    }
  });

  it('lists all saved memories sorted by recency', async () => {
    await saveMemory(toMemoryDomain('alpha'), 'first');
    // Small delay to ensure different mtime
    await new Promise((r) => setTimeout(r, 50));
    await saveMemory(toMemoryDomain('beta'), 'second');

    const result = await listMemories();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBe(2);
      // Most recent first
      expect(result.value[0]!.domain).toBe('beta');
      expect(result.value[1]!.domain).toBe('alpha');
      expect(result.value[0]!.sizeBytes).toBeGreaterThan(0);
    }
  });

  it('returns empty list when no memories exist', async () => {
    const result = await listMemories();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it('ignores non-markdown files in memory directory', async () => {
    await saveMemory(toMemoryDomain('real'), 'real memory');
    await fs.writeFile(path.join(testDir, 'not-a-memory.txt'), 'noise');

    const result = await listMemories();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBe(1);
      expect(result.value[0]!.domain).toBe('real');
    }
  });
});
