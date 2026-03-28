---
source: https://github.com/anthropics/claude-agent-sdk-python/blob/main/CHANGELOG.md
fetched: 2026-03-28
description: Claude Agent SDK Python changelog — v0.1.51 to v0.1.0
---

# Claude Agent SDK Python Changelog

## v0.1.51

- Add `fork_session` support for creating session branches
- Add `delete_session` for cleanup of completed sessions

## v0.1.50

- Add `task_budget` parameter to control per-task token spending
- Improved error messages for budget exceeded scenarios

## v0.1.49

- Add `AgentDefinition` fields for declarative agent configuration
- Support `name`, `description`, `instructions` in AgentDefinition

## v0.1.48

- Add `ThinkingConfig` support for controlling extended thinking
- Options: `enabled`, `budget_tokens`, `temperature`

## v0.1.47

- Add MCP tool annotations support
- Tool annotations include `title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`

## v0.1.46

- Add session history functions: `get_session_history`, `list_sessions`
- Support for session metadata and tagging

## v0.1.45

- Add `session_tags` for organizing and filtering sessions
- Support `rename_session` for updating session names

## v0.1.44

- Improved streaming response handling
- Better error recovery for interrupted streams

## v0.1.43

- Add `agent_progress_summaries` for tracking multi-step agent work
- Summary includes step count, tools used, and current status

## v0.1.42

- Add `system_prompt` override support in query options
- Improved prompt caching for repeated queries

## v0.1.41

- Add `max_turns` parameter for limiting agent conversation depth
- Better handling of tool execution timeouts

## v0.1.40

- Add `permissions` configuration for fine-grained tool access control
- Support `allow`, `deny`, and `ask` permission modes

## v0.1.39

- Add subagent spawning with `create_subagent`
- Subagents inherit parent session context by default

## v0.1.38

- Improved MCP server connection management
- Auto-reconnect for dropped MCP connections

## v0.1.37

- Add `hooks` support for pre/post tool execution callbacks
- Hook types: `before_tool`, `after_tool`, `on_error`

## v0.1.36

- Add `context_window_usage` tracking in responses
- Reports input/output token counts and cache hits

## v0.1.35

- Support for custom tool definitions with JSON Schema
- Add `tool()` decorator for Python function tools

## v0.1.34

- Add `model` parameter override per query
- Support for model fallback chains

## v0.1.33

- Improved session persistence and recovery
- Add `save_session` and `load_session` helpers

## v0.1.32

- Add `environment` parameter for passing env vars to tool execution
- Improved sandboxing for shell commands

## v0.1.31

- Add structured output support via `output_schema`
- JSON Schema validation for agent responses

## v0.1.30

- Add `abort_signal` support for canceling in-progress queries
- Cleanup of resources on abort

## v0.1.29

- Improved retry logic with exponential backoff
- Configurable `max_retries` and `retry_delay`

## v0.1.28

- Add `working_directory` parameter for file operations
- Relative path resolution improvements

## v0.1.27

- Add `allowed_tools` filter for restricting available tools per query
- Tool filtering applies to both built-in and MCP tools

## v0.1.26

- Add event streaming with `on_event` callback
- Event types: `message`, `tool_use`, `tool_result`, `error`

## v0.1.25

- Add `conversation_id` for multi-turn conversation tracking
- Support resuming conversations across sessions

## v0.1.24

- Improved MCP tool discovery and caching
- Reduced latency for MCP tool invocations

## v0.1.23

- Add `temperature` and `top_p` parameters
- Support for deterministic outputs with `temperature=0`

## v0.1.22

- Add `metadata` field for attaching custom data to queries
- Metadata passed through to hooks and events

## v0.1.21

- Improved error handling for malformed tool responses
- Better logging for debugging agent behavior

## v0.1.20

- Add `timeout` parameter for query-level timeouts
- Separate timeouts for tool execution vs overall query

## v0.1.19

- Add `ClaudeSDKClient` class for connection management
- Support connection pooling and keepalive

## v0.1.18

- Add `ClaudeAgentOptions` for centralized configuration
- Options include model, tools, permissions, hooks, MCP servers

## v0.1.17

- Improved streaming with `async for` support
- Add `stream_text()` convenience method

## v0.1.16

- Add `get_context_usage()` for monitoring context window utilization
- Warnings when approaching context limits

## v0.1.15

- Add MCP server configuration via `mcp_servers` parameter
- Support stdio, SSE, and streamable HTTP transports

## v0.1.14

- Add `system_prompt_suffix` for appending to system prompts
- Useful for adding project-specific instructions

## v0.1.13

- Improved tool result formatting
- Support for image and file tool results

## v0.1.12

- Add `query()` function as the primary API entry point
- Simple interface: `result = await query("prompt", options)`

## v0.1.11

- Add built-in tools: `Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep`
- Tools match Claude Code's native capabilities

## v0.1.10

- Initial MCP integration
- Support for connecting to MCP servers

## v0.1.9

- Add session management basics
- Create, resume, and list sessions

## v0.1.8

- Improved async/await patterns
- Better event loop handling

## v0.1.7

- Add logging configuration
- Support for structured logging output

## v0.1.6

- Bug fixes for Windows compatibility
- Path handling improvements

## v0.1.5

- Add `--version` flag to CLI
- Version reporting in API responses

## v0.1.4

- Improved error messages
- Better stack traces for debugging

## v0.1.3

- Add configuration file support
- Load settings from `~/.claude/agent-sdk.json`

## v0.1.2

- Bug fixes for session handling
- Improved memory management

## v0.1.1

- Documentation improvements
- Added examples directory

## v0.1.0

- Initial release of Claude Agent SDK for Python
- Core `query()` API for sending prompts to Claude Code
- Built-in tool support (Read, Write, Edit, Bash, Glob, Grep)
- Session management for multi-turn conversations
- MCP server integration
- Streaming and non-streaming response modes
- Hooks for tool execution lifecycle
- Permission system for tool access control
- Python 3.10+ support
