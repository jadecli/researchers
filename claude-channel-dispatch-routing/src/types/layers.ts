// src/types/layers.ts — Kimball Layer Type System
//
// This module enforces Kimball's three-layer separation at the TYPE LEVEL.
// Runtime, Reporting, and Semantic are phantom-branded so the compiler
// prevents cross-layer access without explicit ETL transforms.
//
// Boris Cherny pattern: branded types + discriminated unions + Result<T,E>

// ── Layer Brands ────────────────────────────────────────────
// These phantom types tag every record with its layer.
// You cannot pass a RuntimeRecord where a ReportingRecord is expected.

declare const RUNTIME: unique symbol;
declare const REPORTING: unique symbol;
declare const SEMANTIC: unique symbol;

export type RuntimeLayer = typeof RUNTIME;
export type ReportingLayer = typeof REPORTING;
export type SemanticLayer = typeof SEMANTIC;

export type DataLayer = RuntimeLayer | ReportingLayer | SemanticLayer;

// ── Layer-Tagged Records ────────────────────────────────────
// Every database record carries its layer brand.

export type LayerTagged<L extends DataLayer, T> = T & {
  readonly __layer: L;
};

export type RuntimeRecord<T> = LayerTagged<RuntimeLayer, T>;
export type ReportingRecord<T> = LayerTagged<ReportingLayer, T>;
export type SemanticRecord<T> = LayerTagged<SemanticLayer, T>;

// ── ETL Transform Type ─────────────────────────────────────
// The ONLY way to cross layers. Source and target layers are
// encoded in the type, so you can't accidentally skip a layer.

export type ETLTransform<
  SourceLayer extends DataLayer,
  TargetLayer extends DataLayer,
  Source,
  Target,
> = {
  readonly name: string;
  readonly sourceLayer: SourceLayer;
  readonly targetLayer: TargetLayer;
  readonly transform: (source: LayerTagged<SourceLayer, Source>) => LayerTagged<TargetLayer, Target>;
};

// ── Layer Constructors ──────────────────────────────────────
// Tag raw data with its layer. These are the ONLY entry points.

export function asRuntime<T>(data: T): RuntimeRecord<T> {
  return data as RuntimeRecord<T>;
}

export function asReporting<T>(data: T): ReportingRecord<T> {
  return data as ReportingRecord<T>;
}

export function asSemantic<T>(data: T): SemanticRecord<T> {
  return data as SemanticRecord<T>;
}

// ── Grain Declaration ───────────────────────────────────────
// Every fact table must declare its grain. This is a compile-time
// annotation, not a runtime value — but we make it a const so
// it shows up in documentation and type inference.

export type GrainDeclaration = {
  readonly factTable: string;
  readonly grain: string; // e.g., "one row per page per round"
  readonly dimensions: ReadonlyArray<string>;
};

// ── Additivity ──────────────────────────────────────────────
export type Additivity = 'additive' | 'semi_additive' | 'non_additive';

// ── Metric Definition (Semantic Layer) ──────────────────────
export type MetricDefinition = SemanticRecord<{
  readonly name: string;
  readonly description: string;
  readonly formula: string;
  readonly grain: string;
  readonly additivity: Additivity;
  readonly dimensions: ReadonlyArray<string>;
  readonly unit: string;
}>;

// ── Dimension Definition (Semantic Layer) ───────────────────
export type DimensionDefinition = SemanticRecord<{
  readonly name: string;
  readonly description: string;
  readonly hierarchy: ReadonlyArray<string>;
  readonly attributes: ReadonlyArray<string>;
}>;

// ── Surrogate Key (Reporting Layer Only) ────────────────────
type Brand<K, T> = K & { readonly __brand: T };
export type SurrogateKey = Brand<number, 'SurrogateKey'>;
export type NaturalKey = Brand<string, 'NaturalKey'>;

export function toSurrogateKey(n: number): SurrogateKey {
  return n as SurrogateKey;
}

export function toNaturalKey(s: string): NaturalKey {
  return s as NaturalKey;
}

// ── SCD Type 2 Fields (Reporting Layer) ─────────────────────
export type SCDType2Fields = {
  readonly isCurrent: boolean;
  readonly validFrom: Date;
  readonly validTo: Date;
};

// ── Runtime Base Fields ─────────────────────────────────────
export type RuntimeBaseFields = {
  readonly _id: string; // pg_uuidv7
  readonly _createdAt: Date;
  readonly _source: string;
};

// ── Bus Matrix Entry ────────────────────────────────────────
export type BusMatrixEntry = {
  readonly factTable: string;
  readonly dimensions: ReadonlyArray<string>;
};

export type BusMatrix = ReadonlyArray<BusMatrixEntry>;

// ── Layer Validation ────────────────────────────────────────
// These type-level functions prevent illegal cross-layer access.
// They produce compile errors, not runtime errors.

// Ensure a function only accepts runtime records
export type RuntimeOnly<T> = T extends RuntimeRecord<infer U> ? U : never;

// Ensure a function only accepts reporting records
export type ReportingOnly<T> = T extends ReportingRecord<infer U> ? U : never;

// Ensure a function only accepts semantic records
export type SemanticOnly<T> = T extends SemanticRecord<infer U> ? U : never;
