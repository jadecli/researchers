"""Write MCP (Model Context Protocol) configuration for connectors."""

from __future__ import annotations

import json
from pathlib import Path

from ..models.plugin_spec import ConnectorSpec


def write_mcp_config(connectors: list[ConnectorSpec], output: str | Path) -> Path:
    """Write MCP configuration JSON file for the given connectors.

    Generates a standard MCP config with mcpServers entries for each connector.

    Args:
        connectors: List of connector specifications.
        output: Path to the output JSON file.

    Returns:
        Path to the written config file.
    """
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)

    mcp_config = _build_mcp_config(connectors)
    output.write_text(
        json.dumps(mcp_config, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return output


def _build_mcp_config(connectors: list[ConnectorSpec]) -> dict:
    """Build the MCP configuration dictionary."""
    servers: dict = {}

    for connector in connectors:
        server_entry: dict = {
            "type": connector.type,
        }

        if connector.type == "stdio":
            server_entry.update(_build_stdio_config(connector))
        elif connector.type == "sse":
            server_entry.update(_build_sse_config(connector))
        elif connector.type == "streamable-http":
            server_entry.update(_build_http_config(connector))
        else:
            server_entry.update(connector.server_config)

        servers[connector.name] = server_entry

    return {"mcpServers": servers}


def _build_stdio_config(connector: ConnectorSpec) -> dict:
    """Build stdio transport configuration."""
    config: dict = {}
    sc = connector.server_config

    if "command" in sc:
        config["command"] = sc["command"]
    if "args" in sc:
        config["args"] = sc["args"]
    if "env" in sc:
        config["env"] = sc["env"]
    if "cwd" in sc:
        config["cwd"] = sc["cwd"]

    return config


def _build_sse_config(connector: ConnectorSpec) -> dict:
    """Build SSE transport configuration."""
    config: dict = {}
    sc = connector.server_config

    if "url" in sc:
        config["url"] = sc["url"]
    if "headers" in sc:
        config["headers"] = sc["headers"]

    return config


def _build_http_config(connector: ConnectorSpec) -> dict:
    """Build streamable HTTP transport configuration."""
    config: dict = {}
    sc = connector.server_config

    if "url" in sc:
        config["url"] = sc["url"]
    if "headers" in sc:
        config["headers"] = sc["headers"]
    if "method" in sc:
        config["method"] = sc["method"]

    return config
