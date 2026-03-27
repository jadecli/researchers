// src/codegen/language-router.ts — Language selection logic for multi-language codegen
import type { LanguageConfig, SupportedLanguage } from '../models/language.js';
import {
  isSupportedLanguage,
  languageConfigFor,
} from '../models/language.js';

// ── Route Result ────────────────────────────────────────────────
export interface RouteResult {
  readonly primaryLanguage: SupportedLanguage;
  readonly primaryConfig: LanguageConfig;
  readonly secondaryLanguages: readonly SupportedLanguage[];
  readonly secondaryConfigs: readonly LanguageConfig[];
  readonly scaffoldType: string;
  readonly rationale: string;
}

// ── Keyword Hints ───────────────────────────────────────────────
const KEYWORD_HINTS: Readonly<Record<string, SupportedLanguage>> = {
  django: 'python',
  flask: 'python',
  fastapi: 'python',
  pytorch: 'python',
  numpy: 'python',
  react: 'typescript',
  nextjs: 'typescript',
  express: 'typescript',
  nest: 'typescript',
  angular: 'typescript',
  vue: 'typescript',
  gin: 'go',
  echo: 'go',
  fiber: 'go',
  kubernetes: 'go',
  actix: 'rust',
  tokio: 'rust',
  warp: 'rust',
  spring: 'java',
  quarkus: 'java',
  ktor: 'kotlin',
  vapor: 'swift',
  swiftui: 'swift',
  aspnet: 'csharp',
  blazor: 'csharp',
  laravel: 'php',
  symfony: 'php',
  rails: 'ruby',
  sinatra: 'ruby',
  phoenix: 'elixir',
  play: 'scala',
  akka: 'scala',
};

// ── Environment Defaults ────────────────────────────────────────
const ENVIRONMENT_DEFAULTS: Readonly<Record<string, SupportedLanguage>> = {
  web: 'typescript',
  cli: 'python',
  serverless: 'typescript',
  library: 'typescript',
  'web-api': 'typescript',
  'full-stack': 'typescript',
  'sdk-wrapper': 'typescript',
  mobile: 'kotlin',
  systems: 'rust',
  data: 'python',
  ml: 'python',
};

// ── Scaffold Type Detection ─────────────────────────────────────
function detectScaffoldType(task: string, environment: string): string {
  const combined = `${task} ${environment}`.toLowerCase();
  if (combined.includes('serverless') || combined.includes('lambda'))
    return 'serverless';
  if (combined.includes('full-stack') || combined.includes('fullstack'))
    return 'full-stack';
  if (combined.includes('api') || combined.includes('server'))
    return 'web-api';
  if (combined.includes('cli') || combined.includes('command'))
    return 'cli';
  if (combined.includes('library') || combined.includes('sdk'))
    return 'library';
  if (combined.includes('wrapper')) return 'sdk-wrapper';
  return 'cli';
}

// ── Language Router ─────────────────────────────────────────────
export class LanguageRouter {
  route(
    task: string,
    environment = 'cli',
    preferredLanguages?: readonly string[],
  ): RouteResult {
    let primary: SupportedLanguage;
    const scaffoldType = detectScaffoldType(task, environment);

    if (preferredLanguages && preferredLanguages.length > 0) {
      const first = preferredLanguages[0]!.toLowerCase();
      primary = isSupportedLanguage(first) ? first : this.inferFromTask(task, environment);
    } else {
      primary = this.inferFromTask(task, environment);
    }

    const secondaries: SupportedLanguage[] = [];
    if (preferredLanguages) {
      for (const lang of preferredLanguages.slice(1)) {
        const lower = lang.toLowerCase();
        if (isSupportedLanguage(lower) && lower !== primary) {
          secondaries.push(lower);
        }
      }
    }

    return {
      primaryLanguage: primary,
      primaryConfig: languageConfigFor(primary),
      secondaryLanguages: secondaries,
      secondaryConfigs: secondaries.map(languageConfigFor),
      scaffoldType,
      rationale: `Selected ${primary} for ${environment} environment with ${scaffoldType} scaffold`,
    };
  }

  private inferFromTask(task: string, environment: string): SupportedLanguage {
    const taskLower = task.toLowerCase();

    // Check keyword hints
    for (const [keyword, lang] of Object.entries(KEYWORD_HINTS)) {
      if (taskLower.includes(keyword)) return lang;
    }

    // Check environment defaults
    const envDefault = ENVIRONMENT_DEFAULTS[environment];
    if (envDefault) return envDefault;

    return 'typescript';
  }
}
