"""Route code generation tasks to appropriate languages and frameworks."""

from __future__ import annotations

import logging
from typing import Any

from ..models.language import LanguageConfig, SupportedLanguage

logger = logging.getLogger(__name__)


class LanguageRouter:
    """Routes code generation tasks to the most appropriate languages.

    Uses heuristics and optional DSPy pipeline predictions to select
    the primary and secondary languages for a given task.

    Usage:
        router = LanguageRouter()
        route = router.route("Build a REST API", environment="web")
        print(route.primary)
    """

    # Default language recommendations by environment
    ENVIRONMENT_DEFAULTS: dict[str, list[SupportedLanguage]] = {
        "web": [SupportedLanguage.TYPESCRIPT, SupportedLanguage.PYTHON, SupportedLanguage.GO],
        "cli": [SupportedLanguage.PYTHON, SupportedLanguage.GO, SupportedLanguage.RUST],
        "serverless": [SupportedLanguage.PYTHON, SupportedLanguage.TYPESCRIPT, SupportedLanguage.GO],
        "library": [SupportedLanguage.PYTHON, SupportedLanguage.TYPESCRIPT, SupportedLanguage.RUST],
        "mobile": [SupportedLanguage.SWIFT, SupportedLanguage.KOTLIN, SupportedLanguage.TYPESCRIPT],
        "data": [SupportedLanguage.PYTHON, SupportedLanguage.SCALA, SupportedLanguage.JAVA],
        "systems": [SupportedLanguage.RUST, SupportedLanguage.GO, SupportedLanguage.CSHARP],
        "scripting": [SupportedLanguage.PYTHON, SupportedLanguage.RUBY, SupportedLanguage.PHP],
    }

    # Keywords that hint at specific languages
    KEYWORD_HINTS: dict[str, SupportedLanguage] = {
        "django": SupportedLanguage.PYTHON,
        "flask": SupportedLanguage.PYTHON,
        "fastapi": SupportedLanguage.PYTHON,
        "react": SupportedLanguage.TYPESCRIPT,
        "next.js": SupportedLanguage.TYPESCRIPT,
        "nextjs": SupportedLanguage.TYPESCRIPT,
        "express": SupportedLanguage.TYPESCRIPT,
        "gin": SupportedLanguage.GO,
        "actix": SupportedLanguage.RUST,
        "tokio": SupportedLanguage.RUST,
        "spring": SupportedLanguage.JAVA,
        "ktor": SupportedLanguage.KOTLIN,
        "vapor": SupportedLanguage.SWIFT,
        "asp.net": SupportedLanguage.CSHARP,
        "blazor": SupportedLanguage.CSHARP,
        "laravel": SupportedLanguage.PHP,
        "rails": SupportedLanguage.RUBY,
        "phoenix": SupportedLanguage.ELIXIR,
        "play": SupportedLanguage.SCALA,
        "akka": SupportedLanguage.SCALA,
    }

    def __init__(self) -> None:
        """Initialize the language router."""
        self._configs: dict[SupportedLanguage, LanguageConfig] = {}

    def get_config(self, lang: SupportedLanguage) -> LanguageConfig:
        """Get or create a LanguageConfig for the given language."""
        if lang not in self._configs:
            self._configs[lang] = LanguageConfig.for_language(lang)
        return self._configs[lang]

    def route(
        self,
        task_description: str,
        environment: str = "cli",
        preferred_languages: list[str] | None = None,
        constraints: str = "",
    ) -> RouteResult:
        """Route a task to the appropriate language(s).

        Args:
            task_description: Description of the code to generate.
            environment: Target environment (web, cli, serverless, etc.).
            preferred_languages: User-preferred languages, or None for auto.
            constraints: Additional constraints.

        Returns:
            A RouteResult with primary language, secondaries, and configs.
        """
        # Check for explicit preferences first
        if preferred_languages:
            primary = self._resolve_language(preferred_languages[0])
            secondaries = [
                self._resolve_language(lang)
                for lang in preferred_languages[1:]
                if self._resolve_language(lang) is not None
            ]
            if primary:
                return RouteResult(
                    primary=primary,
                    secondaries=[s for s in secondaries if s is not None],
                    configs={
                        lang: self.get_config(lang)
                        for lang in [primary] + [s for s in secondaries if s is not None]
                    },
                    rationale=f"User preference: {preferred_languages}",
                )

        # Check for keyword hints in the task description
        task_lower = task_description.lower()
        for keyword, lang in self.KEYWORD_HINTS.items():
            if keyword in task_lower:
                logger.info("Keyword '%s' matched -> %s", keyword, lang.value)
                return RouteResult(
                    primary=lang,
                    secondaries=[],
                    configs={lang: self.get_config(lang)},
                    rationale=f"Keyword match: '{keyword}' -> {lang.value}",
                )

        # Fall back to environment defaults
        env_key = environment.lower().replace("-", "").replace("_", "")
        defaults = self.ENVIRONMENT_DEFAULTS.get(env_key, [SupportedLanguage.PYTHON])
        primary = defaults[0]
        secondaries = defaults[1:] if len(defaults) > 1 else []

        return RouteResult(
            primary=primary,
            secondaries=secondaries,
            configs={lang: self.get_config(lang) for lang in [primary] + secondaries},
            rationale=f"Environment default for '{environment}': {primary.value}",
        )

    def _resolve_language(self, name: str) -> SupportedLanguage | None:
        """Resolve a language name string to a SupportedLanguage enum."""
        name_lower = name.strip().lower()
        for lang in SupportedLanguage:
            if lang.value == name_lower:
                return lang
        # Common aliases
        aliases: dict[str, SupportedLanguage] = {
            "ts": SupportedLanguage.TYPESCRIPT,
            "js": SupportedLanguage.TYPESCRIPT,
            "javascript": SupportedLanguage.TYPESCRIPT,
            "py": SupportedLanguage.PYTHON,
            "rs": SupportedLanguage.RUST,
            "cs": SupportedLanguage.CSHARP,
            "c#": SupportedLanguage.CSHARP,
            "rb": SupportedLanguage.RUBY,
            "ex": SupportedLanguage.ELIXIR,
            "kt": SupportedLanguage.KOTLIN,
        }
        return aliases.get(name_lower)


class RouteResult:
    """Result of routing a task to languages."""

    def __init__(
        self,
        primary: SupportedLanguage,
        secondaries: list[SupportedLanguage],
        configs: dict[SupportedLanguage, LanguageConfig],
        rationale: str = "",
    ) -> None:
        self.primary = primary
        self.secondaries = secondaries
        self.configs = configs
        self.rationale = rationale

    @property
    def all_languages(self) -> list[SupportedLanguage]:
        """All languages (primary + secondaries)."""
        return [self.primary] + self.secondaries

    @property
    def primary_config(self) -> LanguageConfig:
        """Config for the primary language."""
        return self.configs[self.primary]

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a dictionary."""
        return {
            "primary": self.primary.value,
            "secondaries": [s.value for s in self.secondaries],
            "rationale": self.rationale,
        }
