import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const JADE = resolve(ROOT, '.jade');
const HOOKS = resolve(JADE, 'hooks');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function runHook(name: string, args: string = ''): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execSync(`bash ${HOOKS}/${name} ${args}`, {
      cwd: ROOT,
      timeout: 60_000,
      encoding: 'utf-8',
      env: { ...process.env, PATH: process.env['PATH'] },
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err: unknown) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { code: e.status ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Event 1: Session Start — haiku-routed file existence + install + context
// ═══════════════════════════════════════════════════════════════════════════════

describe('Event 1: session-start hook', () => {
  // ── Haiku tier: file existence checks (fast, cheap) ──────────────────────

  const requiredFiles = [
    '.jade/models/base.ts',
    '.jade/surfaces/doc-surface.ts',
    '.jade/surfaces/registry.ts',
    '.jade/schemas/output-schemas.ts',
    '.jade/agents/crawl-agent.ts',
    '.jade/package.json',
    '.jade/tsconfig.json',
  ];

  describe('[haiku] file existence', () => {
    for (const file of requiredFiles) {
      it(`${file} exists`, () => {
        expect(existsSync(resolve(ROOT, file))).toBe(true);
      });
    }
  });

  describe('[haiku] hook script integrity', () => {
    it('session-start.sh exists and is executable-parseable', () => {
      const path = resolve(HOOKS, 'session-start.sh');
      expect(existsSync(path)).toBe(true);
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('#!/usr/bin/env bash');
      expect(content).toContain('set -euo pipefail');
    });

    it('pre-commit.sh exists and is executable-parseable', () => {
      const path = resolve(HOOKS, 'pre-commit.sh');
      expect(existsSync(path)).toBe(true);
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('#!/usr/bin/env bash');
    });

    it('pre-pr.sh exists and is executable-parseable', () => {
      const path = resolve(HOOKS, 'pre-pr.sh');
      expect(existsSync(path)).toBe(true);
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('#!/usr/bin/env bash');
    });
  });

  describe('[haiku] dependency directories', () => {
    it('claude-multi-agent-dispatch/node_modules exists', () => {
      expect(existsSync(resolve(ROOT, 'claude-multi-agent-dispatch/node_modules'))).toBe(true);
    });

    it('claude-multi-agent-sdk/node_modules exists', () => {
      expect(existsSync(resolve(ROOT, 'claude-multi-agent-sdk/node_modules'))).toBe(true);
    });
  });

  describe('[sonnet] session-start execution', () => {
    it('session-start hook passes cleanly', () => {
      const result = runHook('session-start.sh');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('All checks passed');
    });
  });

  describe('[haiku] context carryover detection', () => {
    it('rounds directory structure is accessible if it exists', () => {
      const roundsDir = resolve(ROOT, 'claude-multi-agent-dispatch/rounds');
      if (existsSync(roundsDir)) {
        const stat = statSync(roundsDir);
        expect(stat.isDirectory()).toBe(true);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Event 2: Pre-Commit — haiku import checks + sonnet canonical review
// ═══════════════════════════════════════════════════════════════════════════════

describe('Event 2: pre-commit hook', () => {
  describe('[haiku] .jade/ TypeScript compiles', () => {
    it('tsc --noEmit succeeds on .jade/', () => {
      const result = execSync('npx tsc --noEmit', {
        cwd: JADE,
        timeout: 30_000,
        encoding: 'utf-8',
      });
      // tsc returns empty on success
      expect(typeof result).toBe('string');
    });
  });

  describe('[haiku] import resolution', () => {
    const surfaceFiles = [
      '.jade/surfaces/doc-surface.ts',
      '.jade/surfaces/registry.ts',
      '.jade/agents/crawl-agent.ts',
      '.jade/schemas/output-schemas.ts',
    ];

    for (const file of surfaceFiles) {
      it(`${file} imports resolve to existing files`, () => {
        const fullPath = resolve(ROOT, file);
        const content = readFileSync(fullPath, 'utf-8');
        const importMatches = content.matchAll(/from ['"](\.[^'"]+)['"]/g);
        const fileDir = dirname(fullPath);

        for (const match of importMatches) {
          const importPath = match[1]!.replace(/\.js$/, '.ts');
          const resolved = resolve(fileDir, importPath);
          expect(existsSync(resolved), `Import ${match[1]} from ${file} should resolve`).toBe(true);
        }
      });
    }
  });

  describe('[sonnet] canonical pattern enforcement', () => {
    it('no .jade/ TS file has unused imports (tsc strict catches these)', () => {
      // This is validated by the tsc --noEmit above; this test documents the intent
      const result = runHook('session-start.sh');
      expect(result.code).toBe(0);
    });

    it('.jade/models/base.ts exports Result<T,E>', () => {
      const content = readFileSync(resolve(JADE, 'models/base.ts'), 'utf-8');
      expect(content).toMatch(/Result</);
    });

    it('.jade/surfaces/registry.ts uses createPageRegistry or bumpVersion', () => {
      const content = readFileSync(resolve(JADE, 'surfaces/registry.ts'), 'utf-8');
      expect(content).toMatch(/createPageRegistry|bumpVersion|createVersionedModel/);
    });
  });

  describe('[sonnet] pre-commit execution', () => {
    it('pre-commit hook passes cleanly', () => {
      const result = runHook('pre-commit.sh');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('All checks passed');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Event 3: Pre-PR — opus planning + sonnet review + full test suites
// ═══════════════════════════════════════════════════════════════════════════════

describe('Event 3: pre-pr hook', () => {
  describe('[opus] architectural invariants', () => {
    it('.jade/ tsconfig uses Boris Cherny strict mode', () => {
      const tsconfig = JSON.parse(readFileSync(resolve(JADE, 'tsconfig.json'), 'utf-8'));
      expect(tsconfig.compilerOptions.strict).toBe(true);
      expect(tsconfig.compilerOptions.noUncheckedIndexedAccess).toBe(true);
      expect(tsconfig.compilerOptions.noUnusedLocals).toBe(true);
      expect(tsconfig.compilerOptions.noUnusedParameters).toBe(true);
      expect(tsconfig.compilerOptions.exactOptionalPropertyTypes).toBe(true);
    });

    it('.jade/ package.json exports match actual files', () => {
      const pkg = JSON.parse(readFileSync(resolve(JADE, 'package.json'), 'utf-8'));
      const exports = pkg.exports as Record<string, string>;
      for (const [key, path] of Object.entries(exports)) {
        const resolved = resolve(JADE, path);
        expect(existsSync(resolved), `Export ${key} -> ${path} should exist`).toBe(true);
      }
    });

    it('registry.ts has version tracking', () => {
      const content = readFileSync(resolve(JADE, 'surfaces/registry.ts'), 'utf-8');
      expect(content).toMatch(/createVersionedModel|bumpVersion|createPageRegistry/);
    });
  });

  describe('[opus] model routing annotations in hooks', () => {
    it('session-start.sh documents haiku routing', () => {
      const content = readFileSync(resolve(HOOKS, 'session-start.sh'), 'utf-8');
      expect(content).toMatch(/haiku/i);
    });

    it('pre-commit.sh documents haiku + sonnet routing', () => {
      const content = readFileSync(resolve(HOOKS, 'pre-commit.sh'), 'utf-8');
      expect(content).toMatch(/haiku/i);
      expect(content).toMatch(/sonnet/i);
    });

    it('pre-pr.sh documents opus + sonnet + haiku routing', () => {
      const content = readFileSync(resolve(HOOKS, 'pre-pr.sh'), 'utf-8');
      expect(content).toMatch(/opus/i);
      expect(content).toMatch(/sonnet/i);
      expect(content).toMatch(/haiku/i);
    });
  });

  describe('[sonnet] no canonical violations in .jade/', () => {
    it('no .jade/ file outside base.ts has throw new (Result<T,E> boundary)', () => {
      const files = [
        'surfaces/doc-surface.ts',
        'surfaces/registry.ts',
        'agents/crawl-agent.ts',
        'schemas/output-schemas.ts',
      ];
      for (const file of files) {
        const fullPath = resolve(JADE, file);
        if (!existsSync(fullPath)) continue;
        const content = readFileSync(fullPath, 'utf-8');
        if (content.includes('Result<')) {
          expect(content).not.toMatch(/throw new /);
        }
      }
    });

    it('no non-.jade/ TS file redefines DocSurface', () => {
      // Spot-check the dispatch orchestrator
      const orchPath = resolve(ROOT, 'claude-multi-agent-dispatch/src/orchestrator/dispatch-orchestrator.ts');
      if (existsSync(orchPath)) {
        const content = readFileSync(orchPath, 'utf-8');
        expect(content).not.toMatch(/type DocSurface\s*=/);
      }
    });
  });

  describe('[sonnet] pre-pr execution', () => {
    it('pre-pr hook passes cleanly', { timeout: 120_000 }, () => {
      const result = runHook('pre-pr.sh', 'main');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('All checks passed');
    });
  });
});
