# Security Review System

Multi-language security scanners for Scrapy spiders, crawled data, and generated plugins.

## Coverage Areas

- **SSRF**: Detects server-side request forgery vulnerabilities in spider code, including hardcoded private IPs, URL construction from user input, redirect following to internal networks, and DNS rebinding potential.
- **PII**: Scans crawled/extracted data for personally identifiable information including emails, phone numbers, SSNs, credit cards, API keys, AWS credentials, and JWT tokens.
- **Injection**: Identifies injection risks in CSS/XPath selectors built from external input, unsanitized selector expressions, and eval of selector results.
- **Exfiltration**: Detects data exfiltration vectors in pipelines and middleware including outbound HTTP calls, file writes outside allowed directories, subprocess invocations, and raw socket usage.

## Project Structure

- `rules/` -- YAML configuration files for URL allowlists, PII patterns, security policies, and plugin safety rules.
- `scanners/python/` -- Python-based scanners (SSRF, PII, injection, exfiltration).
- `scanners/typescript/` -- TypeScript scanners (dependency checking, XSS scanning).
- `scanners/go/` -- Go-based scanners (vulnerability auditing, dependency scanning).
- `scanners/rust/` -- Rust URL validation and crawl-target checking.
- `scanners/plugin_scanner.py` -- Plugin audit scanner for generated knowledge-work plugins.
- `tests/` -- Multi-language test suites.

## Scan Readiness
- Python scanners: 31/31 tests pass
- URL allowlist: anthropic.com, claude.ai, claude.com, code.claude.com, platform.claude.com, github.com
- PII patterns: 11 regex patterns (email, phone, SSN, credit_card, api_key, aws_key, jwt)
- SSRF protection: blocks 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
