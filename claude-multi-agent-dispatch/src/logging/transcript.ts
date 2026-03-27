import type {
  TranscriptMetadata,
  Transcript,
  Message,
  Event,
  DecisionEvent,
  QualityScoreEvent,
} from '../types/transcript.js';

// ─── TranscriptBuilder ──────────────────────────────────────────────────────
// Incrementally builds an immutable Transcript from messages and events.

export class TranscriptBuilder {
  private readonly metadata: TranscriptMetadata;
  private readonly messages: Message[] = [];
  private readonly events: Event[] = [];

  constructor(metadata: TranscriptMetadata) {
    this.metadata = metadata;
  }

  /** Add a chat message. */
  addMessage(role: Message['role'], content: string): void {
    this.messages.push({
      role,
      content,
      timestamp: new Date(),
    });
  }

  /** Add a raw event. */
  addEvent(event: Event): void {
    this.events.push(event);
  }

  /** Convenience: add a DecisionEvent. */
  addDecision(
    rationale: string,
    confidence: number,
    alternatives: string[],
  ): void {
    const event: DecisionEvent = {
      type: 'decision',
      rationale,
      confidence,
      alternatives,
      timestamp: new Date(),
    };
    this.events.push(event);
  }

  /** Convenience: add a QualityScoreEvent. */
  addQualityScore(
    dimensions: Record<string, number>,
    overall: number,
  ): void {
    const event: QualityScoreEvent = {
      type: 'quality_score',
      scores: dimensions,
      overall,
      timestamp: new Date(),
    };
    this.events.push(event);
  }

  /** Build an immutable Transcript. */
  build(): Transcript {
    return {
      metadata: this.metadata,
      messages: Object.freeze([...this.messages]),
      events: Object.freeze([...this.events]),
    };
  }

  /** Filter events for tool_call type. */
  getToolCalls(): Event[] {
    return this.events.filter((e) => e.type === 'tool_call');
  }

  /** Filter events for decision type. */
  getDecisions(): Event[] {
    return this.events.filter((e) => e.type === 'decision');
  }

  /** Produce a compact text summary suitable for context injection. */
  summarize(): string {
    const parts: string[] = [];
    parts.push(`Session: ${this.metadata.sessionId}`);
    if (this.metadata.roundId) {
      parts.push(`Round: ${this.metadata.roundId}`);
    }
    parts.push(`Messages: ${this.messages.length}`);
    parts.push(`Events: ${this.events.length}`);

    const toolCalls = this.getToolCalls();
    if (toolCalls.length > 0) {
      parts.push(`Tool calls: ${toolCalls.length}`);
    }

    const decisions = this.getDecisions();
    if (decisions.length > 0) {
      const avgConf =
        decisions.reduce((sum, d) => {
          const dec = d as DecisionEvent;
          return sum + dec.confidence;
        }, 0) / decisions.length;
      parts.push(`Decisions: ${decisions.length} (avg confidence: ${avgConf.toFixed(2)})`);
    }

    const qualityEvents = this.events.filter((e) => e.type === 'quality_score');
    if (qualityEvents.length > 0) {
      const last = qualityEvents[qualityEvents.length - 1] as QualityScoreEvent;
      parts.push(`Latest quality: ${last.overall.toFixed(2)}`);
    }

    return parts.join(' | ');
  }

  /** Serialize the transcript to JSONL format. */
  serialize(): string {
    const transcript = this.build();
    const lines: string[] = [];

    // Metadata line
    lines.push(
      JSON.stringify({
        type: '_metadata',
        ...serializeMetadata(transcript.metadata),
      }),
    );

    // Message lines
    for (const msg of transcript.messages) {
      lines.push(
        JSON.stringify({
          type: '_message',
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
        }),
      );
    }

    // Event lines
    for (const event of transcript.events) {
      lines.push(
        JSON.stringify({
          ...event,
          timestamp:
            event.timestamp instanceof Date
              ? event.timestamp.toISOString()
              : event.timestamp,
        }),
      );
    }

    return lines.join('\n');
  }

  /** Deserialize a JSONL string back into a Transcript. */
  static deserialize(jsonl: string): Transcript {
    const lines = jsonl.split('\n').filter((l) => l.trim().length > 0);

    let metadata: TranscriptMetadata | undefined;
    const messages: Message[] = [];
    const events: Event[] = [];

    for (const line of lines) {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const recordType = parsed['type'] as string;

      if (recordType === '_metadata') {
        metadata = deserializeMetadata(parsed);
      } else if (recordType === '_message') {
        messages.push({
          role: parsed['role'] as Message['role'],
          content: parsed['content'] as string,
          timestamp: new Date(parsed['timestamp'] as string),
        });
      } else {
        // Event record
        events.push({
          ...parsed,
          timestamp: new Date(parsed['timestamp'] as string),
        } as unknown as Event);
      }
    }

    if (!metadata) {
      throw new Error('Missing _metadata line in JSONL transcript');
    }

    return { metadata, messages, events };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function serializeMetadata(
  meta: TranscriptMetadata,
): Record<string, unknown> {
  return {
    sessionId: meta.sessionId,
    roundId: meta.roundId,
    dispatchId: meta.dispatchId,
    agentAssignments: Object.fromEntries(meta.agentAssignments),
  };
}

function deserializeMetadata(
  parsed: Record<string, unknown>,
): TranscriptMetadata {
  const assignments = parsed['agentAssignments'] as
    | Record<string, string>
    | undefined;
  return {
    sessionId: parsed['sessionId'] as TranscriptMetadata['sessionId'],
    roundId: parsed['roundId'] as TranscriptMetadata['roundId'],
    dispatchId: parsed['dispatchId'] as TranscriptMetadata['dispatchId'],
    agentAssignments: new Map(
      Object.entries(assignments ?? {}),
    ) as unknown as TranscriptMetadata['agentAssignments'],
  };
}
