// .jade/models/index.ts — Barrel export for all data models

export {
  type Brand,
  type ModelVersion,
  type SurfaceId,
  type PageSlug,
  type AgentFileId,
  type SchemaVersion,
  type Result,
  type VersionEnvelope,
  type VersionedModel,
  toModelVersion,
  toSurfaceId,
  toPageSlug,
  toAgentFileId,
  toSchemaVersion,
  Ok,
  Err,
  bumpVersion,
  createVersionedModel,
  assertNever,
} from './base.js';
