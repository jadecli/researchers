# Claude Code Action — GitHub Action

> Source: https://github.com/anthropics/claude-code-action
> Fetched: 2026-03-28

General-purpose Claude Code action for GitHub PRs and issues. Intelligently detects execution mode based on workflow context.

## Features

- Intelligent Mode Detection (auto-selects based on context)
- Interactive Code Assistant (questions about code, architecture)
- Code Review (analyze PR changes, suggest improvements)
- Code Implementation (fixes, refactoring, new features)
- PR/Issue Integration (comments, reviews)
- Flexible Tool Access (GitHub APIs, file operations, MCP)
- Progress Tracking (visual checkboxes)
- Structured Outputs (validated JSON → GitHub Action outputs)
- Runs on Your Infrastructure

## Quick Setup

```bash
claude   # open Claude Code
/install-github-app   # guided setup
```

## Authentication

Supports: Anthropic direct API, Amazon Bedrock, Google Vertex AI, Microsoft Foundry.

## Solutions & Use Cases

| Solution | Description |
|----------|-------------|
| Automatic PR Code Review | Full review automation |
| Path-Specific Reviews | Trigger on critical file changes |
| External Contributor Reviews | Special handling for new contributors |
| Custom Review Checklists | Enforce team standards |
| Scheduled Maintenance | Repository health checks |
| Issue Triage & Labeling | Automatic categorization |
| Documentation Sync | Keep docs updated with code |
| Security-Focused Reviews | OWASP-aligned analysis |
| DIY Progress Tracking | Custom tracking comments |

## Documentation

- Solutions Guide: `docs/solutions.md`
- Migration Guide: `docs/migration-guide.md` (v0.x → v1.0)
- Setup Guide: `docs/setup.md`
- Usage Guide: `docs/usage.md`
- Custom Automations: `docs/custom-automations.md`
- Configuration: `docs/configuration.md`
- Cloud Providers: `docs/cloud-providers.md`
- Security: `docs/security.md`
- FAQ: `docs/faq.md`

## Stats

- 6.7k stars, 1.6k forks
- TypeScript 93%, JavaScript 5.6%, Shell 1.4%
- Latest: v1.0 (August 2025)
