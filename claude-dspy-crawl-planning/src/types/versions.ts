// src/types/versions.ts — Pinned language and LSP versions
//
// Validated 2026-03-26. These versions are installed and working.

export const LANGUAGE_VERSIONS = {
  python: { runtime: '3.14.3', lsp: 'pyright-langserver', lspPath: '/Users/alexzh/.local/bin/pyright-langserver' },
  typescript: { runtime: 'Node 25.8.2', lsp: 'typescript-language-server', lspPath: '/opt/homebrew/bin/typescript-language-server' },
  go: { runtime: '1.26.1', lsp: 'gopls', lspPath: '/opt/homebrew/bin/gopls' },
  rust: { runtime: 'not installed', lsp: 'rust-analyzer', lspPath: null },
  cpp: { runtime: 'clang 17.0.0', lsp: 'clangd', lspPath: '/usr/bin/clangd' },
  swift: { runtime: '6.2.4', lsp: 'sourcekit-lsp', lspPath: '/usr/bin/sourcekit-lsp' },
  java: { runtime: 'OpenJDK 25.0.1', lsp: 'jdtls', lspPath: null },
  kotlin: { runtime: 'via Java', lsp: 'kotlin-language-server', lspPath: null },
  csharp: { runtime: 'not installed', lsp: 'csharp-ls', lspPath: null },
  php: { runtime: 'not installed', lsp: 'intelephense', lspPath: null },
  lua: { runtime: 'not installed', lsp: 'lua-language-server', lspPath: null },
  ruby: { runtime: '2.6.10', lsp: 'solargraph', lspPath: null },
} as const;

export const PACKAGE_MANAGERS = {
  pip: '26.0',
  uv: '0.11.1',
  npm: '11.11.1',
  go: '1.26.1',
  // cargo: not installed
  // dotnet: not installed
  // composer: not installed
} as const;

export const ANTHROPIC_SDKS = {
  python: { package: 'anthropic', repo: 'anthropics/anthropic-sdk-python', stars: 3000 },
  typescript: { package: '@anthropic-ai/sdk', repo: 'anthropics/anthropic-sdk-typescript', stars: 1800 },
  go: { package: 'anthropics/anthropic-sdk-go', repo: 'anthropics/anthropic-sdk-go', stars: 930 },
  java: { package: 'anthropic-sdk-java', repo: 'anthropics/anthropic-sdk-java', stars: 265 },
  csharp: { package: 'anthropic-sdk-csharp', repo: 'anthropics/anthropic-sdk-csharp', stars: 204 },
  php: { package: 'anthropic-sdk-php', repo: 'anthropics/anthropic-sdk-php', stars: 123 },
  ruby: { package: 'anthropic-sdk-ruby', repo: 'anthropics/anthropic-sdk-ruby', stars: 46 },
} as const;

export const AGENT_SDKS = {
  python: { package: 'claude-agent-sdk', repo: 'anthropics/claude-agent-sdk-python', stars: 5900 },
  typescript: { package: '@anthropic-ai/claude-agent-sdk', repo: 'anthropics/claude-agent-sdk-typescript', stars: 1100 },
} as const;

// Claude model aliases (from claude-cookbooks CLAUDE.md)
export const MODEL_ALIASES = {
  opus: 'claude-opus-4-6',
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5',
  // Never use dated IDs in application code
  // Bedrock IDs follow different format
} as const;

export type SupportedLanguage = keyof typeof LANGUAGE_VERSIONS;
export type InstalledLSP = {
  [K in SupportedLanguage]: typeof LANGUAGE_VERSIONS[K]['lspPath'] extends null ? never : K
}[SupportedLanguage];
