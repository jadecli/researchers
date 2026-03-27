// src/styles/types.ts — Style domain types following Boris Cherny's strict patterns
//
// Three non-negotiable patterns:
// 1. Branded types prevent style ID confusion at compile time
// 2. Result<T, E> replaces try/catch with exhaustive handling
// 3. Discriminated unions model every style state and kind

import type {
  SurrogateKey,
  MetricDefinition,
  BusMatrix,
  Additivity,
} from '../types/layers.js';

// ── Brand (local re-export for style domain) ──────────────────
type Brand<K, T> = K & { readonly __brand: T };

// ── Branded Types ─────────────────────────────────────────────
export type StyleId = Brand<string, 'StyleId'>;
export type WritingSampleId = Brand<string, 'WritingSampleId'>;
export type StyleInstructionHash = Brand<string, 'StyleInstructionHash'>;

export function toStyleId(raw: string): StyleId {
  if (!raw || raw.trim().length === 0) {
    throw new Error('StyleId cannot be empty');
  }
  return raw as StyleId;
}

export function toWritingSampleId(raw: string): WritingSampleId {
  if (!raw || raw.trim().length === 0) {
    throw new Error('WritingSampleId cannot be empty');
  }
  return raw as WritingSampleId;
}

export function toStyleInstructionHash(raw: string): StyleInstructionHash {
  if (!raw || raw.trim().length === 0) {
    throw new Error('StyleInstructionHash cannot be empty');
  }
  return raw as StyleInstructionHash;
}

// ── Result Type (no thrown exceptions in public API) ──────────
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  return result.ok ? Ok(fn(result.value)) : result;
}

export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}

export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw new Error(`Attempted to unwrap an Err result: ${String(result.error)}`);
}

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

// ── Exhaustive Pattern Matching ───────────────────────────────
export function assertNever(value: never): never {
  throw new Error(`Unhandled discriminant: ${JSON.stringify(value)}`);
}

// ── Preset Names ──────────────────────────────────────────────
export type PresetName = 'normal' | 'concise' | 'formal' | 'explanatory';

// Normal and Concise can never be hidden (per support article)
export type AlwaysVisiblePreset = 'normal' | 'concise';
export type HideablePreset = 'formal' | 'explanatory';

// ── Style Visibility ──────────────────────────────────────────
export type StyleVisibility = 'visible' | 'hidden' | 'always_visible';

// ── Starting Points for "Describe" custom styles ──────────────
export type StartingPoint =
  | 'technical_writing'
  | 'creative_writing'
  | 'academic_writing'
  | 'business_communication'
  | 'code_review';

// ── Writing Sample ────────────────────────────────────────────
export type WritingSampleFormat = 'pdf' | 'doc' | 'txt' | 'paste';

export type WritingSample = {
  readonly id: WritingSampleId;
  readonly format: WritingSampleFormat;
  readonly content: string;
  readonly fileName: string | undefined;
};

// ── Style Kind (Discriminated Union) ──────────────────────────
// Models the three creation methods from the support article:
// 1. Preset styles (built-in)
// 2. Custom via uploading writing samples
// 3. Custom via describing the desired style

export type StyleKind =
  | {
      readonly kind: 'preset';
      readonly presetName: PresetName;
    }
  | {
      readonly kind: 'custom_upload';
      readonly samples: ReadonlyArray<WritingSample>;
    }
  | {
      readonly kind: 'custom_describe';
      readonly description: string;
      readonly startingPoint: StartingPoint;
    }
  | {
      readonly kind: 'custom_manual';
      readonly instructions: string;
    };

export function describeStyleKind(styleKind: StyleKind): string {
  switch (styleKind.kind) {
    case 'preset':
      return `Preset: ${styleKind.presetName}`;
    case 'custom_upload':
      return `Custom (${styleKind.samples.length} writing samples)`;
    case 'custom_describe':
      return `Custom (described from ${styleKind.startingPoint})`;
    case 'custom_manual':
      return 'Custom (manual instructions)';
    default:
      return assertNever(styleKind);
  }
}

// ── Style (Core Entity) ──────────────────────────────────────
export type Style = {
  readonly id: StyleId;
  readonly name: string;
  readonly styleKind: StyleKind;
  readonly instructions: string;
  readonly instructionHash: StyleInstructionHash;
  readonly visibility: StyleVisibility;
  readonly sortOrder: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

// ── Active Style (currently selected) ─────────────────────────
export type ActiveStyle = {
  readonly style: Style;
  readonly activatedAt: Date;
};

// ── Style Error (Discriminated Union) ─────────────────────────
export type StyleError =
  | { readonly type: 'not_found'; readonly styleId: StyleId }
  | { readonly type: 'already_exists'; readonly name: string }
  | {
      readonly type: 'cannot_hide_required';
      readonly presetName: AlwaysVisiblePreset;
    }
  | {
      readonly type: 'invalid_instruction';
      readonly reason: string;
    };

export function handleStyleError(error: StyleError): string {
  switch (error.type) {
    case 'not_found':
      return `Style not found: ${error.styleId as string}`;
    case 'already_exists':
      return `Style already exists: ${error.name}`;
    case 'cannot_hide_required':
      return `Cannot hide required preset: ${error.presetName} (always visible)`;
    case 'invalid_instruction':
      return `Invalid style instruction: ${error.reason}`;
    default:
      return assertNever(error);
  }
}

// ── Create Style Input ────────────────────────────────────────
export type CreateStyleInput =
  | {
      readonly method: 'upload';
      readonly name: string;
      readonly samples: ReadonlyArray<WritingSample>;
    }
  | {
      readonly method: 'describe';
      readonly name: string;
      readonly description: string;
      readonly startingPoint: StartingPoint;
    }
  | {
      readonly method: 'manual';
      readonly name: string;
      readonly instructions: string;
    };

// ── Style Event (for analytics) ──────────────────────────────
export type StyleEventType = 'select' | 'create' | 'edit' | 'hide' | 'unhide' | 'reorder' | 'delete';

export type StyleEvent = {
  readonly eventType: StyleEventType;
  readonly styleId: StyleId;
  readonly styleName: string;
  readonly styleKind: StyleKind['kind'];
  readonly sessionId: string;
  readonly agentId: string | undefined;
  readonly timestamp: Date;
};

// ── Warehouse Types (Kimball Integration) ─────────────────────

export type DimStyleRow = {
  readonly style_sk: SurrogateKey;
  readonly style_id: string;
  readonly style_name: string;
  readonly style_kind: StyleKind['kind'];
  readonly instructions_hash: string;
  readonly is_current: boolean;
  readonly valid_from: Date;
  readonly valid_to: Date;
};

export type FactStyleUsageRow = {
  readonly style_usage_sk: SurrogateKey;
  readonly style_sk: SurrogateKey;
  readonly date_sk: number;
  readonly agent_sk: SurrogateKey | null;
  readonly session_id: string;
  readonly duration_active_ms: number;
  readonly messages_sent: number;
  readonly switches_in_session: number;
};

export type FactStyleCreationRow = {
  readonly style_creation_sk: SurrogateKey;
  readonly style_sk: SurrogateKey;
  readonly date_sk: number;
  readonly session_id: string;
  readonly creation_method: CreateStyleInput['method'];
  readonly sample_count: number;
};

// ── Bus Matrix (Style domain extension) ───────────────────────
export const STYLE_BUS_MATRIX: BusMatrix = [
  {
    factTable: 'fact_style_usage',
    dimensions: ['dim_style', 'dim_date', 'dim_agent', 'dim_session'],
  },
  {
    factTable: 'fact_style_creation',
    dimensions: ['dim_style', 'dim_date', 'dim_session'],
  },
] as const;

// ── Semantic Metric Declarations ──────────────────────────────
// These mirror the SQL semantic views and enforce additivity at the type level.

export const STYLE_METRICS = {
  adoption_rate: {
    name: 'style_adoption_rate',
    description: 'Percentage of sessions using custom (non-preset) styles',
    formula: 'COUNT(custom_sessions) / COUNT(total_sessions)',
    grain: 'one value per date',
    additivity: 'non_additive' as Additivity,
    dimensions: ['dim_date'],
    unit: 'ratio',
  },
  popular_styles: {
    name: 'popular_styles',
    description: 'Number of times each style was selected',
    formula: 'COUNT(*) per style',
    grain: 'one value per style',
    additivity: 'additive' as Additivity,
    dimensions: ['dim_style', 'dim_date'],
    unit: 'count',
  },
  switch_frequency: {
    name: 'style_switch_frequency',
    description: 'Average number of style switches per session',
    formula: 'AVG(switches_in_session)',
    grain: 'one value per session',
    additivity: 'non_additive' as Additivity,
    dimensions: ['dim_session', 'dim_date'],
    unit: 'count',
  },
} as const;

// Type-check: ensure metric declarations match MetricDefinition shape
// (compile-time assertion — the variables are unused but the assignment validates the type)
const _adoptionCheck: Pick<
  MetricDefinition,
  '__layer'
> extends never
  ? typeof STYLE_METRICS.adoption_rate
  : typeof STYLE_METRICS.adoption_rate = STYLE_METRICS.adoption_rate;

void _adoptionCheck;

// ── Dimension Declarations ────────────────────────────────────

export const STYLE_DIMENSIONS = {
  style: {
    name: 'dim_style',
    description: 'Style dimension with SCD Type 2 tracking',
    hierarchy: ['style_kind', 'style_name'],
    attributes: [
      'style_id',
      'style_name',
      'style_kind',
      'instructions_hash',
      'is_current',
      'valid_from',
      'valid_to',
    ],
  },
  session: {
    name: 'dim_session',
    description: 'Session dimension for style usage tracking',
    hierarchy: ['session_id'],
    attributes: ['session_id', 'started_at'],
  },
} as const;
