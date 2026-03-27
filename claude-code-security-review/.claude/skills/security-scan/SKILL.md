---
name: security-scan
description: Run a comprehensive security audit on spider code, crawled data, and generated plugins
disable-model-invocation: true
allowed-tools: Bash(python *), Read, Grep, Glob
---

# Security Scan

Run a full security scan on the project:

1. **SSRF Scan**: Scan all spider files for server-side request forgery vulnerabilities including hardcoded private IPs, URL construction from untrusted input, unsafe redirect following, and DNS rebinding potential.

2. **PII Scan**: Scan crawled/extracted data directories for personally identifiable information including emails, phone numbers, SSNs, credit cards, API keys, AWS credentials, and JWT tokens.

3. **Injection Scan**: Check all spider selectors and pipelines for injection risks including f-string selectors with external input, unsanitized XPath/CSS construction, eval of selector results, SQL injection in pipelines, and command injection.

4. **Exfiltration Scan**: Audit pipelines and middleware for data exfiltration vectors including outbound HTTP requests, file writes outside allowed directories, subprocess calls, and raw socket usage.

5. **Plugin Audit**: Review any generated plugins for security issues including unsafe scripts, dangerous hook commands, credential literals, prompt injection in skill descriptions, and unsafe MCP server configurations.

Report all findings as structured JSON with the following format:

```json
{
  "scan_date": "ISO-8601 timestamp",
  "scanners_run": ["ssrf", "pii", "injection", "exfiltration", "plugin"],
  "total_issues": 0,
  "critical": 0,
  "high": 0,
  "medium": 0,
  "low": 0,
  "findings": []
}
```
