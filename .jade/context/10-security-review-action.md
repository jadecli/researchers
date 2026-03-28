---
source: https://github.com/anthropics/claude-code-security-review/blob/main/README.md
fetched: 2026-03-28
description: Claude Code Security Review — AI-powered security review GitHub Action
---

# Claude Code Security Review

AI-powered security review GitHub Action that uses Claude to analyze pull requests for security vulnerabilities.

## Features

- Automated security review of pull request diffs
- Identifies common vulnerability patterns (injection, XSS, CSRF, authentication bypass, etc.)
- Inline PR comments with severity ratings and remediation suggestions
- False positive filtering to reduce noise
- Configurable sensitivity and scope
- Support for multiple languages and frameworks
- `/security-review` command for on-demand reviews

## Quick Start

Add this workflow to your repository at `.github/workflows/security-review.yml`:

```yaml
name: Security Review
on:
  pull_request:
    types: [opened, synchronize]
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write

jobs:
  security-review:
    if: >
      github.event_name == 'pull_request' ||
      (github.event_name == 'issue_comment' &&
       contains(github.event.comment.body, '/security-review'))
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-security-review@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Security Considerations

- The action only reads pull request diffs; it does not execute any code
- API keys should be stored as GitHub Secrets
- The action runs in a sandboxed environment
- No data is stored or logged beyond the PR review comments
- Review results are posted as PR comments visible to all repository collaborators

## Configuration Options

### Inputs

| Input | Description | Required | Default |
|---|---|---|---|
| `anthropic_api_key` | Anthropic API key | Yes | — |
| `model` | Claude model to use | No | `claude-sonnet-4-20250514` |
| `severity_threshold` | Minimum severity to report (low/medium/high/critical) | No | `medium` |
| `include_patterns` | Glob patterns for files to include | No | `**/*` |
| `exclude_patterns` | Glob patterns for files to exclude | No | `**/test/**,**/*.test.*` |
| `max_comments` | Maximum number of review comments | No | `25` |
| `language` | Language for review comments | No | `en` |

### Outputs

| Output | Description |
|---|---|
| `findings_count` | Number of security findings |
| `critical_count` | Number of critical findings |
| `high_count` | Number of high severity findings |
| `review_summary` | Summary of the security review |

## Architecture

1. **Diff extraction** — Extracts the pull request diff from GitHub
2. **Chunking** — Splits large diffs into manageable chunks
3. **Analysis** — Sends each chunk to Claude for security analysis
4. **Aggregation** — Combines findings and removes duplicates
5. **False positive filtering** — Applies heuristics to reduce noise
6. **Reporting** — Posts inline comments and a summary on the PR

## Workflow

```
PR opened/updated → Extract diff → Chunk diff → Analyze with Claude
    → Aggregate findings → Filter false positives → Post PR comments
```

## Vulnerability Types

The action checks for:

- **Injection** — SQL injection, command injection, LDAP injection
- **Cross-Site Scripting (XSS)** — Reflected, stored, DOM-based
- **Cross-Site Request Forgery (CSRF)** — Missing tokens, SameSite issues
- **Authentication/Authorization** — Bypass, weak credentials, missing checks
- **Sensitive Data Exposure** — Hardcoded secrets, PII leaks, insecure storage
- **Insecure Deserialization** — Unsafe object parsing
- **Security Misconfiguration** — Permissive CORS, debug modes, default credentials
- **Cryptographic Issues** — Weak algorithms, improper key management
- **Path Traversal** — Directory traversal, file inclusion
- **Race Conditions** — TOCTOU, concurrent access issues

## False Positive Filtering

The action applies several strategies to minimize false positives:

- Context-aware analysis that considers surrounding code
- Framework-specific rules (e.g., ORM queries are less likely SQL injection)
- Test file exclusion by default
- Configurable severity thresholds
- Deduplication of similar findings

## /security-review Command

Trigger an on-demand security review by commenting `/security-review` on any pull request. The action will:

1. Detect the comment trigger
2. Run a full security review of the current PR diff
3. Post findings as inline comments
4. Reply to the trigger comment with a summary

## Testing

To test the action locally:

```bash
# Set environment variables
export ANTHROPIC_API_KEY=your-key
export GITHUB_TOKEN=your-token

# Run against a specific PR
npx @anthropic-ai/claude-code-security-review \
  --repo owner/repo \
  --pr 123 \
  --severity-threshold low
```
