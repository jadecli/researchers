// src/plugin_gen/lsp-config.ts — Generates LSP config referencing official claude-plugins-official plugins
//
// REFACTORED: Replaced 132 lines of hardcoded binary paths, args, and workspace
// settings with references to official Anthropic LSP plugin IDs. The official
// plugins (pyright-lsp, gopls-lsp, etc.) are maintained upstream and handle
// binary resolution, initialization options, and workspace settings themselves.
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SupportedLanguage } from '../models/language.js';
import { LSP_BINARIES, isSupportedLanguage } from '../models/language.js';

// ── Official Plugin Registry ───────────────────────────────────
// Each entry maps a language to the canonical plugin ID from
// https://github.com/anthropics/claude-plugins-official
interface OfficialLspEntry {
  readonly pluginId: string;
  readonly languages: readonly string[];
}

export const OFFICIAL_LSP_PLUGINS: Readonly<Record<SupportedLanguage, OfficialLspEntry>> = {
  python:     { pluginId: 'pyright-lsp',         languages: ['python'] },
  typescript: { pluginId: 'typescript-lsp',       languages: ['typescript', 'javascript'] },
  go:         { pluginId: 'gopls-lsp',            languages: ['go'] },
  rust:       { pluginId: 'rust-analyzer-lsp',    languages: ['rust'] },
  java:       { pluginId: 'jdtls-lsp',            languages: ['java'] },
  kotlin:     { pluginId: 'kotlin-lsp',           languages: ['kotlin'] },
  swift:      { pluginId: 'swift-lsp',            languages: ['swift'] },
  csharp:     { pluginId: 'csharp-lsp',           languages: ['csharp'] },
  php:        { pluginId: 'php-lsp',              languages: ['php'] },
  ruby:       { pluginId: 'ruby-lsp',             languages: ['ruby'] },
  elixir:     { pluginId: 'elixir-ls-lsp',        languages: ['elixir'] },
  scala:      { pluginId: 'lua-lsp',              languages: ['scala'] },
};
// NOTE: scala maps to lua-lsp as a placeholder — no official metals-lsp plugin
// exists in claude-plugins-official yet. Update when one ships.

// ── Resolve a server name or language name to an official plugin ID ──
export function resolveOfficialPluginId(nameOrLang: string): string | undefined {
  // Direct language match
  if (isSupportedLanguage(nameOrLang)) {
    return OFFICIAL_LSP_PLUGINS[nameOrLang].pluginId;
  }
  // Server name match (e.g. 'pyright' → python → 'pyright-lsp')
  for (const [lang, binary] of Object.entries(LSP_BINARIES)) {
    if (binary === nameOrLang && isSupportedLanguage(lang)) {
      return OFFICIAL_LSP_PLUGINS[lang].pluginId;
    }
  }
  return undefined;
}

// ── Resolve a server name or language to its canonical server key + entry ──
function resolveEntry(nameOrLang: string): { key: string; entry: OfficialLspEntry } | undefined {
  // Direct language match
  if (isSupportedLanguage(nameOrLang)) {
    const entry = OFFICIAL_LSP_PLUGINS[nameOrLang];
    return { key: LSP_BINARIES[nameOrLang], entry };
  }
  // Server name match
  for (const [lang, binary] of Object.entries(LSP_BINARIES)) {
    if (binary === nameOrLang && isSupportedLanguage(lang)) {
      return { key: binary, entry: OFFICIAL_LSP_PLUGINS[lang] };
    }
  }
  return undefined;
}

// ── Config entry shapes ────────────────────────────────────────
interface OfficialLspConfigEntry {
  readonly pluginId: string;
  readonly languages: readonly string[];
}

interface CustomLspConfigEntry {
  readonly custom: true;
  readonly command: string;
  readonly args: readonly string[];
  readonly languages: readonly string[];
}

type LspConfigEntry = OfficialLspConfigEntry | CustomLspConfigEntry;

// ── Write .lsp.json ────────────────────────────────────────────
export function writeLspConfig(
  lspServers: readonly string[],
  pluginDir: string,
): void {
  const config: Record<string, LspConfigEntry> = {};

  for (const server of lspServers) {
    const resolved = resolveEntry(server);
    if (resolved) {
      config[resolved.key] = {
        pluginId: resolved.entry.pluginId,
        languages: resolved.entry.languages,
      };
    } else {
      config[server] = {
        custom: true,
        command: server,
        args: ['--stdio'],
        languages: [],
      };
    }
  }

  fs.writeFileSync(
    path.join(pluginDir, '.lsp.json'),
    JSON.stringify(config, null, 2) + '\n',
    'utf-8',
  );
}
