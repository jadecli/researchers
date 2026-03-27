"""Write SKILL.md files for plugin skills."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from ..models.plugin_spec import SkillSpec


def write_skill(spec: SkillSpec, skill_dir: str | Path) -> Path:
    """Generate a SKILL.md file from a SkillSpec.

    The generated file has YAML frontmatter (delimited by ---) followed
    by the markdown body content.

    Args:
        spec: The skill specification.
        skill_dir: Directory where the skill file will be written.

    Returns:
        Path to the written skill file.
    """
    skill_dir = Path(skill_dir)
    skill_dir.mkdir(parents=True, exist_ok=True)
    file_path = skill_dir / spec.full_name()

    frontmatter = _build_frontmatter(spec)
    body = _build_body(spec)

    content = f"---\n{frontmatter}---\n\n{body}"
    file_path.write_text(content, encoding="utf-8")
    return file_path


def _build_frontmatter(spec: SkillSpec) -> str:
    """Build YAML frontmatter from the skill spec."""
    fm: dict[str, Any] = {}

    if spec.description:
        fm["description"] = spec.description

    # Merge in any custom frontmatter fields
    fm.update(spec.frontmatter)

    if spec.references:
        fm["references"] = spec.references

    if spec.scripts:
        fm["scripts"] = spec.scripts

    if not fm:
        return ""

    return yaml.dump(fm, default_flow_style=False, sort_keys=False, allow_unicode=True)


def _build_body(spec: SkillSpec) -> str:
    """Build the markdown body content for the skill."""
    sections: list[str] = []

    sections.append(f"# {spec.name}\n")

    if spec.description:
        sections.append(f"{spec.description}\n")

    if spec.content:
        sections.append(spec.content)
    else:
        sections.append(_default_body(spec))

    return "\n".join(sections)


def _default_body(spec: SkillSpec) -> str:
    """Generate default body content when none is provided."""
    lines: list[str] = []
    lines.append("## Usage\n")
    lines.append(f"Use this skill to {spec.description or 'perform the task'}.\n")

    if spec.scripts:
        lines.append("## Scripts\n")
        for script in spec.scripts:
            lines.append(f"- `{script}`")
        lines.append("")

    if spec.references:
        lines.append("## References\n")
        for ref in spec.references:
            lines.append(f"- {ref}")
        lines.append("")

    lines.append("## Instructions\n")
    lines.append(
        "Follow the instructions below to complete the task. "
        "Use the available tools and references as needed.\n"
    )

    return "\n".join(lines)
