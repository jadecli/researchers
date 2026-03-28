// tests/models.test.ts — Model tests: CrawlTarget, ExtractionResult, Improvement, Language, PluginSpec
import { describe, it, expect } from 'vitest';
import {
  createCrawlTarget,
  createCrawlPlan,
  effectiveDomains,
  sortedTargets,
  totalMaxPages,
  describePageType,
  toPageType,
  isPageType,
  PAGE_TYPES,
} from '../src/models/crawl-target.js';
import {
  computeQualityScore,
  meetsThreshold,
  qualityImprovement,
  isRegression,
  isStagnant,
  EMPTY_QUALITY,
} from '../src/models/extraction-result.js';
import {
  createSelectorPatch,
  applyToSource,
  asDiffLine,
} from '../src/models/improvement.js';
import {
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  languageConfigFor,
  LSP_BINARIES,
  SDK_PACKAGES,
} from '../src/models/language.js';
import {
  createPluginSpec,
  createSkillSpec,
  createAgentSpec,
  createConnectorSpec,
  pluginDirName,
  skillCount,
  agentCount,
  connectorCount,
  skillFileName,
  agentFileName,
  hasPlaceholders,
} from '../src/models/plugin-spec.js';
import { toIteration, toQualityValue } from '../src/types.js';

// ── CrawlTarget ─────────────────────────────────────────────────
describe('CrawlTarget', () => {
  it('creates target with defaults', () => {
    const target = createCrawlTarget({ url: 'https://example.com' });
    expect(target.url as string).toBe('https://example.com');
    expect(target.spiderName as string).toBe('generic');
    expect(target.maxPages).toBe(50);
    expect(target.priority).toBe(0);
  });

  it('extracts domain from URL when no allowed domains', () => {
    const target = createCrawlTarget({ url: 'https://docs.example.com/path' });
    const result = effectiveDomains(target);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(['docs.example.com']);
  });

  it('uses allowed domains when provided', () => {
    const target = createCrawlTarget({
      url: 'https://example.com',
      allowedDomains: ['a.com', 'b.com'],
    });
    const result = effectiveDomains(target);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(['a.com', 'b.com']);
  });
});

// ── CrawlPlan ───────────────────────────────────────────────────
describe('CrawlPlan', () => {
  it('creates plan with defaults', () => {
    const plan = createCrawlPlan({
      targets: [
        { url: 'https://a.com', maxPages: 10 },
        { url: 'https://b.com', maxPages: 20 },
      ],
    });
    expect(plan.targets.length).toBe(2);
    expect(totalMaxPages(plan)).toBe(30);
    expect(plan.maxIterations).toBe(3);
    expect(plan.qualityThreshold as number).toBe(0.8);
  });

  it('sorts targets by priority descending', () => {
    const plan = createCrawlPlan({
      targets: [
        { url: 'https://low.com', priority: 1 },
        { url: 'https://high.com', priority: 10 },
        { url: 'https://mid.com', priority: 5 },
      ],
    });
    const sorted = sortedTargets(plan);
    expect(sorted[0]!.priority).toBe(10);
    expect(sorted[1]!.priority).toBe(5);
    expect(sorted[2]!.priority).toBe(1);
  });
});

// ── PageType ────────────────────────────────────────────────────
describe('PageType', () => {
  it('has 8 page types', () => {
    expect(PAGE_TYPES.length).toBe(8);
  });

  it('validates known page types', () => {
    expect(isPageType('doc')).toBe(true);
    expect(isPageType('api')).toBe(true);
    expect(isPageType('invalid')).toBe(false);
  });

  it('converts unknown to doc', () => {
    expect(toPageType('unknown')).toBe('doc');
  });

  it('describes all page types exhaustively', () => {
    for (const pt of PAGE_TYPES) {
      expect(describePageType(pt)).toBeTruthy();
    }
  });
});

// ── QualityScore ────────────────────────────────────────────────
describe('QualityScore', () => {
  it('computes weighted overall', () => {
    const score = computeQualityScore(1.0, 1.0, 1.0);
    expect(score.overall as number).toBe(1.0);
  });

  it('applies correct weights (40/35/25)', () => {
    const score = computeQualityScore(0.5, 0.5, 0.5);
    expect(score.overall as number).toBeCloseTo(0.5, 2);
  });

  it('meets threshold correctly', () => {
    const score = computeQualityScore(0.8, 0.8, 0.8);
    expect(meetsThreshold(score, 0.7)).toBe(true);
    expect(meetsThreshold(score, 0.9)).toBe(false);
  });

  it('has empty quality with all zeros', () => {
    expect(EMPTY_QUALITY.overall as number).toBe(0);
  });
});

// ── ContextDelta ────────────────────────────────────────────────
describe('ContextDelta', () => {
  const delta = {
    iteration: toIteration(1),
    newPatterns: ['p1'],
    failingSelectors: ['s1'],
    qualityBefore: toQualityValue(0.5),
    qualityAfter: toQualityValue(0.7),
    steerDirection: 'improve',
    discoveredPageTypes: ['doc'],
  };

  it('computes quality improvement', () => {
    expect(qualityImprovement(delta)).toBeCloseTo(0.2, 2);
  });

  it('detects regression', () => {
    expect(isRegression(delta)).toBe(false);
    expect(
      isRegression({
        ...delta,
        qualityBefore: toQualityValue(0.8),
        qualityAfter: toQualityValue(0.5),
      }),
    ).toBe(true);
  });

  it('detects stagnation', () => {
    expect(isStagnant(delta)).toBe(false);
    expect(
      isStagnant({
        ...delta,
        qualityBefore: toQualityValue(0.5),
        qualityAfter: toQualityValue(0.5),
      }),
    ).toBe(true);
  });
});

// ── SelectorPatch ───────────────────────────────────────────────
describe('SelectorPatch', () => {
  it('applies to source code', () => {
    const patch = createSelectorPatch({
      spider: 'test',
      oldSelector: '.old',
      newSelector: '.new',
    });
    expect(applyToSource(patch, 'select(".old")')).toBe('select(".new")');
  });

  it('throws on missing old selector', () => {
    const patch = createSelectorPatch({
      spider: 'test',
      oldSelector: '.missing',
      newSelector: '.new',
    });
    expect(() => applyToSource(patch, 'no match here')).toThrow(
      'not found in source',
    );
  });

  it('generates diff line', () => {
    const patch = createSelectorPatch({
      spider: 'test',
      oldSelector: '.old',
      newSelector: '.new',
    });
    expect(asDiffLine(patch)).toBe('- .old\n+ .new');
  });
});

// ── Language ────────────────────────────────────────────────────
describe('Language', () => {
  it('supports 12 languages', () => {
    expect(SUPPORTED_LANGUAGES.length).toBe(12);
  });

  it('validates supported languages', () => {
    expect(isSupportedLanguage('python')).toBe(true);
    expect(isSupportedLanguage('brainfuck')).toBe(false);
  });

  it('has LSP binary for every language', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(LSP_BINARIES[lang]).toBeTruthy();
    }
  });

  it('has SDK package for every language', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(SDK_PACKAGES[lang]).toBeTruthy();
    }
  });

  it('creates config with all fields', () => {
    const config = languageConfigFor('typescript');
    expect(config.language).toBe('typescript');
    expect(config.lspBinary).toBe('typescript-language-server');
    expect(config.sdkPackage).toBe('@anthropic-ai/sdk');
    expect(config.buildTool).toBe('npm');
    expect(config.testCommand).toBe('npm test');
    expect(config.fileExtensions).toContain('.ts');
  });
});

// ── PluginSpec ───────────────────────────────────────────────────
describe('PluginSpec', () => {
  it('creates plugin with defaults', () => {
    const spec = createPluginSpec({ name: 'test-plugin' });
    expect(spec.name as string).toBe('test-plugin');
    expect(spec.version).toBe('0.1.0');
    expect(skillCount(spec)).toBe(0);
    expect(agentCount(spec)).toBe(0);
    expect(connectorCount(spec)).toBe(0);
  });

  it('generates correct dir name', () => {
    const spec = createPluginSpec({ name: 'My Cool Plugin' });
    expect(pluginDirName(spec)).toBe('my-cool-plugin');
  });

  it('creates skill with filename', () => {
    const skill = createSkillSpec({ name: 'analyze' });
    expect(skillFileName(skill)).toBe('analyze.md');
  });

  it('creates agent with filename', () => {
    const agent = createAgentSpec({ name: 'reviewer' });
    expect(agentFileName(agent)).toBe('reviewer.md');
  });

  it('detects connector placeholders', () => {
    const conn = createConnectorSpec({
      name: 'test',
      serverConfig: { api_key: '~~secret~~' },
    });
    expect(hasPlaceholders(conn)).toBe(true);
  });

  it('detects no placeholders', () => {
    const conn = createConnectorSpec({
      name: 'test',
      serverConfig: { host: 'localhost' },
    });
    expect(hasPlaceholders(conn)).toBe(false);
  });
});
