import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Event } from '../types/transcript.js';

// ─── JSONLWriter ────────────────────────────────────────────────────────────
// Append-only JSONL file writer with rotation and filtered reads.

export class JSONLWriter {
  private readonly filePath: string;

  constructor(basePath: string) {
    const dir = path.dirname(basePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.filePath = basePath;
  }

  /** Append an event as a single JSON line with timestamp. */
  append(event: Event): void {
    const line: Record<string, unknown> = {
      ...event,
      // Override event timestamp with ISO string
      timestamp: event.timestamp instanceof Date
        ? event.timestamp.toISOString()
        : event.timestamp,
      _loggedAt: new Date().toISOString(),
    };
    fs.appendFileSync(this.filePath, JSON.stringify(line) + '\n', 'utf-8');
  }

  /** Flush is a no-op since we use appendFileSync (atomic per call). */
  flush(): void {
    // appendFileSync is synchronous — nothing to flush.
  }

  /**
   * Rotate the current file to .1 suffix when it exceeds maxLines.
   * The previous .1 file is overwritten.
   */
  rotate(maxLines: number): void {
    if (!fs.existsSync(this.filePath)) return;

    const content = fs.readFileSync(this.filePath, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);

    if (lines.length <= maxLines) return;

    const rotatedPath = this.filePath + '.1';
    // Move current file to .1
    fs.copyFileSync(this.filePath, rotatedPath);
    // Keep only the most recent maxLines in the current file
    const kept = lines.slice(lines.length - maxLines);
    fs.writeFileSync(this.filePath, kept.join('\n') + '\n', 'utf-8');
  }

  /**
   * Read and parse the JSONL file with optional filtering.
   * @param filter.type — match events where .type equals this value
   * @param filter.after — match events whose timestamp is after this Date
   */
  read(filter?: { type?: string; after?: Date }): Event[] {
    if (!fs.existsSync(this.filePath)) return [];

    const content = fs.readFileSync(this.filePath, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);

    const events: Event[] = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;

        // Apply type filter
        if (filter?.type && parsed['type'] !== filter.type) continue;

        // Apply after filter
        if (filter?.after) {
          const ts = parsed['timestamp'] as string | undefined;
          if (ts && new Date(ts) <= filter.after) continue;
        }

        // Reconstruct the event timestamp as Date
        if (parsed['eventTimestamp']) {
          parsed['timestamp'] = new Date(parsed['eventTimestamp'] as string);
          delete parsed['eventTimestamp'];
        } else if (typeof parsed['timestamp'] === 'string') {
          parsed['timestamp'] = new Date(parsed['timestamp'] as string);
        }

        events.push(parsed as unknown as Event);
      } catch {
        // Skip malformed lines
      }
    }

    return events;
  }

  /** Get the file path. */
  getPath(): string {
    return this.filePath;
  }
}
