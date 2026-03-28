# MCP Python SDK

> Source: https://github.com/modelcontextprotocol/python-sdk
> Fetched: 2026-03-28

Official Model Context Protocol Python SDK for building MCP clients and servers.

## Installation

```bash
uv add "mcp[cli]"
# or
pip install "mcp[cli]"
```

## Quick Start — FastMCP

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Demo", json_response=True)

@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two numbers"""
    return a + b

@mcp.resource("greeting://{name}")
def get_greeting(name: str) -> str:
    """Get a personalized greeting"""
    return f"Hello, {name}!"

if __name__ == "__main__":
    mcp.run(transport="streamable-http")
```

## Core Concepts

### Resources
Data exposure (GET-like). URI-based patterns, no side effects.

### Tools
Action execution (POST-like). Typed parameters, side effects allowed.

### Prompts
Reusable interaction templates for standardized LLM communication.

## Transport Options

| Transport | Description |
|-----------|-------------|
| stdio | Direct process communication |
| SSE | Server-Sent Events for real-time |
| Streamable HTTP | HTTP with streaming support |

## Structured Output

Automatic structured results from type annotations:
- Pydantic BaseModel subclasses
- TypedDicts
- Dataclasses
- `dict[str, T]` patterns
- Primitives (wrapped as `{"result": value}`)

## Advanced Features

- **Context Injection**: Tools receive `Context` for logging, progress, capability access
- **Progress Reporting**: `ctx.report_progress()` for long-running operations
- **Custom Lifespan**: Async context managers for startup/shutdown
- **Direct CallToolResult**: Full control over response metadata

## Documentation

- Full docs: https://modelcontextprotocol.github.io/python-sdk/
- MCP spec: https://spec.modelcontextprotocol.io

## Stats

- 22.4k stars, 3.2k forks
- 233 issues, 152 PRs
- License: MIT
