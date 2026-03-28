// src/models/language.ts — Language configuration for multi-language codegen
import type { LanguageId } from '../types.js';
import { toLanguageId } from '../types.js';

// ── Supported Languages (Discriminated Union via const) ─────────
export const SUPPORTED_LANGUAGES = [
  'python',
  'typescript',
  'go',
  'rust',
  'java',
  'kotlin',
  'swift',
  'csharp',
  'php',
  'ruby',
  'elixir',
  'scala',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

// ── LSP Binary Mapping ──────────────────────────────────────────
export const LSP_BINARIES: Readonly<Record<SupportedLanguage, string>> = {
  python: 'pyright',
  typescript: 'typescript-language-server',
  go: 'gopls',
  rust: 'rust-analyzer',
  java: 'jdtls',
  kotlin: 'kotlin-language-server',
  swift: 'sourcekit-lsp',
  csharp: 'OmniSharp',
  php: 'phpactor',
  ruby: 'solargraph',
  elixir: 'elixir-ls',
  scala: 'metals',
};

// ── SDK Package Mapping ─────────────────────────────────────────
export const SDK_PACKAGES: Readonly<Record<SupportedLanguage, string>> = {
  python: 'anthropic',
  typescript: '@anthropic-ai/sdk',
  go: 'github.com/anthropics/anthropic-sdk-go',
  rust: 'anthropic (crate)',
  java: 'com.anthropic:anthropic-java',
  kotlin: 'com.anthropic:anthropic-java',
  swift: 'anthropic-swift',
  csharp: 'Anthropic.SDK',
  php: 'anthropic-php',
  ruby: 'anthropic-rb',
  elixir: 'anthropic_ex',
  scala: 'com.anthropic:anthropic-java',
};

// ── Language Configuration ──────────────────────────────────────
export interface LanguageConfig {
  readonly language: SupportedLanguage;
  readonly languageId: LanguageId;
  readonly lspBinary: string;
  readonly sdkPackage: string;
  readonly fileExtensions: readonly string[];
  readonly buildTool: string;
  readonly testCommand: string | undefined;
  readonly formatCommand: string | undefined;
}

const LANGUAGE_DEFAULTS: Readonly<
  Record<
    SupportedLanguage,
    {
      fileExtensions: readonly string[];
      buildTool: string;
      testCommand: string;
      formatCommand: string;
    }
  >
> = {
  python: {
    fileExtensions: ['.py', '.pyi'],
    buildTool: 'pip',
    testCommand: 'pytest',
    formatCommand: 'ruff format .',
  },
  typescript: {
    fileExtensions: ['.ts', '.tsx', '.mts'],
    buildTool: 'npm',
    testCommand: 'npm test',
    formatCommand: 'npx prettier --write .',
  },
  go: {
    fileExtensions: ['.go'],
    buildTool: 'go',
    testCommand: 'go test ./...',
    formatCommand: 'gofmt -w .',
  },
  rust: {
    fileExtensions: ['.rs'],
    buildTool: 'cargo',
    testCommand: 'cargo test',
    formatCommand: 'cargo fmt',
  },
  java: {
    fileExtensions: ['.java'],
    buildTool: 'gradle',
    testCommand: 'gradle test',
    formatCommand: 'google-java-format -i **/*.java',
  },
  kotlin: {
    fileExtensions: ['.kt', '.kts'],
    buildTool: 'gradle',
    testCommand: 'gradle test',
    formatCommand: 'ktlint --format',
  },
  swift: {
    fileExtensions: ['.swift'],
    buildTool: 'swift',
    testCommand: 'swift test',
    formatCommand: 'swift-format format -i -r .',
  },
  csharp: {
    fileExtensions: ['.cs', '.csx'],
    buildTool: 'dotnet',
    testCommand: 'dotnet test',
    formatCommand: 'dotnet format',
  },
  php: {
    fileExtensions: ['.php'],
    buildTool: 'composer',
    testCommand: 'vendor/bin/phpunit',
    formatCommand: 'vendor/bin/php-cs-fixer fix',
  },
  ruby: {
    fileExtensions: ['.rb', '.rake'],
    buildTool: 'bundler',
    testCommand: 'bundle exec rspec',
    formatCommand: 'bundle exec rubocop -A',
  },
  elixir: {
    fileExtensions: ['.ex', '.exs'],
    buildTool: 'mix',
    testCommand: 'mix test',
    formatCommand: 'mix format',
  },
  scala: {
    fileExtensions: ['.scala', '.sc'],
    buildTool: 'sbt',
    testCommand: 'sbt test',
    formatCommand: 'sbt scalafmtAll',
  },
};

export function languageConfigFor(lang: SupportedLanguage): LanguageConfig {
  const defaults = LANGUAGE_DEFAULTS[lang];
  return {
    language: lang,
    languageId: toLanguageId(lang),
    lspBinary: LSP_BINARIES[lang],
    sdkPackage: SDK_PACKAGES[lang],
    fileExtensions: defaults.fileExtensions,
    buildTool: defaults.buildTool,
    testCommand: defaults.testCommand,
    formatCommand: defaults.formatCommand,
  };
}
