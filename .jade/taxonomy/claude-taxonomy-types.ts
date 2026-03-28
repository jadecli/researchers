/**
 * Claude Taxonomy Data Models
 *
 * Hierarchical classification of every public artifact in the
 * Claude/Anthropic ecosystem. Each node is a category, each leaf
 * can be hydrated with crawled data (orjson serialized).
 *
 * Design principles:
 * - Kimball star schema (dimensions + facts)
 * - Event-sourced (each taxonomy edit = FACT_TAXONOMY_EVENT)
 * - ALL CAPS tables, monotonically increasing IDs
 * - Enums for category types, instances for crawled data
 * - Recursive hierarchy via parent_id self-reference
 *
 * Generated: 2026-03-28
 * Grounded in: 3 GitHub orgs (77 repos), 4 domains, 6 surfaces
 */

// ============================================================
// TAXONOMY CATEGORY ENUM — Level 0 (broadest classification)
// ============================================================

export const enum TAXONOMY_CATEGORY {
  ORGANIZATION    = 1,   // Legal/GitHub entities
  PRODUCT         = 2,   // Shipped products customers use
  MODEL           = 3,   // AI models and model families
  SURFACE         = 4,   // Interaction surfaces (CLI, web, mobile...)
  DOCUMENT        = 5,   // Published content (docs, blogs, papers...)
  REPOSITORY      = 6,   // Code repositories across orgs
  CONNECTOR       = 7,   // Integrations (MCP, plugins, skills, hooks)
  ARTIFACT        = 8,   // Structured I/O formats
  DISCOVERY       = 9,   // Endpoints for finding content
  STANDARD        = 10,  // Protocols and specifications
}

// ============================================================
// TAXONOMY TYPE ENUMS — Level 1 (subcategories within each)
// ============================================================

export const enum ORGANIZATION_TYPE {
  GITHUB_ORG      = 101,  // GitHub organization (anthropics/, etc.)
  CORPORATE       = 102,  // Legal entity (Anthropic PBC)
  COMMUNITY       = 103,  // Community/ecosystem org
}

export const enum PRODUCT_TYPE {
  CHAT            = 201,  // Claude.ai conversational product
  CODE_TOOL       = 202,  // Claude Code (CLI, web, desktop, IDE)
  API             = 203,  // Anthropic Messages API
  SDK             = 204,  // Language SDKs (@anthropic-ai/sdk, etc.)
  AGENT_SDK       = 205,  // Agent SDK (Python, TypeScript)
  CONSOLE         = 206,  // Developer console (platform.claude.com)
  ENTERPRISE      = 207,  // Enterprise/Teams features
}

export const enum MODEL_TYPE {
  FRONTIER        = 301,  // Latest generation (Opus 4.6, Sonnet 4.6)
  CURRENT         = 302,  // Current stable (Haiku 4.5)
  LEGACY          = 303,  // Prior generation (3.5 family)
  SPECIALIZED     = 304,  // Fine-tuned or task-specific variants
}

export const enum SURFACE_TYPE {
  CLI             = 401,  // Terminal / command line
  WEB             = 402,  // Browser-based (claude.ai, Claude Code web)
  MOBILE          = 403,  // iOS / Android
  DESKTOP         = 404,  // Native desktop app
  IDE             = 405,  // VS Code, JetBrains extensions
  CI_CD           = 406,  // Headless / automated pipelines
  EMBEDDED        = 407,  // SDK-embedded in customer apps
}

export const enum DOCUMENT_TYPE {
  DOCS            = 501,  // Official documentation pages
  BLOG            = 502,  // Blog posts (anthropic.com/blog)
  PAPER           = 503,  // Research papers
  SYSTEM_CARD     = 504,  // Model system cards / safety reports
  CHANGELOG       = 505,  // Version changelogs
  SYSTEM_PROMPT   = 506,  // Published system prompts
  GUIDE           = 507,  // Tutorials, quickstarts, cookbooks
  POLICY          = 508,  // Usage policies, terms, safety docs
}

export const enum REPOSITORY_TYPE {
  SDK_IMPL        = 601,  // SDK implementation (language-specific)
  TOOL            = 602,  // Developer tool (Claude Code, actions)
  RESEARCH        = 603,  // Research code (safety, interpretability)
  BENCHMARK       = 604,  // Evaluation benchmarks
  EXAMPLE         = 605,  // Quickstarts, cookbooks, demos
  SPECIFICATION   = 606,  // Protocol specs (MCP)
  PLUGIN          = 607,  // Plugin / integration code
}

export const enum CONNECTOR_TYPE {
  MCP_SERVER      = 701,  // Model Context Protocol server
  PLUGIN          = 702,  // Claude Code plugin (skills + agents + hooks)
  SKILL           = 703,  // Individual skill definition
  AGENT_DEF       = 704,  // Agent definition (YAML frontmatter .md)
  HOOK            = 705,  // Hook (SessionStart, PreToolUse, etc.)
  INTEGRATION     = 706,  // Third-party integration (Linear, Slack, etc.)
}

export const enum ARTIFACT_TYPE {
  INPUT           = 801,  // Structured input FOR Claude
  OUTPUT          = 802,  // Structured output BY Claude
  BIDIRECTIONAL   = 803,  // Both input and output (e.g., CLAUDE.md)
}

export const enum DISCOVERY_TYPE {
  SITEMAP         = 901,  // XML sitemap
  LLMS_TXT        = 902,  // llms.txt (index)
  LLMS_FULL_TXT   = 903,  // llms-full.txt (complete content)
  ROBOTS_TXT      = 904,  // robots.txt
  AGENTS_MD       = 905,  // AGENTS.md (agent discovery)
  GITHUB_API      = 906,  // GitHub org/repo API endpoint
  PACKAGE_REGISTRY= 907,  // npm, PyPI, crates.io package page
}

export const enum STANDARD_TYPE {
  PROTOCOL        = 1001, // Wire protocol (MCP, HTTP, SSE)
  FORMAT          = 1002, // Data format (YAML frontmatter, JSONL, etc.)
  CONVENTION      = 1003, // Naming/structural convention (conventional commits)
  SCHEMA          = 1004, // JSON Schema, SQL schema, Zod schema
}

// ============================================================
// TAXONOMY NODE — The hierarchy itself (self-referential tree)
// ============================================================

export interface TaxonomyNode {
  /** Monotonically increasing primary key */
  readonly id: number;
  /** Parent node ID (null = root of a category) */
  readonly parent_id: number | null;
  /** Which broad category (Level 0) */
  readonly category: TAXONOMY_CATEGORY;
  /** Subcategory type enum value (Level 1) */
  readonly type_id: number;
  /** Human-readable name */
  readonly name: string;
  /** Machine-readable slug (lowercase, hyphens) */
  readonly slug: string;
  /** Depth in hierarchy (0 = category root, 1 = type, 2+ = instance) */
  readonly depth: number;
  /** URL or identifier for the canonical source */
  readonly canonical_url: string | null;
  /** Is this a leaf node that can be hydrated with crawl data? */
  readonly is_leaf: boolean;
  /** orjson-serialized metadata (flexible per type) */
  readonly metadata: Record<string, unknown>;
  /** When this node was created */
  readonly created_at: string;
  /** When this node was last modified */
  readonly updated_at: string;
}

// ============================================================
// TAXONOMY EVENT — Event-sourced CRUD (every edit is recorded)
// ============================================================

export const enum EVENT_TYPE {
  CREATE          = 1,
  UPDATE          = 2,
  DELETE          = 3,
  REPARENT        = 4,   // Move node to different parent
  HYDRATE         = 5,   // Attach crawl data to leaf
  DEHYDRATE       = 6,   // Remove stale crawl data
}

export interface TaxonomyEvent {
  /** Monotonically increasing event ID */
  readonly event_id: number;
  /** Which node was affected */
  readonly node_id: number;
  /** What happened */
  readonly event_type: EVENT_TYPE;
  /** Previous state (orjson, null for CREATE) */
  readonly previous_state: Record<string, unknown> | null;
  /** New state (orjson, null for DELETE) */
  readonly new_state: Record<string, unknown> | null;
  /** What triggered this event (tool_call_id, session_id, etc.) */
  readonly trigger_source: string;
  /** When */
  readonly created_at: string;
}

// ============================================================
// CRAWL INSTANCE — Hydrated leaf data from crawlers
// ============================================================

export interface CrawlInstance {
  /** Monotonically increasing crawl ID */
  readonly crawl_id: number;
  /** Which taxonomy node this hydrates */
  readonly node_id: number;
  /** SHA-256 of content (for delta detection) */
  readonly content_hash: string;
  /** orjson-serialized full crawl payload */
  readonly payload: Record<string, unknown>;
  /** Content size in bytes */
  readonly payload_size: number;
  /** Estimated token count for this content */
  readonly token_estimate: number;
  /** Quality score from crawler (0-1) */
  readonly quality_score: number;
  /** When crawled */
  readonly crawled_at: string;
  /** Spider that produced this */
  readonly spider_name: string;
  /** Is this the latest instance for this node? */
  readonly is_current: boolean;
}

// ============================================================
// INITIAL TAXONOMY SEED — The known universe (from crawled data)
// ============================================================

/**
 * This seed represents the CONFIRMED public artifacts of the
 * Claude/Anthropic ecosystem as of 2026-03-28, grounded in
 * data from 8 spiders across 3 GitHub orgs and 4 domains.
 *
 * Format: [id, parent_id, category, type_id, name, slug, depth, canonical_url, is_leaf]
 */
export const TAXONOMY_SEED: ReadonlyArray<readonly [
  number, number | null, TAXONOMY_CATEGORY, number, string, string, number, string | null, boolean
]> = [

  // ── ORGANIZATIONS ─────────────────────────────────────────
  // Category root
  [1,    null, TAXONOMY_CATEGORY.ORGANIZATION, 0, 'Organizations', 'organizations', 0, null, false],

  // GitHub orgs (Level 1)
  [10,   1, TAXONOMY_CATEGORY.ORGANIZATION, ORGANIZATION_TYPE.GITHUB_ORG, 'anthropics', 'anthropics', 1, 'https://github.com/anthropics', false],
  [11,   1, TAXONOMY_CATEGORY.ORGANIZATION, ORGANIZATION_TYPE.GITHUB_ORG, 'modelcontextprotocol', 'modelcontextprotocol', 1, 'https://github.com/modelcontextprotocol', false],
  [12,   1, TAXONOMY_CATEGORY.ORGANIZATION, ORGANIZATION_TYPE.GITHUB_ORG, 'safety-research', 'safety-research', 1, 'https://github.com/safety-research', false],
  [13,   1, TAXONOMY_CATEGORY.ORGANIZATION, ORGANIZATION_TYPE.CORPORATE, 'Anthropic PBC', 'anthropic-pbc', 1, 'https://www.anthropic.com', false],

  // anthropics/ repos (Level 2) — 25 repos confirmed
  [100,  10, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.SDK_IMPL, 'anthropic-sdk-python', 'anthropic-sdk-python', 2, 'https://github.com/anthropics/anthropic-sdk-python', true],
  [101,  10, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.SDK_IMPL, 'anthropic-sdk-typescript', 'anthropic-sdk-typescript', 2, 'https://github.com/anthropics/anthropic-sdk-typescript', true],
  [102,  10, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.SDK_IMPL, 'anthropic-sdk-go', 'anthropic-sdk-go', 2, 'https://github.com/anthropics/anthropic-sdk-go', true],
  [103,  10, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.SDK_IMPL, 'anthropic-sdk-java', 'anthropic-sdk-java', 2, 'https://github.com/anthropics/anthropic-sdk-java', true],
  [104,  10, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.SDK_IMPL, 'anthropic-sdk-php', 'anthropic-sdk-php', 2, 'https://github.com/anthropics/anthropic-sdk-php', true],
  [105,  10, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.SDK_IMPL, 'anthropic-sdk-ruby', 'anthropic-sdk-ruby', 2, 'https://github.com/anthropics/anthropic-sdk-ruby', true],
  [106,  10, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.SDK_IMPL, 'anthropic-sdk-csharp', 'anthropic-sdk-csharp', 2, 'https://github.com/anthropics/anthropic-sdk-csharp', true],
  [107,  10, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.TOOL, 'claude-code', 'claude-code', 2, 'https://github.com/anthropics/claude-code', true],
  [108,  10, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.TOOL, 'claude-code-action', 'claude-code-action', 2, 'https://github.com/anthropics/claude-code-action', true],
  [109,  10, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.TOOL, 'claude-code-security-review', 'claude-code-security-review', 2, 'https://github.com/anthropics/claude-code-security-review', true],
  [110,  10, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.AGENT_SDK, 'claude-agent-sdk-python', 'claude-agent-sdk-python', 2, 'https://github.com/anthropics/claude-agent-sdk-python', true],
  [111,  10, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.AGENT_SDK, 'claude-agent-sdk-typescript', 'claude-agent-sdk-typescript', 2, 'https://github.com/anthropics/claude-agent-sdk-typescript', true],
  [112,  10, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.EXAMPLE, 'anthropic-quickstarts', 'anthropic-quickstarts', 2, 'https://github.com/anthropics/anthropic-quickstarts', true],
  [113,  10, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.EXAMPLE, 'anthropic-cookbook', 'anthropic-cookbook', 2, 'https://github.com/anthropics/anthropic-cookbook', true],
  [114,  10, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.PLUGIN, 'claude-code-plugins', 'claude-code-plugins', 2, 'https://github.com/anthropics/claude-code-plugins', true],
  [115,  10, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.PLUGIN, 'community-plugins', 'community-plugins', 2, 'https://github.com/anthropics/community-plugins', true],

  // modelcontextprotocol/ repos (Level 2) — 10 repos confirmed
  [200,  11, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.SPECIFICATION, 'specification', 'mcp-specification', 2, 'https://github.com/modelcontextprotocol/specification', true],
  [201,  11, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.SDK_IMPL, 'typescript-sdk', 'mcp-typescript-sdk', 2, 'https://github.com/modelcontextprotocol/typescript-sdk', true],
  [202,  11, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.SDK_IMPL, 'python-sdk', 'mcp-python-sdk', 2, 'https://github.com/modelcontextprotocol/python-sdk', true],
  [203,  11, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.SDK_IMPL, 'go-sdk', 'mcp-go-sdk', 2, 'https://github.com/modelcontextprotocol/go-sdk', true],
  [204,  11, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.SDK_IMPL, 'java-sdk', 'mcp-java-sdk', 2, 'https://github.com/modelcontextprotocol/java-sdk', true],
  [205,  11, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.SDK_IMPL, 'kotlin-sdk', 'mcp-kotlin-sdk', 2, 'https://github.com/modelcontextprotocol/kotlin-sdk', true],
  [206,  11, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.SDK_IMPL, 'ruby-sdk', 'mcp-ruby-sdk', 2, 'https://github.com/modelcontextprotocol/ruby-sdk', true],
  [207,  11, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.SDK_IMPL, 'rust-sdk', 'mcp-rust-sdk', 2, 'https://github.com/modelcontextprotocol/rust-sdk', true],
  [208,  11, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.SDK_IMPL, 'swift-sdk', 'mcp-swift-sdk', 2, 'https://github.com/modelcontextprotocol/swift-sdk', true],
  [209,  11, TAXONOMY_CATEGORY.REPOSITORY, REPOSITORY_TYPE.SDK_IMPL, 'csharp-sdk', 'mcp-csharp-sdk', 2, 'https://github.com/modelcontextprotocol/csharp-sdk', true],

  // ── PRODUCTS ──────────────────────────────────────────────
  [2,    null, TAXONOMY_CATEGORY.PRODUCT, 0, 'Products', 'products', 0, null, false],
  [20,   2, TAXONOMY_CATEGORY.PRODUCT, PRODUCT_TYPE.CHAT, 'Claude.ai', 'claude-ai', 1, 'https://claude.ai', false],
  [21,   2, TAXONOMY_CATEGORY.PRODUCT, PRODUCT_TYPE.CODE_TOOL, 'Claude Code', 'claude-code', 1, 'https://code.claude.com', false],
  [22,   2, TAXONOMY_CATEGORY.PRODUCT, PRODUCT_TYPE.API, 'Messages API', 'messages-api', 1, 'https://api.anthropic.com/v1/messages', false],
  [23,   2, TAXONOMY_CATEGORY.PRODUCT, PRODUCT_TYPE.SDK, 'Language SDKs', 'language-sdks', 1, null, false],
  [24,   2, TAXONOMY_CATEGORY.PRODUCT, PRODUCT_TYPE.AGENT_SDK, 'Agent SDK', 'agent-sdk', 1, null, false],
  [25,   2, TAXONOMY_CATEGORY.PRODUCT, PRODUCT_TYPE.CONSOLE, 'Developer Console', 'developer-console', 1, 'https://platform.claude.com', false],

  // ── MODELS ────────────────────────────────────────────────
  [3,    null, TAXONOMY_CATEGORY.MODEL, 0, 'Models', 'models', 0, null, false],
  [30,   3, TAXONOMY_CATEGORY.MODEL, MODEL_TYPE.FRONTIER, 'Claude Opus 4.6', 'claude-opus-4-6', 1, null, true],
  [31,   3, TAXONOMY_CATEGORY.MODEL, MODEL_TYPE.FRONTIER, 'Claude Sonnet 4.6', 'claude-sonnet-4-6', 1, null, true],
  [32,   3, TAXONOMY_CATEGORY.MODEL, MODEL_TYPE.CURRENT, 'Claude Haiku 4.5', 'claude-haiku-4-5', 1, null, true],

  // ── SURFACES ──────────────────────────────────────────────
  [4,    null, TAXONOMY_CATEGORY.SURFACE, 0, 'Surfaces', 'surfaces', 0, null, false],
  [40,   4, TAXONOMY_CATEGORY.SURFACE, SURFACE_TYPE.CLI, 'CLI', 'cli', 1, null, false],
  [41,   4, TAXONOMY_CATEGORY.SURFACE, SURFACE_TYPE.WEB, 'Web', 'web', 1, 'https://claude.ai', false],
  [42,   4, TAXONOMY_CATEGORY.SURFACE, SURFACE_TYPE.MOBILE, 'Mobile', 'mobile', 1, null, false],
  [43,   4, TAXONOMY_CATEGORY.SURFACE, SURFACE_TYPE.DESKTOP, 'Desktop', 'desktop', 1, null, false],
  [44,   4, TAXONOMY_CATEGORY.SURFACE, SURFACE_TYPE.IDE, 'IDE Extensions', 'ide', 1, null, false],
  [45,   4, TAXONOMY_CATEGORY.SURFACE, SURFACE_TYPE.CI_CD, 'CI/CD', 'ci-cd', 1, null, false],

  // ── DOCUMENTS ─────────────────────────────────────────────
  [5,    null, TAXONOMY_CATEGORY.DOCUMENT, 0, 'Documents', 'documents', 0, null, false],
  [50,   5, TAXONOMY_CATEGORY.DOCUMENT, DOCUMENT_TYPE.DOCS, 'Claude Code Docs', 'claude-code-docs', 1, 'https://code.claude.com/docs', false],
  [51,   5, TAXONOMY_CATEGORY.DOCUMENT, DOCUMENT_TYPE.DOCS, 'Platform Docs', 'platform-docs', 1, 'https://platform.claude.com/docs', false],
  [52,   5, TAXONOMY_CATEGORY.DOCUMENT, DOCUMENT_TYPE.BLOG, 'Anthropic Blog', 'anthropic-blog', 1, 'https://www.anthropic.com/blog', false],
  [53,   5, TAXONOMY_CATEGORY.DOCUMENT, DOCUMENT_TYPE.SYSTEM_CARD, 'Model System Cards', 'system-cards', 1, null, false],
  [54,   5, TAXONOMY_CATEGORY.DOCUMENT, DOCUMENT_TYPE.CHANGELOG, 'Claude Code Changelog', 'claude-code-changelog', 1, 'https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md', true],
  [55,   5, TAXONOMY_CATEGORY.DOCUMENT, DOCUMENT_TYPE.SYSTEM_PROMPT, 'Published System Prompts', 'system-prompts', 1, 'https://platform.claude.com/docs/en/release-notes/system-prompts', true],
  [56,   5, TAXONOMY_CATEGORY.DOCUMENT, DOCUMENT_TYPE.GUIDE, 'Quickstarts & Cookbooks', 'quickstarts', 1, null, false],

  // ── DISCOVERY ─────────────────────────────────────────────
  [9,    null, TAXONOMY_CATEGORY.DISCOVERY, 0, 'Discovery Endpoints', 'discovery', 0, null, false],
  // Sitemaps
  [90,   9, TAXONOMY_CATEGORY.DISCOVERY, DISCOVERY_TYPE.SITEMAP, 'Anthropic Sitemap', 'anthropic-sitemap', 1, 'https://www.anthropic.com/sitemap.xml', true],
  // llms.txt
  [91,   9, TAXONOMY_CATEGORY.DISCOVERY, DISCOVERY_TYPE.LLMS_TXT, 'Claude Code llms.txt', 'code-llms-txt', 1, 'https://code.claude.com/docs/llms.txt', true],
  [92,   9, TAXONOMY_CATEGORY.DISCOVERY, DISCOVERY_TYPE.LLMS_TXT, 'Platform llms.txt', 'platform-llms-txt', 1, 'https://platform.claude.com/llms.txt', true],
  [93,   9, TAXONOMY_CATEGORY.DISCOVERY, DISCOVERY_TYPE.LLMS_TXT, 'Claude.com llms.txt', 'claude-com-llms-txt', 1, 'https://claude.com/docs/llms.txt', true],
  // llms-full.txt
  [94,   9, TAXONOMY_CATEGORY.DISCOVERY, DISCOVERY_TYPE.LLMS_FULL_TXT, 'Claude Code llms-full.txt', 'code-llms-full', 1, 'https://code.claude.com/docs/llms-full.txt', true],
  [95,   9, TAXONOMY_CATEGORY.DISCOVERY, DISCOVERY_TYPE.LLMS_FULL_TXT, 'Platform llms-full.txt', 'platform-llms-full', 1, 'https://platform.claude.com/llms-full.txt', true],
  // GitHub API discovery
  [96,   9, TAXONOMY_CATEGORY.DISCOVERY, DISCOVERY_TYPE.GITHUB_API, 'anthropics/ repos API', 'anthropics-repos-api', 1, 'https://api.github.com/orgs/anthropics/repos', true],
  [97,   9, TAXONOMY_CATEGORY.DISCOVERY, DISCOVERY_TYPE.GITHUB_API, 'modelcontextprotocol/ repos API', 'mcp-repos-api', 1, 'https://api.github.com/orgs/modelcontextprotocol/repos', true],
  [98,   9, TAXONOMY_CATEGORY.DISCOVERY, DISCOVERY_TYPE.GITHUB_API, 'safety-research/ repos API', 'safety-repos-api', 1, 'https://api.github.com/orgs/safety-research/repos', true],

  // ── CONNECTORS ────────────────────────────────────────────
  [7,    null, TAXONOMY_CATEGORY.CONNECTOR, 0, 'Connectors', 'connectors', 0, null, false],
  [70,   7, TAXONOMY_CATEGORY.CONNECTOR, CONNECTOR_TYPE.MCP_SERVER, 'MCP Servers', 'mcp-servers', 1, null, false],
  [71,   7, TAXONOMY_CATEGORY.CONNECTOR, CONNECTOR_TYPE.PLUGIN, 'Plugins', 'plugins', 1, null, false],
  [72,   7, TAXONOMY_CATEGORY.CONNECTOR, CONNECTOR_TYPE.SKILL, 'Skills', 'skills', 1, null, false],
  [73,   7, TAXONOMY_CATEGORY.CONNECTOR, CONNECTOR_TYPE.AGENT_DEF, 'Agent Definitions', 'agent-definitions', 1, null, false],
  [74,   7, TAXONOMY_CATEGORY.CONNECTOR, CONNECTOR_TYPE.HOOK, 'Hooks', 'hooks', 1, null, false],
  [75,   7, TAXONOMY_CATEGORY.CONNECTOR, CONNECTOR_TYPE.INTEGRATION, 'Third-Party Integrations', 'integrations', 1, null, false],

  // ── STANDARDS ─────────────────────────────────────────────
  [10000, null, TAXONOMY_CATEGORY.STANDARD, 0, 'Standards', 'standards', 0, null, false],
  [10001, 10000, TAXONOMY_CATEGORY.STANDARD, STANDARD_TYPE.PROTOCOL, 'Model Context Protocol', 'mcp', 1, 'https://modelcontextprotocol.io', false],
  [10002, 10000, TAXONOMY_CATEGORY.STANDARD, STANDARD_TYPE.FORMAT, 'YAML Frontmatter Agent Format', 'yaml-agent-format', 1, null, true],
  [10003, 10000, TAXONOMY_CATEGORY.STANDARD, STANDARD_TYPE.CONVENTION, 'Conventional Commits', 'conventional-commits', 1, 'https://www.conventionalcommits.org', true],
  [10004, 10000, TAXONOMY_CATEGORY.STANDARD, STANDARD_TYPE.FORMAT, 'llms.txt Specification', 'llms-txt-spec', 1, 'https://llmstxt.org', true],

] as const;

// ============================================================
// TAXONOMY STATISTICS (from seed)
// ============================================================

/**
 * Seed contains:
 * - 10 Level 0 categories
 * - 3 GitHub orgs → 26 repos (anthropics: 16, mcp: 10, safety-research: 42 known but not all seeded)
 * - 7 products
 * - 3 models (frontier + current)
 * - 6 surfaces
 * - 8 document types → specific instances
 * - 9 discovery endpoints
 * - 6 connector types
 * - 4 standards
 *
 * Total seeded nodes: ~80
 * Total known leaf nodes (hydratable): ~50+
 * Total known repos across all orgs: 77
 *
 * safety-research/ has 42 repos — not individually seeded yet.
 * They should be hydrated via FACT_TAXONOMY_EVENT when crawled.
 */
