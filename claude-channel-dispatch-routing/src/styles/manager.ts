// src/styles/manager.ts — Style CRUD manager using Result<T,E> pattern
//
// Every public method returns Result — no thrown exceptions.
// Branded StyleId prevents accidental string misuse.
// Exhaustive error handling via assertNever.

import type {
  Style,
  StyleId,
  StyleError,
  ActiveStyle,
  CreateStyleInput,
  StyleEvent,
  StyleEventType,
} from './types.js';
import {
  Ok,
  Err,
  toStyleId,
  toStyleInstructionHash,
  assertNever,
  handleStyleError,
} from './types.js';
import type { Result } from './types.js';
import { DEFAULT_STYLES } from './presets.js';

// ── Simple hash (matches presets.ts) ──────────────────────────
function hashInstructions(instructions: string): string {
  let hash = 0;
  for (let i = 0; i < instructions.length; i++) {
    const char = instructions.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `sha256:${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

// ── Style Manager ─────────────────────────────────────────────

export class StyleManager {
  private readonly styles: Map<StyleId, Style>;
  private readonly eventLog: StyleEvent[];
  private activeStyle: ActiveStyle | null;
  private nextSortOrder: number;

  constructor() {
    this.styles = new Map();
    this.eventLog = [];
    this.activeStyle = null;
    this.nextSortOrder = 0;

    for (const style of DEFAULT_STYLES) {
      this.styles.set(style.id, style);
      if (style.sortOrder >= this.nextSortOrder) {
        this.nextSortOrder = style.sortOrder + 1;
      }
    }
  }

  // ── Queries ───────────────────────────────────────────────

  getStyle(id: StyleId): Result<Style, StyleError> {
    const style = this.styles.get(id);
    if (!style) {
      return Err({ type: 'not_found', styleId: id });
    }
    return Ok(style);
  }

  getActiveStyle(): ActiveStyle | null {
    return this.activeStyle;
  }

  listStyles(): ReadonlyArray<Style> {
    return Array.from(this.styles.values())
      .filter((s) => s.visibility !== 'hidden')
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  listAllStyles(): ReadonlyArray<Style> {
    return Array.from(this.styles.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
  }

  getEventLog(): ReadonlyArray<StyleEvent> {
    return this.eventLog;
  }

  // ── Commands ──────────────────────────────────────────────

  createStyle(input: CreateStyleInput): Result<Style, StyleError> {
    // Check for duplicate names
    for (const existing of this.styles.values()) {
      if (existing.name === input.name) {
        return Err({ type: 'already_exists', name: input.name });
      }
    }

    const instructions = this.resolveInstructions(input);
    const validationResult = this.validateInstructions(instructions);
    if (!validationResult.ok) {
      return validationResult;
    }

    const now = new Date();
    const style: Style = {
      id: toStyleId(`custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      name: input.name,
      styleKind: this.resolveStyleKind(input),
      instructions,
      instructionHash: toStyleInstructionHash(hashInstructions(instructions)),
      visibility: 'visible',
      sortOrder: this.nextSortOrder++,
      createdAt: now,
      updatedAt: now,
    };

    this.styles.set(style.id, style);
    this.recordEvent('create', style);

    return Ok(style);
  }

  updateInstructions(
    id: StyleId,
    instructions: string,
  ): Result<Style, StyleError> {
    const existing = this.styles.get(id);
    if (!existing) {
      return Err({ type: 'not_found', styleId: id });
    }

    const validationResult = this.validateInstructions(instructions);
    if (!validationResult.ok) {
      return validationResult;
    }

    const updated: Style = {
      ...existing,
      instructions,
      instructionHash: toStyleInstructionHash(
        hashInstructions(instructions),
      ),
      updatedAt: new Date(),
    };

    this.styles.set(id, updated);
    this.recordEvent('edit', updated);

    return Ok(updated);
  }

  hidePreset(id: StyleId): Result<void, StyleError> {
    const style = this.styles.get(id);
    if (!style) {
      return Err({ type: 'not_found', styleId: id });
    }

    if (style.visibility === 'always_visible') {
      if (
        style.styleKind.kind === 'preset' &&
        (style.styleKind.presetName === 'normal' ||
          style.styleKind.presetName === 'concise')
      ) {
        return Err({
          type: 'cannot_hide_required',
          presetName: style.styleKind.presetName,
        });
      }
    }

    const updated: Style = {
      ...style,
      visibility: 'hidden',
      updatedAt: new Date(),
    };
    this.styles.set(id, updated);
    this.recordEvent('hide', updated);

    return Ok(undefined);
  }

  unhidePreset(id: StyleId): Result<void, StyleError> {
    const style = this.styles.get(id);
    if (!style) {
      return Err({ type: 'not_found', styleId: id });
    }

    const updated: Style = {
      ...style,
      visibility: style.visibility === 'always_visible' ? 'always_visible' : 'visible',
      updatedAt: new Date(),
    };
    this.styles.set(id, updated);
    this.recordEvent('unhide', updated);

    return Ok(undefined);
  }

  resetPresetStyles(): void {
    for (const [id, style] of this.styles) {
      if (
        style.styleKind.kind === 'preset' &&
        style.visibility === 'hidden'
      ) {
        this.styles.set(id, {
          ...style,
          visibility: 'visible',
          updatedAt: new Date(),
        });
      }
    }
  }

  reorderStyles(
    ids: ReadonlyArray<StyleId>,
  ): Result<void, StyleError> {
    // Validate all IDs exist
    for (const id of ids) {
      if (!this.styles.has(id)) {
        return Err({ type: 'not_found', styleId: id });
      }
    }

    // Apply new sort order
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      const style = this.styles.get(id)!;
      this.styles.set(id, {
        ...style,
        sortOrder: i,
        updatedAt: new Date(),
      });
    }

    this.nextSortOrder = ids.length;
    return Ok(undefined);
  }

  switchStyle(id: StyleId): Result<ActiveStyle, StyleError> {
    const style = this.styles.get(id);
    if (!style) {
      return Err({ type: 'not_found', styleId: id });
    }

    if (style.visibility === 'hidden') {
      return Err({ type: 'not_found', styleId: id });
    }

    this.activeStyle = {
      style,
      activatedAt: new Date(),
    };

    this.recordEvent('select', style);

    return Ok(this.activeStyle);
  }

  deleteStyle(id: StyleId): Result<void, StyleError> {
    const style = this.styles.get(id);
    if (!style) {
      return Err({ type: 'not_found', styleId: id });
    }

    // Cannot delete preset styles
    if (style.styleKind.kind === 'preset') {
      return Err({
        type: 'invalid_instruction',
        reason: 'Cannot delete preset styles. Use hide instead.',
      });
    }

    this.styles.delete(id);
    this.recordEvent('delete', style);

    // Clear active style if it was the deleted one
    if (this.activeStyle?.style.id === id) {
      this.activeStyle = null;
    }

    return Ok(undefined);
  }

  // ── Error Display ─────────────────────────────────────────

  formatError(error: StyleError): string {
    return handleStyleError(error);
  }

  // ── Private Helpers ───────────────────────────────────────

  private resolveInstructions(input: CreateStyleInput): string {
    switch (input.method) {
      case 'upload':
        return input.samples.map((s) => s.content).join('\n\n');
      case 'describe':
        return input.description;
      case 'manual':
        return input.instructions;
      default:
        return assertNever(input);
    }
  }

  private resolveStyleKind(input: CreateStyleInput): Style['styleKind'] {
    switch (input.method) {
      case 'upload':
        return { kind: 'custom_upload', samples: input.samples };
      case 'describe':
        return {
          kind: 'custom_describe',
          description: input.description,
          startingPoint: 'technical_writing',
        };
      case 'manual':
        return { kind: 'custom_manual', instructions: input.instructions };
      default:
        return assertNever(input);
    }
  }

  private validateInstructions(
    instructions: string,
  ): Result<void, StyleError> {
    if (!instructions || instructions.trim().length === 0) {
      return Err({
        type: 'invalid_instruction',
        reason: 'Instructions cannot be empty',
      });
    }
    if (instructions.length > 10_000) {
      return Err({
        type: 'invalid_instruction',
        reason: `Instructions too long (${instructions.length} chars, max 10000)`,
      });
    }
    return Ok(undefined);
  }

  private recordEvent(
    eventType: StyleEventType,
    style: Style,
  ): void {
    this.eventLog.push({
      eventType,
      styleId: style.id,
      styleName: style.name,
      styleKind: style.styleKind.kind,
      sessionId: 'session-default',
      agentId: undefined,
      timestamp: new Date(),
    });
  }
}
