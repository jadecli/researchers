// .jade/schemas/output-schemas.ts — YAML/Markdown schema definitions per surface
//
// Each schema defines the expected output structure when an agent crawls
// a page from a given surface. Agents use these as structured output contracts.
// Scripts and tools validate against these schemas.

import type { DocSurface, OutputFormat, AgentStrategy } from '../surfaces/doc-surface.js';
import type { AgentRole } from '../agents/crawl-agent.js';
import type { VersionedModel, SurfaceId } from '../models/base.js';
import { createVersionedModel, toSurfaceId, assertNever } from '../models/base.js';

// ─── Schema Field ───────────────────────────────────────────────────────────

export interface SchemaField {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
  readonly required: boolean;
  readonly description: string;
  readonly enumValues?: readonly string[];
  readonly arrayItemType?: string;
  readonly objectFields?: readonly SchemaField[];
}

// ─── Output Schema ──────────────────────────────────────────────────────────

export interface OutputSchema {
  readonly surface: DocSurface;
  readonly format: OutputFormat;
  readonly version: string;
  readonly fields: readonly SchemaField[];
  readonly yamlTemplate: string;
}

// ─── Per-Surface Schemas ────────────────────────────────────────────────────

const capabilitySchema: OutputSchema = {
  surface: 'capabilities',
  format: 'yaml',
  version: '1.0.0',
  fields: [
    { name: 'name', type: 'string', required: true, description: 'Capability name' },
    { name: 'slug', type: 'string', required: true, description: 'URL slug' },
    { name: 'summary', type: 'string', required: true, description: '2-3 sentence summary' },
    { name: 'apiEndpoint', type: 'string', required: false, description: 'API endpoint path' },
    { name: 'sdkMethod', type: 'string', required: false, description: 'SDK method signature' },
    { name: 'betaStatus', type: 'boolean', required: true, description: 'Is beta feature' },
    { name: 'requiredModel', type: 'string', required: false, description: 'Model requirement' },
    { name: 'parameters', type: 'array', required: false, description: 'API parameters', arrayItemType: 'ParameterSpec' },
    { name: 'codeExamples', type: 'array', required: false, description: 'Code examples', arrayItemType: 'CodeExample' },
  ],
  yamlTemplate: `# Capability: {name}
slug: "{slug}"
summary: "{summary}"
api:
  endpoint: "{apiEndpoint}"
  sdk_method: "{sdkMethod}"
beta: {betaStatus}
required_model: "{requiredModel}"
parameters: []
code_examples: []
`,
};

const toolSchema: OutputSchema = {
  surface: 'tools',
  format: 'yaml',
  version: '1.0.0',
  fields: [
    { name: 'name', type: 'string', required: true, description: 'Tool name' },
    { name: 'section', type: 'enum', required: true, description: 'Tool section', enumValues: ['overview', 'how-it-works', 'tutorial', 'define-tools', 'handle-tool-calls', 'parallel-tool-use', 'tool-runner-sdk', 'strict-tool-use', 'prompt-caching', 'server-tools', 'troubleshooting'] },
    { name: 'summary', type: 'string', required: true, description: 'Section summary' },
    { name: 'inputSchema', type: 'object', required: false, description: 'Tool input JSON schema' },
    { name: 'codeExamples', type: 'array', required: true, description: 'Code examples', arrayItemType: 'CodeExample' },
    { name: 'relatedPages', type: 'array', required: false, description: 'Related page slugs', arrayItemType: 'string' },
  ],
  yamlTemplate: `# Tool: {name}
section: "{section}"
summary: "{summary}"
input_schema: null
code_examples: []
related_pages: []
`,
};

const toolReferenceSchema: OutputSchema = {
  surface: 'tool-reference',
  format: 'yaml',
  version: '1.0.0',
  fields: [
    { name: 'toolName', type: 'string', required: true, description: 'Tool identifier' },
    { name: 'toolType', type: 'enum', required: true, description: 'Built-in tool type', enumValues: ['web-search', 'web-fetch', 'code-execution', 'memory', 'bash', 'computer-use', 'text-editor'] },
    { name: 'serverSide', type: 'boolean', required: true, description: 'Server-side execution' },
    { name: 'inputSchema', type: 'string', required: false, description: 'Input schema definition' },
    { name: 'outputFormat', type: 'string', required: false, description: 'Output format' },
    { name: 'apiDefinition', type: 'object', required: true, description: 'Tool API definition for messages.create()' },
  ],
  yamlTemplate: `# Tool Reference: {toolName}
type: "{toolType}"
server_side: {serverSide}
input_schema: "{inputSchema}"
api_definition:
  type: "{toolType}"
  name: "{toolName}"
`,
};

const toolInfraSchema: OutputSchema = {
  surface: 'tool-infrastructure',
  format: 'yaml',
  version: '1.0.0',
  fields: [
    { name: 'topic', type: 'enum', required: true, description: 'Infrastructure topic', enumValues: ['manage-context', 'tool-combinations', 'tool-search', 'programmatic-calling', 'fine-grained-streaming'] },
    { name: 'summary', type: 'string', required: true, description: 'Topic summary' },
    { name: 'patterns', type: 'array', required: true, description: 'Usage patterns', arrayItemType: 'string' },
    { name: 'codeExamples', type: 'array', required: false, description: 'Code examples', arrayItemType: 'CodeExample' },
  ],
  yamlTemplate: `# Tool Infrastructure: {topic}
summary: "{summary}"
patterns: []
code_examples: []
`,
};

const contextSchema: OutputSchema = {
  surface: 'context-management',
  format: 'yaml',
  version: '1.0.0',
  fields: [
    { name: 'topic', type: 'enum', required: true, description: 'Context topic', enumValues: ['context-windows', 'compaction', 'context-editing', 'prompt-caching', 'token-counting'] },
    { name: 'summary', type: 'string', required: true, description: 'Topic summary' },
    { name: 'affectsTokenCount', type: 'boolean', required: true, description: 'Affects token count' },
    { name: 'limits', type: 'object', required: false, description: 'Token/size limits' },
  ],
  yamlTemplate: `# Context Management: {topic}
summary: "{summary}"
affects_token_count: {affectsTokenCount}
limits: null
`,
};

const filesAssetsSchema: OutputSchema = {
  surface: 'files-assets',
  format: 'yaml',
  version: '1.0.0',
  fields: [
    { name: 'fileTypes', type: 'array', required: true, description: 'Supported file types', arrayItemType: 'string' },
    { name: 'maxSizeMb', type: 'number', required: true, description: 'Max file size in MB' },
    { name: 'apiEndpoints', type: 'array', required: true, description: 'File API endpoints', arrayItemType: 'string' },
  ],
  yamlTemplate: `# Files & Assets
file_types: []
max_size_mb: {maxSizeMb}
api_endpoints: []
`,
};

const agentSkillsSchema: OutputSchema = {
  surface: 'agent-skills',
  format: 'yaml',
  version: '1.0.0',
  fields: [
    { name: 'skillTopic', type: 'enum', required: true, description: 'Skill topic', enumValues: ['overview', 'quickstart', 'best-practices', 'enterprise', 'claude-api-skill', 'skills-with-api'] },
    { name: 'summary', type: 'string', required: true, description: 'Topic summary' },
    { name: 'requiresEnterprise', type: 'boolean', required: true, description: 'Enterprise only' },
    { name: 'skillDefinition', type: 'object', required: false, description: 'Skill definition schema' },
    { name: 'apiIntegration', type: 'object', required: false, description: 'API integration details' },
  ],
  yamlTemplate: `# Agent Skill: {skillTopic}
summary: "{summary}"
requires_enterprise: {requiresEnterprise}
skill_definition: null
api_integration: null
`,
};

// ─── Schema Registry ────────────────────────────────────────────────────────

export const OUTPUT_SCHEMAS: Readonly<Record<DocSurface, OutputSchema>> = {
  'capabilities': capabilitySchema,
  'tools': toolSchema,
  'tool-reference': toolReferenceSchema,
  'tool-infrastructure': toolInfraSchema,
  'context-management': contextSchema,
  'files-assets': filesAssetsSchema,
  'agent-skills': agentSkillsSchema,
};

export function getSchemaForSurface(surface: DocSurface): OutputSchema {
  return OUTPUT_SCHEMAS[surface];
}

// ─── Decision Tree ──────────────────────────────────────────────────────────
// Given surface + priority + format, decide which agent role, model, and
// script to use. This is the programmatic entry point for automated dispatch.

export interface DecisionNode {
  readonly surface: DocSurface;
  readonly strategy: AgentStrategy;
  readonly agentRoles: readonly AgentRole[];
  readonly preferredModel: 'opus' | 'sonnet' | 'haiku';
  readonly outputFormats: readonly OutputFormat[];
  readonly script: ScriptTarget;
}

export type ScriptTarget =
  | 'crawl-and-extract'     // Direct fetch → extract → emit
  | 'agent-crawl-structure' // Headless agent → structure → emit
  | 'batch-bulk-crawl'      // Batch API for bulk pages
  | 'stream-and-score';     // Stream + inline quality scoring

export const DECISION_TREE: Readonly<Record<DocSurface, DecisionNode>> = {
  'capabilities': {
    surface: 'capabilities',
    strategy: 'headless-subagent',
    agentRoles: ['crawler', 'structurer', 'emitter'],
    preferredModel: 'sonnet',
    outputFormats: ['markdown', 'yaml'],
    script: 'agent-crawl-structure',
  },
  'tools': {
    surface: 'tools',
    strategy: 'headless-subagent',
    agentRoles: ['crawler', 'structurer', 'scorer', 'emitter'],
    preferredModel: 'opus',
    outputFormats: ['markdown', 'yaml', 'typescript'],
    script: 'agent-crawl-structure',
  },
  'tool-reference': {
    surface: 'tool-reference',
    strategy: 'direct-fetch-extract',
    agentRoles: ['crawler', 'emitter'],
    preferredModel: 'sonnet',
    outputFormats: ['markdown', 'yaml', 'typescript'],
    script: 'crawl-and-extract',
  },
  'tool-infrastructure': {
    surface: 'tool-infrastructure',
    strategy: 'direct-fetch-extract',
    agentRoles: ['crawler', 'emitter'],
    preferredModel: 'haiku',
    outputFormats: ['markdown'],
    script: 'crawl-and-extract',
  },
  'context-management': {
    surface: 'context-management',
    strategy: 'direct-fetch-extract',
    agentRoles: ['crawler', 'structurer', 'emitter'],
    preferredModel: 'sonnet',
    outputFormats: ['markdown', 'yaml'],
    script: 'crawl-and-extract',
  },
  'files-assets': {
    surface: 'files-assets',
    strategy: 'direct-fetch-extract',
    agentRoles: ['crawler', 'emitter'],
    preferredModel: 'haiku',
    outputFormats: ['markdown', 'yaml'],
    script: 'crawl-and-extract',
  },
  'agent-skills': {
    surface: 'agent-skills',
    strategy: 'headless-subagent',
    agentRoles: ['crawler', 'structurer', 'scorer', 'emitter'],
    preferredModel: 'opus',
    outputFormats: ['markdown', 'yaml', 'typescript'],
    script: 'agent-crawl-structure',
  },
};

export function getDecision(surface: DocSurface): DecisionNode {
  return DECISION_TREE[surface];
}

// ─── Versioned Schema Registry ──────────────────────────────────────────────

export type SchemaRegistry = {
  readonly schemas: Readonly<Record<DocSurface, OutputSchema>>;
  readonly decisions: Readonly<Record<DocSurface, DecisionNode>>;
  readonly totalSurfaces: number;
};

export const SCHEMA_REGISTRY: VersionedModel<SchemaRegistry> = createVersionedModel(
  toSurfaceId('schema-registry'),
  'Output Schema and Decision Tree Registry',
  {
    schemas: OUTPUT_SCHEMAS,
    decisions: DECISION_TREE,
    totalSurfaces: Object.keys(OUTPUT_SCHEMAS).length,
  },
  'crawl-orchestrator',
);
