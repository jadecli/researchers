import { SSRFScanner } from './ssrf.js';
import { PIIScanner } from './pii.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Finding {
  type: 'ssrf' | 'pii' | 'injection' | 'unsafe_pattern';
  severity: 'critical' | 'warning' | 'info';
  detail: string;
  location?: string;
}

export interface ValidationResult {
  valid: boolean;
  findings: Finding[];
}

// ─── Injection patterns ─────────────────────────────────────────────────────

const INJECTION_PATTERNS: { pattern: RegExp; detail: string; severity: Finding['severity'] }[] = [
  {
    pattern: /\bsystem\s*\(\s*["'`]/i,
    detail: 'Potential command injection via system() call',
    severity: 'critical',
  },
  {
    pattern: /\bexec\s*\(\s*["'`]/i,
    detail: 'Potential command injection via exec() call',
    severity: 'critical',
  },
  {
    pattern: /\beval\s*\(\s*["'`]/i,
    detail: 'Potential code injection via eval() call',
    severity: 'critical',
  },
  {
    pattern: /;\s*(?:rm|del|format|mkfs)\s/i,
    detail: 'Potential destructive command injection',
    severity: 'critical',
  },
  {
    pattern: /\|\s*(?:bash|sh|cmd|powershell)\b/i,
    detail: 'Pipe to shell detected',
    severity: 'critical',
  },
  {
    pattern: /<script[^>]*>/i,
    detail: 'HTML script tag injection',
    severity: 'warning',
  },
  {
    pattern: /on(?:load|error|click)\s*=/i,
    detail: 'HTML event handler injection',
    severity: 'warning',
  },
  {
    pattern: /(?:UNION\s+SELECT|OR\s+1\s*=\s*1|DROP\s+TABLE)/i,
    detail: 'SQL injection pattern detected',
    severity: 'critical',
  },
  {
    pattern: /\{\{.*\}\}/,
    detail: 'Template injection pattern detected',
    severity: 'warning',
  },
];

// ─── DispatchValidator ──────────────────────────────────────────────────────

export class DispatchValidator {
  private readonly ssrfScanner: SSRFScanner;
  private readonly piiScanner: PIIScanner;

  constructor() {
    this.ssrfScanner = new SSRFScanner();
    this.piiScanner = new PIIScanner();
  }

  /**
   * Validate a task before dispatch.
   * Checks for injection patterns and unsafe URLs.
   */
  validatePreDispatch(task: string): ValidationResult {
    const findings: Finding[] = [];

    // Check injection patterns
    for (const { pattern, detail, severity } of INJECTION_PATTERNS) {
      const match = task.match(pattern);
      if (match) {
        findings.push({
          type: 'injection',
          severity,
          detail,
          location: `position ${match.index}`,
        });
      }
    }

    // Check for SSRF in URLs found in the task
    const ssrfVulns = this.ssrfScanner.scanContent(task);
    for (const vuln of ssrfVulns) {
      findings.push({
        type: 'ssrf',
        severity: vuln.severity,
        detail: `${vuln.reason}: ${vuln.url}`,
        location: vuln.url,
      });
    }

    return {
      valid: !findings.some((f) => f.severity === 'critical'),
      findings,
    };
  }

  /**
   * Validate output after dispatch.
   * Scans for PII and validates URLs in the output.
   */
  validatePostDispatch(output: string): ValidationResult {
    const findings: Finding[] = [];

    // Scan for PII
    const piiMatches = this.piiScanner.scan(output);
    for (const match of piiMatches) {
      findings.push({
        type: 'pii',
        severity: match.confidence >= 0.8 ? 'critical' : 'warning',
        detail: `${match.type} detected: ${match.redacted}`,
        location: `position ${match.position}`,
      });
    }

    // Scan for unsafe URLs in output
    const ssrfVulns = this.ssrfScanner.scanContent(output);
    for (const vuln of ssrfVulns) {
      findings.push({
        type: 'ssrf',
        severity: vuln.severity,
        detail: `Output contains internal URL: ${vuln.url}`,
        location: vuln.url,
      });
    }

    // Check for unsafe patterns in output
    const unsafePatterns = [
      { pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/i, detail: 'Private key exposed in output' },
      { pattern: /password\s*[:=]\s*["'][^"']{3,}["']/i, detail: 'Password literal in output' },
    ];

    for (const { pattern, detail } of unsafePatterns) {
      if (pattern.test(output)) {
        findings.push({
          type: 'unsafe_pattern',
          severity: 'critical',
          detail,
        });
      }
    }

    return {
      valid: !findings.some((f) => f.severity === 'critical'),
      findings,
    };
  }
}
