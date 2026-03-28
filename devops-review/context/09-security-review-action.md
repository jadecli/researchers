# Claude Code Security Review — GitHub Action

> Source: https://github.com/anthropics/claude-code-security-review
> Fetched: 2026-03-28

AI-powered security review GitHub Action using Claude to analyze code changes for security vulnerabilities.

## Quick Start

```yaml
name: Security Review
permissions:
  pull-requests: write
  contents: read
on:
  pull_request:
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha || github.sha }}
          fetch-depth: 2
      - uses: anthropics/claude-code-security-review@main
        with:
          comment-pr: true
          claude-api-key: ${{ secrets.CLAUDE_API_KEY }}
```

## Features

- **AI-Powered Analysis**: Deep semantic security analysis
- **Diff-Aware Scanning**: Only analyzes changed files for PRs
- **PR Comments**: Automatic security finding comments
- **Language Agnostic**: Works with any programming language
- **False Positive Filtering**: Advanced noise reduction

## Action Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `claude-api-key` | API key (must be enabled for both API and Code) | Required |
| `comment-pr` | Comment on PRs with findings | `true` |
| `upload-results` | Upload results as artifacts | `true` |
| `exclude-directories` | Comma-separated exclude list | None |
| `claude-model` | Model name | `claude-opus-4-1-20250805` |
| `claudecode-timeout` | Timeout in minutes | `20` |
| `run-every-commit` | Run on every commit (may increase FP) | `false` |
| `false-positive-filtering-instructions` | Path to custom FP filter instructions | None |
| `custom-security-scan-instructions` | Path to custom scan instructions | None |

## Action Outputs

| Output | Description |
|--------|-------------|
| `findings-count` | Total security findings |
| `results-file` | Path to results JSON |

## Architecture

```
claudecode/
├── github_action_audit.py    # Main audit script
├── prompts.py                # Security audit prompts
├── findings_filter.py        # False positive filtering
├── claude_api_client.py      # Claude API client
├── json_parser.py            # JSON parsing utilities
├── test_*.py                 # Test suites
└── evals/                    # Eval tooling
```

## Workflow

1. PR Analysis → understand what changed
2. Contextual Review → examine code in context
3. Finding Generation → identify issues with severity/remediation
4. False Positive Filtering → remove noise
5. PR Comments → post on specific lines

## Vulnerability Types Detected

- Injection (SQL, command, LDAP, XPath, NoSQL, XXE)
- Authentication & Authorization
- Data Exposure (secrets, PII, information disclosure)
- Cryptographic Issues
- Input Validation
- Business Logic Flaws (race conditions, TOCTOU)
- Configuration Security
- Supply Chain (dependencies, typosquatting)
- Code Execution (RCE, deserialization, eval)
- XSS (reflected, stored, DOM-based)

## Claude Code Integration

Built-in `/security-review` slash command provides the same analysis in Claude Code.
Customizable by copying `security-review.md` to `.claude/commands/`.
