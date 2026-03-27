"""Write plugin.json manifest file."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..models.plugin_spec import PluginSpec


def write_manifest(spec: PluginSpec, output: str | Path) -> Path:
    """Write a plugin.json manifest file from a PluginSpec.

    The manifest is the primary metadata file for a Claude Code plugin,
    containing name, version, description, and references to all
    constituent skills, agents, connectors, hooks, and LSP servers.

    Args:
        spec: The plugin specification.
        output: Path to the output plugin.json file.

    Returns:
        Path to the written manifest file.
    """
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)

    manifest = _build_manifest(spec)
    output.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return output


def _build_manifest(spec: PluginSpec) -> dict[str, Any]:
    """Build the plugin.json manifest dictionary."""
    manifest: dict[str, Any] = {
        "name": spec.name,
        "version": spec.version,
        "description": spec.description,
    }

    if spec.author:
        manifest["author"] = spec.author

    # Skills
    if spec.skills:
        manifest["skills"] = [
            {
                "name": skill.name,
                "file": f"skills/{skill.full_name()}",
                "description": skill.description,
            }
            for skill in spec.skills
        ]

    # Agents
    if spec.agents:
        manifest["agents"] = [
            {
                "name": agent.name,
                "file": f"agents/{agent.full_name()}",
                "description": agent.description,
                "model": agent.model,
                "tools": agent.tools,
            }
            for agent in spec.agents
        ]

    # Connectors
    if spec.connectors:
        manifest["connectors"] = [
            {
                "name": connector.name,
                "type": connector.type,
                "config_file": f"connectors/{connector.name}.json",
            }
            for connector in spec.connectors
        ]

    # Hooks
    if spec.hooks:
        manifest["hooks"] = {
            "config_file": "hooks/hooks.json",
            "events": list(spec.hooks.keys()),
        }

    # LSP servers
    if spec.lsp_servers:
        manifest["lsp"] = {
            "config_file": ".lsp/config.json",
            "servers": spec.lsp_servers,
        }

    manifest["_generated"] = True

    return manifest
