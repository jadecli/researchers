import { describe, it, expect } from 'vitest';
import { SSRFScanner } from '../src/safety/ssrf.js';
import { PIIScanner, luhnCheck } from '../src/safety/pii.js';
import { DispatchValidator } from '../src/safety/validator.js';

// ─── SSRFScanner tests ──────────────────────────────────────────────────────

describe('SSRFScanner', () => {
  const scanner = new SSRFScanner();

  it('should block localhost', () => {
    const result = scanner.scanUrl('http://localhost:8080/api');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.severity).toBe('critical');
    }
  });

  it('should block 127.x.x.x addresses', () => {
    const result = scanner.scanUrl('http://127.0.0.1/internal');
    expect(result.ok).toBe(false);
  });

  it('should block 10.x.x.x addresses', () => {
    const result = scanner.scanUrl('http://10.0.0.1/internal');
    expect(result.ok).toBe(false);
  });

  it('should block 172.16.x.x addresses', () => {
    const result = scanner.scanUrl('http://172.16.0.1/internal');
    expect(result.ok).toBe(false);
  });

  it('should block 192.168.x.x addresses', () => {
    const result = scanner.scanUrl('http://192.168.1.1/router');
    expect(result.ok).toBe(false);
  });

  it('should block 0.0.0.0', () => {
    const result = scanner.scanUrl('http://0.0.0.0:3000');
    expect(result.ok).toBe(false);
  });

  it('should allow public URLs', () => {
    const result = scanner.scanUrl('https://github.com/anthropics/sdk');
    expect(result.ok).toBe(true);
  });

  it('should allow HTTPS URLs on standard ports', () => {
    const result = scanner.scanUrl('https://api.anthropic.com/v1/messages');
    expect(result.ok).toBe(true);
  });

  it('should warn on unusual ports', () => {
    const result = scanner.scanUrl('http://example.com:9999/api');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.severity).toBe('warning');
    }
  });

  it('should scan content for embedded URLs', () => {
    const content = `
      Visit http://localhost:3000 for the dev server.
      Also see https://github.com/test for docs.
      And http://10.0.0.5/admin for internal.
    `;
    const vulns = scanner.scanContent(content);
    expect(vulns.length).toBeGreaterThanOrEqual(2); // localhost + 10.0.0.5
  });

  it('should block non-http schemes', () => {
    const result = scanner.scanUrl('file:///etc/passwd');
    expect(result.ok).toBe(false);
  });
});

// ─── PIIScanner tests ───────────────────────────────────────────────────────

describe('PIIScanner', () => {
  const scanner = new PIIScanner();

  it('should detect email addresses', () => {
    const matches = scanner.scan('Contact us at test@example.com for info');
    const emails = matches.filter((m) => m.type === 'email');
    expect(emails).toHaveLength(1);
    expect(emails[0]!.value).toBe('test@example.com');
  });

  it('should detect phone numbers', () => {
    const matches = scanner.scan('Call 555-123-4567 for support');
    const phones = matches.filter((m) => m.type === 'phone');
    expect(phones).toHaveLength(1);
  });

  it('should detect SSNs', () => {
    const matches = scanner.scan('SSN: 123-45-6789');
    const ssns = matches.filter((m) => m.type === 'ssn');
    expect(ssns).toHaveLength(1);
    expect(ssns[0]!.value).toBe('123-45-6789');
  });

  it('should detect credit cards with valid Luhn', () => {
    // 4111111111111111 is a valid test Visa number
    const matches = scanner.scan('Card: 4111111111111111');
    const cards = matches.filter((m) => m.type === 'credit_card');
    expect(cards).toHaveLength(1);
  });

  it('should reject credit cards with invalid Luhn', () => {
    const matches = scanner.scan('Card: 1234567890123456');
    const cards = matches.filter((m) => m.type === 'credit_card');
    expect(cards).toHaveLength(0);
  });

  it('should detect API keys', () => {
    const matches = scanner.scan('key: sk-abc12345678901234567890');
    const keys = matches.filter((m) => m.type === 'api_key');
    expect(keys).toHaveLength(1);
  });

  it('should detect JWT tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.abc123def456ghi789';
    const matches = scanner.scan(`Token: ${jwt}`);
    const jwts = matches.filter((m) => m.type === 'jwt');
    expect(jwts).toHaveLength(1);
  });

  it('should redact all PII in content', () => {
    const content = 'Email: test@example.com, SSN: 123-45-6789';
    const redacted = scanner.redact(content);
    expect(redacted).not.toContain('test@example.com');
    expect(redacted).not.toContain('123-45-6789');
    expect(redacted).toContain('[REDACTED:email]');
    expect(redacted).toContain('[REDACTED:ssn]');
  });
});

// ─── luhnCheck tests ────────────────────────────────────────────────────────

describe('luhnCheck', () => {
  it('should validate correct Luhn numbers', () => {
    expect(luhnCheck('4111111111111111')).toBe(true); // Visa test
    expect(luhnCheck('5500000000000004')).toBe(true); // MC test
  });

  it('should reject invalid Luhn numbers', () => {
    expect(luhnCheck('1234567890123456')).toBe(false);
    expect(luhnCheck('0000000000000000')).toBe(true); // technically valid
  });

  it('should reject short numbers', () => {
    expect(luhnCheck('411111')).toBe(false);
  });

  it('should reject non-digit strings', () => {
    expect(luhnCheck('abcdefghijklm')).toBe(false);
  });
});

// ─── DispatchValidator tests ────────────────────────────────────────────────

describe('DispatchValidator', () => {
  const validator = new DispatchValidator();

  describe('validatePreDispatch', () => {
    it('should pass clean task', () => {
      const result = validator.validatePreDispatch(
        'Analyze the TypeScript code in the repository and produce a summary.',
      );
      expect(result.valid).toBe(true);
      expect(result.findings).toHaveLength(0);
    });

    it('should detect injection patterns', () => {
      const result = validator.validatePreDispatch(
        'Run this: system("rm -rf /")',
      );
      expect(result.valid).toBe(false);
      expect(result.findings.some((f) => f.type === 'injection')).toBe(true);
    });

    it('should detect SQL injection', () => {
      const result = validator.validatePreDispatch(
        "Process: ' OR 1=1 --",
      );
      expect(result.valid).toBe(false);
    });

    it('should detect SSRF in task URLs', () => {
      const result = validator.validatePreDispatch(
        'Fetch data from http://localhost:8080/admin',
      );
      expect(result.findings.some((f) => f.type === 'ssrf')).toBe(true);
    });
  });

  describe('validatePostDispatch', () => {
    it('should pass clean output', () => {
      const result = validator.validatePostDispatch(
        '# Analysis Results\n\nThe code is well-structured and follows best practices.',
      );
      expect(result.valid).toBe(true);
    });

    it('should detect PII in output', () => {
      const result = validator.validatePostDispatch(
        'The user email is admin@internal.com and SSN is 123-45-6789',
      );
      expect(result.findings.some((f) => f.type === 'pii')).toBe(true);
    });

    it('should detect private keys in output', () => {
      const result = validator.validatePostDispatch(
        '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----',
      );
      expect(result.valid).toBe(false);
      expect(result.findings.some((f) => f.type === 'unsafe_pattern')).toBe(true);
    });

    it('should detect internal URLs in output', () => {
      const result = validator.validatePostDispatch(
        'The API is at http://10.0.0.5:3000/api/v1',
      );
      expect(result.findings.some((f) => f.type === 'ssrf')).toBe(true);
    });
  });
});
