---
source: https://github.com/modelcontextprotocol/python-sdk/blob/main/README.md
fetched: 2026-03-28
description: MCP Python SDK — FastMCP server, resources, tools, structured output, transports
---

# MCP Python SDK

The official Python SDK for the Model Context Protocol (MCP). Build MCP servers and clients with a Pythonic API using FastMCP.

## Installation

```bash
pip install mcp
```

Or with optional dependencies:

```bash
pip install mcp[cli]     # Includes CLI tools
pip install mcp[server]  # Server dependencies
pip install mcp[client]  # Client dependencies
```

## Quickstart

### FastMCP Server

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("my-server")

@mcp.tool()
def greet(name: str) -> str:
    """Greet a user by name."""
    return f"Hello, {name}!"

@mcp.resource("config://app")
def get_config() -> str:
    """Return application configuration."""
    return json.dumps({"version": "1.0", "debug": False})

@mcp.prompt()
def review_prompt(code: str) -> str:
    """Generate a code review prompt."""
    return f"Please review this code:\n\n{code}"

mcp.run()
```

## Core Concepts

### Server with Lifespan

Manage server startup and shutdown:

```python
from contextlib import asynccontextmanager
from mcp.server.fastmcp import FastMCP

@asynccontextmanager
async def lifespan(server: FastMCP):
    # Startup
    db = await Database.connect()
    server.state["db"] = db
    yield
    # Shutdown
    await db.disconnect()

mcp = FastMCP("db-server", lifespan=lifespan)
```

### Resources

Expose data to clients:

```python
@mcp.resource("file://{path}")
def read_file(path: str) -> str:
    """Read a file from the filesystem."""
    return Path(path).read_text()

@mcp.resource("db://users/{user_id}")
async def get_user(user_id: int) -> str:
    """Fetch user data from the database."""
    user = await db.get_user(user_id)
    return json.dumps(user)
```

### Tools with Structured Output

Return structured data from tools:

```python
from pydantic import BaseModel

class AnalysisResult(BaseModel):
    score: float
    issues: list[str]
    recommendations: list[str]

@mcp.tool(output_model=AnalysisResult)
def analyze_code(code: str) -> AnalysisResult:
    """Analyze code quality."""
    return AnalysisResult(
        score=8.5,
        issues=["Missing type hints"],
        recommendations=["Add type annotations"],
    )
```

### Prompts

Define reusable prompt templates:

```python
@mcp.prompt()
def debug_prompt(error: str, stack_trace: str) -> str:
    """Create a debugging prompt."""
    return f"""Debug this error:

Error: {error}

Stack trace:
{stack_trace}

Provide a root cause analysis and fix."""
```

### Context

Access MCP context within tools:

```python
from mcp.server.fastmcp import Context

@mcp.tool()
async def smart_tool(query: str, ctx: Context) -> str:
    """A tool that uses context."""
    # Log progress
    await ctx.report_progress(0.5, "Processing...")

    # Access server state
    db = ctx.server.state["db"]

    # Read a resource
    config = await ctx.read_resource("config://app")

    return f"Processed: {query}"
```

### Completions

Provide argument completions:

```python
@mcp.complete("file://{path}")
async def complete_path(path: str) -> list[str]:
    """Provide path completions."""
    parent = Path(path).parent
    return [str(p) for p in parent.iterdir() if str(p).startswith(path)]
```

### Elicitation

Request information from the client:

```python
@mcp.tool()
async def deploy(env: str, ctx: Context) -> str:
    """Deploy to an environment with confirmation."""
    confirmed = await ctx.elicit(
        message=f"Deploy to {env}?",
        schema={"type": "boolean"},
    )
    if confirmed:
        return f"Deployed to {env}"
    return "Deployment cancelled"
```

### Sampling

Request LLM completions from the client:

```python
@mcp.tool()
async def summarize(text: str, ctx: Context) -> str:
    """Summarize text using the client's LLM."""
    result = await ctx.sample(
        messages=[{"role": "user", "content": f"Summarize: {text}"}],
        max_tokens=200,
    )
    return result.content
```

### Authentication

Secure server endpoints:

```python
from mcp.server.auth import OAuthProvider

mcp = FastMCP("secure-server", auth=OAuthProvider(
    issuer="https://auth.example.com",
    audience="mcp-server",
))
```

## Running Servers

### Development Mode

```bash
mcp dev server.py
```

Opens the MCP Inspector for interactive testing.

### Claude Desktop

Add to Claude Desktop configuration:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "python",
      "args": ["server.py"]
    }
  }
}
```

### Direct Execution

```bash
python server.py
```

### Streamable HTTP

```python
mcp = FastMCP("http-server")
mcp.run(transport="streamable-http", host="0.0.0.0", port=8000)
```

### ASGI Mounting

Mount MCP server inside an existing ASGI app:

```python
from starlette.applications import Starlette
from mcp.server.fastmcp import FastMCP

app = Starlette()
mcp = FastMCP("embedded-server")

app.mount("/mcp", mcp.as_asgi())
```

## Advanced Usage

### Low-Level Server

For full control, use the low-level server API:

```python
from mcp.server import Server

server = Server("low-level-server")

@server.list_tools()
async def list_tools():
    return [
        {
            "name": "greet",
            "description": "Greet a user",
            "inputSchema": {
                "type": "object",
                "properties": {"name": {"type": "string"}},
                "required": ["name"],
            },
        }
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "greet":
        return [{"type": "text", "text": f"Hello, {arguments['name']}!"}]
```

### Pagination

Handle large result sets:

```python
@mcp.tool()
async def list_items(cursor: str | None = None, limit: int = 10) -> dict:
    """List items with pagination."""
    items = await db.get_items(cursor=cursor, limit=limit)
    return {
        "items": items,
        "nextCursor": items[-1].id if len(items) == limit else None,
    }
```

### Clients

Connect to MCP servers from Python:

```python
from mcp.client import McpClient

async with McpClient.connect(
    transport="stdio",
    command="python",
    args=["server.py"],
) as client:
    tools = await client.list_tools()
    result = await client.call_tool("greet", {"name": "World"})
    print(result)
```

### OAuth

Implement OAuth 2.1 authentication:

```python
from mcp.server.auth import OAuthProvider, OAuthConfig

oauth = OAuthProvider(
    config=OAuthConfig(
        issuer="https://auth.example.com",
        token_endpoint="https://auth.example.com/token",
        authorization_endpoint="https://auth.example.com/authorize",
    )
)

mcp = FastMCP("oauth-server", auth=oauth)
```

## MCP Primitives

| Primitive | Description | Example |
|---|---|---|
| **Tools** | Functions the client can invoke | Database queries, API calls, computations |
| **Resources** | Data the client can read | Files, database records, configurations |
| **Prompts** | Reusable prompt templates | Code review, debugging, analysis prompts |
| **Sampling** | Server-initiated LLM calls | Summarization, classification within tools |
| **Elicitation** | Server-initiated client queries | Confirmations, additional input requests |
| **Completions** | Argument auto-completion | File paths, database tables, user names |
