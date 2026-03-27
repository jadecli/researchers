"""Plugin specification models following anthropics/knowledge-work-plugins patterns."""

from __future__ import annotations

import json
from typing import Any, Optional

from pydantic import BaseModel, Field

__all__ = ["PluginSpec", "SkillSpec", "AgentSpec", "ConnectorSpec"]


class SkillSpec(BaseModel):
    """Specification for a single skill within a plugin."""

    name: str = Field(..., description="Skill name, used as filename stem")
    description: str = Field(default="", description="Human-readable description")
    frontmatter: dict[str, Any] = Field(
        default_factory=dict,
        description="YAML frontmatter fields (tools, model, etc.)",
    )
    content: str = Field(default="", description="Markdown body of the skill file")
    references: list[str] = Field(
        default_factory=list, description="File or URL references the skill uses"
    )
    scripts: list[str] = Field(
        default_factory=list, description="Shell scripts the skill can invoke"
    )

    def full_name(self) -> str:
        """Return the SKILL.md filename."""
        return f"{self.name}.md"


class AgentSpec(BaseModel):
    """Specification for an agent within a plugin."""

    name: str = Field(..., description="Agent identifier")
    description: str = Field(default="", description="What the agent does")
    tools: list[str] = Field(default_factory=list, description="Tools available to the agent")
    model: str = Field(default="claude-sonnet-4-20250514", description="Model to use")
    system_prompt: str = Field(default="", description="System prompt for the agent")

    def full_name(self) -> str:
        """Return the agent .md filename."""
        return f"{self.name}.md"


class ConnectorSpec(BaseModel):
    """Specification for an MCP connector."""

    name: str = Field(..., description="Connector identifier")
    type: str = Field(
        default="stdio",
        description="Transport type: stdio, sse, streamable-http",
    )
    server_config: dict[str, Any] = Field(
        default_factory=dict,
        description="MCP server configuration (command, args, env, etc.)",
    )
    placeholder_category: str = Field(
        default="",
        description="Category for ~~ placeholder substitution (e.g., 'api_key')",
    )

    def has_placeholders(self) -> bool:
        """Check if server config contains ~~ placeholder values."""
        config_str = json.dumps(self.server_config)
        return "~~" in config_str


class PluginSpec(BaseModel):
    """Full specification for a Claude Code plugin."""

    name: str = Field(..., description="Plugin name")
    version: str = Field(default="0.1.0", description="Semantic version")
    description: str = Field(default="", description="Plugin description")
    author: str = Field(default="", description="Plugin author")
    skills: list[SkillSpec] = Field(default_factory=list, description="Skills provided")
    agents: list[AgentSpec] = Field(default_factory=list, description="Agents provided")
    connectors: list[ConnectorSpec] = Field(
        default_factory=list, description="MCP connectors"
    )
    hooks: dict[str, list[dict[str, Any]]] = Field(
        default_factory=dict,
        description="Hook definitions keyed by event name",
    )
    lsp_servers: list[str] = Field(
        default_factory=list,
        description="LSP server binaries to configure",
    )

    @property
    def plugin_dir_name(self) -> str:
        """Directory name for the plugin."""
        return self.name.replace(" ", "-").lower()

    @property
    def skill_count(self) -> int:
        """Number of skills in this plugin."""
        return len(self.skills)

    @property
    def agent_count(self) -> int:
        """Number of agents in this plugin."""
        return len(self.agents)

    @property
    def connector_count(self) -> int:
        """Number of connectors in this plugin."""
        return len(self.connectors)
