import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  Transcript,
  TranscriptId,
  DispatchId,
  RoundId,
  QualityScore,
} from '../types/index.js';
import type { AuditReport } from './auditor.js';

// ─── AuditStore ─────────────────────────────────────────────────────────────

/**
 * JSONL-backed persistence for transcripts and audit reports.
 * Uses file-based storage at rounds/{N}/ directory.
 * Maintains in-memory Map indexes for fast lookup.
 */
export class AuditStore {
  private readonly baseDir: string;
  private readonly transcriptIndex: Map<string, Transcript> = new Map();
  private readonly auditIndex: Map<string, AuditReport> = new Map();
  private readonly dispatchAuditIndex: Map<string, string[]> = new Map();

  constructor(baseDir: string = './rounds') {
    this.baseDir = baseDir;
    this.ensureDir(this.baseDir);
    this.loadIndexes();
  }

  // ─── Transcript operations ──────────────────────────────────────────────

  /**
   * Save a transcript to transcripts.jsonl (append).
   */
  saveTranscript(transcript: Transcript): void {
    const filePath = this.transcriptFilePath();
    this.ensureDir(path.dirname(filePath));

    // Serialize Map for JSON
    const serializable = this.serializeTranscript(transcript);
    const line = JSON.stringify(serializable) + '\n';
    fs.appendFileSync(filePath, line, 'utf-8');

    // Update in-memory index
    this.transcriptIndex.set(String(transcript.metadata.sessionId), transcript);
  }

  /**
   * Load a transcript by its session ID (used as lookup key).
   */
  loadTranscript(id: TranscriptId): Transcript | undefined {
    return this.transcriptIndex.get(String(id));
  }

  // ─── Audit report operations ────────────────────────────────────────────

  /**
   * Save an audit report to audits.jsonl (append).
   */
  saveAuditReport(report: AuditReport): void {
    const filePath = this.auditFilePath();
    this.ensureDir(path.dirname(filePath));

    const serializable = this.serializeAuditReport(report);
    const line = JSON.stringify(serializable) + '\n';
    fs.appendFileSync(filePath, line, 'utf-8');

    // Update indexes
    const auditIdStr = String(report.auditId);
    const dispatchIdStr = String(report.dispatchId);
    this.auditIndex.set(auditIdStr, report);

    const existing = this.dispatchAuditIndex.get(dispatchIdStr) ?? [];
    existing.push(auditIdStr);
    this.dispatchAuditIndex.set(dispatchIdStr, existing);
  }

  /**
   * Get audit reports, optionally filtered by dispatchId.
   */
  getAuditReports(dispatchId?: DispatchId): AuditReport[] {
    if (dispatchId) {
      const auditIds = this.dispatchAuditIndex.get(String(dispatchId)) ?? [];
      return auditIds
        .map((id) => this.auditIndex.get(id))
        .filter((r): r is AuditReport => r !== undefined);
    }
    return [...this.auditIndex.values()];
  }

  /**
   * Get quality score history, optionally filtered by roundId.
   */
  getQualityHistory(_roundId?: RoundId): QualityScore[] {
    // Quality scores are extracted from audit reports
    const reports = this.getAuditReports();
    return reports.map((r) => ({
      dimensions: [
        { dimension: 'completeness' as const, value: r.overallScore, confidence: 0.8, weight: 1 },
        { dimension: 'accuracy' as const, value: r.overallScore, confidence: 0.8, weight: 1 },
      ],
      overall: r.overallScore,
      overallConfidence: 0.8,
    }));
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  private transcriptFilePath(): string {
    return path.join(this.baseDir, 'transcripts.jsonl');
  }

  private auditFilePath(): string {
    return path.join(this.baseDir, 'audits.jsonl');
  }

  private ensureDir(dir: string): void {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // Directory may already exist
    }
  }

  private loadIndexes(): void {
    // Load transcripts
    const transcriptPath = this.transcriptFilePath();
    if (fs.existsSync(transcriptPath)) {
      try {
        const content = fs.readFileSync(transcriptPath, 'utf-8');
        const lines = content.split('\n').filter((l) => l.trim().length > 0);
        for (const line of lines) {
          try {
            const raw = JSON.parse(line) as Record<string, unknown>;
            const transcript = this.deserializeTranscript(raw);
            this.transcriptIndex.set(String(transcript.metadata.sessionId), transcript);
          } catch {
            // Skip malformed lines
          }
        }
      } catch {
        // File read error, start with empty index
      }
    }

    // Load audit reports
    const auditPath = this.auditFilePath();
    if (fs.existsSync(auditPath)) {
      try {
        const content = fs.readFileSync(auditPath, 'utf-8');
        const lines = content.split('\n').filter((l) => l.trim().length > 0);
        for (const line of lines) {
          try {
            const raw = JSON.parse(line) as Record<string, unknown>;
            const report = this.deserializeAuditReport(raw);
            const auditIdStr = String(report.auditId);
            const dispatchIdStr = String(report.dispatchId);

            this.auditIndex.set(auditIdStr, report);
            const existing = this.dispatchAuditIndex.get(dispatchIdStr) ?? [];
            existing.push(auditIdStr);
            this.dispatchAuditIndex.set(dispatchIdStr, existing);
          } catch {
            // Skip malformed lines
          }
        }
      } catch {
        // File read error, start with empty index
      }
    }
  }

  private serializeTranscript(transcript: Transcript): Record<string, unknown> {
    return {
      metadata: {
        sessionId: String(transcript.metadata.sessionId),
        roundId: transcript.metadata.roundId ? String(transcript.metadata.roundId) : undefined,
        dispatchId: transcript.metadata.dispatchId ? String(transcript.metadata.dispatchId) : undefined,
        agentAssignments: Object.fromEntries(transcript.metadata.agentAssignments),
      },
      messages: transcript.messages,
      events: transcript.events.map((e) => ({ ...e })),
    };
  }

  private deserializeTranscript(raw: Record<string, unknown>): Transcript {
    const meta = raw['metadata'] as Record<string, unknown>;
    const assignments = meta['agentAssignments'] as Record<string, string> | undefined;

    return {
      metadata: {
        sessionId: meta['sessionId'] as any,
        roundId: meta['roundId'] as any,
        dispatchId: meta['dispatchId'] as any,
        agentAssignments: new Map(Object.entries(assignments ?? {})) as any,
      },
      messages: (raw['messages'] as any[]) ?? [],
      events: (raw['events'] as any[]) ?? [],
    };
  }

  private serializeAuditReport(report: AuditReport): Record<string, unknown> {
    return {
      auditId: String(report.auditId),
      dispatchId: String(report.dispatchId),
      agentScores: Object.fromEntries(report.agentScores),
      overallScore: report.overallScore,
      flaggedIssues: report.flaggedIssues,
      recommendations: report.recommendations,
      timestamp: report.timestamp.toISOString(),
    };
  }

  private deserializeAuditReport(raw: Record<string, unknown>): AuditReport {
    const scores = raw['agentScores'] as Record<string, number> | undefined;
    return {
      auditId: raw['auditId'] as any,
      dispatchId: raw['dispatchId'] as any,
      agentScores: new Map(Object.entries(scores ?? {})),
      overallScore: raw['overallScore'] as number,
      flaggedIssues: (raw['flaggedIssues'] as any[]) ?? [],
      recommendations: (raw['recommendations'] as string[]) ?? [],
      timestamp: new Date(raw['timestamp'] as string),
    };
  }
}
