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
