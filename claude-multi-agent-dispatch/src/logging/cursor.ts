// src/logging/cursor.ts — JSONL byte-offset cursor for efficient inbox reads
//
// Extracted patterns from oh-my-claudecode (Yeachan Heo):
//   - jsonl-byte-offset-cursor-inbox: persistent offset avoids re-parsing
//   - inbox-outbox-rotation: half-retention rotation on size threshold
//   - dispatch-request-dedup: content-hash deduplication
//
// Instead of re-reading entire JSONL files, each reader maintains a
// persistent byte-offset cursor. On read, we seek to the offset and
// only parse new lines. O(new_lines) instead of O(total_lines).
//
// Boris Cherny patterns: Branded types, Result<T,E>.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { Ok, Err, type Result } from '../types/core.js';

// ── Branded Types ──────────────────────────────────────────────

type Brand<T, B extends string> = T & { readonly [__brand]: B };
declare const __brand: unique symbol;

export type ByteOffset = Brand<number, 'ByteOffset'>;

function toByteOffset(n: number): ByteOffset { return n as ByteOffset; }

// ── Cursor State ───────────────────────────────────────────────

export interface CursorState {
  readonly offset: ByteOffset;
  readonly lineCount: number;
  readonly lastReadAt: number;
}

// ── Cursor Reader ──────────────────────────────────────────────

export class CursorReader<T = unknown> {
  private readonly filePath: string;
  private readonly cursorPath: string;
  private readonly seenHashes: Set<string>;
  private cursor: CursorState;

  constructor(filePath: string, cursorDir?: string) {
    this.filePath = filePath;
    const dir = cursorDir ?? path.dirname(filePath);
    const baseName = path.basename(filePath, path.extname(filePath));
    this.cursorPath = path.join(dir, `${baseName}.offset`);
    this.seenHashes = new Set();
    this.cursor = this.loadCursor();
  }

  /**
   * Read only new lines since the last cursor position.
   * Returns parsed objects and advances the cursor.
   * @param dedup — if true, deduplicate by content hash
   */
  readNew(dedup: boolean = false): T[] {
    if (!fs.existsSync(this.filePath)) return [];

    const fd = fs.openSync(this.filePath, 'r');
    try {
      const stat = fs.fstatSync(fd);
      const fileSize = stat.size;

      // Nothing new
      if (fileSize <= (this.cursor.offset as number)) return [];

      // Read only the new bytes
      const newBytes = fileSize - (this.cursor.offset as number);
      const buffer = Buffer.alloc(newBytes);
      fs.readSync(fd, buffer, 0, newBytes, this.cursor.offset as number);

      const chunk = buffer.toString('utf-8');
      const lines = chunk.split('\n').filter((l) => l.trim().length > 0);
      const results: T[] = [];

      for (const line of lines) {
        try {
          if (dedup) {
            const hash = crypto.createHash('md5').update(line).digest('hex');
            if (this.seenHashes.has(hash)) continue;
            this.seenHashes.add(hash);
          }
          results.push(JSON.parse(line) as T);
        } catch {
          // Skip malformed lines
        }
      }

      // Advance cursor
      this.cursor = {
        offset: toByteOffset(fileSize),
        lineCount: this.cursor.lineCount + results.length,
        lastReadAt: Date.now(),
      };
      this.saveCursor();

      return results;
    } finally {
      fs.closeSync(fd);
    }
  }

  /**
   * Peek at new lines without advancing the cursor.
   */
  peekNew(): T[] {
    const savedCursor = { ...this.cursor };
    const savedHashes = new Set(this.seenHashes);
    const results = this.readNew(false);
    this.cursor = savedCursor;
    this.seenHashes.clear();
    for (const h of savedHashes) this.seenHashes.add(h);
    return results;
  }

  /**
   * Reset cursor to beginning of file.
   */
  reset(): void {
    this.cursor = {
      offset: toByteOffset(0),
      lineCount: 0,
      lastReadAt: Date.now(),
    };
    this.seenHashes.clear();
    this.saveCursor();
  }

  /**
   * Get current cursor state.
   */
  getState(): CursorState {
    return this.cursor;
  }

  // ── Private helpers ────────────────────────────────────────────

  private loadCursor(): CursorState {
    try {
      if (fs.existsSync(this.cursorPath)) {
        const raw = fs.readFileSync(this.cursorPath, 'utf-8');
        const data = JSON.parse(raw) as CursorState;
        return {
          offset: toByteOffset(data.offset as number),
          lineCount: data.lineCount,
          lastReadAt: data.lastReadAt,
        };
      }
    } catch {
      // Start fresh on any error
    }
    return { offset: toByteOffset(0), lineCount: 0, lastReadAt: Date.now() };
  }

  private saveCursor(): void {
    try {
      const dir = path.dirname(this.cursorPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.cursorPath, JSON.stringify(this.cursor) + '\n');
    } catch {
      // Non-fatal: cursor will be reloaded from file next time
    }
  }
}

// ── JSONL Rotation ─────────────────────────────────────────────
// Half-retention rotation: keep the most recent half when size exceeds threshold.

/**
 * Rotate a JSONL file when it exceeds maxBytes.
 * Keeps the most recent half of lines. Returns true if rotation occurred.
 */
export function rotateJsonl(
  filePath: string,
  maxBytes: number,
): Result<boolean, Error> {
  try {
    if (!fs.existsSync(filePath)) return Ok(false);

    const stat = fs.statSync(filePath);
    if (stat.size <= maxBytes) return Ok(false);

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);

    if (lines.length <= 1) return Ok(false);

    // Keep the most recent half
    const keepFrom = Math.floor(lines.length / 2);
    const kept = lines.slice(keepFrom);

    // Archive the rotated portion
    const rotatedPath = filePath + '.1';
    const archived = lines.slice(0, keepFrom);
    fs.writeFileSync(rotatedPath, archived.join('\n') + '\n', 'utf-8');

    // Write kept lines back to main file
    fs.writeFileSync(filePath, kept.join('\n') + '\n', 'utf-8');

    return Ok(true);
  } catch (e) {
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
}
