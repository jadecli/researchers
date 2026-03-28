// .jade/agents/crawl-agent.ts — Agent file for headless subagent crawl prompts
//
// Data models from .jade/surfaces/ are structured inputs here.
// Each agent file produces a prompt that a headless Claude subagent
// can execute without human intervention.

import type { DocPage, DocSurface, AgentStrategy, OutputFormat } from '../surfaces/doc-surface.js';
import type { AgentFileId, VersionedModel } from '../models/base.js';
import { toAgentFileId, createVersionedModel, toSurfaceId } from '../models/base.js';

// ─── Agent File Types ───────────────────────────────────────────────────────

export type AgentRole =
  | 'crawler'        // Fetches and extracts raw content
  | 'structurer'     // Converts raw content to typed data models
  | 'scorer'         // Evaluates quality of extraction
  | 'synthesizer'    // Merges results across pages
  | 'emitter';       // Produces final markdown/yaml/typescript output

export interface AgentFile {
  readonly id: AgentFileId;
  readonly role: AgentRole;
  readonly surface: DocSurface;
  readonly model: AgentModelPreference;
  readonly systemPrompt: string;
  readonly userPromptTemplate: string;
  readonly outputFormat: OutputFormat;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly tools: readonly AgentToolSpec[];
}

export type AgentModelPreference = 'opus' | 'sonnet' | 'haiku';

export interface AgentToolSpec {
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
}

// ─── Prompt Builders ────────────────────────────────────────────────────────
// Build concrete prompts from data model inputs.

export function buildCrawlPrompt(page: DocPage): string {
  return [
    `You are a documentation crawler agent. Your task is to extract structured content from a single documentation page.`,
    ``,
    `## Target`,
    `- URL: ${page.url}`,
    `- Title: ${page.title}`,
    `- Surface: ${page.surface}`,
    `- Priority: ${page.priority}`,
    ``,
    `## Instructions`,
    `1. Fetch the page content from the URL above`,
    `2. Extract all headings, code blocks, and prose content`,
    `3. Identify API endpoints, SDK methods, and configuration options`,
    `4. Preserve code examples with their language annotations`,
    `5. Extract all internal links to related documentation pages`,
    ``,
    `## Output Format`,
    `Return a JSON object with:`,
    `- title: string`,
    `- summary: string (2-3 sentences)`,
    `- headings: string[]`,
    `- codeBlocks: { language: string, content: string }[]`,
    `- apiEndpoints: { method: string, path: string, description: string }[]`,
    `- relatedLinks: { text: string, url: string }[]`,
    `- content: string (full markdown content)`,
  ].join('\n');
}

export function buildStructurerPrompt(page: DocPage, rawContent: string): string {
  return [
    `You are a documentation structurer agent. Convert raw crawled content into a typed data model.`,
    ``,
    `## Source Page`,
    `- Surface: ${page.surface}`,
    `- Slug: ${page.slug}`,
    `- URL: ${page.url}`,
    ``,
    `## Raw Content`,
    `\`\`\``,
    rawContent.slice(0, 50000),
    `\`\`\``,
    ``,
    `## Instructions`,
    `1. Parse the raw content into structured sections`,
    `2. Identify and tag each section by type (concept, tutorial, reference, example)`,
    `3. Extract parameter tables into typed interfaces`,
    `4. Map code examples to their SDK language (Python, TypeScript, etc.)`,
    `5. Identify prerequisites and dependencies on other pages`,
    ``,
    `## Output`,
    `Return TypeScript interface definitions that model this page's content.`,
  ].join('\n');
}

export function buildScorerPrompt(page: DocPage, extraction: string): string {
  return [
    `You are a quality scorer agent. Evaluate the extraction quality of a documentation page.`,
    ``,
    `## Page: ${page.title} (${page.surface})`,
    `## URL: ${page.url}`,
    ``,
    `## Extraction to Score`,
    `\`\`\``,
    extraction.slice(0, 30000),
    `\`\`\``,
    ``,
    `## Score on these 5 dimensions (0.0 to 1.0):`,
    `1. **Completeness** — Does the extraction cover all page content?`,
    `2. **Structure** — Is content organized with headings, lists, code blocks?`,
    `3. **Accuracy** — Are code examples and API details correct?`,
    `4. **Coherence** — Does the extraction flow logically?`,
    `5. **Safety** — No exposed secrets, PII, or dangerous patterns?`,
    ``,
    `Return JSON: { completeness: number, structure: number, accuracy: number, coherence: number, safety: number, overall: number, feedback: string }`,
  ].join('\n');
}

export function buildEmitterPrompt(
  page: DocPage,
  structuredContent: string,
  format: OutputFormat,
): string {
  const formatInstructions: Record<OutputFormat, string> = {
    markdown: 'Emit clean Markdown with proper heading hierarchy, fenced code blocks, and internal links.',
    yaml: 'Emit YAML with typed fields matching the page data model. Use anchors for shared values.',
    json: 'Emit JSON matching the DocPage interface. Include all surface-specific fields.',
    typescript: 'Emit TypeScript type definitions and const data objects for this page content.',
  };

  return [
    `You are an emitter agent. Convert structured page content into ${format} format.`,
    ``,
    `## Page: ${page.title}`,
    `## Surface: ${page.surface}`,
    `## Output format: ${format}`,
    ``,
    `## Structured Content`,
    `\`\`\``,
    structuredContent.slice(0, 40000),
    `\`\`\``,
    ``,
    `## Instructions`,
    formatInstructions[format],
  ].join('\n');
}

// ─── Agent File Registry ────────────────────────────────────────────────────
// Pre-built agent files per surface. Each can be used as a prompt for a
// headless subagent via Agent SDK v2 or CLI dispatch.

function makeAgentFile(
  role: AgentRole,
  surface: DocSurface,
  model: AgentModelPreference,
  outputFormat: OutputFormat,
  systemPrompt: string,
  tools: readonly AgentToolSpec[] = [],
): AgentFile {
  return {
    id: toAgentFileId(`${role}-${surface}`),
    role,
    surface,
    model,
    systemPrompt,
    userPromptTemplate: `Process {page.url} for surface {page.surface}`,
    outputFormat,
    maxTokens: role === 'crawler' ? 8192 : role === 'structurer' ? 16384 : 4096,
    temperature: role === 'scorer' ? 0.0 : 0.1,
    tools,
  };
}

export const AGENT_FILES: readonly AgentFile[] = [
  // Crawlers — one per surface that uses headless-subagent strategy
  makeAgentFile('crawler', 'capabilities', 'sonnet', 'json',
    'You extract structured documentation from Anthropic capability pages. Focus on API parameters, SDK methods, and model requirements.'),
  makeAgentFile('crawler', 'tools', 'opus', 'json',
    'You extract structured documentation from Anthropic tool use pages. Focus on tool definitions, input schemas, and agentic patterns.',
    [{ name: 'web_fetch', description: 'Fetch page content', required: true }]),
  makeAgentFile('crawler', 'agent-skills', 'opus', 'json',
    'You extract structured documentation from Agent Skills pages. Focus on skill definitions, API integration, and enterprise features.',
    [{ name: 'web_fetch', description: 'Fetch page content', required: true }]),

  // Structurers
  makeAgentFile('structurer', 'capabilities', 'sonnet', 'typescript',
    'Convert raw capability page content into TypeScript interfaces and const objects.'),
  makeAgentFile('structurer', 'tools', 'sonnet', 'typescript',
    'Convert raw tool documentation into TypeScript tool definition interfaces.'),
  makeAgentFile('structurer', 'agent-skills', 'sonnet', 'typescript',
    'Convert raw agent skills content into TypeScript skill definition types.'),

  // Scorers — haiku is sufficient for quality scoring
  makeAgentFile('scorer', 'capabilities', 'haiku', 'json',
    'Score the quality of extracted capability documentation on 5 dimensions.'),
  makeAgentFile('scorer', 'tools', 'haiku', 'json',
    'Score the quality of extracted tool documentation on 5 dimensions.'),

  // Emitters — per output format
  makeAgentFile('emitter', 'tools', 'sonnet', 'yaml',
    'Emit YAML agent tool definitions compatible with Claude API tool_use format.'),
  makeAgentFile('emitter', 'tools', 'sonnet', 'markdown',
    'Emit clean Markdown documentation for tool use patterns.'),
  makeAgentFile('emitter', 'agent-skills', 'sonnet', 'yaml',
    'Emit YAML skill definitions for Agent Skills API integration.'),
];

// ─── Versioned Agent File Registry ──────────────────────────────────────────

export type AgentFileRegistry = {
  readonly agents: readonly AgentFile[];
  readonly byRole: Readonly<Record<AgentRole, readonly AgentFile[]>>;
  readonly bySurface: Readonly<Record<DocSurface, readonly AgentFile[]>>;
};

export const AGENT_FILE_REGISTRY: VersionedModel<AgentFileRegistry> = createVersionedModel(
  toSurfaceId('agent-file-registry'),
  'Headless Subagent File Registry',
  {
    agents: AGENT_FILES,
    byRole: groupBy(AGENT_FILES, (a) => a.role) as Record<AgentRole, readonly AgentFile[]>,
    bySurface: groupBy(AGENT_FILES, (a) => a.surface) as Record<DocSurface, readonly AgentFile[]>,
  },
  'crawl-orchestrator',
);

// ─── Helper ─────────────────────────────────────────────────────────────────

function groupBy<T>(items: readonly T[], key: (item: T) => string): Record<string, readonly T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item);
    if (!groups[k]) groups[k] = [];
    groups[k]!.push(item);
  }
  return groups;
}
