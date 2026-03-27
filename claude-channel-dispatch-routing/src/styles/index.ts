// src/styles/index.ts — Public API for the style management module
//
// Re-exports types, presets, and manager as a single barrel.

// ── Types ─────────────────────────────────────────────────────
export type {
  StyleId,
  WritingSampleId,
  StyleInstructionHash,
  Result,
  PresetName,
  AlwaysVisiblePreset,
  HideablePreset,
  StyleVisibility,
  StartingPoint,
  WritingSampleFormat,
  WritingSample,
  StyleKind,
  Style,
  ActiveStyle,
  StyleError,
  CreateStyleInput,
  StyleEventType,
  StyleEvent,
  DimStyleRow,
  FactStyleUsageRow,
  FactStyleCreationRow,
} from './types.js';

export {
  toStyleId,
  toWritingSampleId,
  toStyleInstructionHash,
  Ok,
  Err,
  map,
  flatMap,
  unwrap,
  unwrapOr,
  assertNever,
  describeStyleKind,
  handleStyleError,
  STYLE_BUS_MATRIX,
  STYLE_METRICS,
  STYLE_DIMENSIONS,
} from './types.js';

// ── Presets ───────────────────────────────────────────────────
export {
  PRESET_NORMAL,
  PRESET_CONCISE,
  PRESET_FORMAL,
  PRESET_EXPLANATORY,
  CUSTOM_TYPESCRIPT_STRICT,
  CUSTOM_DIMENSIONAL_MODELER,
  DEFAULT_STYLES,
} from './presets.js';

// ── Manager ───────────────────────────────────────────────────
export { StyleManager } from './manager.js';
