import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  SessionId,
  DispatchId,
  AgentId,
  USD,
  RoundId,
} from '../types/index.js';
import { toSessionId, toUSD } from '../types/index.js';
import type { DispatchState } from '../types/index.js';

// ─── DispatchSession ────────────────────────────────────────────────────────

export interface DispatchSession {
  readonly id: SessionId;
  dispatches: DispatchId[];
  activeAgents: AgentId[];
  budgetUsed: USD;
  budgetRemaining: USD;
  state: DispatchState;
  readonly roundId?: RoundId;
  readonly startTime: Date;
}

// ─── SessionStore ───────────────────────────────────────────────────────────

/**
 * JSONL-backed session persistence. Maintains in-memory index
 * and integrates with AuditStore for cross-referencing.
 */
export class SessionStore {
  private readonly baseDir: string;
  private readonly sessions: Map<string, DispatchSession> = new Map();

  constructor(baseDir: string = './rounds') {
    this.baseDir = baseDir;
    this.ensureDir(this.baseDir);
    this.loadIndex();
  }

  /**
   * Create a new session.
   */
  create(params: {
    budget: USD;
    roundId?: RoundId;
  }): DispatchSession {
    const id = toSessionId(`session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    const session: DispatchSession = {
      id,
      dispatches: [],
      activeAgents: [],
      budgetUsed: toUSD(0),
      budgetRemaining: params.budget,
      state: { status: 'idle' },
      roundId: params.roundId,
      startTime: new Date(),
    };

    this.sessions.set(String(id), session);
    this.persist(session);

    return session;
  }

  /**
   * Load a session by ID.
   */
  load(id: SessionId): DispatchSession | undefined {
    return this.sessions.get(String(id));
  }

  /**
   * Update a session in-place and persist.
   */
  update(id: SessionId, updater: (session: DispatchSession) => void): DispatchSession | undefined {
    const session = this.sessions.get(String(id));
    if (!session) return undefined;

    updater(session);
    this.persist(session);

    return session;
  }

  /**
   * Archive a session (mark as complete and remove from active index).
   */
  archive(id: SessionId): boolean {
    const session = this.sessions.get(String(id));
    if (!session) return false;

    // Move to archive file
    const archivePath = path.join(this.baseDir, 'sessions-archive.jsonl');
    this.ensureDir(path.dirname(archivePath));

    const serialized = this.serialize(session);
    const line = JSON.stringify({ ...serialized, archivedAt: new Date().toISOString() }) + '\n';
    fs.appendFileSync(archivePath, line, 'utf-8');

    this.sessions.delete(String(id));

    return true;
  }

  /**
   * Get all active sessions.
   */
  listActive(): DispatchSession[] {
    return [...this.sessions.values()];
  }

  /**
   * Get sessions for a specific round.
   */
  getByRound(roundId: RoundId): DispatchSession[] {
    return [...this.sessions.values()].filter(
      (s) => s.roundId && String(s.roundId) === String(roundId),
    );
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  private sessionFilePath(): string {
    return path.join(this.baseDir, 'sessions.jsonl');
  }

  private ensureDir(dir: string): void {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // Already exists
    }
  }

  private persist(session: DispatchSession): void {
    const filePath = this.sessionFilePath();
    this.ensureDir(path.dirname(filePath));

    const line = JSON.stringify(this.serialize(session)) + '\n';
    fs.appendFileSync(filePath, line, 'utf-8');
  }

  private loadIndex(): void {
    const filePath = this.sessionFilePath();
    if (!fs.existsSync(filePath)) return;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim().length > 0);

      for (const line of lines) {
        try {
          const raw = JSON.parse(line) as Record<string, unknown>;
          const session = this.deserialize(raw);
          // Later entries override earlier ones (latest state wins)
          this.sessions.set(String(session.id), session);
        } catch {
          // Skip malformed lines
        }
      }
    } catch {
      // File read error
    }
  }

  private serialize(session: DispatchSession): Record<string, unknown> {
    return {
      id: String(session.id),
      dispatches: session.dispatches.map(String),
      activeAgents: session.activeAgents.map(String),
      budgetUsed: session.budgetUsed as number,
      budgetRemaining: session.budgetRemaining as number,
      state: session.state,
      roundId: session.roundId ? String(session.roundId) : undefined,
      startTime: session.startTime.toISOString(),
    };
  }

  private deserialize(raw: Record<string, unknown>): DispatchSession {
    return {
      id: raw['id'] as SessionId,
      dispatches: ((raw['dispatches'] as string[]) ?? []) as DispatchId[],
      activeAgents: ((raw['activeAgents'] as string[]) ?? []) as AgentId[],
      budgetUsed: toUSD((raw['budgetUsed'] as number) ?? 0),
      budgetRemaining: toUSD((raw['budgetRemaining'] as number) ?? 0),
      state: (raw['state'] as DispatchState) ?? { status: 'idle' },
      roundId: raw['roundId'] as RoundId | undefined,
      startTime: new Date(raw['startTime'] as string),
    };
  }
}
