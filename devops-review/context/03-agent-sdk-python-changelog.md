# Claude Agent SDK — Python CHANGELOG

> Source: https://github.com/anthropics/claude-agent-sdk-python/blob/main/CHANGELOG.md
> Fetched: 2026-03-28

## Version History Summary

Versions 0.0.13 through 0.1.51, documenting the evolution from "Claude Code SDK" to "Claude Agent SDK".

### Recent Major Features (v0.1.51)
- Session management: `fork_session()` and `delete_session()`
- Token budget management via `task_budget` option
- Support for `--system-prompt-file` CLI flag
- New `AgentDefinition` fields: `disallowedTools`, `maxTurns`, `initialPrompt`

### Notable Additions
- Extended thinking configuration with `ThinkingConfig` types (v0.1.36)
- MCP tool annotations support via `@tool` decorator (v0.1.31)
- Session history functions and runtime MCP server management (v0.1.46)
- File checkpointing and rewind capabilities (v0.1.15)

### Major Breaking Changes (v0.1.0)
- SDK transitioned from "Claude Code" to "Claude Agent" branding
- `ClaudeCodeOptions` renamed to `ClaudeAgentOptions`
- System prompt handling consolidated
- Default prompts eliminated, configuration simplified

### CLI Version Progression
Bundled CLI versions progressed from 2.0.49 to 2.1.85.

### Bug Fix Areas
- Python compatibility improvements
- Async operation fixes
- MCP tool handling corrections
- Process cleanup issues resolved
