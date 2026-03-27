// src/plugin_gen/lsp-config.ts — Generates LSP server configuration
import * as fs from 'node:fs';
import * as path from 'node:path';

interface LspServerConfig {
  readonly command: string;
  readonly args: readonly string[];
  readonly languages: readonly string[];
  readonly initializationOptions: Readonly<Record<string, unknown>>;
  readonly workspaceSettings: Readonly<Record<string, unknown>>;
}

const LSP_DEFAULTS: Readonly<Record<string, LspServerConfig>> = {
  pyright: {
    command: 'pyright-langserver',
    args: ['--stdio'],
    languages: ['python'],
    initializationOptions: {},
    workspaceSettings: {
      python: { analysis: { typeCheckingMode: 'strict' } },
    },
  },
  'typescript-language-server': {
    command: 'typescript-language-server',
    args: ['--stdio'],
    languages: ['typescript', 'javascript'],
    initializationOptions: {},
    workspaceSettings: {},
  },
  gopls: {
    command: 'gopls',
    args: ['serve'],
    languages: ['go'],
    initializationOptions: {},
    workspaceSettings: {
      gopls: { staticcheck: true, gofumpt: true },
    },
  },
  'rust-analyzer': {
    command: 'rust-analyzer',
    args: [],
    languages: ['rust'],
    initializationOptions: {},
    workspaceSettings: {
      'rust-analyzer': { checkOnSave: { command: 'clippy' } },
    },
  },
  jdtls: {
    command: 'jdtls',
    args: [],
    languages: ['java'],
    initializationOptions: {},
    workspaceSettings: {},
  },
  'kotlin-language-server': {
    command: 'kotlin-language-server',
    args: [],
    languages: ['kotlin'],
    initializationOptions: {},
    workspaceSettings: {},
  },
  'sourcekit-lsp': {
    command: 'sourcekit-lsp',
    args: [],
    languages: ['swift'],
    initializationOptions: {},
    workspaceSettings: {},
  },
  OmniSharp: {
    command: 'OmniSharp',
    args: ['--languageserver'],
    languages: ['csharp'],
    initializationOptions: {},
    workspaceSettings: {},
  },
  phpactor: {
    command: 'phpactor',
    args: ['language-server'],
    languages: ['php'],
    initializationOptions: {},
    workspaceSettings: {},
  },
  solargraph: {
    command: 'solargraph',
    args: ['stdio'],
    languages: ['ruby'],
    initializationOptions: {},
    workspaceSettings: {},
  },
  'elixir-ls': {
    command: 'elixir-ls',
    args: [],
    languages: ['elixir'],
    initializationOptions: {},
    workspaceSettings: {},
  },
  metals: {
    command: 'metals',
    args: [],
    languages: ['scala'],
    initializationOptions: {},
    workspaceSettings: {},
  },
};

export function writeLspConfig(
  lspServers: readonly string[],
  pluginDir: string,
): void {
  const config: Record<string, LspServerConfig> = {};

  for (const server of lspServers) {
    const defaults = LSP_DEFAULTS[server];
    if (defaults) {
      config[server] = defaults;
    } else {
      config[server] = {
        command: server,
        args: ['--stdio'],
        languages: [],
        initializationOptions: {},
        workspaceSettings: {},
      };
    }
  }

  fs.writeFileSync(
    path.join(pluginDir, '.lsp.json'),
    JSON.stringify(config, null, 2) + '\n',
    'utf-8',
  );
}
