"""Generate a full plugin directory from a PluginSpec."""

from __future__ import annotations

import logging
from pathlib import Path

from ..models.plugin_spec import PluginSpec
from .agent_writer import write_agent
from .connectors_writer import write_connectors
from .hooks_writer import write_hooks
from .lsp_config import write_lsp_config
from .manifest import write_manifest
from .mcp_config import write_mcp_config
from .skill_writer import write_skill

logger = logging.getLogger(__name__)


def generate_plugin(spec: PluginSpec, output_dir: str | Path) -> Path:
    """Generate a complete plugin directory structure from a PluginSpec.

    Creates the following structure:
        <output_dir>/<plugin-name>/
            plugin.json
            skills/
                <skill-name>.md
                ...
            agents/
                <agent-name>.md
                ...
            connectors/
                mcp.json
            hooks/
                hooks.json
            .lsp/
                config.json

    Args:
        spec: The plugin specification to generate from.
        output_dir: Parent directory where the plugin directory will be created.

    Returns:
        Path to the generated plugin directory.
    """
    output_dir = Path(output_dir)
    plugin_dir = output_dir / spec.plugin_dir_name
    plugin_dir.mkdir(parents=True, exist_ok=True)

    logger.info("Generating plugin '%s' at %s", spec.name, plugin_dir)

    # Create subdirectories
    skills_dir = plugin_dir / "skills"
    skills_dir.mkdir(exist_ok=True)

    agents_dir = plugin_dir / "agents"
    agents_dir.mkdir(exist_ok=True)

    connectors_dir = plugin_dir / "connectors"
    connectors_dir.mkdir(exist_ok=True)

    hooks_dir = plugin_dir / "hooks"
    hooks_dir.mkdir(exist_ok=True)

    lsp_dir = plugin_dir / ".lsp"
    lsp_dir.mkdir(exist_ok=True)

    # Write skills
    for skill_spec in spec.skills:
        write_skill(skill_spec, skills_dir)
        logger.info("  Wrote skill: %s", skill_spec.full_name())

    # Write agents
    for agent_spec in spec.agents:
        write_agent(agent_spec, agents_dir)
        logger.info("  Wrote agent: %s", agent_spec.full_name())

    # Write connectors and MCP config
    if spec.connectors:
        write_connectors(spec.connectors, connectors_dir)
        write_mcp_config(spec.connectors, connectors_dir / "mcp.json")
        logger.info("  Wrote %d connectors", len(spec.connectors))

    # Write hooks
    if spec.hooks:
        write_hooks(spec.hooks, hooks_dir / "hooks.json")
        logger.info("  Wrote hooks for %d events", len(spec.hooks))

    # Write LSP config
    if spec.lsp_servers:
        write_lsp_config(spec.lsp_servers, lsp_dir / "config.json")
        logger.info("  Wrote LSP config for %d servers", len(spec.lsp_servers))

    # Write manifest
    write_manifest(spec, plugin_dir / "plugin.json")
    logger.info("  Wrote plugin.json manifest")

    logger.info(
        "Plugin generation complete: %d skills, %d agents, %d connectors",
        spec.skill_count,
        spec.agent_count,
        spec.connector_count,
    )
    return plugin_dir
