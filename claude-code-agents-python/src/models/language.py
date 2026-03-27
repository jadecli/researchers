"""Language configuration models for multi-language codegen."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

__all__ = [
    "SupportedLanguage",
    "LSP_BINARIES",
    "SDK_LANGUAGES",
    "LanguageConfig",
]


class SupportedLanguage(str, Enum):
    """All supported programming languages for code generation."""

    PYTHON = "python"
    TYPESCRIPT = "typescript"
    GO = "go"
    RUST = "rust"
    JAVA = "java"
    KOTLIN = "kotlin"
    SWIFT = "swift"
    CSHARP = "csharp"
    PHP = "php"
    RUBY = "ruby"
    ELIXIR = "elixir"
    SCALA = "scala"


LSP_BINARIES: dict[SupportedLanguage, str] = {
    SupportedLanguage.PYTHON: "pyright",
    SupportedLanguage.TYPESCRIPT: "typescript-language-server",
    SupportedLanguage.GO: "gopls",
    SupportedLanguage.RUST: "rust-analyzer",
    SupportedLanguage.JAVA: "jdtls",
    SupportedLanguage.KOTLIN: "kotlin-language-server",
    SupportedLanguage.SWIFT: "sourcekit-lsp",
    SupportedLanguage.CSHARP: "OmniSharp",
    SupportedLanguage.PHP: "phpactor",
    SupportedLanguage.RUBY: "solargraph",
    SupportedLanguage.ELIXIR: "elixir-ls",
    SupportedLanguage.SCALA: "metals",
}


SDK_LANGUAGES: dict[SupportedLanguage, str] = {
    SupportedLanguage.PYTHON: "anthropic",
    SupportedLanguage.TYPESCRIPT: "@anthropic-ai/sdk",
    SupportedLanguage.GO: "github.com/anthropics/anthropic-sdk-go",
    SupportedLanguage.RUST: "anthropic (crate)",
    SupportedLanguage.JAVA: "com.anthropic:anthropic-java",
    SupportedLanguage.KOTLIN: "com.anthropic:anthropic-java",
    SupportedLanguage.SWIFT: "anthropic-swift",
    SupportedLanguage.CSHARP: "Anthropic.SDK",
    SupportedLanguage.PHP: "anthropic-php",
    SupportedLanguage.RUBY: "anthropic-rb",
    SupportedLanguage.ELIXIR: "anthropic_ex",
    SupportedLanguage.SCALA: "com.anthropic:anthropic-java",
}


class LanguageConfig(BaseModel):
    """Configuration for a specific language in code generation."""

    language: SupportedLanguage = Field(..., description="The programming language")
    lsp_binary: str = Field(default="", description="LSP server binary name")
    sdk_package: str = Field(default="", description="Anthropic SDK package identifier")
    file_extensions: list[str] = Field(
        default_factory=list, description="Common file extensions"
    )
    build_tool: str = Field(default="", description="Primary build tool")
    test_command: Optional[str] = Field(
        default=None, description="Default test command"
    )
    format_command: Optional[str] = Field(
        default=None, description="Default format command"
    )

    @classmethod
    def for_language(cls, lang: SupportedLanguage) -> LanguageConfig:
        """Create a LanguageConfig with defaults for the given language."""
        configs: dict[SupportedLanguage, dict] = {
            SupportedLanguage.PYTHON: {
                "file_extensions": [".py", ".pyi"],
                "build_tool": "pip",
                "test_command": "pytest",
                "format_command": "ruff format .",
            },
            SupportedLanguage.TYPESCRIPT: {
                "file_extensions": [".ts", ".tsx", ".mts"],
                "build_tool": "npm",
                "test_command": "npm test",
                "format_command": "npx prettier --write .",
            },
            SupportedLanguage.GO: {
                "file_extensions": [".go"],
                "build_tool": "go",
                "test_command": "go test ./...",
                "format_command": "gofmt -w .",
            },
            SupportedLanguage.RUST: {
                "file_extensions": [".rs"],
                "build_tool": "cargo",
                "test_command": "cargo test",
                "format_command": "cargo fmt",
            },
            SupportedLanguage.JAVA: {
                "file_extensions": [".java"],
                "build_tool": "gradle",
                "test_command": "gradle test",
                "format_command": "google-java-format -i **/*.java",
            },
            SupportedLanguage.KOTLIN: {
                "file_extensions": [".kt", ".kts"],
                "build_tool": "gradle",
                "test_command": "gradle test",
                "format_command": "ktlint --format",
            },
            SupportedLanguage.SWIFT: {
                "file_extensions": [".swift"],
                "build_tool": "swift",
                "test_command": "swift test",
                "format_command": "swift-format format -i -r .",
            },
            SupportedLanguage.CSHARP: {
                "file_extensions": [".cs", ".csx"],
                "build_tool": "dotnet",
                "test_command": "dotnet test",
                "format_command": "dotnet format",
            },
            SupportedLanguage.PHP: {
                "file_extensions": [".php"],
                "build_tool": "composer",
                "test_command": "vendor/bin/phpunit",
                "format_command": "vendor/bin/php-cs-fixer fix",
            },
            SupportedLanguage.RUBY: {
                "file_extensions": [".rb", ".rake"],
                "build_tool": "bundler",
                "test_command": "bundle exec rspec",
                "format_command": "bundle exec rubocop -A",
            },
            SupportedLanguage.ELIXIR: {
                "file_extensions": [".ex", ".exs"],
                "build_tool": "mix",
                "test_command": "mix test",
                "format_command": "mix format",
            },
            SupportedLanguage.SCALA: {
                "file_extensions": [".scala", ".sc"],
                "build_tool": "sbt",
                "test_command": "sbt test",
                "format_command": "sbt scalafmtAll",
            },
        }
        defaults = configs.get(lang, {})
        return cls(
            language=lang,
            lsp_binary=LSP_BINARIES.get(lang, ""),
            sdk_package=SDK_LANGUAGES.get(lang, ""),
            file_extensions=defaults.get("file_extensions", []),
            build_tool=defaults.get("build_tool", ""),
            test_command=defaults.get("test_command"),
            format_command=defaults.get("format_command"),
        )
