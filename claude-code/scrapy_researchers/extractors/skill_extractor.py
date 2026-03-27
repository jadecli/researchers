"""Extractor for skill patterns from documentation markdown."""

from __future__ import annotations

import json
import re
from typing import Any


class SkillSpec:
    """Represents an extracted skill specification."""

    def __init__(
        self,
        name: str,
        description: str = "",
        frontmatter: dict[str, Any] | None = None,
        content: str = "",
        source_url: str = "",
    ) -> None:
        self.name = name
        self.description = description
        self.frontmatter = frontmatter or {}
        self.content = content
        self.source_url = source_url

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "frontmatter": self.frontmatter,
            "content": self.content,
            "source_url": self.source_url,
        }


class SkillExtractor:
    """Extracts skill patterns from documentation markdown.

    Detects:
    - YAML frontmatter blocks (--- delimited)
    - SKILL.md patterns
    - plugin.json structures
    """

    FRONTMATTER_PATTERN = re.compile(
        r"^---\s*\n(.*?)\n---\s*\n(.*)",
        re.DOTALL,
    )

    SKILL_MD_PATTERN = re.compile(
        r"(?:^|\n)#\s+(?:SKILL|Skill)[:\s]+(\S+)\s*\n(.*?)(?=\n#\s|\Z)",
        re.DOTALL,
    )

    PLUGIN_JSON_PATTERN = re.compile(
        r'```(?:json)?\s*\n(\{[^`]*?"(?:name|plugin_name)"[^`]*?\})\s*\n```',
        re.DOTALL,
    )

    def extract_skill_patterns(self, markdown: str, source_url: str = "") -> list[SkillSpec]:
        """Extract all skill patterns from markdown content."""
        skills: list[SkillSpec] = []

        # Extract YAML frontmatter skills
        frontmatter_skills = self._extract_frontmatter_skills(markdown, source_url)
        skills.extend(frontmatter_skills)

        # Extract SKILL.md heading patterns
        heading_skills = self._extract_skill_headings(markdown, source_url)
        skills.extend(heading_skills)

        # Extract plugin.json blocks
        plugin_skills = self._extract_plugin_json(markdown, source_url)
        skills.extend(plugin_skills)

        # Deduplicate by name
        seen_names: set[str] = set()
        unique_skills: list[SkillSpec] = []
        for skill in skills:
            if skill.name not in seen_names:
                seen_names.add(skill.name)
                unique_skills.append(skill)

        return unique_skills

    def _extract_frontmatter_skills(
        self, markdown: str, source_url: str
    ) -> list[SkillSpec]:
        """Extract skills from YAML frontmatter blocks."""
        skills: list[SkillSpec] = []

        match = self.FRONTMATTER_PATTERN.match(markdown)
        if not match:
            return skills

        frontmatter_raw = match.group(1)
        body = match.group(2).strip()

        frontmatter = self._parse_yaml_simple(frontmatter_raw)

        name = frontmatter.get("name", "")
        if not name:
            return skills

        description = frontmatter.get("description", "")

        skills.append(
            SkillSpec(
                name=str(name),
                description=str(description),
                frontmatter=frontmatter,
                content=body,
                source_url=source_url,
            )
        )

        return skills

    def _extract_skill_headings(
        self, markdown: str, source_url: str
    ) -> list[SkillSpec]:
        """Extract skills from SKILL.md heading patterns."""
        skills: list[SkillSpec] = []

        for match in self.SKILL_MD_PATTERN.finditer(markdown):
            name = match.group(1).strip()
            content = match.group(2).strip()

            # Try to extract description from first paragraph
            lines = content.split("\n")
            description = ""
            for line in lines:
                stripped = line.strip()
                if stripped and not stripped.startswith("#"):
                    description = stripped
                    break

            skills.append(
                SkillSpec(
                    name=name,
                    description=description,
                    content=content,
                    source_url=source_url,
                )
            )

        return skills

    def _extract_plugin_json(
        self, markdown: str, source_url: str
    ) -> list[SkillSpec]:
        """Extract skills from plugin.json code blocks."""
        skills: list[SkillSpec] = []

        for match in self.PLUGIN_JSON_PATTERN.finditer(markdown):
            json_str = match.group(1)
            try:
                data = json.loads(json_str)
            except json.JSONDecodeError:
                continue

            name = data.get("name") or data.get("plugin_name", "")
            if not name:
                continue

            description = data.get("description", "")
            content = json.dumps(data, indent=2)

            skills.append(
                SkillSpec(
                    name=str(name),
                    description=str(description),
                    frontmatter=data,
                    content=content,
                    source_url=source_url,
                )
            )

        return skills

    def _parse_yaml_simple(self, yaml_text: str) -> dict[str, Any]:
        """Simple YAML key-value parser (no full YAML dependency).

        Handles basic key: value pairs, including multi-word values and
        simple lists.
        """
        result: dict[str, Any] = {}

        current_key = ""
        current_list: list[str] | None = None

        for line in yaml_text.split("\n"):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue

            # List item continuation
            if stripped.startswith("- ") and current_key and current_list is not None:
                current_list.append(stripped[2:].strip())
                result[current_key] = current_list
                continue

            # Key-value pair
            if ":" in stripped:
                if current_list is not None:
                    current_list = None

                colon_idx = stripped.index(":")
                key = stripped[:colon_idx].strip()
                value = stripped[colon_idx + 1 :].strip()

                if not value:
                    current_key = key
                    current_list = []
                    result[key] = current_list
                elif value.lower() == "true":
                    result[key] = True
                    current_key = key
                    current_list = None
                elif value.lower() == "false":
                    result[key] = False
                    current_key = key
                    current_list = None
                else:
                    # Remove surrounding quotes
                    if (value.startswith('"') and value.endswith('"')) or (
                        value.startswith("'") and value.endswith("'")
                    ):
                        value = value[1:-1]

                    # Check if it looks like a number
                    try:
                        result[key] = int(value)
                    except ValueError:
                        try:
                            result[key] = float(value)
                        except ValueError:
                            result[key] = value

                    current_key = key
                    current_list = None

        return result
