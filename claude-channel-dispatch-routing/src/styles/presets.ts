// src/styles/presets.ts — Preset + custom style definitions
//
// Four presets from Claude's "Configure and use styles" support article,
// plus two custom styles encoding Boris Cherny's TypeScript discipline
// and Ralph Kimball's data warehouse discipline.

import type { Style, PresetName, StyleVisibility } from './types.js';
import { toStyleId, toStyleInstructionHash } from './types.js';

// ── Simple hash for instruction content fingerprinting ────────
function hashInstructions(instructions: string): string {
  let hash = 0;
  for (let i = 0; i < instructions.length; i++) {
    const char = instructions.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `sha256:${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

// ── Preset Style Instructions ─────────────────────────────────

const PRESET_INSTRUCTIONS: Record<PresetName, string> = {
  normal: [
    'Respond naturally and helpfully.',
    'Use a balanced tone — neither overly casual nor overly formal.',
    'Adjust detail level based on the complexity of the question.',
    'Use formatting (headers, lists, code blocks) when it aids clarity.',
  ].join(' '),

  concise: [
    'Keep responses short and direct.',
    'Lead with the answer, not the reasoning.',
    'Skip filler words, preamble, and unnecessary transitions.',
    'Use bullet points for multiple items.',
    'If you can say it in one sentence, do not use three.',
    'Prefer short, direct sentences over long explanations.',
    'Omit caveats unless they are critical.',
  ].join(' '),

  formal: [
    'Use clear, polished, professional language.',
    'Avoid contractions, slang, and colloquialisms.',
    'Structure responses with proper paragraphs and logical flow.',
    'Use precise vocabulary appropriate to the subject matter.',
    'Maintain a respectful, measured tone throughout.',
    'When referencing technical concepts, use their formal names.',
    'Cite sources or precedents when applicable.',
  ].join(' '),

  explanatory: [
    'Prioritize understanding over brevity.',
    'Break complex concepts into digestible steps.',
    'Use analogies and examples to illustrate abstract ideas.',
    'Define technical terms when first introduced.',
    'Build from foundational concepts to advanced topics.',
    'Include "why" explanations alongside "how" instructions.',
    'Use diagrams or structured examples when they aid comprehension.',
    'Anticipate follow-up questions and address them proactively.',
  ].join(' '),
};

// ── Custom Style: TypeScript Strict (Boris Cherny) ────────────

const TYPESCRIPT_STRICT_INSTRUCTIONS = [
  // Branded types
  'Use branded types (nominal typing) for all domain identifiers.',
  'Never pass a raw string or number where a domain-specific ID is expected.',
  'Define Brand<K, T> = K & { readonly __brand: T } and create constructor functions (toAgentId, toSessionId) that validate at system boundaries.',
  '',
  // Result pattern
  'Replace try/catch with Result<T, E> everywhere.',
  'Every function that can fail returns Ok(value) or Err(error) — never throws.',
  'Provide map, flatMap, unwrap, and unwrapOr combinators.',
  'Use Result for all I/O, parsing, and validation operations.',
  '',
  // Discriminated unions
  'Model every possible state as a discriminated union with a string literal "type" or "status" discriminant field.',
  'Each variant carries only the data relevant to that state — no optional fields that are "sometimes undefined."',
  'Use exhaustive switch statements with assertNever in the default branch to catch unhandled variants at compile time.',
  '',
  // Readonly discipline
  'Mark all properties and arrays as readonly.',
  'Use ReadonlyArray<T> instead of T[].',
  'Use Readonly<T> for object types passed across module boundaries.',
  'Prefer const assertions for literal types.',
  '',
  // Type-level programming
  'Use conditional types (T extends U ? X : Y) to derive related types from a single source of truth.',
  'Use mapped types to transform existing types systematically.',
  'Use template literal types for string-based type constraints.',
  'Prefer unknown over any — narrow with type guards, never widen.',
  '',
  // Compiler strictness
  'Enable strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true.',
  'Treat compiler warnings as errors.',
  'Validate at system boundaries with branded type constructors, then trust the types internally.',
  '',
  // Module design
  'Export types and constructors from a single barrel file per domain.',
  'Co-locate types with the module that owns them.',
  'Use phantom types to enforce layer separation at compile time.',
].join('\n');

// ── Custom Style: Dimensional Modeler (Ralph Kimball) ─────────

const DIMENSIONAL_MODELER_INSTRUCTIONS = [
  // Grain declaration
  'Begin every data design by declaring the grain — "one row per X per Y" — before adding any columns.',
  'The grain determines everything: which dimensions apply, which facts are additive, and how the table grows.',
  'Never add a column that violates the declared grain.',
  '',
  // Three-layer architecture
  'Separate the data architecture into three layers:',
  '  1. Runtime (3NF, write-optimized): append-only operational tables with BRIN indexes on timestamps.',
  '  2. Reporting (star schema, read-optimized): denormalized dimension and fact tables with surrogate keys.',
  '  3. Semantic (business contract): views that expose business metrics — no physical schema details leak through.',
  '',
  // Star schema design
  'Design fact tables as narrow, deep tables with foreign keys to dimension tables.',
  'Use surrogate keys (_sk suffix) in the reporting layer — never expose natural keys to consumers.',
  'Place all descriptive attributes in dimension tables, all measurable quantities in fact tables.',
  '',
  // Conformed dimensions
  'Use conformed dimensions shared across multiple fact tables to enable drill-across queries.',
  'dim_date is the most universal conformed dimension — every fact table should reference it.',
  'When a dimension is shared, its definition must be identical everywhere (same grain, same attributes).',
  '',
  // Slowly Changing Dimensions
  'Apply SCD Type 2 (valid_from / valid_to + is_current flag) for any dimension whose attributes change over time.',
  'SCD Type 1 (overwrite) is only acceptable for corrections, never for legitimate business changes.',
  'Always index is_current = true for efficient current-state queries.',
  '',
  // Additivity
  'Annotate every metric with its additivity:',
  '  - ADDITIVE: can SUM across all dimensions (e.g., total cost, page count).',
  '  - SEMI-ADDITIVE: can SUM across some dimensions but not time (e.g., account balances).',
  '  - NON-ADDITIVE: cannot SUM — use AVG, ratios, or distinct counts (e.g., quality scores, rates).',
  'Never SUM a non-additive metric — it produces meaningless numbers.',
  '',
  // ETL
  'ETL transforms are the ONLY way data crosses layers.',
  'Make ETL idempotent: re-running the same transform produces the same result.',
  'Schedule ETL on a regular cadence (e.g., pg_cron every 15 minutes) and refresh materialized views concurrently.',
  '',
  // Bus matrix
  'Maintain a bus matrix that maps which conformed dimensions apply to each fact table.',
  'The bus matrix is the blueprint for the entire warehouse — update it before writing any SQL.',
  '',
  // Semantic layer
  'The semantic layer is the ONLY interface consumers see.',
  'Name views with business terms (quality_improvement_rate, not fact_crawl_quality_delta_avg).',
  'Document the grain, additivity, and formula for every semantic metric.',
  'Pre-aggregate with materialized views where query patterns are predictable.',
].join('\n');

// ── Style Factory ─────────────────────────────────────────────

function makePresetStyle(
  presetName: PresetName,
  sortOrder: number,
): Style {
  const instructions = PRESET_INSTRUCTIONS[presetName];
  const visibility: StyleVisibility =
    presetName === 'normal' || presetName === 'concise'
      ? 'always_visible'
      : 'visible';

  return {
    id: toStyleId(`preset-${presetName}`),
    name: presetName.charAt(0).toUpperCase() + presetName.slice(1),
    styleKind: { kind: 'preset', presetName },
    instructions,
    instructionHash: toStyleInstructionHash(hashInstructions(instructions)),
    visibility,
    sortOrder,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

function makeCustomStyle(
  id: string,
  name: string,
  instructions: string,
  sortOrder: number,
): Style {
  return {
    id: toStyleId(id),
    name,
    styleKind: { kind: 'custom_manual', instructions },
    instructions,
    instructionHash: toStyleInstructionHash(hashInstructions(instructions)),
    visibility: 'visible',
    sortOrder,
    createdAt: new Date('2026-03-27T00:00:00Z'),
    updatedAt: new Date('2026-03-27T00:00:00Z'),
  };
}

// ── Exported Preset Styles ────────────────────────────────────

export const PRESET_NORMAL: Style = makePresetStyle('normal', 0);
export const PRESET_CONCISE: Style = makePresetStyle('concise', 1);
export const PRESET_FORMAL: Style = makePresetStyle('formal', 2);
export const PRESET_EXPLANATORY: Style = makePresetStyle('explanatory', 3);

// ── Exported Custom Styles ────────────────────────────────────

export const CUSTOM_TYPESCRIPT_STRICT: Style = makeCustomStyle(
  'custom-typescript-strict',
  'TypeScript Strict',
  TYPESCRIPT_STRICT_INSTRUCTIONS,
  4,
);

export const CUSTOM_DIMENSIONAL_MODELER: Style = makeCustomStyle(
  'custom-dimensional-modeler',
  'Dimensional Modeler',
  DIMENSIONAL_MODELER_INSTRUCTIONS,
  5,
);

// ── All Default Styles (ordered) ──────────────────────────────

export const DEFAULT_STYLES: ReadonlyArray<Style> = [
  PRESET_NORMAL,
  PRESET_CONCISE,
  PRESET_FORMAL,
  PRESET_EXPLANATORY,
  CUSTOM_TYPESCRIPT_STRICT,
  CUSTOM_DIMENSIONAL_MODELER,
] as const;
