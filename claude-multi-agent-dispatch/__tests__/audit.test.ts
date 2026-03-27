import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { AuditorAgent, type AuditReport } from '../src/audit/auditor.js';
import { alignmentJudge, classifyScore } from '../src/audit/judge.js';
import { realismApprover } from '../src/audit/approver.js';
import { AuditStore } from '../src/audit/store.js';
import { AUDIT_TOOLS } from '../src/audit/tools.js';
import type { Transcript } from '../src/types/index.js';
import { toSessionId, toDispatchId, toAgentId, toAuditId, toTranscriptId } from '../src/types/index.js';

// ─── Helper: create sample transcript ───────────────────────────────────────

function createSampleTranscript(): Transcript {
  return {
    metadata: {
      sessionId: toSessionId('test-session-1'),
      dispatchId: toDispatchId('test-dispatch-1'),
      agentAssignments: new Map([[toAgentId('agent-1'), 'worker']]),
    },
    messages: [
      { role: 'user', content: 'Implement a sorting algorithm', timestamp: new Date() },
      { role: 'assistant', content: 'Here is a quicksort implementation...', timestamp: new Date() },
    ],
    events: [
      {
        type: 'tool_result' as const,
        toolCallId: 'tc-1' as any,
        content: 'The quicksort algorithm sorts an array by partitioning elements around a pivot. It has O(n log n) average time complexity.',
        isError: false,
        timestamp: new Date(),
      },
      {
        type: 'dispatch' as const,
        dispatchId: toDispatchId('test-dispatch-1'),
        taskSummary: 'Implement sorting with optimal time complexity for the given dataset requirements',
        agentIds: [toAgentId('agent-1')],
        timestamp: new Date(),
      },
    ],
  };
}

// ─── AuditorAgent ───────────────────────────────────────────────────────────

describe('AuditorAgent', () => {
  it('should review a transcript and produce an AuditReport', async () => {
    const auditor = new AuditorAgent('Implement a sorting algorithm');
    const transcript = createSampleTranscript();

    const result = await auditor.review(transcript);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const report = result.value;
      expect(report.dispatchId).toBe('test-dispatch-1');
      expect(report.auditId).toBeTruthy();
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(1);
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.recommendations.length).toBeGreaterThan(0);
    }
  });

  it('should fail on transcript without dispatchId', async () => {
    const auditor = new AuditorAgent();
    const transcript: Transcript = {
      metadata: {
        sessionId: toSessionId('test-session'),
        agentAssignments: new Map(),
      },
      messages: [],
      events: [],
    };

    const result = await auditor.review(transcript);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('dispatchId');
    }
  });

  it('should flag issues for low-quality outputs', async () => {
    const auditor = new AuditorAgent('Build a secure authentication system');
    const transcript: Transcript = {
      metadata: {
        sessionId: toSessionId('test-session-2'),
        dispatchId: toDispatchId('test-dispatch-2'),
        agentAssignments: new Map(),
      },
      messages: [],
      events: [
        {
          type: 'tool_result' as const,
          toolCallId: 'tc-2' as any,
          content: 'ok', // Very short, low quality
          isError: false,
          timestamp: new Date(),
        },
      ],
    };

    const result = await auditor.review(transcript);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Short output should get flagged
      expect(result.value.overallScore).toBeLessThan(0.8);
    }
  });
});

// ─── alignmentJudge ─────────────────────────────────────────────────────────

describe('alignmentJudge', () => {
  it('should score a relevant output higher', async () => {
    const result = await alignmentJudge(
      'The quicksort algorithm sorts elements by selecting a pivot and partitioning the array into two sub-arrays. Elements less than the pivot go left, greater go right. This process recurses on each partition.',
      'Explain the quicksort algorithm',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.score).toBeGreaterThan(0.3);
      expect(result.value.dimensions.relevance).toBeGreaterThan(0);
      expect(result.value.dimensions.accuracy).toBeGreaterThan(0);
      expect(result.value.dimensions.safety).toBeGreaterThan(0);
      expect(result.value.rationale).toBeTruthy();
    }
  });

  it('should score an empty output as 0', async () => {
    const result = await alignmentJudge('', 'Do something');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.score).toBe(0);
    }
  });

  it('should fail on empty task spec', async () => {
    const result = await alignmentJudge('Some output', '');
    expect(result.ok).toBe(false);
  });

  it('should classify scores correctly', () => {
    expect(classifyScore(0.1)).toBe('poor');
    expect(classifyScore(0.29)).toBe('poor');
    expect(classifyScore(0.3)).toBe('acceptable');
    expect(classifyScore(0.59)).toBe('acceptable');
    expect(classifyScore(0.6)).toBe('good');
    expect(classifyScore(0.79)).toBe('good');
    expect(classifyScore(0.8)).toBe('excellent');
    expect(classifyScore(1.0)).toBe('excellent');
  });

  it('should penalize hedging language', async () => {
    const confident = await alignmentJudge(
      'The answer is 42. This is the definitive result of the computation.',
      'What is the answer?',
    );
    const hedging = await alignmentJudge(
      'I think the answer might be 42. Maybe it could possibly be something else. Not sure really.',
      'What is the answer?',
    );

    expect(confident.ok && hedging.ok).toBe(true);
    if (confident.ok && hedging.ok) {
      expect(confident.value.dimensions.accuracy).toBeGreaterThan(hedging.value.dimensions.accuracy);
    }
  });
});

// ─── realismApprover ────────────────────────────────────────────────────────

describe('realismApprover', () => {
  it('should approve clean output', async () => {
    const result = await realismApprover(
      'TypeScript is a typed superset of JavaScript developed by Microsoft.',
      'Describe TypeScript',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.approved).toBe(true);
      expect(result.value.flaggedSections).toHaveLength(0);
    }
  });

  it('should flag fabricated URLs', async () => {
    const result = await realismApprover(
      'You can find more info at https://example-site1.com and https://example-doc3.org',
      'Find documentation',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.flaggedSections.length).toBeGreaterThan(0);
      const hallucinations = result.value.flaggedSections.filter((f) => f.reason === 'hallucination');
      expect(hallucinations.length).toBeGreaterThan(0);
    }
  });

  it('should flag impossible dates', async () => {
    const result = await realismApprover(
      'The event occurred on February 30, 2024 and also on April 31.',
      'When did the event happen?',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const dateErrors = result.value.flaggedSections.filter((f) => f.reason === 'factual_error');
      expect(dateErrors.length).toBeGreaterThan(0);
    }
  });

  it('should flag fabricated statistics', async () => {
    const result = await realismApprover(
      'The study found that exactly 73.847% of participants showed improvement.',
      'Report study results',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const claims = result.value.flaggedSections.filter((f) => f.reason === 'unsupported_claim');
      expect(claims.length).toBeGreaterThan(0);
    }
  });

  it('should approve empty output', async () => {
    const result = await realismApprover('', 'context');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.approved).toBe(true);
    }
  });
});

// ─── AuditStore ─────────────────────────────────────────────────────────────

describe('AuditStore', () => {
  let tempDir: string;
  let store: AuditStore;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-store-test-'));
    store = new AuditStore(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should save and load a transcript', () => {
    const transcript = createSampleTranscript();
    store.saveTranscript(transcript);

    const loaded = store.loadTranscript(toSessionId('test-session-1') as any);
    expect(loaded).toBeDefined();
    if (loaded) {
      expect(String(loaded.metadata.sessionId)).toBe('test-session-1');
    }
  });

  it('should save and query audit reports', () => {
    const report: AuditReport = {
      auditId: toAuditId('audit-1'),
      dispatchId: toDispatchId('dispatch-1'),
      agentScores: new Map([['agent-1', 0.75]]),
      overallScore: 0.75,
      flaggedIssues: [],
      recommendations: ['Looks good'],
      timestamp: new Date(),
    };

    store.saveAuditReport(report);

    const allReports = store.getAuditReports();
    expect(allReports).toHaveLength(1);
    expect(allReports[0]!.overallScore).toBe(0.75);

    const byDispatch = store.getAuditReports(toDispatchId('dispatch-1'));
    expect(byDispatch).toHaveLength(1);

    const byOther = store.getAuditReports(toDispatchId('other'));
    expect(byOther).toHaveLength(0);
  });

  it('should persist across store instances', () => {
    const report: AuditReport = {
      auditId: toAuditId('audit-persist'),
      dispatchId: toDispatchId('dispatch-persist'),
      agentScores: new Map([['agent-2', 0.8]]),
      overallScore: 0.8,
      flaggedIssues: [],
      recommendations: [],
      timestamp: new Date(),
    };

    store.saveAuditReport(report);

    // Create a new store instance pointing to same directory
    const store2 = new AuditStore(tempDir);
    const loaded = store2.getAuditReports();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.overallScore).toBe(0.8);
  });

  it('should return quality history', () => {
    const report: AuditReport = {
      auditId: toAuditId('audit-q'),
      dispatchId: toDispatchId('dispatch-q'),
      agentScores: new Map(),
      overallScore: 0.65,
      flaggedIssues: [],
      recommendations: [],
      timestamp: new Date(),
    };

    store.saveAuditReport(report);

    const history = store.getQualityHistory();
    expect(history).toHaveLength(1);
    expect(history[0]!.overall).toBe(0.65);
  });
});

// ─── Audit tool definitions ─────────────────────────────────────────────────

describe('Audit Tools', () => {
  it('should have 4 tool definitions', () => {
    expect(AUDIT_TOOLS).toHaveLength(4);
  });

  it('should have valid schemas for all tools', () => {
    for (const tool of AUDIT_TOOLS) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema['type']).toBe('object');
      expect(tool.inputSchema['properties']).toBeDefined();
      expect(tool.inputSchema['required']).toBeDefined();
      expect(typeof tool.execute).toBe('function');
    }
  });

  it('should include read_transcript, score_output, check_realism, generate_feedback', () => {
    const names = AUDIT_TOOLS.map((t) => t.name);
    expect(names).toContain('read_transcript');
    expect(names).toContain('score_output');
    expect(names).toContain('check_realism');
    expect(names).toContain('generate_feedback');
  });

  it('score_output tool should execute successfully', async () => {
    const tool = AUDIT_TOOLS.find((t) => t.name === 'score_output')!;
    const result = await tool.execute({
      output: 'The sky is blue because of Rayleigh scattering of sunlight in the atmosphere.',
      taskSpec: 'Explain why the sky is blue',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const judgment = result.value as { score: number };
      expect(judgment.score).toBeGreaterThan(0);
    }
  });

  it('check_realism tool should execute successfully', async () => {
    const tool = AUDIT_TOOLS.find((t) => t.name === 'check_realism')!;
    const result = await tool.execute({
      output: 'Normal text without hallucinations.',
      context: 'General knowledge context',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const approval = result.value as { approved: boolean };
      expect(approval.approved).toBe(true);
    }
  });

  it('generate_feedback tool should execute with valid report', async () => {
    const tool = AUDIT_TOOLS.find((t) => t.name === 'generate_feedback')!;
    const report = JSON.stringify({
      overallScore: 0.45,
      flaggedIssues: [
        { severity: 'warning', description: 'Low completeness' },
      ],
    });

    const result = await tool.execute({ auditReport: report });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const feedback = result.value as { suggestions: string[] };
      expect(feedback.suggestions.length).toBeGreaterThan(0);
    }
  });
});
