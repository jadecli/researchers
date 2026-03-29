import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { CursorReader, rotateJsonl } from '../src/logging/cursor.js';

describe('CursorReader', () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-test-'));
    filePath = path.join(tmpDir, 'events.jsonl');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function appendLine(data: object): void {
    fs.appendFileSync(filePath, JSON.stringify(data) + '\n');
  }

  it('reads all lines on first call', () => {
    appendLine({ type: 'a', value: 1 });
    appendLine({ type: 'b', value: 2 });

    const reader = new CursorReader(filePath);
    const items = reader.readNew();

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ type: 'a', value: 1 });
    expect(items[1]).toEqual({ type: 'b', value: 2 });
  });

  it('only reads new lines on subsequent calls', () => {
    appendLine({ type: 'a', value: 1 });

    const reader = new CursorReader(filePath);
    const first = reader.readNew();
    expect(first).toHaveLength(1);

    // Append more
    appendLine({ type: 'b', value: 2 });
    appendLine({ type: 'c', value: 3 });

    const second = reader.readNew();
    expect(second).toHaveLength(2);
    expect(second[0]).toEqual({ type: 'b', value: 2 });
  });

  it('returns empty array when no new data', () => {
    appendLine({ type: 'a' });

    const reader = new CursorReader(filePath);
    reader.readNew();

    const empty = reader.readNew();
    expect(empty).toHaveLength(0);
  });

  it('returns empty array for non-existent file', () => {
    const reader = new CursorReader(path.join(tmpDir, 'nope.jsonl'));
    expect(reader.readNew()).toHaveLength(0);
  });

  it('skips malformed lines', () => {
    fs.appendFileSync(filePath, '{"valid":true}\nnot-json\n{"also":"valid"}\n');

    const reader = new CursorReader(filePath);
    const items = reader.readNew();
    expect(items).toHaveLength(2);
  });

  it('deduplicates by content hash when dedup=true', () => {
    appendLine({ type: 'a', value: 1 });
    appendLine({ type: 'a', value: 1 }); // duplicate
    appendLine({ type: 'b', value: 2 });

    const reader = new CursorReader(filePath);
    const items = reader.readNew(true);
    expect(items).toHaveLength(2);
  });

  it('peekNew does not advance cursor', () => {
    appendLine({ type: 'a' });

    const reader = new CursorReader(filePath);
    const peeked = reader.peekNew();
    expect(peeked).toHaveLength(1);

    // Same data should be available again
    const actual = reader.readNew();
    expect(actual).toHaveLength(1);
  });

  it('reset allows re-reading from beginning', () => {
    appendLine({ type: 'a' });
    appendLine({ type: 'b' });

    const reader = new CursorReader(filePath);
    reader.readNew();

    reader.reset();
    const all = reader.readNew();
    expect(all).toHaveLength(2);
  });

  it('persists cursor across instances', () => {
    appendLine({ type: 'a' });

    const reader1 = new CursorReader(filePath);
    reader1.readNew(); // advance cursor

    appendLine({ type: 'b' });

    // New instance picks up from saved cursor
    const reader2 = new CursorReader(filePath);
    const items = reader2.readNew();
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ type: 'b' });
  });

  it('getState returns current cursor info', () => {
    appendLine({ type: 'a' });

    const reader = new CursorReader(filePath);
    reader.readNew();

    const state = reader.getState();
    expect(state.offset).toBeGreaterThan(0);
    expect(state.lineCount).toBe(1);
  });
});

describe('rotateJsonl', () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rotate-test-'));
    filePath = path.join(tmpDir, 'events.jsonl');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('does nothing when file is small', () => {
    fs.writeFileSync(filePath, '{"a":1}\n');
    const result = rotateJsonl(filePath, 1_000_000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(false);
  });

  it('rotates when file exceeds maxBytes', () => {
    // Write many lines to exceed threshold
    const lines = Array.from({ length: 100 }, (_, i) =>
      JSON.stringify({ index: i, padding: 'x'.repeat(100) }),
    );
    fs.writeFileSync(filePath, lines.join('\n') + '\n');

    const result = rotateJsonl(filePath, 100); // tiny threshold
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(true);

    // Main file should have ~half the lines
    const remaining = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
    expect(remaining.length).toBe(50);

    // Rotated file should exist
    expect(fs.existsSync(filePath + '.1')).toBe(true);
  });

  it('returns false for non-existent file', () => {
    const result = rotateJsonl(path.join(tmpDir, 'nope.jsonl'), 100);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(false);
  });
});
