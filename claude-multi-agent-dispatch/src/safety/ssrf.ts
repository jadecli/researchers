import * as fs from 'node:fs';
import { Ok, Err, type Result } from '../types/core.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SSRFVulnerability {
  url: string;
  reason: string;
  severity: 'critical' | 'warning';
}

// ─── Private IP range patterns ──────────────────────────────────────────────

const PRIVATE_RANGES: { pattern: RegExp; description: string }[] = [
  {
    pattern: /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    description: 'Loopback address (127.0.0.0/8)',
  },
  {
    pattern: /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    description: 'Private network (10.0.0.0/8)',
  },
  {
    pattern: /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/,
    description: 'Private network (172.16.0.0/12)',
  },
  {
    pattern: /^192\.168\.\d{1,3}\.\d{1,3}$/,
    description: 'Private network (192.168.0.0/16)',
  },
  {
    pattern: /^0\.0\.0\.0$/,
    description: 'Unspecified address (0.0.0.0)',
  },
  {
    pattern: /^169\.254\.\d{1,3}\.\d{1,3}$/,
    description: 'Link-local address (169.254.0.0/16)',
  },
];

const PRIVATE_HOSTNAMES = ['localhost', '0.0.0.0', '[::1]'];

// ─── SSRFScanner ────────────────────────────────────────────────────────────

export class SSRFScanner {
  private allowlist: string[] = [];

  /**
   * Scan a single URL for SSRF vulnerabilities.
   * Returns Ok(void) if safe, Err(SSRFVulnerability) if dangerous.
   */
  scanUrl(url: string): Result<void, SSRFVulnerability> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return Err({
        url,
        reason: 'Malformed URL',
        severity: 'warning',
      });
    }

    // Check scheme
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return Err({
        url,
        reason: `Unsafe scheme: ${parsed.protocol}`,
        severity: 'critical',
      });
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check allowlist first
    if (this.allowlist.includes(hostname)) {
      return Ok(undefined);
    }

    // Check private hostnames
    for (const privateHost of PRIVATE_HOSTNAMES) {
      if (hostname === privateHost) {
        return Err({
          url,
          reason: `Private hostname: ${hostname}`,
          severity: 'critical',
        });
      }
    }

    // Check private IP ranges
    for (const { pattern, description } of PRIVATE_RANGES) {
      if (pattern.test(hostname)) {
        return Err({
          url,
          reason: `Private IP range: ${description}`,
          severity: 'critical',
        });
      }
    }

    // Check for suspicious ports
    const port = parsed.port ? parseInt(parsed.port, 10) : null;
    if (port !== null && ![80, 443, 8080, 8443].includes(port)) {
      return Err({
        url,
        reason: `Unusual port: ${port}`,
        severity: 'warning',
      });
    }

    return Ok(undefined);
  }

  /**
   * Scan content for URLs and check each for SSRF vulnerabilities.
   */
  scanContent(content: string): SSRFVulnerability[] {
    const urlPattern = /https?:\/\/[^\s<>"'{}|\\^`\[\]]+/g;
    const matches = content.match(urlPattern) ?? [];
    const vulnerabilities: SSRFVulnerability[] = [];

    for (const url of matches) {
      const result = this.scanUrl(url);
      if (!result.ok) {
        vulnerabilities.push(result.error);
      }
    }

    return vulnerabilities;
  }

  /**
   * Load an allowlist of domains from a YAML file.
   * Expects a simple `allowed_domains:` list.
   */
  loadAllowlist(yamlPath: string): string[] {
    try {
      const content = fs.readFileSync(yamlPath, 'utf-8');
      const domains: string[] = [];

      // Simple YAML parsing for allowed_domains list
      let inAllowedDomains = false;
      for (const line of content.split('\n')) {
        const trimmed = line.trim();

        if (trimmed === 'allowed_domains:') {
          inAllowedDomains = true;
          continue;
        }

        if (inAllowedDomains) {
          if (trimmed.startsWith('- ')) {
            const domain = trimmed
              .slice(2)
              .trim()
              .replace(/^['"]|['"]$/g, '');
            domains.push(domain.toLowerCase());
          } else if (trimmed.length > 0 && !trimmed.startsWith('#')) {
            // End of the list section
            inAllowedDomains = false;
          }
        }
      }

      this.allowlist = domains;
      return domains;
    } catch {
      return [];
    }
  }
}
