// src/channel/server.ts — MCP Channel Server
//
// Implements the claude/channel and claude/channel/permission capabilities.
// Webhook HTTP listener for inbound messages + SSE stream for outbound.
// Boris Cherny: Result<T,E>, branded types, exhaustive matching.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  type ChannelEvent,
  type PermissionRequest,
  type PermissionVerdict,
  type ChannelConfig,
  type SenderId,
  toSenderId,
  toChatId,
  toRequestId,
  parseVerdict,
} from './types.js';
import { SenderGate } from './gating.js';

// ── Configuration ─────────────────────────────────────────────

const DEFAULT_PORT = 8788;
const DEFAULT_HOSTNAME = '127.0.0.1';
const DEFAULT_ACCESS_PATH = join(
  homedir(),
  '.claude',
  'channels',
  'dispatch',
  'access.json',
);

function loadConfig(): ChannelConfig {
  const portEnv = process.env['CHANNEL_PORT'];
  const port = portEnv !== undefined ? parseInt(portEnv, 10) : DEFAULT_PORT;
  const hostname = process.env['CHANNEL_HOST'] ?? DEFAULT_HOSTNAME;
  const accessPath = process.env['CHANNEL_ACCESS_PATH'] ?? DEFAULT_ACCESS_PATH;
  const gate = SenderGate.create(accessPath);

  return {
    port: Number.isFinite(port) ? port : DEFAULT_PORT,
    hostname,
    allowlist: [...gate.getAllowed()],
  };
}

// ── Instructions ──────────────────────────────────────────────

const INSTRUCTIONS = `You are connected to a dispatch channel.

When you receive a channel event (notifications/claude/channel/event), read the
message content and respond using the "reply" tool with the appropriate chat_id.

When you receive a permission request (notifications/claude/channel/permission_request),
format it clearly for the human and wait for their yes/no verdict before proceeding.

Always address the sender by their source identifier. Keep replies concise and
actionable. If a message is from an unknown sender, ignore it silently.`;

// ── SSE Client Registry ──────────────────────────────────────

type SSEClient = {
  readonly id: string;
  readonly response: ServerResponse;
};

const sseClients: SSEClient[] = [];
let sseIdCounter = 0;

function broadcastSSE(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.response.write(payload);
    } catch {
      // Client disconnected — will be cleaned up on close.
    }
  }
}

// ── MCP Server Setup ─────────────────────────────────────────

function createChannelServer(): Server {
  const server = new Server(
    {
      name: 'dispatch-channel',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        notifications: {},
      },
    },
  );

  // ── List Tools ────────────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
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
      },
    ],
  }));

  // ── Call Tool ─────────────────────────────────────────────

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name !== 'reply') {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    const chatId = typeof args?.['chat_id'] === 'string' ? args['chat_id'] : '';
    const text = typeof args?.['text'] === 'string' ? args['text'] : '';

    if (chatId.length === 0 || text.length === 0) {
      return {
        content: [{ type: 'text', text: 'Both chat_id and text are required.' }],
        isError: true,
      };
    }

    // Broadcast reply over SSE to connected listeners.
    broadcastSSE('channel:reply', {
      chatId: toChatId(chatId),
      text,
      timestamp: new Date().toISOString(),
    });

    return {
      content: [{ type: 'text', text: `Reply sent to ${chatId}.` }],
    };
  });

  return server;
}

// ── Permission Relay ─────────────────────────────────────────

function relayPermissionRequest(
  server: Server,
  request: PermissionRequest,
): void {
  const prompt = [
    `🔒 Permission request [${request.requestId as string}]`,
    `Tool: ${request.toolName}`,
    `Description: ${request.description}`,
    `Input preview: ${request.inputPreview}`,
    '',
    `Reply "yes ${request.requestId as string}" to approve or "no ${request.requestId as string}" to deny.`,
  ].join('\n');

  broadcastSSE('channel:permission_request', {
    requestId: request.requestId,
    toolName: request.toolName,
    description: request.description,
    inputPreview: request.inputPreview,
    prompt,
  });
}

function handlePermissionVerdict(
  server: Server,
  verdict: PermissionVerdict,
): void {
  // Emit permission verdict notification back to the MCP host.
  server.notification({
    method: 'notifications/claude/channel/permission',
    params: {
      requestId: verdict.requestId,
      behavior: verdict.behavior,
    },
  });

  broadcastSSE('channel:permission_verdict', {
    requestId: verdict.requestId,
    behavior: verdict.behavior,
  });
}

// ── HTTP Webhook Server ──────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function startHttpServer(
  server: Server,
  config: ChannelConfig,
  gate: SenderGate,
): void {
  const httpServer = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url ?? '/';
      const method = req.method ?? 'GET';

      // ── SSE Endpoint ────────────────────────────────────
      if (method === 'GET' && url === '/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        const clientId = String(++sseIdCounter);
        const client: SSEClient = { id: clientId, response: res };
        sseClients.push(client);

        // Send initial heartbeat.
        res.write(`event: connected\ndata: {"clientId":"${clientId}"}\n\n`);

        req.on('close', () => {
          const idx = sseClients.findIndex((c) => c.id === clientId);
          if (idx !== -1) {
            sseClients.splice(idx, 1);
          }
        });

        return;
      }

      // ── Inbound Message Endpoint ────────────────────────
      if (method === 'POST' && url === '/') {
        try {
          const body = await readBody(req);
          const payload = JSON.parse(body) as {
            sender?: string;
            content?: string;
            meta?: Record<string, string>;
            type?: string;
            request_id?: string;
            tool_name?: string;
            description?: string;
            input_preview?: string;
          };

          // Handle permission request relay from MCP host.
          if (payload.type === 'permission_request') {
            const permReq: PermissionRequest = {
              requestId: toRequestId(payload.request_id ?? ''),
              toolName: payload.tool_name ?? '',
              description: payload.description ?? '',
              inputPreview: payload.input_preview ?? '',
            };

            relayPermissionRequest(server, permReq);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, relayed: true }));
            return;
          }

          // Sender gating — reject unknown senders.
          const senderId = toSenderId(payload.sender ?? '');
          if (!gate.isAllowed(senderId)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({ ok: false, error: 'sender_not_allowed' }),
            );
            return;
          }

          const content = payload.content ?? '';

          // Check if this is a permission verdict.
          const verdictResult = parseVerdict(content);
          if (verdictResult.ok) {
            handlePermissionVerdict(server, verdictResult.value);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                ok: true,
                verdict: verdictResult.value.behavior,
              }),
            );
            return;
          }

          // Regular channel event.
          const event: ChannelEvent = {
            source: senderId,
            content,
            meta: Object.freeze(payload.meta ?? {}),
          };

          // Emit channel event notification to MCP host.
          server.notification({
            method: 'notifications/claude/channel/event',
            params: {
              source: event.source,
              content: event.content,
              meta: event.meta,
            },
          });

          broadcastSSE('channel:event', event);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              ok: false,
              error: err instanceof Error ? err.message : 'bad_request',
            }),
          );
        }
        return;
      }

      // ── Health Check ────────────────────────────────────
      if (method === 'GET' && url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: true,
            server: 'dispatch-channel',
            sseClients: sseClients.length,
          }),
        );
        return;
      }

      // ── 404 ─────────────────────────────────────────────
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'not_found' }));
    },
  );

  httpServer.listen(config.port, config.hostname, () => {
    console.error(
      `[dispatch-channel] HTTP server listening on ${config.hostname}:${config.port}`,
    );
  });
}

// ── Main ──────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config = loadConfig();
  const accessPath = process.env['CHANNEL_ACCESS_PATH'] ?? DEFAULT_ACCESS_PATH;
  const gate = SenderGate.create(accessPath);

  const server = createChannelServer();
  const transport = new StdioServerTransport();

  // Handle permission request notifications from the MCP host.
  server.setNotificationHandler(
    {
      method: 'notifications/claude/channel/permission_request',
    } as { method: string },
    async (notification) => {
      const params = notification.params as {
        request_id?: string;
        tool_name?: string;
        description?: string;
        input_preview?: string;
      };

      const permReq: PermissionRequest = {
        requestId: toRequestId(params.request_id ?? ''),
        toolName: params.tool_name ?? '',
        description: params.description ?? '',
        inputPreview: params.input_preview ?? '',
      };

      relayPermissionRequest(server, permReq);
    },
  );

  // Start the HTTP webhook server for inbound messages + SSE.
  startHttpServer(server, config, gate);

  // Connect MCP via stdio transport.
  await server.connect(transport);
  console.error('[dispatch-channel] MCP server connected via stdio');
}

main().catch((err) => {
  console.error('[dispatch-channel] Fatal error:', err);
  process.exit(1);
});

// ── Exports for Testing ───────────────────────────────────────

export {
  createChannelServer,
  relayPermissionRequest,
  handlePermissionVerdict,
  broadcastSSE,
  INSTRUCTIONS,
  type SSEClient,
};
