// .jade/surfaces/doc-surface.ts — Doc surface area enum and page model
//
// Every page from docs.anthropic.com maps to exactly one DocSurface.
// The discriminated union drives which agent handles the page,
// which extraction strategy to use, and which YAML schema to emit.

import type { SurfaceId, PageSlug, VersionedModel } from '../models/base.js';
import { toSurfaceId, toPageSlug, createVersionedModel } from '../models/base.js';

// ─── Doc Surface Enum ───────────────────────────────────────────────────────
// Each literal maps 1:1 to a top-level section of the Anthropic docs.

export type DocSurface =
  | 'capabilities'
  | 'tools'
  | 'tool-reference'
  | 'tool-infrastructure'
  | 'context-management'
  | 'files-assets'
  | 'agent-skills';

export const ALL_SURFACES: readonly DocSurface[] = [
  'capabilities',
  'tools',
  'tool-reference',
  'tool-infrastructure',
  'context-management',
  'files-assets',
  'agent-skills',
] as const;

// ─── Crawl Priority ─────────────────────────────────────────────────────────

export type CrawlPriority = 'critical' | 'high' | 'medium' | 'low';

// ─── Agent Strategy ─────────────────────────────────────────────────────────
// Which agent approach to use for extracting this page.

export type AgentStrategy =
  | 'direct-fetch-extract'   // Simple HTTP GET + HTML extraction
  | 'headless-subagent'      // Claude headless agent reads + structures
  | 'sdk-stream'             // Agent SDK v2 streaming session
  | 'batch-process';         // Batch API for bulk pages

// ─── Output Format ──────────────────────────────────────────────────────────

export type OutputFormat = 'markdown' | 'yaml' | 'json' | 'typescript';

// ─── Base Doc Page ──────────────────────────────────────────────────────────
// Shared fields for every doc page regardless of surface.

export interface DocPageBase {
  readonly slug: PageSlug;
  readonly url: string;
  readonly title: string;
  readonly surface: DocSurface;
  readonly priority: CrawlPriority;
  readonly agentStrategy: AgentStrategy;
  readonly outputFormats: readonly OutputFormat[];
  readonly parentSlug: PageSlug | null;
  readonly childSlugs: readonly PageSlug[];
}

// ─── Surface-Specific Page Models ───────────────────────────────────────────
// Inheritance: each extends DocPageBase with surface-specific fields.
// This reduces complexity — shared crawl/extract logic lives in DocPageBase,
// surface-specific semantics are typed per-variant.

export interface CapabilityPage extends DocPageBase {
  readonly surface: 'capabilities';
  readonly capabilityName: string;
  readonly apiEndpoint: string | null;
  readonly sdkMethod: string | null;
  readonly betaStatus: boolean;
  readonly requiredModel: string | null;
}

export interface ToolPage extends DocPageBase {
  readonly surface: 'tools';
  readonly toolSection: ToolSection;
  readonly hasCodeExamples: boolean;
  readonly relatedTools: readonly PageSlug[];
}

export interface ToolReferencePage extends DocPageBase {
  readonly surface: 'tool-reference';
  readonly toolName: string;
  readonly toolType: BuiltInToolType;
  readonly inputSchema: string | null;
  readonly serverSide: boolean;
}

export interface ToolInfrastructurePage extends DocPageBase {
  readonly surface: 'tool-infrastructure';
  readonly infraTopic: ToolInfraTopic;
}

export interface ContextManagementPage extends DocPageBase {
  readonly surface: 'context-management';
  readonly contextTopic: ContextTopic;
  readonly affectsTokenCount: boolean;
}

export interface FilesAssetsPage extends DocPageBase {
  readonly surface: 'files-assets';
  readonly fileType: string;
  readonly maxSizeMb: number | null;
}

export interface AgentSkillPage extends DocPageBase {
  readonly surface: 'agent-skills';
  readonly skillTopic: AgentSkillTopic;
  readonly requiresEnterprise: boolean;
}

// ─── Discriminated Union ────────────────────────────────────────────────────
// The `surface` field is the discriminant. Pattern match exhaustively.

export type DocPage =
  | CapabilityPage
  | ToolPage
  | ToolReferencePage
  | ToolInfrastructurePage
  | ContextManagementPage
  | FilesAssetsPage
  | AgentSkillPage;

// ─── Sub-Enums ──────────────────────────────────────────────────────────────

export type ToolSection =
  | 'overview'
  | 'how-it-works'
  | 'tutorial'
  | 'define-tools'
  | 'handle-tool-calls'
  | 'parallel-tool-use'
  | 'tool-runner-sdk'
  | 'strict-tool-use'
  | 'prompt-caching'
  | 'server-tools'
  | 'troubleshooting';

export type BuiltInToolType =
  | 'web-search'
  | 'web-fetch'
  | 'code-execution'
  | 'memory'
  | 'bash'
  | 'computer-use'
  | 'text-editor';

export type ToolInfraTopic =
  | 'manage-context'
  | 'tool-combinations'
  | 'tool-search'
  | 'programmatic-calling'
  | 'fine-grained-streaming';

export type ContextTopic =
  | 'context-windows'
  | 'compaction'
  | 'context-editing'
  | 'prompt-caching'
  | 'token-counting';

export type AgentSkillTopic =
  | 'overview'
  | 'quickstart'
  | 'best-practices'
  | 'enterprise'
  | 'claude-api-skill'
  | 'skills-with-api';

// ─── Decision Tree ──────────────────────────────────────────────────────────
// Given a URL, resolve which surface and strategy to use.

export function classifyUrl(url: string): { surface: DocSurface; priority: CrawlPriority; strategy: AgentStrategy } {
  const path = url.toLowerCase();

  if (path.includes('agent-skills') || path.includes('agent_skills')) {
    return { surface: 'agent-skills', priority: 'high', strategy: 'headless-subagent' };
  }
  if (path.includes('tool-use/web-') || path.includes('tool-use/code-') ||
      path.includes('tool-use/memory') || path.includes('tool-use/bash') ||
      path.includes('tool-use/computer-use') || path.includes('tool-use/text-editor')) {
    return { surface: 'tool-reference', priority: 'high', strategy: 'direct-fetch-extract' };
  }
  if (path.includes('manage-tool-context') || path.includes('tool-combinations') ||
      path.includes('tool-search') || path.includes('programmatic') ||
      path.includes('fine-grained')) {
    return { surface: 'tool-infrastructure', priority: 'medium', strategy: 'direct-fetch-extract' };
  }
  if (path.includes('tool-use')) {
    return { surface: 'tools', priority: 'critical', strategy: 'headless-subagent' };
  }
  if (path.includes('context-window') || path.includes('compaction') ||
      path.includes('context-editing') || path.includes('prompt-caching') ||
      path.includes('token-counting')) {
    return { surface: 'context-management', priority: 'high', strategy: 'direct-fetch-extract' };
  }
  if (path.includes('files') || path.includes('files-api')) {
    return { surface: 'files-assets', priority: 'medium', strategy: 'direct-fetch-extract' };
  }
  // Default: capabilities (extended thinking, vision, streaming, etc.)
  return { surface: 'capabilities', priority: 'high', strategy: 'direct-fetch-extract' };
}

// ─── Page Registry Factory ──────────────────────────────────────────────────
// Creates a VersionedModel of the full doc page registry.

export type DocPageRegistry = {
  readonly pages: readonly DocPage[];
  readonly surfaceCounts: Readonly<Record<DocSurface, number>>;
  readonly totalPages: number;
};

export function createPageRegistry(
  pages: readonly DocPage[],
): VersionedModel<DocPageRegistry> {
  const surfaceCounts = {} as Record<DocSurface, number>;
  for (const s of ALL_SURFACES) {
    surfaceCounts[s] = pages.filter((p) => p.surface === s).length;
  }

  return createVersionedModel(
    toSurfaceId('doc-page-registry'),
    'Anthropic Documentation Page Registry',
    { pages, surfaceCounts, totalPages: pages.length },
    'crawl-orchestrator',
  );
}
