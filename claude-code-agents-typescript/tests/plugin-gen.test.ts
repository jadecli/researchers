// tests/plugin-gen.test.ts — Plugin generation tests (manifest, skills, agents, connectors, hooks)
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generatePlugin } from '../src/plugin_gen/scaffold.js';
import {
  createPluginSpec,
  createSkillSpec,
  createAgentSpec,
  createConnectorSpec,
} from '../src/models/plugin-spec.js';
import {
  OFFICIAL_LSP_PLUGINS,
  resolveOfficialPluginId,
  writeLspConfig,
} from '../src/plugin_gen/lsp-config.js';
import { SUPPORTED_LANGUAGES } from '../src/models/language.js';

describe('Plugin Generation', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates plugin directory structure', () => {
    const spec = createPluginSpec({
      name: 'test-plugin',
      description: 'A test plugin',
      skills: [createSkillSpec({ name: 'test-skill', description: 'A skill' })],
      agents: [
        createAgentSpec({ name: 'test-agent', description: 'An agent' }),
      ],
    });

    const pluginDir = generatePlugin(spec, tmpDir);

    expect(fs.existsSync(pluginDir)).toBe(true);
    expect(fs.existsSync(path.join(pluginDir, 'plugin.json'))).toBe(true);
    expect(fs.existsSync(path.join(pluginDir, 'skills'))).toBe(true);
    expect(fs.existsSync(path.join(pluginDir, 'agents'))).toBe(true);
  });

  it('generates valid plugin.json manifest', () => {
    const spec = createPluginSpec({
      name: 'manifest-test',
      version: '1.0.0',
      description: 'Test manifest',
      skills: [createSkillSpec({ name: 'skill1' })],
      agents: [createAgentSpec({ name: 'agent1' })],
    });

    const pluginDir = generatePlugin(spec, tmpDir);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf-8'),
    );

    expect(manifest.name).toBe('manifest-test');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.skills).toHaveLength(1);
    expect(manifest.agents).toHaveLength(1);
    expect(manifest._generated).toBe(true);
  });

  it('generates skill markdown files', () => {
    const spec = createPluginSpec({
      name: 'skill-test',
      skills: [
        createSkillSpec({
          name: 'analyze',
          description: 'Analyze quality',
          references: ['https://example.com'],
          scripts: ['npm test'],
        }),
      ],
    });

    const pluginDir = generatePlugin(spec, tmpDir);
    const skillPath = path.join(pluginDir, 'skills', 'analyze.md');
    expect(fs.existsSync(skillPath)).toBe(true);

    const content = fs.readFileSync(skillPath, 'utf-8');
    expect(content).toContain('---');
    expect(content).toContain('description: Analyze quality');
    expect(content).toContain('# analyze');
    expect(content).toContain('npm test');
    expect(content).toContain('https://example.com');
  });

  it('generates agent markdown files', () => {
    const spec = createPluginSpec({
      name: 'agent-test',
      agents: [
        createAgentSpec({
          name: 'reviewer',
          description: 'Reviews code',
          tools: ['Read', 'Grep'],
          model: 'claude-sonnet-4-20250514',
        }),
      ],
    });

    const pluginDir = generatePlugin(spec, tmpDir);
    const agentPath = path.join(pluginDir, 'agents', 'reviewer.md');
    expect(fs.existsSync(agentPath)).toBe(true);

    const content = fs.readFileSync(agentPath, 'utf-8');
    expect(content).toContain('# reviewer');
    expect(content).toContain('claude-sonnet-4-20250514');
    expect(content).toContain('Read');
    expect(content).toContain('Grep');
  });

  it('generates connector JSON files', () => {
    const spec = createPluginSpec({
      name: 'connector-test',
      connectors: [
        createConnectorSpec({
          name: 'my-mcp',
          type: 'stdio',
          serverConfig: { command: 'node', args: ['server.js'] },
        }),
      ],
    });

    const pluginDir = generatePlugin(spec, tmpDir);
    const connPath = path.join(pluginDir, 'connectors', 'my-mcp.json');
    expect(fs.existsSync(connPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(connPath, 'utf-8'));
    expect(content.name).toBe('my-mcp');
    expect(content.type).toBe('stdio');

    // Index file
    const indexPath = path.join(pluginDir, 'connectors', 'index.json');
    expect(fs.existsSync(indexPath)).toBe(true);
  });

  it('generates hook configuration', () => {
    const spec = createPluginSpec({
      name: 'hooks-test',
      hooks: {
        PreToolExecution: [{ type: 'command', command: 'echo pre' }],
        PostToolExecution: [{ type: 'script', script: './post.sh' }],
      },
    });

    const pluginDir = generatePlugin(spec, tmpDir);
    const hooksPath = path.join(pluginDir, 'hooks', 'hooks.json');
    expect(fs.existsSync(hooksPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(hooksPath, 'utf-8'));
    expect(content.PreToolExecution).toHaveLength(1);
    expect(content.PostToolExecution).toHaveLength(1);
  });

  it('filters invalid hook events', () => {
    const spec = createPluginSpec({
      name: 'hooks-filter-test',
      hooks: {
        PreToolExecution: [{ type: 'command', command: 'echo' }],
        InvalidEvent: [{ type: 'command', command: 'echo' }],
      },
    });

    const pluginDir = generatePlugin(spec, tmpDir);
    const hooksPath = path.join(pluginDir, 'hooks', 'hooks.json');
    const content = JSON.parse(fs.readFileSync(hooksPath, 'utf-8'));
    expect(content.PreToolExecution).toBeDefined();
    expect(content.InvalidEvent).toBeUndefined();
  });

  it('generates LSP config', () => {
    const spec = createPluginSpec({
      name: 'lsp-test',
      lspServers: ['pyright', 'gopls'],
    });

    const pluginDir = generatePlugin(spec, tmpDir);
    const lspPath = path.join(pluginDir, '.lsp.json');
    expect(fs.existsSync(lspPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(lspPath, 'utf-8'));
    expect(content.pyright).toBeDefined();
    expect(content.gopls).toBeDefined();
    expect(content.pyright.languages).toContain('python');
  });

  // ── LSP Config Refactor Tests ─────────────────────────────────
  // WHY: Our lsp-config.ts had 132 lines of hardcoded server binary paths,
  // args, and workspace settings. The claude-plugins-official repo ships 14
  // authoritative, Anthropic-maintained LSP plugins (pyright-lsp, gopls-lsp,
  // etc.) that handle binary resolution. We should reference those canonical
  // plugin IDs instead of maintaining a stale copy of their config.

  describe('OFFICIAL_LSP_PLUGINS registry', () => {
    it('maps every supported language to an official plugin ID', () => {
      // WHY: If we add a language to SUPPORTED_LANGUAGES but forget to map it
      // to an official plugin, the generated config will silently fall back to
      // a generic stub. This test enforces that every language has a plugin.
      // NOTE: scala has no official metals-lsp yet — it maps to lua-lsp as a
      // placeholder. When Anthropic ships metals-lsp, update the registry.
      const KNOWN_EXCEPTIONS = new Set(['scala']);
      for (const lang of SUPPORTED_LANGUAGES) {
        if (KNOWN_EXCEPTIONS.has(lang)) continue;
        const pluginId = resolveOfficialPluginId(lang);
        expect(pluginId, `missing plugin for ${lang}`).toBeDefined();
        expect(pluginId!.endsWith('-lsp'), `${lang} → ${pluginId} should end with -lsp`).toBe(true);
      }
    });

    it('documents languages without a matching official plugin', () => {
      // WHY: Be explicit about which languages lack a real official plugin.
      // When an official metals-lsp ships, this test will remind us to update.
      const scalaPluginId = resolveOfficialPluginId('scala');
      expect(scalaPluginId).toBe('lua-lsp'); // placeholder — not semantically correct
    });

    it('contains only valid plugin IDs from claude-plugins-official', () => {
      // WHY: Plugin IDs must match the official repo names exactly. A typo
      // means the plugin won't install. This test documents the canonical set.
      const knownOfficialPlugins = [
        'pyright-lsp', 'typescript-lsp', 'gopls-lsp', 'rust-analyzer-lsp',
        'jdtls-lsp', 'kotlin-lsp', 'swift-lsp', 'csharp-lsp',
        'php-lsp', 'ruby-lsp', 'elixir-ls-lsp', 'lua-lsp',
      ];
      for (const entry of Object.values(OFFICIAL_LSP_PLUGINS)) {
        expect(
          knownOfficialPlugins,
          `${entry.pluginId} is not a known official plugin`,
        ).toContain(entry.pluginId);
      }
    });

    it('does NOT contain hardcoded binary paths or args', () => {
      // WHY: The whole point of this refactor is to stop maintaining binary
      // paths. The official plugins handle that. Our registry should only
      // store the plugin ID and language mapping — nothing about binaries.
      for (const [lang, entry] of Object.entries(OFFICIAL_LSP_PLUGINS)) {
        expect(entry, `${lang} entry should not have 'command'`).not.toHaveProperty('command');
        expect(entry, `${lang} entry should not have 'args'`).not.toHaveProperty('args');
        expect(entry, `${lang} entry should not have 'initializationOptions'`).not.toHaveProperty('initializationOptions');
        expect(entry, `${lang} entry should not have 'workspaceSettings'`).not.toHaveProperty('workspaceSettings');
      }
    });
  });

  describe('writeLspConfig generates plugin references', () => {
    it('writes plugin ID references instead of server configs', () => {
      // WHY: The old .lsp.json contained full server configs (command, args,
      // workspaceSettings). The new one should reference official plugins so
      // the runtime can resolve them from the installed plugin.
      const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-ref-'));
      writeLspConfig(['pyright', 'gopls'], outDir);
      const content = JSON.parse(
        fs.readFileSync(path.join(outDir, '.lsp.json'), 'utf-8'),
      );

      expect(content.pyright.pluginId).toBe('pyright-lsp');
      expect(content.pyright.languages).toContain('python');
      expect(content.gopls.pluginId).toBe('gopls-lsp');
      expect(content.gopls.languages).toContain('go');

      fs.rmSync(outDir, { recursive: true, force: true });
    });

    it('falls back gracefully for unknown server names', () => {
      // WHY: Users may pass custom LSP server names that aren't in the official
      // catalog. We should still generate a config entry, just without a plugin
      // reference, and flag it as custom.
      const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-custom-'));
      writeLspConfig(['custom-lsp'], outDir);
      const content = JSON.parse(
        fs.readFileSync(path.join(outDir, '.lsp.json'), 'utf-8'),
      );

      expect(content['custom-lsp'].pluginId).toBeUndefined();
      expect(content['custom-lsp'].custom).toBe(true);
      expect(content['custom-lsp'].command).toBe('custom-lsp');

      fs.rmSync(outDir, { recursive: true, force: true });
    });

    it('resolves language-name inputs to official plugin IDs', () => {
      // WHY: Callers may pass language names ('python', 'go') instead of
      // server names ('pyright', 'gopls'). We should resolve both.
      const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-lang-'));
      writeLspConfig(['python', 'rust'], outDir);
      const content = JSON.parse(
        fs.readFileSync(path.join(outDir, '.lsp.json'), 'utf-8'),
      );

      expect(content.pyright.pluginId).toBe('pyright-lsp');
      expect(content['rust-analyzer'].pluginId).toBe('rust-analyzer-lsp');

      fs.rmSync(outDir, { recursive: true, force: true });
    });
  });

  it('generates MCP config', () => {
    const spec = createPluginSpec({
      name: 'mcp-test',
      connectors: [
        createConnectorSpec({
          name: 'db-server',
          type: 'stdio',
          serverConfig: { command: 'db-mcp', args: ['--port', '5432'] },
        }),
        createConnectorSpec({
          name: 'web-server',
          type: 'sse',
          serverConfig: { url: 'http://localhost:8080/sse' },
        }),
      ],
    });

    const pluginDir = generatePlugin(spec, tmpDir);
    const mcpPath = path.join(pluginDir, '.mcp.json');
    expect(fs.existsSync(mcpPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
    expect(content.mcpServers['db-server']).toBeDefined();
    expect(content.mcpServers['db-server'].command).toBe('db-mcp');
    expect(content.mcpServers['web-server']).toBeDefined();
    expect(content.mcpServers['web-server'].url).toBe(
      'http://localhost:8080/sse',
    );
  });

  it('generates full plugin end-to-end', () => {
    const spec = createPluginSpec({
      name: 'Full Plugin',
      version: '2.0.0',
      description: 'A complete plugin',
      skills: [
        createSkillSpec({ name: 'analyze', description: 'Quality analysis' }),
        createSkillSpec({ name: 'generate', description: 'Code generation' }),
      ],
      agents: [
        createAgentSpec({
          name: 'architect',
          tools: ['Read', 'Write', 'Bash'],
        }),
      ],
      connectors: [
        createConnectorSpec({
          name: 'mcp-srv',
          type: 'stdio',
          serverConfig: { command: 'mcp-server' },
        }),
      ],
      hooks: {
        PreToolExecution: [{ type: 'command', command: 'lint' }],
      },
      lspServers: ['typescript-language-server'],
    });

    const pluginDir = generatePlugin(spec, tmpDir);

    // Verify directory name
    expect(path.basename(pluginDir)).toBe('full-plugin');

    // Verify all files exist
    expect(fs.existsSync(path.join(pluginDir, 'plugin.json'))).toBe(true);
    expect(fs.existsSync(path.join(pluginDir, 'skills', 'analyze.md'))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(pluginDir, 'skills', 'generate.md'))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(pluginDir, 'agents', 'architect.md')),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(pluginDir, 'connectors', 'mcp-srv.json')),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(pluginDir, 'connectors', 'index.json')),
    ).toBe(true);
    expect(fs.existsSync(path.join(pluginDir, 'hooks', 'hooks.json'))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(pluginDir, '.lsp.json'))).toBe(true);
    expect(fs.existsSync(path.join(pluginDir, '.mcp.json'))).toBe(true);

    // Verify manifest content
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf-8'),
    );
    expect(manifest.skills).toHaveLength(2);
    expect(manifest.agents).toHaveLength(1);
    expect(manifest.connectors).toHaveLength(1);
  });
});
