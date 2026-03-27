"""Write agent .md files for plugin agents."""

from __future__ import annotations

from pathlib import Path

from ..models.plugin_spec import AgentSpec


def write_agent(spec: AgentSpec, agents_dir: str | Path) -> Path:
    """Generate an agent .md file from an AgentSpec.

    The generated file contains the agent's system prompt and configuration
    as structured markdown.

    Args:
        spec: The agent specification.
        agents_dir: Directory where the agent file will be written.

    Returns:
        Path to the written agent file.
    """
    agents_dir = Path(agents_dir)
    agents_dir.mkdir(parents=True, exist_ok=True)
    file_path = agents_dir / spec.full_name()

    content = _build_agent_content(spec)
    file_path.write_text(content, encoding="utf-8")
    return file_path


def _build_agent_content(spec: AgentSpec) -> str:
    """Build the markdown content for an agent file."""
    sections: list[str] = []

    sections.append(f"# {spec.name}\n")

    if spec.description:
        sections.append(f"{spec.description}\n")

    sections.append("## Configuration\n")
    sections.append(f"- **Model**: {spec.model}")
    if spec.tools:
        tools_str = ", ".join(f"`{t}`" for t in spec.tools)
        sections.append(f"- **Tools**: {tools_str}")
    sections.append("")

    if spec.system_prompt:
        sections.append("## System Prompt\n")
        sections.append(spec.system_prompt)
        sections.append("")
    else:
        sections.append("## System Prompt\n")
        sections.append(_default_system_prompt(spec))
        sections.append("")

    sections.append("## Behavior\n")
    sections.append(
        f"This agent ({spec.name}) operates with the tools and model specified above. "
        "It follows its system prompt to accomplish tasks within its domain."
    )
    sections.append("")

    if spec.tools:
        sections.append("## Available Tools\n")
        for tool in spec.tools:
            sections.append(f"### {tool}\n")
            sections.append(f"The `{tool}` tool is available for this agent to use.\n")

    return "\n".join(sections)


def _default_system_prompt(spec: AgentSpec) -> str:
    """Generate a default system prompt for the agent."""
    tools_mention = ""
    if spec.tools:
        tools_str = ", ".join(spec.tools)
        tools_mention = f" You have access to the following tools: {tools_str}."

    return (
        f"You are {spec.name}, a specialized agent.{tools_mention}\n\n"
        f"{spec.description}\n\n"
        "Follow best practices, be thorough in your analysis, and provide "
        "clear, actionable outputs. Ask clarifying questions when the task "
        "is ambiguous."
    )
