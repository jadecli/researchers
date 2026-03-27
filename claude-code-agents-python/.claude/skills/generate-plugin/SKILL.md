---
description: Generate a Claude Code plugin with skills, agents, connectors, hooks, and LSP configuration.
tools:
  - Bash
  - Read
  - Write
  - Glob
model: claude-sonnet-4-20250514
references:
  - src/plugin_gen/scaffold.py
  - src/models/plugin_spec.py
  - src/plugin_gen/skill_writer.py
  - src/plugin_gen/agent_writer.py
scripts:
  - python -m src.cli generate-plugin
---

# generate-plugin

Generate a Claude Code plugin with skills, agents, connectors, hooks, and LSP configuration.

## Usage

Use this skill to scaffold a complete Claude Code plugin following the anthropics/knowledge-work-plugins patterns. The generated plugin includes:

- **plugin.json**: Manifest with metadata and references to all components.
- **skills/**: SKILL.md files with YAML frontmatter and markdown body.
- **agents/**: Agent .md files with system prompts and tool configurations.
- **connectors/**: MCP connector configurations with `~~` placeholder support.
- **hooks/**: Lifecycle hook configurations (PreToolExecution, PostToolExecution, etc.).
- **.lsp/**: LSP server configurations for multi-language support.

## Parameters

- **name**: Plugin name (required).
- **domain**: Target domain like engineering, data, legal, etc. (default: engineering).
- **description**: Plugin description.
- **output-dir**: Where to generate the plugin (default: ./generated_plugins).
- **skills**: Specific skill names to include.
- **agents**: Specific agent names to include.

## Example

```bash
python -m src.cli generate-plugin \
  --name "code-review-pro" \
  --domain engineering \
  --description "Advanced code review with security analysis" \
  --skills review-code \
  --skills check-security \
  --agents reviewer \
  --output-dir ./plugins
```

## Instructions

1. Determine the plugin domain and purpose.
2. Choose skill and agent names that reflect the plugin's capabilities.
3. Run the generate-plugin command.
4. Review and customize the generated SKILL.md and agent files.
5. Fill in any `~~` placeholder values in connector configurations.
6. Test the plugin by installing it in a Claude Code project.
