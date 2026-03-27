# Claude Code Actions

Cross-platform integration hub for Claude Code spanning GitHub Actions, GitLab CI/CD,
Chrome browser automation, Slack reporting, and Language Server Protocol setup.

## Architecture

```
claude-code-actions/
├── .github/workflows/    # GitHub Actions CI/CD pipelines
├── .gitlab-ci.yml        # GitLab CI/CD equivalent pipeline
├── chrome/               # Headless Chrome extraction & form automation
├── integrations/         # Slack, Linear, Notion connectors
├── scripts/              # CLI entry-points for CI runners
├── lsp_setup/            # LSP binary installer & per-language configs
└── .claude/
    ├── skills/           # Reusable Claude Code skill definitions
    └── agents/           # Autonomous agent definitions
```

## Cross-Platform Integration Map

### GitHub Actions
- **scheduled-crawl** -- nightly cron + manual dispatch; runs iterative spider crawls
- **improvement-cycle** -- matrix build across 4 spiders with N iterations each
- **quality-report** -- weekly HTML dashboard generation uploaded as artifact
- **pr-spider-review** -- PR-triggered review of spider code changes
- **plugin-publish** -- manual workflow to validate and publish marketplace plugins
- **multi-lang-ci** -- matrix CI for every language extractor
- **lsp-integration-test** -- validates all LSP configurations end-to-end

### GitLab CI
Mirror of the GitHub pipelines with stages: crawl, improve, test, report, publish.
Uses GitLab-native artifacts, caching, and environment variables.

### Chrome Automation
- `ChromeExtractor` -- headless Chrome page extraction with JS rendering support
- `FormAutomator` -- automated form filling for plugin submissions and login flows

### Integrations
- **Slack** -- crawl summaries and quality alerts posted to channels
- **Linear** -- auto-create improvement issues, sync campaign task boards
- **Notion** -- publish crawled pages and update quality dashboards

### LSP Setup
Installs and configures 11 language servers:
pyright, typescript-language-server, gopls, rust-analyzer, jdtls,
kotlin-language-server, csharp-ls, clangd, intelephense, sourcekit-lsp, lua-language-server

## Development Commands

```bash
# Install all dependencies
pip install -e ".[all]"

# Run quality gate locally
python scripts/check-quality.py --threshold 0.85

# Generate HTML report
python scripts/generate-report.py --output report.html

# Install all LSP servers
bash lsp_setup/install_all_lsp.sh

# Verify LSP installations
python lsp_setup/verify_lsp.py
```

## Environment Variables

| Variable | Used By | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | All workflows | Claude API access |
| `SLACK_BOT_TOKEN` | slack_reporter | Post to Slack channels |
| `SLACK_CHANNEL_ID` | slack_reporter | Target channel |
| `LINEAR_API_KEY` | linear_sync | Linear issue management |
| `NOTION_TOKEN` | notion_publisher | Notion API access |
| `NOTION_DATABASE_ID` | notion_publisher | Target database |
| `CHROME_PATH` | chrome extractors | Custom Chrome binary path |
| `GITHUB_TOKEN` | GitHub workflows | Repository access |
| `GITLAB_TOKEN` | GitLab CI | Repository access |

## Conventions

- All Python code targets 3.10+ and passes ruff + mypy strict
- Shell scripts are POSIX-compatible where possible, bash where necessary
- Workflow files use pinned action versions for reproducibility
- LSP configs are JSON with inline comments stripped before use
- Quality threshold default is 0.85 (85%) unless overridden

## Workflow Dispatch Inputs
All workflows accept these inputs via workflow_dispatch:
- `target`: URL to crawl (sitemap.xml or llms.txt)
- `spider`: Spider name (docs_spider, platform_spider, etc.)
- `iterations`: Number of improvement iterations (default: 3)
- `quality_threshold`: Minimum quality score (default: 0.60)
