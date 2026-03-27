// ─── Types ──────────────────────────────────────────────────────────────────

export interface PIIMatch {
  type: string;
  value: string;
  redacted: string;
  position: number;
  confidence: number;
}

interface PIIPattern {
  type: string;
  regex: RegExp;
  confidence: number;
  validate?: (match: string) => boolean;
  redactFn?: (match: string) => string;
}

// ─── Default PII patterns ───────────────────────────────────────────────────

const DEFAULT_PATTERNS: PIIPattern[] = [
  {
    type: 'email',
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    confidence: 0.9,
    redactFn: (m) => `${m[0]}***@${m.split('@')[1]?.replace(/./g, '*') ?? '***'}`,
  },
  {
    type: 'ssn',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    confidence: 0.95,
    redactFn: () => '***-**-****',
  },
  {
    type: 'credit_card',
    regex: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
    confidence: 0.85,
    validate: (match) => {
      const digits = match.replace(/[- ]/g, '');
      return luhnCheck(digits);
    },
    redactFn: (m) => {
      const digits = m.replace(/[- ]/g, '');
      return `****-****-****-${digits.slice(-4)}`;
    },
  },
  {
    type: 'phone',
    regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    confidence: 0.7,
    redactFn: (m) => {
      const digits = m.replace(/[-. ]/g, '');
      return `(***) ***-${digits.slice(-4)}`;
    },
  },
  {
    type: 'api_key',
    regex: /\b(?:sk-|pk_|api[_-]?key)[a-zA-Z0-9]{20,}\b/gi,
    confidence: 0.9,
    redactFn: (m) => `${m.slice(0, 4)}${'*'.repeat(Math.min(20, m.length - 4))}`,
  },
  {
    type: 'jwt',
    regex: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    confidence: 0.95,
    redactFn: () => '[JWT_TOKEN]',
  },
];

// ─── Luhn Check ─────────────────────────────────────────────────────────────

export function luhnCheck(digits: string): boolean {
  if (!/^\d+$/.test(digits) || digits.length < 13) return false;

  let sum = 0;
  let alternate = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i]!, 10);

    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }

    sum += n;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}

// ─── PIIScanner ─────────────────────────────────────────────────────────────

export class PIIScanner {
  private patterns: PIIPattern[];

  constructor(patterns?: PIIPattern[]) {
    this.patterns = patterns ?? DEFAULT_PATTERNS;
  }

  /**
   * Scan content for PII matches.
   */
  scan(content: string): PIIMatch[] {
    const matches: PIIMatch[] = [];

    for (const pattern of this.patterns) {
      // Reset regex state for global patterns
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);

      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        const value = match[0];

        // Run optional validator
        if (pattern.validate && !pattern.validate(value)) {
          continue;
        }

        const redacted = pattern.redactFn
          ? pattern.redactFn(value)
          : `[REDACTED:${pattern.type}]`;

        matches.push({
          type: pattern.type,
          value,
          redacted,
          position: match.index,
          confidence: pattern.confidence,
        });
      }
    }

    return matches;
  }

  /**
   * Redact all PII in content, replacing with [REDACTED:{type}].
   */
  redact(content: string): string {
    let redacted = content;

    // Sort matches by position descending to replace from end to start
    const allMatches = this.scan(content).sort(
      (a, b) => b.position - a.position,
    );

    for (const match of allMatches) {
      redacted =
        redacted.slice(0, match.position) +
        `[REDACTED:${match.type}]` +
        redacted.slice(match.position + match.value.length);
    }

    return redacted;
  }
}
