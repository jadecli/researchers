// ─── ThoughtType ─────────────────────────────────────────────────────────────

export type ThoughtType =
  | 'problem_definition'
  | 'constraints'
  | 'model'
  | 'proof'
  | 'implementation';

// ─── Assumption ──────────────────────────────────────────────────────────────

export interface Assumption {
  readonly id: string;
  readonly description: string;
  status: 'active' | 'challenged' | 'invalidated';
  evidence?: string;
}

// ─── ShannonThought ──────────────────────────────────────────────────────────

export interface ShannonThought {
  readonly id: string;
  readonly type: ThoughtType;
  readonly content: string;
  confidence: number; // 0-1
  uncertainty: number; // 0-1
  readonly assumptions: Assumption[];
  readonly dependencies: readonly string[];
  readonly isRevision: boolean;
  readonly revisesThoughtId?: string;
  readonly timestamp: Date;
}

// ─── ThoughtChain ────────────────────────────────────────────────────────────

export interface ThoughtChain {
  readonly thoughts: readonly ShannonThought[];
  readonly resolvedOrder: readonly string[];
}

// ─── ThinkingReport ──────────────────────────────────────────────────────────

export interface ThinkingReport {
  readonly chain: ThoughtChain;
  readonly overallConfidence: number;
  readonly unresolvedAssumptions: readonly Assumption[];
}
