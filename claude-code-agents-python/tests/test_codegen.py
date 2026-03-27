"""Tests for code generation."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.codegen.language_router import LanguageRouter, RouteResult
from src.codegen.multi_lang_scaffold import MultiLangScaffold
from src.codegen.template_engine import TemplateEngine
from src.models.language import LanguageConfig, SupportedLanguage


class TestSupportedLanguage:
    def test_all_languages(self) -> None:
        assert len(SupportedLanguage) == 12

    def test_values(self) -> None:
        assert SupportedLanguage.PYTHON.value == "python"
        assert SupportedLanguage.TYPESCRIPT.value == "typescript"
        assert SupportedLanguage.GO.value == "go"
        assert SupportedLanguage.RUST.value == "rust"


class TestLanguageConfig:
    def test_for_python(self) -> None:
        config = LanguageConfig.for_language(SupportedLanguage.PYTHON)
        assert config.build_tool == "pip"
        assert config.test_command == "pytest"
        assert ".py" in config.file_extensions
        assert config.lsp_binary == "pyright"
        assert config.sdk_package == "anthropic"

    def test_for_typescript(self) -> None:
        config = LanguageConfig.for_language(SupportedLanguage.TYPESCRIPT)
        assert config.build_tool == "npm"
        assert ".ts" in config.file_extensions

    def test_for_all_languages(self) -> None:
        for lang in SupportedLanguage:
            config = LanguageConfig.for_language(lang)
            assert config.language == lang
            assert config.build_tool != ""
            assert len(config.file_extensions) > 0


class TestLanguageRouter:
    def test_route_with_preference(self) -> None:
        router = LanguageRouter()
        result = router.route("Build something", preferred_languages=["python"])
        assert result.primary == SupportedLanguage.PYTHON

    def test_route_keyword_django(self) -> None:
        router = LanguageRouter()
        result = router.route("Build a Django REST API")
        assert result.primary == SupportedLanguage.PYTHON

    def test_route_keyword_react(self) -> None:
        router = LanguageRouter()
        result = router.route("Create a React frontend app")
        assert result.primary == SupportedLanguage.TYPESCRIPT

    def test_route_keyword_gin(self) -> None:
        router = LanguageRouter()
        result = router.route("Build a Gin web server")
        assert result.primary == SupportedLanguage.GO

    def test_route_environment_web(self) -> None:
        router = LanguageRouter()
        result = router.route("Build something for the web", environment="web")
        assert result.primary == SupportedLanguage.TYPESCRIPT

    def test_route_environment_cli(self) -> None:
        router = LanguageRouter()
        result = router.route("Build a command line tool", environment="cli")
        assert result.primary == SupportedLanguage.PYTHON

    def test_route_result_to_dict(self) -> None:
        router = LanguageRouter()
        result = router.route("Build something", preferred_languages=["go"])
        d = result.to_dict()
        assert d["primary"] == "go"

    def test_resolve_aliases(self) -> None:
        router = LanguageRouter()
        result = router.route("test", preferred_languages=["ts"])
        assert result.primary == SupportedLanguage.TYPESCRIPT

        result = router.route("test", preferred_languages=["py"])
        assert result.primary == SupportedLanguage.PYTHON


class TestTemplateEngine:
    def test_render_python(self) -> None:
        engine = TemplateEngine()
        files = engine.render(
            "python", "cli", {"project_name": "test-project"}
        )
        assert "pyproject.toml" in files
        assert "src/main.py" in files
        assert "test-project" in files["pyproject.toml"]

    def test_render_typescript(self) -> None:
        engine = TemplateEngine()
        files = engine.render(
            "typescript", "web-api", {"project_name": "ts-api"}
        )
        assert "package.json" in files
        assert "src/index.ts" in files

    def test_render_go(self) -> None:
        engine = TemplateEngine()
        files = engine.render(
            "go", "cli", {"project_name": "go-tool"}
        )
        assert "go.mod" in files
        assert "main.go" in files

    def test_render_all_languages(self) -> None:
        engine = TemplateEngine()
        for lang in SupportedLanguage:
            files = engine.render(
                lang, "cli", {"project_name": f"{lang.value}-project"}
            )
            assert len(files) > 0, f"No files rendered for {lang.value}"

    def test_render_to_disk(self, tmp_path: Path) -> None:
        engine = TemplateEngine()
        paths = engine.render_to_disk(
            "python", "cli",
            {"project_name": "disk-test"},
            tmp_path / "output",
        )
        assert len(paths) > 0
        assert all(p.exists() for p in paths)


class TestMultiLangScaffold:
    def test_create_single_language(self, tmp_path: Path) -> None:
        scaffold = MultiLangScaffold()
        paths = scaffold.create(
            task="Build a CLI tool",
            output_dir=tmp_path,
            project_name="my-cli",
            preferred_languages=["python"],
        )
        assert len(paths) > 0
        project_dir = tmp_path / "my-cli"
        assert project_dir.exists()
        assert (project_dir / ".project.json").exists()

    def test_create_multi_language(self, tmp_path: Path) -> None:
        scaffold = MultiLangScaffold()
        paths = scaffold.create(
            task="Build a full-stack app",
            output_dir=tmp_path,
            project_name="multi",
            environment="web",
        )
        assert len(paths) > 0
        # Should have secondary language modules
        project_dir = tmp_path / "multi"
        assert project_dir.exists()

    def test_detect_scaffold_type(self) -> None:
        scaffold = MultiLangScaffold()
        assert scaffold._detect_scaffold_type("Build a REST API", "web") == "web-api"
        assert scaffold._detect_scaffold_type("Create a CLI tool", "cli") == "cli"
        assert scaffold._detect_scaffold_type("Package a library", "library") == "library"
        assert scaffold._detect_scaffold_type("Lambda function", "serverless") == "serverless"
