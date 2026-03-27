"""Multi-language project scaffolding."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from ..models.language import LanguageConfig, SupportedLanguage
from .language_router import LanguageRouter, RouteResult
from .template_engine import TemplateEngine

logger = logging.getLogger(__name__)


class MultiLangScaffold:
    """Creates multi-language project scaffolds.

    Combines the LanguageRouter for language selection with the TemplateEngine
    for rendering, producing a complete project directory with support for
    multiple languages.

    Usage:
        scaffold = MultiLangScaffold()
        paths = scaffold.create(
            task="Build a REST API with a CLI client",
            output_dir="./output",
            project_name="my-api",
        )
    """

    def __init__(
        self,
        router: LanguageRouter | None = None,
        engine: TemplateEngine | None = None,
    ) -> None:
        """Initialize with optional router and engine."""
        self.router = router or LanguageRouter()
        self.engine = engine or TemplateEngine()

    def create(
        self,
        task: str,
        output_dir: str | Path,
        project_name: str = "project",
        environment: str = "cli",
        preferred_languages: list[str] | None = None,
        description: str = "",
        scaffold_type: str | None = None,
    ) -> list[Path]:
        """Create a multi-language project scaffold.

        Args:
            task: Description of what the project should do.
            output_dir: Root output directory.
            project_name: Name for the project.
            environment: Target environment (web, cli, etc.).
            preferred_languages: Preferred language names, or None for auto.
            description: Project description.
            scaffold_type: Override scaffold type, or None for auto-detection.

        Returns:
            List of all created file paths.
        """
        output_dir = Path(output_dir)
        route = self.router.route(
            task_description=task,
            environment=environment,
            preferred_languages=preferred_languages,
        )

        logger.info(
            "Routing: primary=%s, secondaries=%s, rationale=%s",
            route.primary.value,
            [s.value for s in route.secondaries],
            route.rationale,
        )

        effective_scaffold = scaffold_type or self._detect_scaffold_type(task, environment)
        context = self._build_context(project_name, description, route)

        all_paths: list[Path] = []

        # Generate primary language scaffold
        primary_dir = output_dir / project_name
        primary_paths = self.engine.render_to_disk(
            language=route.primary,
            scaffold_type=effective_scaffold,
            context=context,
            output_dir=primary_dir,
        )
        all_paths.extend(primary_paths)
        logger.info(
            "Generated %d files for primary language %s",
            len(primary_paths),
            route.primary.value,
        )

        # Generate secondary language scaffolds in subdirectories
        for secondary_lang in route.secondaries:
            sub_dir = primary_dir / f"{secondary_lang.value}-module"
            secondary_context = {
                **context,
                "project_name": f"{project_name}-{secondary_lang.value}",
            }
            secondary_paths = self.engine.render_to_disk(
                language=secondary_lang,
                scaffold_type=effective_scaffold,
                context=secondary_context,
                output_dir=sub_dir,
            )
            all_paths.extend(secondary_paths)
            logger.info(
                "Generated %d files for secondary language %s",
                len(secondary_paths),
                secondary_lang.value,
            )

        # Write a top-level project config
        meta_path = self._write_project_meta(
            primary_dir, project_name, route, effective_scaffold
        )
        all_paths.append(meta_path)

        logger.info(
            "Multi-lang scaffold complete: %d total files in %s",
            len(all_paths),
            primary_dir,
        )
        return all_paths

    def _detect_scaffold_type(self, task: str, environment: str) -> str:
        """Detect scaffold type from task description and environment."""
        task_lower = task.lower()
        if any(kw in task_lower for kw in ["api", "rest", "graphql", "server"]):
            return "web-api"
        if any(kw in task_lower for kw in ["cli", "command", "terminal"]):
            return "cli"
        if any(kw in task_lower for kw in ["library", "package", "module", "sdk"]):
            return "library"
        if any(kw in task_lower for kw in ["lambda", "serverless", "function"]):
            return "serverless"
        if any(kw in task_lower for kw in ["full-stack", "fullstack", "frontend"]):
            return "full-stack"

        env_map = {
            "web": "web-api",
            "cli": "cli",
            "serverless": "serverless",
            "library": "library",
            "mobile": "library",
        }
        return env_map.get(environment, "cli")

    def _build_context(
        self, project_name: str, description: str, route: RouteResult
    ) -> dict[str, Any]:
        """Build template context from project params and route result."""
        return {
            "project_name": project_name,
            "description": description or f"A {route.primary.value} project",
            "primary_language": route.primary.value,
            "secondary_languages": [s.value for s in route.secondaries],
            "all_languages": [lang.value for lang in route.all_languages],
        }

    def _write_project_meta(
        self,
        project_dir: Path,
        project_name: str,
        route: RouteResult,
        scaffold_type: str,
    ) -> Path:
        """Write a .project.json metadata file."""
        import json

        meta = {
            "name": project_name,
            "scaffold_type": scaffold_type,
            "primary_language": route.primary.value,
            "secondary_languages": [s.value for s in route.secondaries],
            "rationale": route.rationale,
            "configs": {
                lang.value: {
                    "build_tool": config.build_tool,
                    "test_command": config.test_command,
                    "lsp": config.lsp_binary,
                }
                for lang, config in route.configs.items()
            },
        }

        meta_path = project_dir / ".project.json"
        meta_path.parent.mkdir(parents=True, exist_ok=True)
        meta_path.write_text(
            json.dumps(meta, indent=2) + "\n",
            encoding="utf-8",
        )
        return meta_path
