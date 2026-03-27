// src/plugin_gen/hooks-writer.ts — Generates hook configuration JSON
import * as fs from 'node:fs';
import * as path from 'node:path';

const VALID_EVENTS = [
  'PreToolExecution',
  'PostToolExecution',
  'Notification',
  'Stop',
  'SubagentSpawn',
] as const;

type HookEvent = (typeof VALID_EVENTS)[number];

const VALID_HANDLER_TYPES = ['command', 'script', 'webhook'] as const;

function isValidEvent(event: string): event is HookEvent {
  return (VALID_EVENTS as readonly string[]).includes(event);
}

function isValidHandler(handler: Record<string, unknown>): boolean {
  const type = handler['type'];
  return (
    typeof type === 'string' &&
    (VALID_HANDLER_TYPES as readonly string[]).includes(type)
  );
}

export function writeHooks(
  hooks: Readonly<Record<string, readonly Record<string, unknown>[]>>,
  hooksDir: string,
): void {
  const normalized: Record<string, Record<string, unknown>[]> = {};

  for (const [event, handlers] of Object.entries(hooks)) {
    if (!isValidEvent(event)) continue;

    const validHandlers = handlers.filter(isValidHandler);
    if (validHandlers.length > 0) {
      normalized[event] = validHandlers.map((h) => ({ ...h }));
    }
  }

  fs.writeFileSync(
    path.join(hooksDir, 'hooks.json'),
    JSON.stringify(normalized, null, 2) + '\n',
    'utf-8',
  );
}
