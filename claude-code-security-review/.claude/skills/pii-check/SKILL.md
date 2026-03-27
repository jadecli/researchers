---
name: pii-check
description: Scan extracted/crawled data for personally identifiable information
disable-model-invocation: true
allowed-tools: Bash(python *), Read, Grep
argument-hint: [directory]
---

# PII Check

Scan the specified directory (or current data/ directory) for personally identifiable information in extracted/crawled data files.

Detected PII types:
- Email addresses
- Phone numbers (US and international)
- Social Security Numbers
- Credit card numbers (with Luhn validation)
- IP addresses
- AWS access keys and secret keys
- Generic API keys and tokens
- JWT tokens
- Private key headers

Usage:
```bash
python -m scanners.python.pii_scanner <target-directory>
```

Report each finding with type, redacted value, file location, and confidence score.
