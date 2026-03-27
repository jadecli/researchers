import { Ok, Err, type Result } from '../types/index.js';
import { AuditStore } from './store.js';
import { alignmentJudge } from './judge.js';
import { realismApprover } from './approver.js';

// ─── ToolDefinition (matching project convention) ───────────────────────────

export interface AuditToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly execute: (input: Record<string, unknown>) => Promise<Result<unknown, Error>>;
}

// ─── Shared store instance ──────────────────────────────────────────────────

let sharedStore: AuditStore | null = null;

function getStore(): AuditStore {
  if (!sharedStore) {
    sharedStore = new AuditStore();
  }
  return sharedStore;
}

/**
 * Set a custom AuditStore for tool execution (useful for testing).
 */
export function setAuditStore(store: AuditStore): void {
  sharedStore = store;
}

// ─── Tool: read_transcript ──────────────────────────────────────────────────

export const readTranscriptTool: AuditToolDefinition = {
  name: 'read_transcript',
  description: 'Read a transcript by its ID from the audit store.',
  inputSchema: {
    type: 'object',
    properties: {
      transcriptId: {
        type: 'string',
        description: 'The unique identifier of the transcript to read.',
      },
    },
    required: ['transcriptId'],
  },
  execute: async (input: Record<string, unknown>): Promise<Result<unknown, Error>> => {
    const transcriptId = input['transcriptId'];
    if (typeof transcriptId !== 'string' || transcriptId.trim().length === 0) {
      return Err(new Error('transcriptId must be a non-empty string'));
    }

    const store = getStore();
    const transcript = store.loadTranscript(transcriptId as any);

    if (!transcript) {
      return Err(new Error(`Transcript not found: ${transcriptId}`));
    }

    return Ok(transcript);
  },
};

// ─── Tool: score_output ─────────────────────────────────────────────────────

export const scoreOutputTool: AuditToolDefinition = {
  name: 'score_output',
  description: 'Score an agent output against a task specification using the alignment judge.',
  inputSchema: {
    type: 'object',
    properties: {
      output: {
        type: 'string',
        description: 'The agent output to score.',
      },
      taskSpec: {
        type: 'string',
        description: 'The task specification to evaluate against.',
      },
    },
    required: ['output', 'taskSpec'],
  },
  execute: async (input: Record<string, unknown>): Promise<Result<unknown, Error>> => {
    const output = input['output'];
    const taskSpec = input['taskSpec'];

    if (typeof output !== 'string') {
      return Err(new Error('output must be a string'));
    }
    if (typeof taskSpec !== 'string') {
      return Err(new Error('taskSpec must be a string'));
    }

    return alignmentJudge(output, taskSpec);
  },
};

// ─── Tool: check_realism ────────────────────────────────────────────────────

export const checkRealismTool: AuditToolDefinition = {
  name: 'check_realism',
  description: 'Check an output for hallucinations, fabricated facts, and logical inconsistencies.',
  inputSchema: {
    type: 'object',
    properties: {
      output: {
        type: 'string',
        description: 'The output text to check for realism.',
      },
      context: {
        type: 'string',
        description: 'Context information to verify against.',
      },
    },
    required: ['output', 'context'],
  },
  execute: async (input: Record<string, unknown>): Promise<Result<unknown, Error>> => {
    const output = input['output'];
    const context = input['context'];

    if (typeof output !== 'string') {
      return Err(new Error('output must be a string'));
    }
    if (typeof context !== 'string') {
      return Err(new Error('context must be a string'));
    }

    return realismApprover(output, context);
  },
};

// ─── Tool: generate_feedback ────────────────────────────────────────────────

export const generateFeedbackTool: AuditToolDefinition = {
  name: 'generate_feedback',
  description: 'Generate improvement suggestions based on an audit report.',
  inputSchema: {
    type: 'object',
    properties: {
      auditReport: {
        type: 'string',
        description: 'JSON-serialized audit report to generate feedback from.',
      },
    },
    required: ['auditReport'],
  },
  execute: async (input: Record<string, unknown>): Promise<Result<unknown, Error>> => {
    const reportStr = input['auditReport'];

    if (typeof reportStr !== 'string') {
      return Err(new Error('auditReport must be a JSON string'));
    }

    try {
      const report = JSON.parse(reportStr) as Record<string, unknown>;

      const overallScore = (report['overallScore'] as number) ?? 0;
      const flaggedIssues = (report['flaggedIssues'] as Array<Record<string, unknown>>) ?? [];
      const suggestions: string[] = [];

      // Generate suggestions based on score
      if (overallScore < 0.3) {
        suggestions.push('Critical quality issues. Consider a full re-dispatch with different agent configuration.');
        suggestions.push('Review task specification for clarity and completeness.');
      } else if (overallScore < 0.6) {
        suggestions.push('Moderate quality. Focus on the specific dimensions that scored lowest.');
        suggestions.push('Consider adding more context or constraints to the task specification.');
      } else if (overallScore < 0.8) {
        suggestions.push('Good quality. Minor refinements needed.');
      } else {
        suggestions.push('Excellent quality. No significant improvements needed.');
      }

      // Generate suggestions based on flagged issues
      const criticalCount = flaggedIssues.filter((i) => i['severity'] === 'critical').length;
      const warningCount = flaggedIssues.filter((i) => i['severity'] === 'warning').length;

      if (criticalCount > 0) {
        suggestions.push(`${criticalCount} critical issue(s) require immediate attention.`);
      }
      if (warningCount > 0) {
        suggestions.push(`${warningCount} warning(s) should be reviewed and addressed.`);
      }

      // Check for recurring patterns in issues
      const reasons = flaggedIssues.map((i) => String(i['description'] ?? ''));
      const hallucinationIssues = reasons.filter((r) => r.includes('hallucin') || r.includes('realism'));
      if (hallucinationIssues.length > 0) {
        suggestions.push('Enable stronger fact-checking: multiple hallucination/realism flags detected.');
      }

      const safetyIssues = reasons.filter((r) => r.includes('safety') || r.includes('Safety'));
      if (safetyIssues.length > 0) {
        suggestions.push('Add safety constraints to dispatch configuration.');
      }

      return Ok({
        suggestions,
        overallScore,
        issueCount: flaggedIssues.length,
        criticalCount,
        warningCount,
      });
    } catch (parseErr) {
      return Err(new Error(`Failed to parse audit report: ${String(parseErr)}`));
    }
  },
};

// ─── All audit tools ────────────────────────────────────────────────────────

export const AUDIT_TOOLS: readonly AuditToolDefinition[] = [
  readTranscriptTool,
  scoreOutputTool,
  checkRealismTool,
  generateFeedbackTool,
];
