# Claude Code Overview

> Source: https://code.claude.com/docs/en/overview
> Fetched: 2026-03-28

Claude Code is an agentic coding tool that reads your codebase, edits files, runs commands, and integrates with your development tools. Available in your terminal, IDE, desktop app, and browser.

## Installation

### Native Install (Recommended)

**macOS, Linux, WSL:**
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows PowerShell:**
```powershell
irm https://claude.ai/install.ps1 | iex
```

### Homebrew
```bash
brew install --cask claude-code
```

### WinGet
```powershell
winget install Anthropic.ClaudeCode
```

### Start
```bash
cd your-project
claude
```

## Surfaces

| Surface | Description |
|---------|-------------|
| Terminal | Full-featured CLI |
| VS Code | Extension with inline diffs, @-mentions |
| JetBrains | Plugin for IntelliJ, PyCharm, WebStorm |
| Desktop app | Standalone app with visual diff review, scheduling |
| Web | Browser-based at claude.ai/code |

## Capabilities

- **Automate tasks**: Tests, lint, merge conflicts, dependency updates
- **Build features and fix bugs**: Multi-file changes from plain language
- **Git operations**: Commits, branches, PRs
- **MCP connectors**: Google Drive, Jira, Slack, custom tools
- **CLAUDE.md**: Persistent instructions per project
- **Custom skills**: `/review-pr`, `/deploy-staging`
- **Hooks**: Shell commands before/after actions
- **Agent teams**: Multiple agents working in parallel
- **Agent SDK**: Build custom agents with full tool access
- **CLI piping**: `tail -200 app.log | claude -p "analyze"`
- **Scheduled tasks**: Cloud or desktop recurring tasks
- **Cross-surface**: Remote Control, Dispatch, /teleport, /desktop

## Integration Table

| Use Case | Best Option |
|----------|-------------|
| Continue local session from phone | Remote Control |
| Push events from Telegram/Discord/webhooks | Channels |
| Start locally, continue on mobile | Web or iOS app |
| Recurring schedule | Cloud or Desktop scheduled tasks |
| PR reviews and issue triage | GitHub Actions or GitLab CI/CD |
| Automatic code review on PRs | GitHub Code Review |
| Route Slack bug reports to PRs | Slack integration |
| Debug live web apps | Chrome integration |
| Custom agent workflows | Agent SDK |

## Next Steps

- Quickstart: `/en/quickstart`
- Memory/CLAUDE.md: `/en/memory`
- Common workflows: `/en/common-workflows`
- Best practices: `/en/best-practices`
- Settings: `/en/settings`
- Troubleshooting: `/en/troubleshooting`
- Full docs index: `https://code.claude.com/docs/llms.txt`
