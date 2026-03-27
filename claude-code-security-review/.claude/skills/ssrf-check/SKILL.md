---
name: ssrf-check
description: Check spider code for Server-Side Request Forgery vulnerabilities
disable-model-invocation: true
allowed-tools: Bash(python *), Read, Grep
argument-hint: [spider-file]
---

# SSRF Check

Scan the specified spider file for Server-Side Request Forgery (SSRF) vulnerabilities.

Checks performed:
- Hardcoded private/internal IP addresses (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- URL construction from user/external input (f-strings, format strings, concatenation)
- Unsafe redirect following that could lead to internal network access
- DNS rebinding potential via unprotected DNS resolution
- URL validation against the configured allowlist

Usage:
```bash
python -m scanners.python.ssrf_scanner <spider-file>
```
