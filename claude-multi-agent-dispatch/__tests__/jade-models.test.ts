import { describe, it, expect } from 'vitest';

// ─── Base model tests ───────────────────────────────────────────────────────

import {
  toModelVersion,
  toSurfaceId,
  toPageSlug,
  toAgentFileId,
  toSchemaVersion,
  createVersionedModel,
  bumpVersion,
} from '../../.jade/models/base.js';

describe('Branded Type Constructors', () => {
  it('toModelVersion accepts positive integers', () => {
    expect(toModelVersion(1) as number).toBe(1);
    expect(toModelVersion(99) as number).toBe(99);
  });

  it('toModelVersion rejects invalid values', () => {
    expect(() => toModelVersion(0)).toThrow();
    expect(() => toModelVersion(-1)).toThrow();
    expect(() => toModelVersion(1.5)).toThrow();
  });

  it('toSurfaceId accepts lowercase kebab/snake', () => {
    expect(toSurfaceId('tools') as string).toBe('tools');
    expect(toSurfaceId('agent-skills') as string).toBe('agent-skills');
    expect(toSurfaceId('context_management') as string).toBe('context_management');
  });

  it('toSurfaceId rejects invalid formats', () => {
    expect(() => toSurfaceId('')).toThrow();
    expect(() => toSurfaceId('CAPS')).toThrow();
    expect(() => toSurfaceId('123start')).toThrow();
  });

  it('toPageSlug accepts non-empty strings', () => {
    expect(toPageSlug('extended-thinking') as string).toBe('extended-thinking');
  });

  it('toPageSlug rejects empty', () => {
    expect(() => toPageSlug('')).toThrow();
  });

  it('toAgentFileId accepts non-empty strings', () => {
    expect(toAgentFileId('crawler-tools') as string).toBe('crawler-tools');
  });

  it('toSchemaVersion accepts semver', () => {
    expect(toSchemaVersion('1.0.0') as string).toBe('1.0.0');
    expect(toSchemaVersion('2.3.14') as string).toBe('2.3.14');
  });

  it('toSchemaVersion rejects non-semver', () => {
    expect(() => toSchemaVersion('1.0')).toThrow();
    expect(() => toSchemaVersion('v1.0.0')).toThrow();
  });
});

describe('VersionedModel', () => {
  it('createVersionedModel starts at version 1', () => {
    const model = createVersionedModel(
      toSurfaceId('test-model'),
      'Test',
      { value: 42 },
      'test-user',
    );

    expect(model.currentVersion as number).toBe(1);
    expect(model.current.isCurrent).toBe(true);
    expect(model.current.validTo).toBeNull();
    expect(model.current.data.value).toBe(42);
    expect(model.history).toHaveLength(0);
  });

  it('bumpVersion increments version and archives previous', () => {
    const v1 = createVersionedModel(
      toSurfaceId('test-model'),
      'Test',
      { value: 1 },
      'user-a',
    );

    const v2 = bumpVersion(v1, { value: 2 }, 'user-b', 'Updated value');

    expect(v2.currentVersion as number).toBe(2);
    expect(v2.current.data.value).toBe(2);
    expect(v2.current.editedBy).toBe('user-b');
    expect(v2.current.editReason).toBe('Updated value');
    expect(v2.current.isCurrent).toBe(true);
    expect(v2.current.validTo).toBeNull();

    // History should have the closed v1
    expect(v2.history).toHaveLength(1);
    expect(v2.history[0]!.version as number).toBe(1);
    expect(v2.history[0]!.isCurrent).toBe(false);
    expect(v2.history[0]!.validTo).not.toBeNull();
  });

  it('multiple bumps create full history chain', () => {
    let model = createVersionedModel(toSurfaceId('chain'), 'Chain', 'a', 'u');
    model = bumpVersion(model, 'b', 'u', 'b');
    model = bumpVersion(model, 'c', 'u', 'c');
    model = bumpVersion(model, 'd', 'u', 'd');

    expect(model.currentVersion as number).toBe(4);
    expect(model.current.data).toBe('d');
    expect(model.history).toHaveLength(3);
    expect(model.history.map((h) => h.data)).toEqual(['a', 'b', 'c']);
  });
});

// ─── Doc Surface tests ──────────────────────────────────────────────────────

import {
  ALL_SURFACES,
  classifyUrl,
  createPageRegistry,
  type DocSurface,
} from '../../.jade/surfaces/doc-surface.js';
import { ALL_DOC_PAGES, DOC_PAGE_REGISTRY } from '../../.jade/surfaces/registry.js';

describe('DocSurface', () => {
  it('ALL_SURFACES has 7 surfaces', () => {
    expect(ALL_SURFACES).toHaveLength(7);
  });

  it('classifyUrl maps tool-use URLs to tools surface', () => {
    const result = classifyUrl('https://docs.anthropic.com/en/docs/build-with-claude/tool-use/overview');
    expect(result.surface).toBe('tools');
    expect(result.priority).toBe('critical');
  });

  it('classifyUrl maps web-search-tool to tool-reference', () => {
    const result = classifyUrl('https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search-tool');
    expect(result.surface).toBe('tool-reference');
  });

  it('classifyUrl maps agent-skills to agent-skills surface', () => {
    const result = classifyUrl('https://docs.anthropic.com/en/docs/build-with-claude/agent-skills/overview');
    expect(result.surface).toBe('agent-skills');
  });

  it('classifyUrl maps context-windows to context-management', () => {
    const result = classifyUrl('https://docs.anthropic.com/en/docs/build-with-claude/context-windows');
    expect(result.surface).toBe('context-management');
  });

  it('classifyUrl defaults to capabilities', () => {
    const result = classifyUrl('https://docs.anthropic.com/en/docs/build-with-claude/vision');
    expect(result.surface).toBe('capabilities');
  });
});

describe('DocPageRegistry', () => {
  it('ALL_DOC_PAGES has all pages from every surface', () => {
    expect(ALL_DOC_PAGES.length).toBeGreaterThanOrEqual(45);
  });

  it('every page has a valid URL starting with https', () => {
    for (const page of ALL_DOC_PAGES) {
      expect(page.url).toMatch(/^https:\/\//);
    }
  });

  it('every page has a non-empty slug', () => {
    for (const page of ALL_DOC_PAGES) {
      expect((page.slug as string).length).toBeGreaterThan(0);
    }
  });

  it('all 7 surfaces are represented', () => {
    const surfaces = new Set(ALL_DOC_PAGES.map((p) => p.surface));
    expect(surfaces.size).toBe(7);
    for (const s of ALL_SURFACES) {
      expect(surfaces.has(s)).toBe(true);
    }
  });

  it('DOC_PAGE_REGISTRY is a VersionedModel at version 1', () => {
    expect(DOC_PAGE_REGISTRY.currentVersion as number).toBe(1);
    expect(DOC_PAGE_REGISTRY.current.isCurrent).toBe(true);
    expect(DOC_PAGE_REGISTRY.current.data.totalPages).toBe(ALL_DOC_PAGES.length);
  });

  it('surfaceCounts match actual page distribution', () => {
    const data = DOC_PAGE_REGISTRY.current.data;
    for (const s of ALL_SURFACES) {
      const actual = ALL_DOC_PAGES.filter((p) => p.surface === s).length;
      expect(data.surfaceCounts[s]).toBe(actual);
    }
  });

  it('critical pages include key tool documentation', () => {
    const critical = ALL_DOC_PAGES.filter((p) => p.priority === 'critical');
    expect(critical.length).toBeGreaterThanOrEqual(4);
    const slugs = critical.map((p) => p.slug as string);
    expect(slugs).toContain('tools-overview');
    expect(slugs).toContain('define-tools');
  });

  it('parent-child relationships are consistent', () => {
    const slugSet = new Set(ALL_DOC_PAGES.map((p) => p.slug as string));
    for (const page of ALL_DOC_PAGES) {
      if (page.parentSlug !== null) {
        expect(slugSet.has(page.parentSlug as string)).toBe(true);
      }
      for (const child of page.childSlugs) {
        expect(slugSet.has(child as string)).toBe(true);
      }
    }
  });
});

// ─── Agent File tests ───────────────────────────────────────────────────────

import {
  AGENT_FILES,
  AGENT_FILE_REGISTRY,
  buildCrawlPrompt,
  buildScorerPrompt,
} from '../../.jade/agents/crawl-agent.js';

describe('AgentFiles', () => {
  it('AGENT_FILES has crawlers, structurers, scorers, and emitters', () => {
    const roles = new Set(AGENT_FILES.map((a) => a.role));
    expect(roles.has('crawler')).toBe(true);
    expect(roles.has('structurer')).toBe(true);
    expect(roles.has('scorer')).toBe(true);
    expect(roles.has('emitter')).toBe(true);
  });

  it('every agent file has a non-empty system prompt', () => {
    for (const agent of AGENT_FILES) {
      expect(agent.systemPrompt.length).toBeGreaterThan(10);
    }
  });

  it('scorer agents use temperature 0', () => {
    const scorers = AGENT_FILES.filter((a) => a.role === 'scorer');
    for (const s of scorers) {
      expect(s.temperature).toBe(0.0);
    }
  });

  it('AGENT_FILE_REGISTRY is versioned', () => {
    expect(AGENT_FILE_REGISTRY.currentVersion as number).toBe(1);
    expect(AGENT_FILE_REGISTRY.current.data.agents.length).toBe(AGENT_FILES.length);
  });

  it('buildCrawlPrompt produces valid prompt', () => {
    const page = ALL_DOC_PAGES[0]!;
    const prompt = buildCrawlPrompt(page);
    expect(prompt).toContain(page.url);
    expect(prompt).toContain(page.title);
    expect(prompt).toContain('Extract');
  });

  it('buildScorerPrompt includes quality dimensions', () => {
    const page = ALL_DOC_PAGES[0]!;
    const prompt = buildScorerPrompt(page, 'sample extraction content');
    expect(prompt).toContain('Completeness');
    expect(prompt).toContain('Accuracy');
    expect(prompt).toContain('Safety');
  });
});

// ─── Schema tests ───────────────────────────────────────────────────────────

import {
  OUTPUT_SCHEMAS,
  DECISION_TREE,
  SCHEMA_REGISTRY,
  getSchemaForSurface,
  getDecision,
} from '../../.jade/schemas/output-schemas.js';

describe('OutputSchemas', () => {
  it('every surface has an output schema', () => {
    for (const s of ALL_SURFACES) {
      const schema = getSchemaForSurface(s);
      expect(schema).toBeDefined();
      expect(schema.surface).toBe(s);
      expect(schema.fields.length).toBeGreaterThan(0);
    }
  });

  it('every schema has a YAML template', () => {
    for (const s of ALL_SURFACES) {
      const schema = getSchemaForSurface(s);
      expect(schema.yamlTemplate.length).toBeGreaterThan(10);
    }
  });

  it('required fields are present in each schema', () => {
    for (const s of ALL_SURFACES) {
      const schema = getSchemaForSurface(s);
      const required = schema.fields.filter((f) => f.required);
      expect(required.length).toBeGreaterThan(0);
    }
  });
});

describe('DecisionTree', () => {
  it('every surface has a decision node', () => {
    for (const s of ALL_SURFACES) {
      const decision = getDecision(s);
      expect(decision).toBeDefined();
      expect(decision.surface).toBe(s);
    }
  });

  it('tools surface uses opus model', () => {
    const decision = getDecision('tools');
    expect(decision.preferredModel).toBe('opus');
    expect(decision.script).toBe('agent-crawl-structure');
  });

  it('tool-reference uses direct-fetch strategy', () => {
    const decision = getDecision('tool-reference');
    expect(decision.strategy).toBe('direct-fetch-extract');
    expect(decision.script).toBe('crawl-and-extract');
  });

  it('every decision has at least one agent role', () => {
    for (const s of ALL_SURFACES) {
      const decision = getDecision(s);
      expect(decision.agentRoles.length).toBeGreaterThan(0);
    }
  });

  it('SCHEMA_REGISTRY is versioned', () => {
    expect(SCHEMA_REGISTRY.currentVersion as number).toBe(1);
    expect(SCHEMA_REGISTRY.current.data.totalSurfaces).toBe(7);
  });
});
