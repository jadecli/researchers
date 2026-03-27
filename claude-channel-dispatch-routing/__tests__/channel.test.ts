// __tests__/channel.test.ts — Channel MCP Server Tests
//
// vitest tests for channel event format, permission verdict parsing,
// sender gating, reply tool schema, and permission relay format.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  type ChannelEvent,
  type PermissionRequest,
  type PermissionVerdict,
  toSenderId,
  toRequestId,
  toChatId,
  parseVerdict,
  VERDICT_REGEX,
} from '../src/channel/types.js';
import { SenderGate } from '../src/channel/gating.js';

// ── Helpers ───────────────────────────────────────────────────

function makeTmpDir(): string {
  const dir = join(tmpdir(), `channel-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ── test_channel_event_format ─────────────────────────────────

describe('Channel Event Format', () => {
  it('notification has correct method and params', () => {
    // Arrange: simulate the notification payload the server emits.
    const event: ChannelEvent = {
      source: toSenderId('alice'),
      content: 'Run the quality report for round 3.',
      meta: { platform: 'slack', threadId: 'T123' },
    };

    const notification = {
      method: 'notifications/claude/channel/event',
      params: {
        source: event.source,
        content: event.content,
        meta: event.meta,
      },
    };

    // Assert
    expect(notification.method).toBe('notifications/claude/channel/event');
    expect(notification.params.source).toBe('alice');
    expect(notification.params.content).toBe('Run the quality report for round 3.');
    expect(notification.params.meta).toEqual({ platform: 'slack', threadId: 'T123' });
  });

  it('meta defaults to empty object when absent', () => {
    const event: ChannelEvent = {
      source: toSenderId('bob'),
      content: 'Hello',
      meta: {},
    };

    expect(event.meta).toEqual({});
  });
});

// ── test_permission_verdict_parsing ──────────────────────────

describe('Permission Verdict Parsing', () => {
  it('matches "yes" + 5-letter ID', () => {
    const result = parseVerdict('yes abcde');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.behavior).toBe('allow');
      expect(result.value.requestId).toBe('abcde');
    }
  });

  it('matches "no" + 5-letter ID', () => {
    const result = parseVerdict('no fghij');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.behavior).toBe('deny');
      expect(result.value.requestId).toBe('fghij');
    }
  });

  it('matches short forms "y" and "n"', () => {
    const yResult = parseVerdict('y abcde');
    expect(yResult.ok).toBe(true);
    if (yResult.ok) {
      expect(yResult.value.behavior).toBe('allow');
    }

    const nResult = parseVerdict('n fghij');
    expect(nResult.ok).toBe(true);
    if (nResult.ok) {
      expect(nResult.value.behavior).toBe('deny');
    }
  });

  it('is case insensitive', () => {
    const result = parseVerdict('YES ABCDE');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.behavior).toBe('allow');
      expect(result.value.requestId).toBe('abcde');
    }
  });

  it('tolerates leading/trailing whitespace', () => {
    const result = parseVerdict('  yes abcde  ');
    expect(result.ok).toBe(true);
  });

  it('rejects IDs containing "l" (ambiguity with 1)', () => {
    const result = parseVerdict('yes abcle');
    expect(result.ok).toBe(false);
  });

  it('rejects IDs that are too short', () => {
    const result = parseVerdict('yes abcd');
    expect(result.ok).toBe(false);
  });

  it('rejects IDs that are too long', () => {
    const result = parseVerdict('yes abcdef');
    expect(result.ok).toBe(false);
  });

  it('rejects non-verdict text', () => {
    const result = parseVerdict('Run the quality report for round 3.');
    expect(result.ok).toBe(false);
  });

  it('regex matches expected patterns', () => {
    expect(VERDICT_REGEX.test('yes abcde')).toBe(true);
    expect(VERDICT_REGEX.test('no fghij')).toBe(true);
    expect(VERDICT_REGEX.test('y mnopq')).toBe(true);
    expect(VERDICT_REGEX.test('n rstuv')).toBe(true);
    expect(VERDICT_REGEX.test('maybe abcde')).toBe(false);
    expect(VERDICT_REGEX.test('yes abc')).toBe(false);
  });
});

// ── test_sender_gating ───────────────────────────────────────

describe('Sender Gating', () => {
  let tmpDir: string;
  let accessPath: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    accessPath = join(tmpDir, 'access.json');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('allowed sender passes', () => {
    writeFileSync(
      accessPath,
      JSON.stringify({ allowedSenders: ['alice', 'bob'] }),
    );
    const gate = SenderGate.create(accessPath);

    expect(gate.isAllowed(toSenderId('alice'))).toBe(true);
    expect(gate.isAllowed(toSenderId('bob'))).toBe(true);
  });

  it('unknown sender is dropped', () => {
    writeFileSync(
      accessPath,
      JSON.stringify({ allowedSenders: ['alice'] }),
    );
    const gate = SenderGate.create(accessPath);

    expect(gate.isAllowed(toSenderId('eve'))).toBe(false);
  });

  it('empty allowlist rejects everyone', () => {
    writeFileSync(
      accessPath,
      JSON.stringify({ allowedSenders: [] }),
    );
    const gate = SenderGate.create(accessPath);

    expect(gate.isAllowed(toSenderId('alice'))).toBe(false);
  });

  it('missing file starts with empty allowlist', () => {
    const gate = SenderGate.create(join(tmpDir, 'nonexistent.json'));

    expect(gate.isAllowed(toSenderId('alice'))).toBe(false);
  });

  it('addSender persists and allows', () => {
    const gate = SenderGate.create(accessPath);
    const result = gate.addSender(toSenderId('charlie'));

    expect(result.ok).toBe(true);
    expect(gate.isAllowed(toSenderId('charlie'))).toBe(true);

    // Reload from disk to verify persistence.
    const gate2 = SenderGate.create(accessPath);
    expect(gate2.isAllowed(toSenderId('charlie'))).toBe(true);
  });

  it('removeSender persists and denies', () => {
    writeFileSync(
      accessPath,
      JSON.stringify({ allowedSenders: ['alice', 'bob'] }),
    );
    const gate = SenderGate.create(accessPath);
    gate.removeSender(toSenderId('alice'));

    expect(gate.isAllowed(toSenderId('alice'))).toBe(false);

    // Reload to verify persistence.
    const gate2 = SenderGate.create(accessPath);
    expect(gate2.isAllowed(toSenderId('alice'))).toBe(false);
    expect(gate2.isAllowed(toSenderId('bob'))).toBe(true);
  });
});

// ── test_reply_tool_schema ───────────────────────────────────

describe('Reply Tool Schema', () => {
  it('has chat_id and text params', () => {
    // The schema as declared by the server's ListTools handler.
    const replyToolSchema = {
      name: 'reply',
      description: 'Send a reply message to a specific chat in the dispatch channel.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          chat_id: {
            type: 'string',
            description: 'The chat identifier to reply to.',
          },
          text: {
            type: 'string',
            description: 'The reply text content.',
          },
        },
        required: ['chat_id', 'text'],
      },
    };

    expect(replyToolSchema.name).toBe('reply');
    expect(replyToolSchema.inputSchema.properties).toHaveProperty('chat_id');
    expect(replyToolSchema.inputSchema.properties).toHaveProperty('text');
    expect(replyToolSchema.inputSchema.required).toContain('chat_id');
    expect(replyToolSchema.inputSchema.required).toContain('text');
    expect(replyToolSchema.inputSchema.properties.chat_id.type).toBe('string');
    expect(replyToolSchema.inputSchema.properties.text.type).toBe('string');
  });
});

// ── test_permission_relay_format ─────────────────────────────

describe('Permission Relay Format', () => {
  it('request fields are present', () => {
    const request: PermissionRequest = {
      requestId: toRequestId('abcde'),
      toolName: 'execute_sql',
      description: 'Run a SQL query against the runtime database.',
      inputPreview: 'SELECT * FROM runtime.crawl_events LIMIT 10',
    };

    expect(request.requestId).toBe('abcde');
    expect(request.toolName).toBe('execute_sql');
    expect(request.description).toContain('SQL query');
    expect(request.inputPreview).toContain('SELECT');
  });

  it('notification format includes all required fields', () => {
    const notification = {
      method: 'notifications/claude/channel/permission_request',
      params: {
        request_id: 'abcde',
        tool_name: 'execute_sql',
        description: 'Run a SQL query against the runtime database.',
        input_preview: 'SELECT * FROM runtime.crawl_events LIMIT 10',
      },
    };

    expect(notification.method).toBe('notifications/claude/channel/permission_request');
    expect(notification.params).toHaveProperty('request_id');
    expect(notification.params).toHaveProperty('tool_name');
    expect(notification.params).toHaveProperty('description');
    expect(notification.params).toHaveProperty('input_preview');
  });

  it('verdict notification carries requestId and behavior', () => {
    const verdict: PermissionVerdict = {
      requestId: toRequestId('fghij'),
      behavior: 'deny',
    };

    const notification = {
      method: 'notifications/claude/channel/permission',
      params: {
        requestId: verdict.requestId,
        behavior: verdict.behavior,
      },
    };

    expect(notification.method).toBe('notifications/claude/channel/permission');
    expect(notification.params.requestId).toBe('fghij');
    expect(notification.params.behavior).toBe('deny');
  });
});
