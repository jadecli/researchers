// .jade/models/base.ts — Foundation branded types and versioning primitives
//
// Boris Cherny: every value crossing a boundary is branded.
// Ralph Kimball: every dimension is versioned (SCD Type 2).
// Every edit bumps the version. Inheritance only where it reduces complexity.

// ─── Brand Primitive ────────────────────────────────────────────────────────

declare const __brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

// ─── Branded Identifiers ────────────────────────────────────────────────────

export type ModelVersion = Brand<number, 'ModelVersion'>;
export type SurfaceId = Brand<string, 'SurfaceId'>;
export type PageSlug = Brand<string, 'PageSlug'>;
export type AgentFileId = Brand<string, 'AgentFileId'>;
export type SchemaVersion = Brand<string, 'SchemaVersion'>;

// ─── Branded Constructors ───────────────────────────────────────────────────

export function toModelVersion(raw: number): ModelVersion {
  if (!Number.isInteger(raw) || raw < 1) {
    throw new Error(`ModelVersion must be a positive integer, got ${raw}`);
  }
  return raw as ModelVersion;
}

export function toSurfaceId(raw: string): SurfaceId {
  if (!/^[a-z][a-z0-9_-]+$/.test(raw)) {
    throw new Error(`SurfaceId must be lowercase kebab/snake, got "${raw}"`);
  }
  return raw as SurfaceId;
}

export function toPageSlug(raw: string): PageSlug {
  if (!raw || raw.trim().length === 0) {
    throw new Error('PageSlug cannot be empty');
  }
  return raw as PageSlug;
}

export function toAgentFileId(raw: string): AgentFileId {
  if (!raw || raw.trim().length === 0) {
    throw new Error('AgentFileId cannot be empty');
  }
  return raw as AgentFileId;
}

export function toSchemaVersion(raw: string): SchemaVersion {
  if (!/^\d+\.\d+\.\d+$/.test(raw)) {
    throw new Error(`SchemaVersion must be semver (x.y.z), got "${raw}"`);
  }
  return raw as SchemaVersion;
}

// ─── Result<T, E> ───────────────────────────────────────────────────────────

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ─── SCD Type 2 Version Envelope ────────────────────────────────────────────
// Every data model is wrapped in this envelope. Each edit creates a new version.
// Previous versions remain accessible via the history array.

export interface VersionEnvelope<T> {
  readonly version: ModelVersion;
  readonly validFrom: string;       // ISO 8601
  readonly validTo: string | null;  // null = current
  readonly isCurrent: boolean;
  readonly editedBy: string;
  readonly editReason: string;
  readonly data: T;
}

export interface VersionedModel<T> {
  readonly id: SurfaceId;
  readonly name: string;
  readonly currentVersion: ModelVersion;
  readonly current: VersionEnvelope<T>;
  readonly history: readonly VersionEnvelope<T>[];
}

// ─── Version Bump ───────────────────────────────────────────────────────────

export function bumpVersion<T>(
  model: VersionedModel<T>,
  newData: T,
  editedBy: string,
  editReason: string,
): VersionedModel<T> {
  const now = new Date().toISOString();
  const nextVersion = toModelVersion((model.currentVersion as number) + 1);

  // Close out the current version
  const closedCurrent: VersionEnvelope<T> = {
    ...model.current,
    validTo: now,
    isCurrent: false,
  };

  // Create new current version
  const newCurrent: VersionEnvelope<T> = {
    version: nextVersion,
    validFrom: now,
    validTo: null,
    isCurrent: true,
    editedBy,
    editReason,
    data: newData,
  };

  return {
    ...model,
    currentVersion: nextVersion,
    current: newCurrent,
    history: [...model.history, closedCurrent],
  };
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createVersionedModel<T>(
  id: SurfaceId,
  name: string,
  initialData: T,
  editedBy: string,
): VersionedModel<T> {
  const v1 = toModelVersion(1);
  const now = new Date().toISOString();

  const envelope: VersionEnvelope<T> = {
    version: v1,
    validFrom: now,
    validTo: null,
    isCurrent: true,
    editedBy,
    editReason: 'Initial creation',
    data: initialData,
  };

  return {
    id,
    name,
    currentVersion: v1,
    current: envelope,
    history: [],
  };
}

// ─── assertNever ────────────────────────────────────────────────────────────

export function assertNever(value: never): never {
  throw new Error(`Unexpected value in assertNever: ${JSON.stringify(value)}`);
}
