// src/plugin_gen/connectors-writer.ts — Generates connector JSON config files
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ConnectorSpec } from '../models/plugin-spec.js';

function injectPlaceholders(
  config: Readonly<Record<string, unknown>>,
  category: string,
): Record<string, unknown> {
  if (!category) return { ...config };

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string' && (key.includes('key') || key.includes('token') || key.includes('secret'))) {
      result[key] = `~~${category}_${key}~~`;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = injectPlaceholders(
        value as Record<string, unknown>,
        category,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function writeConnectors(
  connectors: readonly ConnectorSpec[],
  connectorsDir: string,
): void {
  const index: Record<string, unknown>[] = [];

  for (const connector of connectors) {
    const config = connector.placeholderCategory
      ? injectPlaceholders(connector.serverConfig, connector.placeholderCategory)
      : { ...connector.serverConfig };

    const entry = {
      name: connector.name,
      type: connector.type,
      config,
    };

    // Write individual connector file
    fs.writeFileSync(
      path.join(connectorsDir, `${connector.name}.json`),
      JSON.stringify(entry, null, 2) + '\n',
      'utf-8',
    );

    index.push(entry);
  }

  // Write index
  fs.writeFileSync(
    path.join(connectorsDir, 'index.json'),
    JSON.stringify(index, null, 2) + '\n',
    'utf-8',
  );
}
