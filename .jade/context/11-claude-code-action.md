---
source: https://github.com/anthropics/claude-code-action/blob/main/README.md
fetched: 2026-03-28
description: Claude Code Action — general-purpose GitHub Action for PRs and issues
---

# Claude Code Action

A general-purpose GitHub Action that brings Claude Code's agentic capabilities to your pull requests and issues. Claude can review code, answer questions, implement suggestions, and automate development workflows directly in GitHub.

## Features

- **PR Review** — Automated code review with inline comments and suggestions
- **Issue Triage** — Analyze and label new issues, suggest solutions
- **Implementation** — Apply code changes suggested in PR comments
- **Q&A** — Answer questions about the codebase in PR and issue comments
- **Custom Workflows** — Build custom automation with Claude's full tool capabilities
- **MCP Integration** — Connect to external tools via Model Context Protocol
- **CLAUDE.md Support** — Respects project-level CLAUDE.md configuration

## Quickstart

Add this workflow to `.github/workflows/claude-code.yml`:

```yaml
name: Claude Code
on:
  pull_request:
    types: [opened, synchronize, reopened]
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  claude:
    if: >
      github.event_name == 'pull_request' ||
      (github.event_name == 'issue_comment' &&
       contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'pull_request_review_comment' &&
       contains(github.event.comment.body, '@claude'))
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Solutions Guide Summary

### Code Review

Configure Claude to automatically review PRs on open:

- Set trigger on `pull_request` events
- Claude analyzes the diff and posts inline comments
- Supports custom review guidelines via CLAUDE.md

### Issue Management

Have Claude triage and respond to issues:

- Auto-label based on content analysis
- Suggest relevant code areas
- Propose implementation approaches

### Interactive Assistance

Mention `@claude` in any comment to:

- Ask questions about the code
- Request specific changes
- Get explanations of complex logic
- Run commands and report results

### Custom Prompts

Pass a custom `prompt` input to the action for specialized workflows:

```yaml
- uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    prompt: "Review this PR for accessibility compliance with WCAG 2.1 AA"
```

## Documentation

- [Configuration Reference](docs/configuration.md) — All inputs, outputs, and environment variables
- [Solutions Guide](docs/solutions.md) — Recipes for common workflows
- [MCP Integration](docs/mcp.md) — Connecting external tools
- [Troubleshooting](docs/troubleshooting.md) — Common issues and solutions

## FAQ

**Q: What model does the action use?**
A: By default, it uses Claude Sonnet. You can specify a different model with the `model` input.

**Q: How do I control costs?**
A: Use the `max_tokens` input to limit response length, and configure triggers carefully to avoid unnecessary runs.

**Q: Can Claude push commits?**
A: Yes, if you provide a `github_token` with write permissions to contents, Claude can commit changes directly to the PR branch.

**Q: Does it work with private repositories?**
A: Yes, the action works with both public and private repositories.

**Q: How do I customize Claude's behavior?**
A: Add a CLAUDE.md file to your repository root with project-specific instructions. Claude will follow these guidelines during reviews.

**Q: Can I use MCP servers?**
A: Yes, pass MCP server configurations via the `mcp_servers` input in JSON format.
