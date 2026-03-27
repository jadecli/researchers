"""Write LSP server configuration for multi-language support."""

from __future__ import annotations

import json
from pathlib import Path

from ..models.language import LSP_BINARIES, SupportedLanguage


def write_lsp_config(lsp_servers: list[str], output: str | Path) -> Path:
    """Write LSP configuration JSON for the specified servers.

    Maps LSP server binary names to their full configuration including
    initialization options and supported file types.

    Args:
        lsp_servers: List of LSP server binary names (e.g., ['pyright', 'gopls']).
        output: Path to the output JSON file.

    Returns:
        Path to the written config file.
    """
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)

    config = _build_lsp_config(lsp_servers)
    output.write_text(
        json.dumps(config, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return output


def _build_lsp_config(lsp_servers: list[str]) -> dict:
    """Build the full LSP configuration."""
    # Reverse-map binary names to languages
    binary_to_lang: dict[str, SupportedLanguage] = {
        binary: lang for lang, binary in LSP_BINARIES.items()
    }

    servers: dict = {}
    for binary in lsp_servers:
        lang = binary_to_lang.get(binary)
        server_config = _server_config_for(binary, lang)
        servers[binary] = server_config

    return {
        "lspServers": servers,
        "_meta": {
            "version": "1.0",
            "configured_servers": len(servers),
        },
    }


def _server_config_for(binary: str, lang: SupportedLanguage | None) -> dict:
    """Build configuration for a specific LSP server."""
    config: dict = {
        "command": binary,
        "args": _default_args(binary),
        "languages": _languages_for_binary(binary, lang),
    }

    init_options = _init_options(binary)
    if init_options:
        config["initializationOptions"] = init_options

    settings = _workspace_settings(binary)
    if settings:
        config["settings"] = settings

    return config


def _default_args(binary: str) -> list[str]:
    """Default command-line arguments for known LSP servers."""
    args_map: dict[str, list[str]] = {
        "pyright": ["--stdio"],
        "typescript-language-server": ["--stdio"],
        "gopls": ["serve"],
        "rust-analyzer": [],
        "jdtls": ["-data", "/tmp/jdtls-workspace"],
        "kotlin-language-server": [],
        "sourcekit-lsp": [],
        "OmniSharp": ["--languageserver", "--stdio"],
        "phpactor": ["language-server"],
        "solargraph": ["stdio"],
        "elixir-ls": [],
        "metals": [],
    }
    return args_map.get(binary, [])


def _languages_for_binary(binary: str, lang: SupportedLanguage | None) -> list[str]:
    """Map a binary to the language IDs it supports."""
    if lang:
        extra_map: dict[SupportedLanguage, list[str]] = {
            SupportedLanguage.TYPESCRIPT: ["typescript", "typescriptreact", "javascript"],
            SupportedLanguage.KOTLIN: ["kotlin", "kotlinscript"],
            SupportedLanguage.CSHARP: ["csharp", "fsharp"],
        }
        return extra_map.get(lang, [lang.value])
    return []


def _init_options(binary: str) -> dict:
    """Initialization options for known LSP servers."""
    options_map: dict[str, dict] = {
        "pyright": {
            "python": {
                "analysis": {
                    "autoSearchPaths": True,
                    "diagnosticMode": "workspace",
                    "typeCheckingMode": "basic",
                }
            }
        },
        "gopls": {
            "analyses": {
                "unusedparams": True,
                "shadow": True,
            },
            "staticcheck": True,
        },
        "rust-analyzer": {
            "checkOnSave": {"command": "clippy"},
        },
    }
    return options_map.get(binary, {})


def _workspace_settings(binary: str) -> dict:
    """Workspace settings for known LSP servers."""
    settings_map: dict[str, dict] = {
        "typescript-language-server": {
            "typescript": {
                "inlayHints": {
                    "includeInlayParameterNameHints": "all",
                }
            }
        },
        "solargraph": {
            "solargraph": {
                "diagnostics": True,
                "formatting": True,
            }
        },
    }
    return settings_map.get(binary, {})
