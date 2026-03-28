# Agent SDK Reference — Python

> Source: https://platform.claude.com/docs/en/agent-sdk/python
> Fetched: 2026-03-28
> Note: Full reference is 700+ lines. Key API surface documented below.

## Installation

```bash
pip install claude-agent-sdk
```

## Choosing Between `query()` and `ClaudeSDKClient`

| Feature | `query()` | `ClaudeSDKClient` |
|---------|-----------|-------------------|
| Session | New each time | Reuses same session |
| Conversation | Single exchange | Multiple exchanges |
| Interrupts | Not supported | Supported |
| Continue Chat | No | Yes |
| Use Case | One-off tasks | Continuous conversations |

## Core Functions

### `query(prompt, options?, transport?)` → `AsyncIterator[Message]`

```python
async for message in query(prompt="Create a Python web server", options=options):
    print(message)
```

### `@tool(name, description, input_schema, annotations?)` → decorator

```python
@tool("greet", "Greet a user", {"name": str})
async def greet(args: dict[str, Any]) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": f"Hello, {args['name']}!"}]}
```

### `create_sdk_mcp_server(name, version?, tools?)` → `McpSdkServerConfig`

```python
calculator = create_sdk_mcp_server(
    name="calculator",
    tools=[add, multiply],
)
options = ClaudeAgentOptions(
    mcp_servers={"calc": calculator},
    allowed_tools=["mcp__calc__add", "mcp__calc__multiply"],
)
```

### Session Management

- `list_sessions(directory?, limit?, include_worktrees?)` → `list[SDKSessionInfo]`
- `get_session_messages(session_id, directory?, limit?, offset?)` → `list[SessionMessage]`
- `get_session_info(session_id, directory?)` → `SDKSessionInfo | None`
- `rename_session(session_id, title, directory?)` → `None`
- `tag_session(session_id, tag, directory?)` → `None`

## ClaudeSDKClient

Maintains conversation context across multiple exchanges.

```python
async with ClaudeSDKClient() as client:
    await client.query("What's the capital of France?")
    async for message in client.receive_response():
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    print(f"Claude: {block.text}")

    # Follow-up — session retains context
    await client.query("What's the population of that city?")
    async for message in client.receive_response():
        # ...
```

### Client Methods

| Method | Description |
|--------|-------------|
| `connect(prompt?)` | Connect with optional initial prompt |
| `query(prompt)` | Send a new request |
| `receive_messages()` | All messages as async iterator |
| `receive_response()` | Messages until ResultMessage |
| `interrupt()` | Send interrupt signal |
| `set_permission_mode(mode)` | Change permission mode |
| `set_model(model)` | Change model |
| `rewind_files(message_id)` | Restore files to checkpoint |
| `get_mcp_status()` | Get MCP server status |
| `reconnect_mcp_server(name)` | Reconnect failed MCP server |
| `toggle_mcp_server(name, enabled)` | Enable/disable MCP server |
| `stop_task(task_id)` | Stop background task |
| `disconnect()` | Disconnect |

### Custom Permission Handler

```python
async def custom_permission_handler(
    tool_name: str, input_data: dict, context: ToolPermissionContext
) -> PermissionResultAllow | PermissionResultDeny:
    if tool_name == "Write" and input_data.get("file_path", "").startswith("/system/"):
        return PermissionResultDeny(message="System directory write not allowed", interrupt=True)
    return PermissionResultAllow(updated_input=input_data)
```
