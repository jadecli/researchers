// src/models/plugin-spec.ts — Plugin specification models
import type { PluginName } from '../types.js';
import { toPluginName } from '../types.js';

// ── Skill Spec ──────────────────────────────────────────────────
export interface SkillSpec {
  readonly name: string;
  readonly description: string;
  readonly frontmatter: Readonly<Record<string, unknown>>;
  readonly content: string;
  readonly references: readonly string[];
  readonly scripts: readonly string[];
}

export function createSkillSpec(input: {
  readonly name: string;
  readonly description?: string;
  readonly frontmatter?: Record<string, unknown>;
  readonly content?: string;
  readonly references?: string[];
  readonly scripts?: string[];
}): SkillSpec {
  return {
    name: input.name,
    description: input.description ?? '',
    frontmatter: input.frontmatter ?? {},
    content: input.content ?? '',
    references: input.references ?? [],
    scripts: input.scripts ?? [],
  };
}

export function skillFileName(spec: SkillSpec): string {
  return `${spec.name}.md`;
}

// ── Agent Spec ──────────────────────────────────────────────────
export interface AgentSpec {
  readonly name: string;
  readonly description: string;
  readonly tools: readonly string[];
  readonly model: string;
  readonly systemPrompt: string;
}

export function createAgentSpec(input: {
  readonly name: string;
  readonly description?: string;
  readonly tools?: string[];
  readonly model?: string;
  readonly systemPrompt?: string;
}): AgentSpec {
  return {
    name: input.name,
    description: input.description ?? '',
    tools: input.tools ?? [],
    model: input.model ?? 'claude-sonnet-4-20250514',
    systemPrompt: input.systemPrompt ?? '',
  };
}

export function agentFileName(spec: AgentSpec): string {
  return `${spec.name}.md`;
}

// ── Connector Spec ──────────────────────────────────────────────
export type TransportType = 'stdio' | 'sse' | 'streamable-http';

export interface ConnectorSpec {
  readonly name: string;
  readonly type: TransportType;
  readonly serverConfig: Readonly<Record<string, unknown>>;
  readonly placeholderCategory: string;
}

export function createConnectorSpec(input: {
  readonly name: string;
  readonly type?: TransportType;
  readonly serverConfig?: Record<string, unknown>;
  readonly placeholderCategory?: string;
}): ConnectorSpec {
  return {
    name: input.name,
    type: input.type ?? 'stdio',
    serverConfig: input.serverConfig ?? {},
    placeholderCategory: input.placeholderCategory ?? '',
  };
}

export function hasPlaceholders(spec: ConnectorSpec): boolean {
  return JSON.stringify(spec.serverConfig).includes('~~');
}

// ── Plugin Spec ─────────────────────────────────────────────────
export interface PluginSpec {
  readonly name: PluginName;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly skills: readonly SkillSpec[];
  readonly agents: readonly AgentSpec[];
  readonly connectors: readonly ConnectorSpec[];
  readonly hooks: Readonly<Record<string, readonly Record<string, unknown>[]>>;
  readonly lspServers: readonly string[];
}

export function createPluginSpec(input: {
  readonly name: string;
  readonly version?: string;
  readonly description?: string;
  readonly author?: string;
  readonly skills?: SkillSpec[];
  readonly agents?: AgentSpec[];
  readonly connectors?: ConnectorSpec[];
  readonly hooks?: Record<string, Record<string, unknown>[]>;
  readonly lspServers?: string[];
}): PluginSpec {
  return {
    name: toPluginName(input.name),
    version: input.version ?? '0.1.0',
    description: input.description ?? '',
    author: input.author ?? '',
    skills: input.skills ?? [],
    agents: input.agents ?? [],
    connectors: input.connectors ?? [],
    hooks: input.hooks ?? {},
    lspServers: input.lspServers ?? [],
  };
}

export function pluginDirName(spec: PluginSpec): string {
  return (spec.name as string).replace(/ /g, '-').toLowerCase();
}

export function skillCount(spec: PluginSpec): number {
  return spec.skills.length;
}

export function agentCount(spec: PluginSpec): number {
  return spec.agents.length;
}

export function connectorCount(spec: PluginSpec): number {
  return spec.connectors.length;
}
