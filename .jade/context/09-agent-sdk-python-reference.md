---
source: https://platform.claude.com/docs/en/agent-sdk/python
fetched: 2026-03-28
description: Claude Agent SDK Python reference — query(), ClaudeSDKClient, ClaudeAgentOptions, all types
---

# Agent SDK Reference - Python

Complete API reference for the Python Agent SDK, including all functions, types, and classes.

## Installation

```bash
pip install claude-agent-sdk
```

## Choosing between `query()` and `ClaudeSDKClient`

The Python SDK provides two ways to interact with Claude Code:

| Feature             | `query()`                     | `ClaudeSDKClient`                  |
| :------------------ | :---------------------------- | :--------------------------------- |
| **Session**         | Creates new session each time | Reuses same session                |
| **Conversation**    | Single exchange               | Multiple exchanges in same context |
| **Connection**      | Managed automatically         | Manual control                     |
| **Streaming Input** | ✅ Supported                  | ✅ Supported                       |
| **Interrupts**      | ❌ Not supported              | ✅ Supported                       |
| **Hooks**           | ✅ Supported                  | ✅ Supported                       |
| **Custom Tools**    | ✅ Supported                  | ✅ Supported                       |
| **Continue Chat**   | ❌ New session each time      | ✅ Maintains conversation          |
| **Use Case**        | One-off tasks                 | Continuous conversations           |

### When to use `query()` (new session each time)

**Best for:**
- One-off questions where you don't need conversation history
- Independent tasks that don't require context from previous exchanges
- Simple automation scripts
- When you want a fresh start each time

### When to use `ClaudeSDKClient` (continuous conversation)

**Best for:**
- **Continuing conversations** - When you need Claude to remember context
- **Follow-up questions** - Building on previous responses
- **Interactive applications** - Chat interfaces, REPLs
- **Response-driven logic** - When next action depends on Claude's response
- **Session control** - Managing conversation lifecycle explicitly

## Functions

### `query()`

Creates a new session for each interaction with Claude Code. Returns an async iterator that yields messages as they arrive. Each call to `query()` starts fresh with no memory of previous interactions.

```python
async def query(
    *,
    prompt: str | AsyncIterable[dict[str, Any]],
    options: ClaudeAgentOptions | None = None,
    transport: Transport | None = None
) -> AsyncIterator[Message]
```

#### Parameters

| Parameter | Type                         | Description                                                                |
| :-------- | :--------------------------- | :------------------------------------------------------------------------- |
| `prompt`  | `str \| AsyncIterable[dict]` | The input prompt as a string or async iterable for streaming mode          |
| `options` | `ClaudeAgentOptions \| None` | Optional configuration object (defaults to `ClaudeAgentOptions()` if None) |
| `transport` | `Transport \| None` | Optional custom transport for communicating with the CLI process |

#### Returns

Returns an `AsyncIterator[Message]` that yields messages from the conversation.

#### Example - With options

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions


async def main():
    options = ClaudeAgentOptions(
        system_prompt="You are an expert Python developer",
        permission_mode="acceptEdits",
        cwd="/home/user/project",
    )

    async for message in query(prompt="Create a Python web server", options=options):
        print(message)


asyncio.run(main())
```

### `tool()`

Decorator for defining MCP tools with type safety.

```python
def tool(
    name: str,
    description: str,
    input_schema: type | dict[str, Any],
    annotations: ToolAnnotations | None = None
) -> Callable[[Callable[[Any], Awaitable[dict[str, Any]]]], SdkMcpTool[Any]]
```

#### Parameters

| Parameter      | Type                         | Description                                                                                                                      |
| :------------- | :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | `str`                        | Unique identifier for the tool                                                                                                   |
| `description`  | `str`                        | Human-readable description of what the tool does                                                                                 |
| `input_schema` | `type \| dict[str, Any]`     | Schema defining the tool's input parameters (see below)                                                                          |
| `annotations`  | [`ToolAnnotations`](#tool-annotations)` \| None` | Optional MCP tool annotations providing behavioral hints to clients                                                              |

#### Input schema options

1. **Simple type mapping** (recommended):

   ```python
   {"text": str, "count": int, "enabled": bool}
   ```

2. **JSON Schema format** (for complex validation):
   ```python
   {
       "type": "object",
       "properties": {
           "text": {"type": "string"},
           "count": {"type": "integer", "minimum": 0},
       },
       "required": ["text"],
   }
   ```

#### Returns

A decorator function that wraps the tool implementation and returns an `SdkMcpTool` instance.

#### Example

```python
from claude_agent_sdk import tool
from typing import Any


@tool("greet", "Greet a user", {"name": str})
async def greet(args: dict[str, Any]) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": f"Hello, {args['name']}!"}]}
```

#### `ToolAnnotations`

Re-exported from `mcp.types`. All fields are optional hints; clients should not rely on them for security decisions.

| Field | Type | Default | Description |
| :---- | :--- | :------ | :---------- |
| `title` | `str \| None` | `None` | Human-readable title for the tool |
| `readOnlyHint` | `bool \| None` | `False` | If `True`, the tool does not modify its environment |
| `destructiveHint` | `bool \| None` | `True` | If `True`, the tool may perform destructive updates |
| `idempotentHint` | `bool \| None` | `False` | If `True`, repeated calls with the same arguments have no additional effect |
| `openWorldHint` | `bool \| None` | `True` | If `True`, the tool interacts with external entities |

```python
from claude_agent_sdk import tool, ToolAnnotations
from typing import Any


@tool(
    "search",
    "Search the web",
    {"query": str},
    annotations=ToolAnnotations(readOnlyHint=True, openWorldHint=True),
)
async def search(args: dict[str, Any]) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": f"Results for: {args['query']}"}]}
```

### `create_sdk_mcp_server()`

Create an in-process MCP server that runs within your Python application.

```python
def create_sdk_mcp_server(
    name: str,
    version: str = "1.0.0",
    tools: list[SdkMcpTool[Any]] | None = None
) -> McpSdkServerConfig
```

#### Parameters

| Parameter | Type                            | Default   | Description                                           |
| :-------- | :------------------------------ | :-------- | :---------------------------------------------------- |
| `name`    | `str`                           | -         | Unique identifier for the server                      |
| `version` | `str`                           | `"1.0.0"` | Server version string                                 |
| `tools`   | `list[SdkMcpTool[Any]] \| None` | `None`    | List of tool functions created with `@tool` decorator |

#### Returns

Returns an `McpSdkServerConfig` object that can be passed to `ClaudeAgentOptions.mcp_servers`.

#### Example

```python
from claude_agent_sdk import tool, create_sdk_mcp_server


@tool("add", "Add two numbers", {"a": float, "b": float})
async def add(args):
    return {"content": [{"type": "text", "text": f"Sum: {args['a'] + args['b']}"}]}


@tool("multiply", "Multiply two numbers", {"a": float, "b": float})
async def multiply(args):
    return {"content": [{"type": "text", "text": f"Product: {args['a'] * args['b']}"}]}


calculator = create_sdk_mcp_server(
    name="calculator",
    version="2.0.0",
    tools=[add, multiply],
)

# Use with Claude
options = ClaudeAgentOptions(
    mcp_servers={"calc": calculator},
    allowed_tools=["mcp__calc__add", "mcp__calc__multiply"],
)
```

### `list_sessions()`

Lists past sessions with metadata. Filter by project directory or list sessions across all projects. Synchronous; returns immediately.

```python
def list_sessions(
    directory: str | None = None,
    limit: int | None = None,
    include_worktrees: bool = True
) -> list[SDKSessionInfo]
```

#### Parameters

| Parameter | Type | Default | Description |
| :-------- | :--- | :------ | :---------- |
| `directory` | `str \| None` | `None` | Directory to list sessions for. When omitted, returns sessions across all projects |
| `limit` | `int \| None` | `None` | Maximum number of sessions to return |
| `include_worktrees` | `bool` | `True` | When `directory` is inside a git repository, include sessions from all worktree paths |

#### Return type: `SDKSessionInfo`

| Property | Type | Description |
| :------- | :--- | :---------- |
| `session_id` | `str` | Unique session identifier |
| `summary` | `str` | Display title: custom title, auto-generated summary, or first prompt |
| `last_modified` | `int` | Last modified time in milliseconds since epoch |
| `file_size` | `int \| None` | Session file size in bytes |
| `custom_title` | `str \| None` | User-set session title |
| `first_prompt` | `str \| None` | First meaningful user prompt in the session |
| `git_branch` | `str \| None` | Git branch at the end of the session |
| `cwd` | `str \| None` | Working directory for the session |
| `tag` | `str \| None` | User-set session tag |
| `created_at` | `int \| None` | Session creation time in milliseconds since epoch |

#### Example

```python
from claude_agent_sdk import list_sessions

for session in list_sessions(directory="/path/to/project", limit=10):
    print(f"{session.summary} ({session.session_id})")
```

### `get_session_messages()`

Retrieves messages from a past session. Synchronous; returns immediately.

```python
def get_session_messages(
    session_id: str,
    directory: str | None = None,
    limit: int | None = None,
    offset: int = 0
) -> list[SessionMessage]
```

#### Parameters

| Parameter | Type | Default | Description |
| :-------- | :--- | :------ | :---------- |
| `session_id` | `str` | required | The session ID to retrieve messages for |
| `directory` | `str \| None` | `None` | Project directory to look in |
| `limit` | `int \| None` | `None` | Maximum number of messages to return |
| `offset` | `int` | `0` | Number of messages to skip from the start |

#### Return type: `SessionMessage`

| Property | Type | Description |
| :------- | :--- | :---------- |
| `type` | `Literal["user", "assistant"]` | Message role |
| `uuid` | `str` | Unique message identifier |
| `session_id` | `str` | Session identifier |
| `message` | `Any` | Raw message content |
| `parent_tool_use_id` | `None` | Reserved for future use |

#### Example

```python
from claude_agent_sdk import list_sessions, get_session_messages

sessions = list_sessions(limit=1)
if sessions:
    messages = get_session_messages(sessions[0].session_id)
    for msg in messages:
        print(f"[{msg.type}] {msg.uuid}")
```

### `get_session_info()`

Reads metadata for a single session by ID without scanning the full project directory. Synchronous; returns immediately.

```python
def get_session_info(
    session_id: str,
    directory: str | None = None,
) -> SDKSessionInfo | None
```

#### Parameters

| Parameter | Type | Default | Description |
| :-------- | :--- | :------ | :---------- |
| `session_id` | `str` | required | UUID of the session to look up |
| `directory` | `str \| None` | `None` | Project directory path |

Returns [`SDKSessionInfo`](#return-type-sdk-session-info), or `None` if the session is not found.

#### Example

```python
from claude_agent_sdk import get_session_info

info = get_session_info("550e8400-e29b-41d4-a716-446655440000")
if info:
    print(f"{info.summary} (branch: {info.git_branch}, tag: {info.tag})")
```

### `rename_session()`

Renames a session by appending a custom-title entry. Repeated calls are safe; the most recent title wins. Synchronous.

```python
def rename_session(
    session_id: str,
    title: str,
    directory: str | None = None,
) -> None
```

#### Parameters

| Parameter | Type | Default | Description |
| :-------- | :--- | :------ | :---------- |
| `session_id` | `str` | required | UUID of the session to rename |
| `title` | `str` | required | New title. Must be non-empty after stripping whitespace |
| `directory` | `str \| None` | `None` | Project directory path |

Raises `ValueError` if `session_id` is not a valid UUID or `title` is empty; `FileNotFoundError` if the session cannot be found.

#### Example

```python
from claude_agent_sdk import list_sessions, rename_session

sessions = list_sessions(directory="/path/to/project", limit=1)
if sessions:
    rename_session(sessions[0].session_id, "Refactor auth module")
```

### `tag_session()`

Tags a session. Pass `None` to clear the tag. Repeated calls are safe; the most recent tag wins. Synchronous.

```python
def tag_session(
    session_id: str,
    tag: str | None,
    directory: str | None = None,
) -> None
```

#### Parameters

| Parameter | Type | Default | Description |
| :-------- | :--- | :------ | :---------- |
| `session_id` | `str` | required | UUID of the session to tag |
| `tag` | `str \| None` | required | Tag string, or `None` to clear |
| `directory` | `str \| None` | `None` | Project directory path |

Raises `ValueError` if `session_id` is not a valid UUID or `tag` is empty after sanitization; `FileNotFoundError` if the session cannot be found.

#### Example

```python
from claude_agent_sdk import list_sessions, tag_session

# Tag a session
tag_session("550e8400-e29b-41d4-a716-446655440000", "needs-review")

# Later: find all sessions with that tag
for session in list_sessions(directory="/path/to/project"):
    if session.tag == "needs-review":
        print(session.summary)
```

## Classes

### `ClaudeSDKClient`

**Maintains a conversation session across multiple exchanges.** This is the Python equivalent of how the TypeScript SDK's `query()` function works internally.

#### Key Features

- **Session continuity**: Maintains conversation context across multiple `query()` calls
- **Same conversation**: The session retains previous messages
- **Interrupt support**: Can stop execution mid-task
- **Explicit lifecycle**: You control when the session starts and ends
- **Response-driven flow**: Can react to responses and send follow-ups
- **Custom tools and hooks**: Supports custom tools and hooks

```python
class ClaudeSDKClient:
    def __init__(self, options: ClaudeAgentOptions | None = None, transport: Transport | None = None)
    async def connect(self, prompt: str | AsyncIterable[dict] | None = None) -> None
    async def query(self, prompt: str | AsyncIterable[dict], session_id: str = "default") -> None
    async def receive_messages(self) -> AsyncIterator[Message]
    async def receive_response(self) -> AsyncIterator[Message]
    async def interrupt(self) -> None
    async def set_permission_mode(self, mode: str) -> None
    async def set_model(self, model: str | None = None) -> None
    async def rewind_files(self, user_message_id: str) -> None
    async def get_mcp_status(self) -> McpStatusResponse
    async def reconnect_mcp_server(self, server_name: str) -> None
    async def toggle_mcp_server(self, server_name: str, enabled: bool) -> None
    async def stop_task(self, task_id: str) -> None
    async def get_server_info(self) -> dict[str, Any] | None
    async def disconnect(self) -> None
```

#### Methods

| Method                      | Description                                                         |
| :-------------------------- | :------------------------------------------------------------------ |
| `__init__(options)`         | Initialize the client with optional configuration                   |
| `connect(prompt)`           | Connect to Claude with an optional initial prompt or message stream |
| `query(prompt, session_id)` | Send a new request in streaming mode                                |
| `receive_messages()`        | Receive all messages from Claude as an async iterator               |
| `receive_response()`        | Receive messages until and including a ResultMessage                |
| `interrupt()`               | Send interrupt signal (only works in streaming mode)                |
| `set_permission_mode(mode)` | Change the permission mode for the current session                  |
| `set_model(model)`          | Change the model for the current session. Pass `None` to reset to default |
| `rewind_files(user_message_id)` | Restore files to their state at the specified user message |
| `get_mcp_status()`          | Get the status of all configured MCP servers |
| `reconnect_mcp_server(server_name)` | Retry connecting to an MCP server that failed or was disconnected |
| `toggle_mcp_server(server_name, enabled)` | Enable or disable an MCP server mid-session |
| `stop_task(task_id)`        | Stop a running background task |
| `get_server_info()`         | Get server information including session ID and capabilities        |
| `disconnect()`              | Disconnect from Claude                                              |

#### Context Manager Support

The client can be used as an async context manager for automatic connection management:

```python
async with ClaudeSDKClient() as client:
    await client.query("Hello Claude")
    async for message in client.receive_response():
        print(message)
```

> **Important:** When iterating over messages, avoid using `break` to exit early as this can cause asyncio cleanup issues. Instead, let the iteration complete naturally or use flags to track when you've found what you need.

#### Example - Continuing a conversation

```python
import asyncio
from claude_agent_sdk import ClaudeSDKClient, AssistantMessage, TextBlock, ResultMessage


async def main():
    async with ClaudeSDKClient() as client:
        # First question
        await client.query("What's the capital of France?")

        # Process response
        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        print(f"Claude: {block.text}")

        # Follow-up question - the session retains the previous context
        await client.query("What's the population of that city?")

        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        print(f"Claude: {block.text}")

        # Another follow-up - still in the same conversation
        await client.query("What are some famous landmarks there?")

        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        print(f"Claude: {block.text}")


asyncio.run(main())
```

#### Example - Streaming input with ClaudeSDKClient

```python
import asyncio
from claude_agent_sdk import ClaudeSDKClient


async def message_stream():
    """Generate messages dynamically."""
    yield {
        "type": "user",
        "message": {"role": "user", "content": "Analyze the following data:"},
    }
    await asyncio.sleep(0.5)
    yield {
        "type": "user",
        "message": {"role": "user", "content": "Temperature: 25°C, Humidity: 60%"},
    }
    await asyncio.sleep(0.5)
    yield {
        "type": "user",
        "message": {"role": "user", "content": "What patterns do you see?"},
    }


async def main():
    async with ClaudeSDKClient() as client:
        # Stream input to Claude
        await client.query(message_stream())

        # Process response
        async for message in client.receive_response():
            print(message)

        # Follow-up in same session
        await client.query("Should we be concerned about these readings?")

        async for message in client.receive_response():
            print(message)


asyncio.run(main())
```

#### Example - Using interrupts

```python
import asyncio
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, ResultMessage


async def interruptible_task():
    options = ClaudeAgentOptions(allowed_tools=["Bash"], permission_mode="acceptEdits")

    async with ClaudeSDKClient(options=options) as client:
        # Start a long-running task
        await client.query("Count from 1 to 100 slowly, using the bash sleep command")

        # Let it run for a bit
        await asyncio.sleep(2)

        # Interrupt the task
        await client.interrupt()
        print("Task interrupted!")

        # Drain the interrupted task's messages
        async for message in client.receive_response():
            if isinstance(message, ResultMessage):
                print(f"Interrupted task finished with subtype={message.subtype!r}")

        # Send a new command
        await client.query("Just say hello instead")

        # Now receive the new response
        async for message in client.receive_response():
            if isinstance(message, ResultMessage) and message.subtype == "success":
                print(f"New result: {message.result}")


asyncio.run(interruptible_task())
```

**Buffer behavior after interrupt:** `interrupt()` sends a stop signal but does not clear the message buffer. Messages already produced by the interrupted task remain in the stream. You must drain them with `receive_response()` before reading the response to a new query.

#### Example - Advanced permission control

```python
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
from claude_agent_sdk.types import (
    PermissionResultAllow,
    PermissionResultDeny,
    ToolPermissionContext,
)


async def custom_permission_handler(
    tool_name: str, input_data: dict, context: ToolPermissionContext
) -> PermissionResultAllow | PermissionResultDeny:
    """Custom logic for tool permissions."""

    # Block writes to system directories
    if tool_name == "Write" and input_data.get("file_path", "").startswith("/system/"):
        return PermissionResultDeny(
            message="System directory write not allowed", interrupt=True
        )

    # Redirect sensitive file operations
    if tool_name in ["Write", "Edit"] and "config" in input_data.get("file_path", ""):
        safe_path = f"./sandbox/{input_data['file_path']}"
        return PermissionResultAllow(
            updated_input={**input_data, "file_path": safe_path}
        )

    # Allow everything else
    return PermissionResultAllow(updated_input=input_data)


async def main():
    options = ClaudeAgentOptions(
        can_use_tool=custom_permission_handler, allowed_tools=["Read", "Write", "Edit"]
    )

    async with ClaudeSDKClient(options=options) as client:
        await client.query("Update the system config file")

        async for message in client.receive_response():
            # Will use sandbox path instead
            print(message)


asyncio.run(main())
```

## Types

**Note:** Classes decorated with `@dataclass` are object instances at runtime with attribute access. Classes defined with `TypedDict` are **plain dicts at runtime** and require key access.

### `SdkMcpTool`

Definition for an SDK MCP tool created with the `@tool` decorator.

```python
@dataclass
class SdkMcpTool(Generic[T]):
    name: str
    description: str
    input_schema: type[T] | dict[str, Any]
    handler: Callable[[T], Awaitable[dict[str, Any]]]
    annotations: ToolAnnotations | None = None
```

| Property       | Type                                       | Description                                                                                     |
| :------------- | :----------------------------------------- | :---------------------------------------------------------------------------------------------- |
| `name`         | `str`                                      | Unique identifier for the tool                                                                  |
| `description`  | `str`                                      | Human-readable description                                                                      |
| `input_schema` | `type[T] \| dict[str, Any]`                | Schema for input validation                                                                     |
| `handler`      | `Callable[[T], Awaitable[dict[str, Any]]]` | Async function that handles tool execution                                                      |
| `annotations`  | `ToolAnnotations \| None`                  | Optional MCP tool annotations                                                                   |

### `Transport`

Abstract base class for custom transport implementations.

```python
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import Any


class Transport(ABC):
    @abstractmethod
    async def connect(self) -> None: ...

    @abstractmethod
    async def write(self, data: str) -> None: ...

    @abstractmethod
    def read_messages(self) -> AsyncIterator[dict[str, Any]]: ...

    @abstractmethod
    async def close(self) -> None: ...

    @abstractmethod
    def is_ready(self) -> bool: ...

    @abstractmethod
    async def end_input(self) -> None: ...
```

| Method | Description |
| :--- | :--- |
| `connect()` | Connect the transport and prepare for communication |
| `write(data)` | Write raw data (JSON + newline) to the transport |
| `read_messages()` | Async iterator that yields parsed JSON messages |
| `close()` | Close the connection and clean up resources |
| `is_ready()` | Returns `True` if the transport can send and receive |
| `end_input()` | Close the input stream |

Import: `from claude_agent_sdk import Transport`

### `ClaudeAgentOptions`

Configuration dataclass for Claude Code queries.

```python
@dataclass
class ClaudeAgentOptions:
    tools: list[str] | ToolsPreset | None = None
    allowed_tools: list[str] = field(default_factory=list)
    system_prompt: str | SystemPromptPreset | None = None
    mcp_servers: dict[str, McpServerConfig] | str | Path = field(default_factory=dict)
    permission_mode: PermissionMode | None = None
    continue_conversation: bool = False
    resume: str | None = None
    max_turns: int | None = None
    max_budget_usd: float | None = None
    disallowed_tools: list[str] = field(default_factory=list)
    model: str | None = None
    fallback_model: str | None = None
    betas: list[SdkBeta] = field(default_factory=list)
    output_format: dict[str, Any] | None = None
    permission_prompt_tool_name: str | None = None
    cwd: str | Path | None = None
    cli_path: str | Path | None = None
    settings: str | None = None
    add_dirs: list[str | Path] = field(default_factory=list)
    env: dict[str, str] = field(default_factory=dict)
    extra_args: dict[str, str | None] = field(default_factory=dict)
    max_buffer_size: int | None = None
    debug_stderr: Any = sys.stderr  # Deprecated
    stderr: Callable[[str], None] | None = None
    can_use_tool: CanUseTool | None = None
    hooks: dict[HookEvent, list[HookMatcher]] | None = None
    user: str | None = None
    include_partial_messages: bool = False
    fork_session: bool = False
    agents: dict[str, AgentDefinition] | None = None
    setting_sources: list[SettingSource] | None = None
    sandbox: SandboxSettings | None = None
    plugins: list[SdkPluginConfig] = field(default_factory=list)
    max_thinking_tokens: int | None = None  # Deprecated: use thinking instead
    thinking: ThinkingConfig | None = None
    effort: Literal["low", "medium", "high", "max"] | None = None
    enable_file_checkpointing: bool = False
```

| Property                      | Type                                         | Default              | Description                                                                                                                                                                             |
| :---------------------------- | :------------------------------------------- | :------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools`                       | `list[str] \| ToolsPreset \| None`           | `None`               | Tools configuration. Use `{"type": "preset", "preset": "claude_code"}` for Claude Code's default tools                                                                                  |
| `allowed_tools`               | `list[str]`                                  | `[]`                 | Tools to auto-approve without prompting                                                                                                                                               |
| `system_prompt`               | `str \| SystemPromptPreset \| None`          | `None`               | System prompt configuration                                                                                                                                                          |
| `mcp_servers`                 | `dict[str, McpServerConfig] \| str \| Path`  | `{}`                 | MCP server configurations or path to config file                                                                                                                                        |
| `permission_mode`             | `PermissionMode \| None`                     | `None`               | Permission mode for tool usage                                                                                                                                                          |
| `continue_conversation`       | `bool`                                       | `False`              | Continue the most recent conversation                                                                                                                                                   |
| `resume`                      | `str \| None`                                | `None`               | Session ID to resume                                                                                                                                                                    |
| `max_turns`                   | `int \| None`                                | `None`               | Maximum agentic turns (tool-use round trips)                                                                                                                                            |
| `max_budget_usd`              | `float \| None`                              | `None`               | Maximum budget in USD for the session                                                                                                                                                   |
| `disallowed_tools`            | `list[str]`                                  | `[]`                 | Tools to always deny                                                                                                                                                                    |
| `enable_file_checkpointing`   | `bool`                                       | `False`              | Enable file change tracking for rewinding                                                                                                                                              |
| `model`                       | `str \| None`                                | `None`               | Claude model to use                                                                                                                                                                     |
| `fallback_model`              | `str \| None`                                | `None`               | Fallback model to use if the primary model fails                                                                                                                                        |
| `betas`                       | `list[SdkBeta]`                              | `[]`                 | Beta features to enable                                                                                                                                                                |
| `output_format`               | `dict[str, Any] \| None`                     | `None`               | Output format for structured responses                                                                                                                                                |
| `permission_prompt_tool_name` | `str \| None`                                | `None`               | MCP tool name for permission prompts                                                                                                                                                    |
| `cwd`                         | `str \| Path \| None`                        | `None`               | Current working directory                                                                                                                                                               |
| `cli_path`                    | `str \| Path \| None`                        | `None`               | Custom path to the Claude Code CLI executable                                                                                                                                          |
| `settings`                    | `str \| None`                                | `None`               | Path to settings file                                                                                                                                                                   |
| `add_dirs`                    | `list[str \| Path]`                          | `[]`                 | Additional directories Claude can access                                                                                                                                                |
| `env`                         | `dict[str, str]`                             | `{}`                 | Environment variables                                                                                                                                                                   |
| `extra_args`                  | `dict[str, str \| None]`                     | `{}`                 | Additional CLI arguments to pass directly to the CLI                                                                                                                                    |
| `max_buffer_size`             | `int \| None`                                | `None`               | Maximum bytes when buffering CLI stdout                                                                                                                                                |
| `debug_stderr`                | `Any`                                        | `sys.stderr`         | _Deprecated_ - File-like object for debug output                                                                                                                                      |
| `stderr`                      | `Callable[[str], None] \| None`              | `None`               | Callback function for stderr output from CLI                                                                                                                                            |
| `can_use_tool`                | [`CanUseTool`](#can-use-tool) ` \| None`      | `None`               | Tool permission callback function                                                                                                                                                      |
| `hooks`                       | `dict[HookEvent, list[HookMatcher]] \| None` | `None`               | Hook configurations for intercepting events                                                                                                                                             |
| `user`                        | `str \| None`                                | `None`               | User identifier                                                                                                                                                                         |
| `include_partial_messages`    | `bool`                                       | `False`              | Include partial message streaming events                                                                                                                                              |
| `fork_session`                | `bool`                                       | `False`              | When resuming with `resume`, fork to a new session ID instead of continuing the original session                                                                                       |
| `agents`                      | `dict[str, AgentDefinition] \| None`         | `None`               | Programmatically defined subagents                                                                                                                                                      |
| `plugins`                     | `list[SdkPluginConfig]`                      | `[]`                 | Load custom plugins from local paths                                                                                                                                                   |
| `sandbox`                     | [`SandboxSettings`](#sandbox-settings) ` \| None` | `None`              | Configure sandbox behavior programmatically                                                                                        |
| `setting_sources`             | `list[SettingSource] \| None`                | `None` (no settings) | Control which filesystem settings to load                                                                                                                                             |
| `max_thinking_tokens`         | `int \| None`                                | `None`               | _Deprecated_ - Maximum tokens for thinking blocks                                                                                                                                     |
| `thinking`                    | [`ThinkingConfig`](#thinking-config) ` \| None` | `None`             | Controls extended thinking behavior                                                                                                                                                   |
| `effort`                      | `Literal["low", "medium", "high", "max"] \| None` | `None`          | Effort level for thinking depth                                                                                                                                                         |

### `OutputFormat`

Configuration for structured output validation.

```python
{
    "type": "json_schema",
    "schema": {...},  # Your JSON Schema definition
}
```

| Field    | Required | Description                                    |
| :------- | :------- | :--------------------------------------------- |
| `type`   | Yes      | Must be `"json_schema"` for JSON Schema validation |
| `schema` | Yes      | JSON Schema definition for output validation   |

### `SystemPromptPreset`

Configuration for using Claude Code's preset system prompt with optional additions.

```python
class SystemPromptPreset(TypedDict):
    type: Literal["preset"]
    preset: Literal["claude_code"]
    append: NotRequired[str]
```

| Field    | Required | Description                                                   |
| :------- | :------- | :------------------------------------------------------------ |
| `type`   | Yes      | Must be `"preset"` to use a preset system prompt              |
| `preset` | Yes      | Must be `"claude_code"` to use Claude Code's system prompt    |
| `append` | No       | Additional instructions to append to the preset system prompt |

### `SettingSource`

Controls which filesystem-based configuration sources the SDK loads settings from.

```python
SettingSource = Literal["user", "project", "local"]
```

| Value       | Description                                  | Location                      |
| :---------- | :------------------------------------------- | :---------------------------- |
| `"user"`    | Global user settings                         | `~/.claude/settings.json`     |
| `"project"` | Shared project settings (version controlled) | `.claude/settings.json`       |
| `"local"`   | Local project settings (gitignored)          | `.claude/settings.local.json` |

#### Default behavior

When `setting_sources` is **omitted** or **`None`**, the SDK does **not** load any filesystem settings.

#### Examples

**Load all filesystem settings:**

```python
from claude_agent_sdk import query, ClaudeAgentOptions

async for message in query(
    prompt="Analyze this code",
    options=ClaudeAgentOptions(
        setting_sources=["user", "project", "local"]
    ),
):
    print(message)
```

**Load only project settings:**

```python
async for message in query(
    prompt="Run CI checks",
    options=ClaudeAgentOptions(
        setting_sources=["project"]
    ),
):
    print(message)
```

**Loading CLAUDE.md project instructions:**

```python
async for message in query(
    prompt="Add a new feature following project conventions",
    options=ClaudeAgentOptions(
        system_prompt={
            "type": "preset",
            "preset": "claude_code",
        },
        setting_sources=["project"],  # Required to load CLAUDE.md from project
        allowed_tools=["Read", "Write", "Edit"],
    ),
):
    print(message)
```

### `AgentDefinition`

Configuration for a subagent defined programmatically.

```python
@dataclass
class AgentDefinition:
    description: str
    prompt: str
    tools: list[str] | None = None
    model: Literal["sonnet", "opus", "haiku", "inherit"] | None = None
    skills: list[str] | None = None
    memory: Literal["user", "project", "local"] | None = None
    mcpServers: list[str | dict[str, Any]] | None = None
```

| Field         | Required | Description                                                    |
| :------------ | :------- | :------------------------------------------------------------- |
| `description` | Yes      | Natural language description of when to use this agent         |
| `prompt`      | Yes      | The agent's system prompt                                      |
| `tools`       | No       | Array of allowed tool names                                    |
| `model`       | No       | Model override for this agent                                  |
| `skills`      | No       | List of skill names available to this agent                    |
| `memory`      | No       | Memory source for this agent                                   |
| `mcpServers`  | No       | MCP servers available to this agent                            |

### `PermissionMode`

Permission modes for controlling tool execution.

```python
PermissionMode = Literal[
    "default",  # Standard permission behavior
    "acceptEdits",  # Auto-accept file edits
    "plan",  # Planning mode - no execution
    "bypassPermissions",  # Bypass all permission checks
]
```

### `CanUseTool`

Type alias for tool permission callback functions.

```python
CanUseTool = Callable[
    [str, dict[str, Any], ToolPermissionContext], Awaitable[PermissionResult]
]
```

The callback receives:
- `tool_name`: Name of the tool being called
- `input_data`: The tool's input parameters
- `context`: A `ToolPermissionContext` with additional information

Returns a `PermissionResult` (either `PermissionResultAllow` or `PermissionResultDeny`).

### `ToolPermissionContext`

Context information passed to tool permission callbacks.

```python
@dataclass
class ToolPermissionContext:
    signal: Any | None = None
    suggestions: list[PermissionUpdate] = field(default_factory=list)
```

| Field | Type | Description |
|:------|:-----|:------------|
| `signal` | `Any \| None` | Reserved for future abort signal support |
| `suggestions` | `list[PermissionUpdate]` | Permission update suggestions from the CLI |

### `PermissionResult`

Union type for permission callback results.

```python
PermissionResult = PermissionResultAllow | PermissionResultDeny
```

### `PermissionResultAllow`

Result indicating the tool call should be allowed.

```python
@dataclass
class PermissionResultAllow:
    behavior: Literal["allow"] = "allow"
    updated_input: dict[str, Any] | None = None
    updated_permissions: list[PermissionUpdate] | None = None
```

| Field | Type | Default | Description |
|:------|:-----|:--------|:------------|
| `behavior` | `Literal["allow"]` | `"allow"` | Must be "allow" |
| `updated_input` | `dict[str, Any] \| None` | `None` | Modified input to use instead of original |
| `updated_permissions` | `list[PermissionUpdate] \| None` | `None` | Permission updates to apply |

### `PermissionResultDeny`

Result indicating the tool call should be denied.

```python
@dataclass
class PermissionResultDeny:
    behavior: Literal["deny"] = "deny"
    message: str = ""
    interrupt: bool = False
```

| Field | Type | Default | Description |
|:------|:-----|:--------|:------------|
| `behavior` | `Literal["deny"]` | `"deny"` | Must be "deny" |
| `message` | `str` | `""` | Message explaining why the tool was denied |
| `interrupt` | `bool` | `False` | Whether to interrupt the current execution |

### `PermissionUpdate`

Configuration for updating permissions programmatically.

```python
@dataclass
class PermissionUpdate:
    type: Literal[
        "addRules",
        "replaceRules",
        "removeRules",
        "setMode",
        "addDirectories",
        "removeDirectories",
    ]
    rules: list[PermissionRuleValue] | None = None
    behavior: Literal["allow", "deny", "ask"] | None = None
    mode: PermissionMode | None = None
    directories: list[str] | None = None
    destination: (
        Literal["userSettings", "projectSettings", "localSettings", "session"] | None
    ) = None
```

### `ToolsPreset`

Preset tools configuration for using Claude Code's default tool set.

```python
class ToolsPreset(TypedDict):
    type: Literal["preset"]
    preset: Literal["claude_code"]
```

### `ThinkingConfig`

Controls extended thinking behavior.

```python
class ThinkingConfigAdaptive(TypedDict):
    type: Literal["adaptive"]


class ThinkingConfigEnabled(TypedDict):
    type: Literal["enabled"]
    budget_tokens: int


class ThinkingConfigDisabled(TypedDict):
    type: Literal["disabled"]


ThinkingConfig = ThinkingConfigAdaptive | ThinkingConfigEnabled | ThinkingConfigDisabled
```

| Variant | Fields | Description |
| :------ | :----- | :---------- |
| `adaptive` | `type` | Claude adaptively decides when to think |
| `enabled` | `type`, `budget_tokens` | Enable thinking with a specific token budget |
| `disabled` | `type` | Disable thinking |

These are `TypedDict` classes, so they're plain dicts at runtime. Access fields with `config["budget_tokens"]`, not `config.budget_tokens`:

```python
from claude_agent_sdk import ClaudeAgentOptions, ThinkingConfigEnabled

# Option 1: dict literal (recommended)
options = ClaudeAgentOptions(thinking={"type": "enabled", "budget_tokens": 20000})

# Option 2: constructor-style
config = ThinkingConfigEnabled(type="enabled", budget_tokens=20000)
print(config["budget_tokens"])  # 20000
```

### `SdkBeta`

Literal type for SDK beta features.

```python
SdkBeta = Literal["context-1m-2025-08-07"]
```

Use with the `betas` field in `ClaudeAgentOptions` to enable beta features. Use `context-1m-2025-08-07` with Claude Sonnet 4.5 and Sonnet 4 to enable the 1M-token context window.

**Note:** Claude Opus 4.6 and Sonnet 4.6 have a 1M token context window. Including `context-1m-2025-08-07` has no effect on those models.

### `McpSdkServerConfig`

Configuration for SDK MCP servers created with `create_sdk_mcp_server()`.

```python
class McpSdkServerConfig(TypedDict):
    type: Literal["sdk"]
    name: str
    instance: Any  # MCP Server instance
```

### `McpServerConfig`

Union type for MCP server configurations.

```python
McpServerConfig = (
    McpStdioServerConfig | McpSSEServerConfig | McpHttpServerConfig | McpSdkServerConfig
)
```

#### `McpStdioServerConfig`

```python
class McpStdioServerConfig(TypedDict):
    type: NotRequired[Literal["stdio"]]
    command: str
    args: NotRequired[list[str]]
    env: NotRequired[dict[str, str]]
```

#### `McpSSEServerConfig`

```python
class McpSSEServerConfig(TypedDict):
    type: Literal["sse"]
    url: str
    headers: NotRequired[dict[str, str]]
```

#### `McpHttpServerConfig`

```python
class McpHttpServerConfig(TypedDict):
    type: Literal["http"]
    url: str
    headers: NotRequired[dict[str, str]]
```

### `McpServerStatusConfig`

The configuration of an MCP server as reported by `get_mcp_status()`.

```python
McpServerStatusConfig = (
    McpStdioServerConfig
    | McpSSEServerConfig
    | McpHttpServerConfig
    | McpSdkServerConfigStatus
    | McpClaudeAIProxyServerConfig
)
```

### `McpStatusResponse`

Response from `ClaudeSDKClient.get_mcp_status()`.

```python
class McpStatusResponse(TypedDict):
    mcpServers: list[McpServerStatus]
```

### `McpServerStatus`

Status of a connected MCP server.

```python
class McpServerStatus(TypedDict):
    name: str
    status: McpServerConnectionStatus  # "connected" | "failed" | "needs-auth" | "pending" | "disabled"
    serverInfo: NotRequired[McpServerInfo]
    error: NotRequired[str]
    config: NotRequired[McpServerStatusConfig]
    scope: NotRequired[str]
    tools: NotRequired[list[McpToolInfo]]
```

| Field | Type | Description |
|:------|:-----|:------------|
| `name` | `str` | Server name |
| `status` | `str` | One of `"connected"`, `"failed"`, `"needs-auth"`, `"pending"`, or `"disabled"` |
| `serverInfo` | `dict` (optional) | Server name and version |
| `error` | `str` (optional) | Error message if the server failed to connect |
| `config` | [`McpServerStatusConfig`](#mcp-server-status-config) (optional) | Server configuration |
| `scope` | `str` (optional) | Configuration scope |
| `tools` | `list` (optional) | Tools provided by this server |

### `SdkPluginConfig`

Configuration for loading plugins in the SDK.

```python
class SdkPluginConfig(TypedDict):
    type: Literal["local"]
    path: str
```

| Field | Type | Description |
|:------|:-----|:------------|
| `type` | `Literal["local"]` | Must be `"local"` |
| `path` | `str` | Absolute or relative path to the plugin directory |

## Message Types

### `Message`

Union type of all possible messages.

```python
Message = (
    UserMessage
    | AssistantMessage
    | SystemMessage
    | ResultMessage
    | StreamEvent
    | RateLimitEvent
)
```

### `UserMessage`

User input message.

```python
@dataclass
class UserMessage:
    content: str | list[ContentBlock]
    uuid: str | None = None
    parent_tool_use_id: str | None = None
    tool_use_result: dict[str, Any] | None = None
```

| Field                | Type                        | Description                                           |
| :------------------- | :-------------------------- | :---------------------------------------------------- |
| `content`            | `str \| list[ContentBlock]` | Message content as text or content blocks              |
| `uuid`               | `str \| None`               | Unique message identifier                              |
| `parent_tool_use_id` | `str \| None`               | Tool use ID if this message is a tool result response  |
| `tool_use_result`    | `dict[str, Any] \| None`   | Tool result data if applicable                         |

### `AssistantMessage`

Assistant response message with content blocks.

```python
@dataclass
class AssistantMessage:
    content: list[ContentBlock]
    model: str
    parent_tool_use_id: str | None = None
    error: AssistantMessageError | None = None
    usage: dict[str, Any] | None = None
```

| Field                | Type                                  | Description                                            |
| :------------------- | :------------------------------------ | :----------------------------------------------------- |
| `content`            | `list[ContentBlock]`                  | List of content blocks in the response                 |
| `model`              | `str`                                 | Model that generated the response                      |
| `parent_tool_use_id` | `str \| None`                         | Tool use ID if this is a nested response               |
| `error`              | [`AssistantMessageError`](#assistant-message-error) ` \| None` | Error type if the response encountered an error |
| `usage`              | `dict[str, Any] \| None`              | Per-message token usage |

### `AssistantMessageError`

Possible error types for assistant messages.

```python
AssistantMessageError = Literal[
    "authentication_failed",
    "billing_error",
    "rate_limit",
    "invalid_request",
    "server_error",
    "max_output_tokens",
    "unknown",
]
```

### `SystemMessage`

System message with metadata.

```python
@dataclass
class SystemMessage:
    subtype: str
    data: dict[str, Any]
```

### `ResultMessage`

Final result message with cost and usage information.

```python
@dataclass
class ResultMessage:
    subtype: str
    duration_ms: int
    duration_api_ms: int
    is_error: bool
    num_turns: int
    session_id: str
    total_cost_usd: float | None = None
    usage: dict[str, Any] | None = None
    result: str | None = None
    stop_reason: str | None = None
    structured_output: Any = None
```

The `usage` dict contains the following keys when present:

| Key | Type | Description |
| --- | --- | --- |
| `input_tokens` | `int` | Total input tokens consumed |
| `output_tokens` | `int` | Total output tokens generated |
| `cache_creation_input_tokens` | `int` | Tokens used to create new cache entries |
| `cache_read_input_tokens` | `int` | Tokens read from existing cache entries |

### `StreamEvent`

Stream event for partial message updates during streaming. Only received when `include_partial_messages=True`.

```python
@dataclass
class StreamEvent:
    uuid: str
    session_id: str
    event: dict[str, Any]
    parent_tool_use_id: str | None = None
```

| Field | Type | Description |
|:------|:-----|:------------|
| `uuid` | `str` | Unique identifier for this event |
| `session_id` | `str` | Session identifier |
| `event` | `dict[str, Any]` | The raw Claude API stream event data |
| `parent_tool_use_id` | `str \| None` | Parent tool use ID if from a subagent |

### `RateLimitEvent`

Emitted when rate limit status changes.

```python
@dataclass
class RateLimitEvent:
    rate_limit_info: RateLimitInfo
    uuid: str
    session_id: str
```

| Field | Type | Description |
|:------|:-----|:------------|
| `rate_limit_info` | [`RateLimitInfo`](#rate-limit-info) | Current rate limit state |
| `uuid` | `str` | Unique event identifier |
| `session_id` | `str` | Session identifier |

### `RateLimitInfo`

Rate limit state carried by `RateLimitEvent`.

```python
RateLimitStatus = Literal["allowed", "allowed_warning", "rejected"]
RateLimitType = Literal[
    "five_hour", "seven_day", "seven_day_opus", "seven_day_sonnet", "overage"
]


@dataclass
class RateLimitInfo:
    status: RateLimitStatus
    resets_at: int | None = None
    rate_limit_type: RateLimitType | None = None
    utilization: float | None = None
    overage_status: RateLimitStatus | None = None
    overage_resets_at: int | None = None
    overage_disabled_reason: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)
```

| Field | Type | Description |
|:------|:-----|:------------|
| `status` | `RateLimitStatus` | Current status |
| `resets_at` | `int \| None` | Unix timestamp when the rate limit window resets |
| `rate_limit_type` | `RateLimitType \| None` | Which rate limit window applies |
| `utilization` | `float \| None` | Fraction of the rate limit consumed (0.0 to 1.0) |
| `overage_status` | `RateLimitStatus \| None` | Status of pay-as-you-go overage usage |
| `overage_resets_at` | `int \| None` | Unix timestamp when the overage window resets |
| `overage_disabled_reason` | `str \| None` | Why overage is unavailable |
| `raw` | `dict[str, Any]` | Full raw dict from the CLI |

### `TaskStartedMessage`

Emitted when a background task starts.

```python
@dataclass
class TaskStartedMessage(SystemMessage):
    task_id: str
    description: str
    uuid: str
    session_id: str
    tool_use_id: str | None = None
    task_type: str | None = None
```

| Field | Type | Description |
|:------|:-----|:------------|
| `task_id` | `str` | Unique identifier for the task |
| `description` | `str` | Description of the task |
| `uuid` | `str` | Unique message identifier |
| `session_id` | `str` | Session identifier |
| `tool_use_id` | `str \| None` | Associated tool use ID |
| `task_type` | `str \| None` | Which kind of background task |

### `TaskUsage`

Token and timing data for a background task.

```python
class TaskUsage(TypedDict):
    total_tokens: int
    tool_uses: int
    duration_ms: int
```

### `TaskProgressMessage`

Emitted periodically with progress updates for a running background task.

```python
@dataclass
class TaskProgressMessage(SystemMessage):
    task_id: str
    description: str
    usage: TaskUsage
    uuid: str
    session_id: str
    tool_use_id: str | None = None
    last_tool_name: str | None = None
```

| Field | Type | Description |
|:------|:-----|:------------|
| `task_id` | `str` | Unique identifier for the task |
| `description` | `str` | Current status description |
| `usage` | `TaskUsage` | Token usage for this task so far |
| `uuid` | `str` | Unique message identifier |
| `session_id` | `str` | Session identifier |
| `tool_use_id` | `str \| None` | Associated tool use ID |
| `last_tool_name` | `str \| None` | Name of the last tool the task used |

### `TaskNotificationMessage`

Emitted when a task completes, fails, or is stopped.

```python
@dataclass
class TaskNotificationMessage(SystemMessage):
    task_id: str
    status: TaskNotificationStatus  # "completed" | "failed" | "stopped"
    output_file: str
    summary: str
    uuid: str
    session_id: str
    tool_use_id: str | None = None
    usage: TaskUsage | None = None
```

| Field | Type | Description |
|:------|:-----|:------------|
| `task_id` | `str` | Unique identifier for the task |
| `status` | `TaskNotificationStatus` | One of `"completed"`, `"failed"`, or `"stopped"` |
| `output_file` | `str` | Path to the task output file |
| `summary` | `str` | Summary of the task result |
| `uuid` | `str` | Unique message identifier |
| `session_id` | `str` | Session identifier |
| `tool_use_id` | `str \| None` | Associated tool use ID |
| `usage` | `TaskUsage \| None` | Final token usage for the task |

## Content Block Types

### `ContentBlock`

Union type of all content blocks.

```python
ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock
```

### `TextBlock`

Text content block.

```python
@dataclass
class TextBlock:
    text: str
```

### `ThinkingBlock`

Thinking content block (for models with thinking capability).

```python
@dataclass
class ThinkingBlock:
    thinking: str
    signature: str
```

### `ToolUseBlock`

Tool use request block.

```python
@dataclass
class ToolUseBlock:
    id: str
    name: str
    input: dict[str, Any]
```

### `ToolResultBlock`

Tool execution result block.

```python
@dataclass
class ToolResultBlock:
    tool_use_id: str
    content: str | list[dict[str, Any]] | None = None
    is_error: bool | None = None
```

## Error Types

### `ClaudeSDKError`

Base exception class for all SDK errors.

```python
class ClaudeSDKError(Exception):
    """Base error for Claude SDK."""
```

### `CLINotFoundError`

Raised when Claude Code CLI is not installed or not found.

```python
class CLINotFoundError(CLIConnectionError):
    def __init__(
        self, message: str = "Claude Code not found", cli_path: str | None = None
    ):
        """
        Args:
            message: Error message (default: "Claude Code not found")
            cli_path: Optional path to the CLI that was not found
        """
```

### `CLIConnectionError`

Raised when connection to Claude Code fails.

```python
class CLIConnectionError(ClaudeSDKError):
    """Failed to connect to Claude Code."""
```

### `ProcessError`

Raised when the Claude Code process fails.

```python
class ProcessError(ClaudeSDKError):
    def __init__(
        self, message: str, exit_code: int | None = None, stderr: str | None = None
    ):
        self.exit_code = exit_code
        self.stderr = stderr
```

### `CLIJSONDecodeError`

Raised when JSON parsing fails.

```python
class CLIJSONDecodeError(ClaudeSDKError):
    def __init__(self, line: str, original_error: Exception):
        """
        Args:
            line: The line that failed to parse
            original_error: The original JSON decode exception
        """
        self.line = line
        self.original_error = original_error
```

## Hook Types

### `HookEvent`

Supported hook event types.

```python
HookEvent = Literal[
    "PreToolUse",  # Called before tool execution
    "PostToolUse",  # Called after tool execution
    "PostToolUseFailure",  # Called when a tool execution fails
    "UserPromptSubmit",  # Called when user submits a prompt
    "Stop",  # Called when stopping execution
    "SubagentStop",  # Called when a subagent stops
    "PreCompact",  # Called before message compaction
    "Notification",  # Called for notification events
    "SubagentStart",  # Called when a subagent starts
    "PermissionRequest",  # Called when a permission decision is needed
]
```

**Note:** The TypeScript SDK supports additional hook events not yet available in Python.

### `HookCallback`

Type definition for hook callback functions.

```python
HookCallback = Callable[[HookInput, str | None, HookContext], Awaitable[HookJSONOutput]]
```

Parameters:

- `input`: Strongly-typed hook input with discriminated unions based on `hook_event_name`
- `tool_use_id`: Optional tool use identifier (for tool-related hooks)
- `context`: Hook context with additional information

Returns a [`HookJSONOutput`](#hook-json-output).

### `HookContext`

Context information passed to hook callbacks.

```python
class HookContext(TypedDict):
    signal: Any | None
```

### `HookMatcher`

Configuration for matching hooks to specific events or tools.

```python
@dataclass
class HookMatcher:
    matcher: str | None = None
    hooks: list[HookCallback] = field(default_factory=list)
    timeout: float | None = None
```

| Field | Type | Description |
|:------|:-----|:------------|
| `matcher` | `str \| None` | Tool name or pattern to match (e.g., `"Bash"`, `"Write\|Edit"`) |
| `hooks` | `list[HookCallback]` | List of callbacks to execute |
| `timeout` | `float \| None` | Timeout in seconds for all hooks (default: 60) |

### `HookInput`

Union type of all hook input types.

```python
HookInput = (
    PreToolUseHookInput
    | PostToolUseHookInput
    | PostToolUseFailureHookInput
    | UserPromptSubmitHookInput
    | StopHookInput
    | SubagentStopHookInput
    | PreCompactHookInput
    | NotificationHookInput
    | SubagentStartHookInput
    | PermissionRequestHookInput
)
```

### `BaseHookInput`

Base fields present in all hook input types.

```python
class BaseHookInput(TypedDict):
    session_id: str
    transcript_path: str
    cwd: str
    permission_mode: NotRequired[str]
```

| Field | Type | Description |
|:------|:-----|:------------|
| `session_id` | `str` | Current session identifier |
| `transcript_path` | `str` | Path to the session transcript file |
| `cwd` | `str` | Current working directory |
| `permission_mode` | `str` (optional) | Current permission mode |

### `PreToolUseHookInput`

Input data for `PreToolUse` hook events.

```python
class PreToolUseHookInput(BaseHookInput):
    hook_event_name: Literal["PreToolUse"]
    tool_name: str
    tool_input: dict[str, Any]
    tool_use_id: str
    agent_id: NotRequired[str]
    agent_type: NotRequired[str]
```

### `PostToolUseHookInput`

Input data for `PostToolUse` hook events.

```python
class PostToolUseHookInput(BaseHookInput):
    hook_event_name: Literal["PostToolUse"]
    tool_name: str
    tool_input: dict[str, Any]
    tool_response: Any
    tool_use_id: str
    agent_id: NotRequired[str]
    agent_type: NotRequired[str]
```

### `PostToolUseFailureHookInput`

Input data for `PostToolUseFailure` hook events.

```python
class PostToolUseFailureHookInput(BaseHookInput):
    hook_event_name: Literal["PostToolUseFailure"]
    tool_name: str
    tool_input: dict[str, Any]
    tool_use_id: str
    error: str
    is_interrupt: NotRequired[bool]
    agent_id: NotRequired[str]
    agent_type: NotRequired[str]
```

### `UserPromptSubmitHookInput`

Input data for `UserPromptSubmit` hook events.

```python
class UserPromptSubmitHookInput(BaseHookInput):
    hook_event_name: Literal["UserPromptSubmit"]
    prompt: str
```

### `StopHookInput`

Input data for `Stop` hook events.

```python
class StopHookInput(BaseHookInput):
    hook_event_name: Literal["Stop"]
    stop_hook_active: bool
```

### `SubagentStopHookInput`

Input data for `SubagentStop` hook events.

```python
class SubagentStopHookInput(BaseHookInput):
    hook_event_name: Literal["SubagentStop"]
    stop_hook_active: bool
    agent_id: str
    agent_transcript_path: str
    agent_type: str
```

### `PreCompactHookInput`

Input data for `PreCompact` hook events.

```python
class PreCompactHookInput(BaseHookInput):
    hook_event_name: Literal["PreCompact"]
    trigger: Literal["manual", "auto"]
    custom_instructions: str | None
```

### `NotificationHookInput`

Input data for `Notification` hook events.

```python
class NotificationHookInput(BaseHookInput):
    hook_event_name: Literal["Notification"]
    message: str
    title: NotRequired[str]
    notification_type: str
```

### `SubagentStartHookInput`

Input data for `SubagentStart` hook events.

```python
class SubagentStartHookInput(BaseHookInput):
    hook_event_name: Literal["SubagentStart"]
    agent_id: str
    agent_type: str
```

### `PermissionRequestHookInput`

Input data for `PermissionRequest` hook events.

```python
class PermissionRequestHookInput(BaseHookInput):
    hook_event_name: Literal["PermissionRequest"]
    tool_name: str
    tool_input: dict[str, Any]
    permission_suggestions: NotRequired[list[Any]]
```

### `HookJSONOutput`

Union type for hook callback return values.

```python
HookJSONOutput = AsyncHookJSONOutput | SyncHookJSONOutput
```

#### `SyncHookJSONOutput`

Synchronous hook output with control and decision fields.

```python
class SyncHookJSONOutput(TypedDict):
    # Control fields
    continue_: NotRequired[bool]  # Use continue_ (with underscore) in Python
    suppressOutput: NotRequired[bool]
    stopReason: NotRequired[str]

    # Decision fields
    decision: NotRequired[Literal["block"]]
    systemMessage: NotRequired[str]
    reason: NotRequired[str]

    # Hook-specific output
    hookSpecificOutput: NotRequired[HookSpecificOutput]
```

**Note:** Use `continue_` (with underscore) in Python code. It is automatically converted to `continue` when sent to the CLI.

#### `HookSpecificOutput`

A discriminated union of event-specific output types. The `hookEventName` field determines which fields are valid.

```python
class PreToolUseHookSpecificOutput(TypedDict):
    hookEventName: Literal["PreToolUse"]
    permissionDecision: NotRequired[Literal["allow", "deny", "ask"]]
    permissionDecisionReason: NotRequired[str]
    updatedInput: NotRequired[dict[str, Any]]
    additionalContext: NotRequired[str]


class PostToolUseHookSpecificOutput(TypedDict):
    hookEventName: Literal["PostToolUse"]
    additionalContext: NotRequired[str]
    updatedMCPToolOutput: NotRequired[Any]


class PostToolUseFailureHookSpecificOutput(TypedDict):
    hookEventName: Literal["PostToolUseFailure"]
    additionalContext: NotRequired[str]


class UserPromptSubmitHookSpecificOutput(TypedDict):
    hookEventName: Literal["UserPromptSubmit"]
    additionalContext: NotRequired[str]


class NotificationHookSpecificOutput(TypedDict):
    hookEventName: Literal["Notification"]
    additionalContext: NotRequired[str]


class SubagentStartHookSpecificOutput(TypedDict):
    hookEventName: Literal["SubagentStart"]
    additionalContext: NotRequired[str]


class PermissionRequestHookSpecificOutput(TypedDict):
    hookEventName: Literal["PermissionRequest"]
    decision: dict[str, Any]


HookSpecificOutput = (
    PreToolUseHookSpecificOutput
    | PostToolUseHookSpecificOutput
    | PostToolUseFailureHookSpecificOutput
    | UserPromptSubmitHookSpecificOutput
    | NotificationHookSpecificOutput
    | SubagentStartHookSpecificOutput
    | PermissionRequestHookSpecificOutput
)
```

#### `AsyncHookJSONOutput`

Async hook output that defers hook execution.

```python
class AsyncHookJSONOutput(TypedDict):
    async_: Literal[True]  # Use async_ (with underscore) in Python
    asyncTimeout: NotRequired[int]
```

**Note:** Use `async_` (with underscore) in Python code. It is automatically converted to `async` when sent to the CLI.

### Hook Usage Example

This example registers two hooks: one that blocks dangerous bash commands, and another that logs all tool usage.

```python
from claude_agent_sdk import query, ClaudeAgentOptions, HookMatcher, HookContext
from typing import Any


async def validate_bash_command(
    input_data: dict[str, Any], tool_use_id: str | None, context: HookContext
) -> dict[str, Any]:
    """Validate and potentially block dangerous bash commands."""
    if input_data["tool_name"] == "Bash":
        command = input_data["tool_input"].get("command", "")
        if "rm -rf /" in command:
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": "Dangerous command blocked",
                }
            }
    return {}


async def log_tool_use(
    input_data: dict[str, Any], tool_use_id: str | None, context: HookContext
) -> dict[str, Any]:
    """Log all tool usage for auditing."""
    print(f"Tool used: {input_data.get('tool_name')}")
    return {}


options = ClaudeAgentOptions(
    hooks={
        "PreToolUse": [
            HookMatcher(
                matcher="Bash", hooks=[validate_bash_command], timeout=120
            ),
            HookMatcher(hooks=[log_tool_use]),
        ],
        "PostToolUse": [HookMatcher(hooks=[log_tool_use])],
    }
)

async for message in query(prompt="Analyze this codebase", options=options):
    print(message)
```

## Tool Input/Output Types

Documentation of input/output schemas for all built-in Claude Code tools.

### Agent

**Tool name:** `Agent` (previously `Task`, which is still accepted as an alias)

**Input:**

```python
{
    "description": str,
    "prompt": str,
    "subagent_type": str,
}
```

**Output:**

```python
{
    "result": str,
    "usage": dict | None,
    "total_cost_usd": float | None,
    "duration_ms": int | None,
}
```

### AskUserQuestion

**Tool name:** `AskUserQuestion`

Asks the user clarifying questions during execution.

**Input:**

```python
{
    "questions": [
        {
            "question": str,
            "header": str,
            "options": [
                {
                    "label": str,
                    "description": str,
                }
            ],
            "multiSelect": bool,
        }
    ],
    "answers": dict | None,
}
```

**Output:**

```python
{
    "questions": [...],
    "answers": dict[str, str],
}
```

### Bash

**Tool name:** `Bash`

**Input:**

```python
{
    "command": str,
    "timeout": int | None,
    "description": str | None,
    "run_in_background": bool | None,
}
```

**Output:**

```python
{
    "output": str,
    "exitCode": int,
    "killed": bool | None,
    "shellId": str | None,
}
```

### Edit

**Tool name:** `Edit`

**Input:**

```python
{
    "file_path": str,
    "old_string": str,
    "new_string": str,
    "replace_all": bool | None,
}
```

**Output:**

```python
{
    "message": str,
    "replacements": int,
    "file_path": str,
}
```

### Read

**Tool name:** `Read`

**Input:**

```python
{
    "file_path": str,
    "offset": int | None,
    "limit": int | None,
}
```

**Output (Text files):**

```python
{
    "content": str,
    "total_lines": int,
    "lines_returned": int,
}
```

**Output (Images):**

```python
{
    "image": str,
    "mime_type": str,
    "file_size": int,
}
```

### Write

**Tool name:** `Write`

**Input:**

```python
{
    "file_path": str,
    "content": str,
}
```

**Output:**

```python
{
    "message": str,
    "bytes_written": int,
    "file_path": str,
}
```

### Glob

**Tool name:** `Glob`

**Input:**

```python
{
    "pattern": str,
    "path": str | None,
}
```

**Output:**

```python
{
    "matches": list[str],
    "count": int,
    "search_path": str,
}
```

### Grep

**Tool name:** `Grep`

**Input:**

```python
{
    "pattern": str,
    "path": str | None,
    "glob": str | None,
    "type": str | None,
    "output_mode": str | None,
    "-i": bool | None,
    "-n": bool | None,
    "-B": int | None,
    "-A": int | None,
    "-C": int | None,
    "head_limit": int | None,
    "multiline": bool | None,
}
```

**Output (content mode):**

```python
{
    "matches": [
        {
            "file": str,
            "line_number": int | None,
            "line": str,
            "before_context": list[str] | None,
            "after_context": list[str] | None,
        }
    ],
    "total_matches": int,
}
```

**Output (files_with_matches mode):**

```python
{
    "files": list[str],
    "count": int,
}
```

### NotebookEdit

**Tool name:** `NotebookEdit`

**Input:**

```python
{
    "notebook_path": str,
    "cell_id": str | None,
    "new_source": str,
    "cell_type": "code" | "markdown" | None,
    "edit_mode": "replace" | "insert" | "delete" | None,
}
```

**Output:**

```python
{
    "message": str,
    "edit_type": "replaced" | "inserted" | "deleted",
    "cell_id": str | None,
    "total_cells": int,
}
```

### WebFetch

**Tool name:** `WebFetch`

**Input:**

```python
{
    "url": str,
    "prompt": str,
}
```

**Output:**

```python
{
    "response": str,
    "url": str,
    "final_url": str | None,
    "status_code": int | None,
}
```

### WebSearch

**Tool name:** `WebSearch`

**Input:**

```python
{
    "query": str,
    "allowed_domains": list[str] | None,
    "blocked_domains": list[str] | None,
}
```

**Output:**

```python
{
    "results": [{"title": str, "url": str, "snippet": str, "metadata": dict | None}],
    "total_results": int,
    "query": str,
}
```

### TodoWrite

**Tool name:** `TodoWrite`

**Input:**

```python
{
    "todos": [
        {
            "content": str,
            "status": "pending" | "in_progress" | "completed",
            "activeForm": str,
        }
    ]
}
```

**Output:**

```python
{
    "message": str,
    "stats": {"total": int, "pending": int, "in_progress": int, "completed": int},
}
```

### BashOutput

**Tool name:** `BashOutput`

**Input:**

```python
{
    "bash_id": str,
    "filter": str | None,
}
```

**Output:**

```python
{
    "output": str,
    "status": "running" | "completed" | "failed",
    "exitCode": int | None,
}
```

### KillBash

**Tool name:** `KillBash`

**Input:**

```python
{
    "shell_id": str
}
```

**Output:**

```python
{
    "message": str,
    "shell_id": str,
}
```

### ExitPlanMode

**Tool name:** `ExitPlanMode`

**Input:**

```python
{
    "plan": str
}
```

**Output:**

```python
{
    "message": str,
    "approved": bool | None,
}
```

### ListMcpResources

**Tool name:** `ListMcpResources`

**Input:**

```python
{
    "server": str | None
}
```

**Output:**

```python
{
    "resources": [
        {
            "uri": str,
            "name": str,
            "description": str | None,
            "mimeType": str | None,
            "server": str,
        }
    ],
    "total": int,
}
```

### ReadMcpResource

**Tool name:** `ReadMcpResource`

**Input:**

```python
{
    "server": str,
    "uri": str,
}
```

**Output:**

```python
{
    "contents": [
        {"uri": str, "mimeType": str | None, "text": str | None, "blob": str | None}
    ],
    "server": str,
}
```

## Advanced Features with ClaudeSDKClient

### Building a Continuous Conversation Interface

```python
from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AssistantMessage,
    TextBlock,
)
import asyncio


class ConversationSession:
    """Maintains a single conversation session with Claude."""

    def __init__(self, options: ClaudeAgentOptions | None = None):
        self.client = ClaudeSDKClient(options)
        self.turn_count = 0

    async def start(self):
        await self.client.connect()
        print("Starting conversation session. Claude will remember context.")
        print(
            "Commands: 'exit' to quit, 'interrupt' to stop current task, 'new' for new session"
        )

        while True:
            user_input = input(f"\n[Turn {self.turn_count + 1}] You: ")

            if user_input.lower() == "exit":
                break
            elif user_input.lower() == "interrupt":
                await self.client.interrupt()
                print("Task interrupted!")
                continue
            elif user_input.lower() == "new":
                # Disconnect and reconnect for a fresh session
                await self.client.disconnect()
                await self.client.connect()
                self.turn_count = 0
                print("Started new conversation session (previous context cleared)")
                continue

            # Send message - the session retains all previous messages
            await self.client.query(user_input)
            self.turn_count += 1

            # Process response
            print(f"[Turn {self.turn_count}] Claude: ", end="")
            async for message in self.client.receive_response():
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            print(block.text, end="")
            print()  # New line after response

        await self.client.disconnect()
        print(f"Conversation ended after {self.turn_count} turns.")


async def main():
    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Write", "Bash"], permission_mode="acceptEdits"
    )
    session = ConversationSession(options)
    await session.start()


asyncio.run(main())
```

### Using Hooks for Behavior Modification

```python
from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    HookMatcher,
    HookContext,
)
import asyncio
from typing import Any


async def pre_tool_logger(
    input_data: dict[str, Any], tool_use_id: str | None, context: HookContext
) -> dict[str, Any]:
    """Log all tool usage before execution."""
    tool_name = input_data.get("tool_name", "unknown")
    print(f"[PRE-TOOL] About to use: {tool_name}")

    if tool_name == "Bash" and "rm -rf" in str(input_data.get("tool_input", {})):
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "Dangerous command blocked",
            }
        }
    return {}


async def post_tool_logger(
    input_data: dict[str, Any], tool_use_id: str | None, context: HookContext
) -> dict[str, Any]:
    """Log results after tool execution."""
    tool_name = input_data.get("tool_name", "unknown")
    print(f"[POST-TOOL] Completed: {tool_name}")
    return {}


async def main():
    options = ClaudeAgentOptions(
        hooks={
            "PreToolUse": [
                HookMatcher(hooks=[pre_tool_logger]),
                HookMatcher(matcher="Bash", hooks=[pre_tool_logger]),
            ],
            "PostToolUse": [HookMatcher(hooks=[post_tool_logger])],
        },
        allowed_tools=["Read", "Write", "Bash"],
    )

    async with ClaudeSDKClient(options=options) as client:
        await client.query("List files in current directory")

        async for message in client.receive_response():
            pass


asyncio.run(main())
```