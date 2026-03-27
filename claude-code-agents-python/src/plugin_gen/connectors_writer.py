"""Write connector configuration files with ~~ placeholder support."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..models.plugin_spec import ConnectorSpec


def write_connectors(connectors: list[ConnectorSpec], output_dir: str | Path) -> Path:
    """Write connector configuration files to the output directory.

    Each connector gets its own JSON file. Values marked with ~~ prefixes
    are placeholders that users must fill in before activating the connector.

    Args:
        connectors: List of connector specifications.
        output_dir: Directory to write connector files to.

    Returns:
        Path to the output directory.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    for connector in connectors:
        config = _build_connector_config(connector)
        file_path = output_dir / f"{connector.name}.json"
        file_path.write_text(
            json.dumps(config, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

    # Write an index file listing all connectors
    index = _build_connector_index(connectors)
    index_path = output_dir / "index.json"
    index_path.write_text(
        json.dumps(index, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    return output_dir


def _build_connector_config(connector: ConnectorSpec) -> dict[str, Any]:
    """Build a connector configuration with placeholder annotations."""
    config: dict[str, Any] = {
        "name": connector.name,
        "type": connector.type,
        "server": _inject_placeholders(connector.server_config, connector.placeholder_category),
    }

    if connector.placeholder_category:
        config["_placeholders"] = {
            "category": connector.placeholder_category,
            "instructions": (
                f"Replace all values prefixed with ~~ with your actual "
                f"{connector.placeholder_category} values."
            ),
        }

    return config


def _inject_placeholders(config: dict[str, Any], category: str) -> dict[str, Any]:
    """Process config values, ensuring ~~ placeholders are properly formatted.

    Values that are already ~~ prefixed are kept as-is. String values
    matching known placeholder patterns get ~~ prefixed if a category
    is specified and they look like placeholder values.
    """
    result: dict[str, Any] = {}

    for key, value in config.items():
        if isinstance(value, str):
            if value.startswith("~~"):
                result[key] = value
            elif category and _looks_like_placeholder(key, value):
                result[key] = f"~~{category}_{key}~~"
            else:
                result[key] = value
        elif isinstance(value, dict):
            result[key] = _inject_placeholders(value, category)
        elif isinstance(value, list):
            result[key] = [
                _inject_placeholders(item, category) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            result[key] = value

    return result


def _looks_like_placeholder(key: str, value: str) -> bool:
    """Heuristic: does this key-value pair look like it needs a placeholder?"""
    placeholder_keys = {
        "api_key", "token", "secret", "password", "auth",
        "key", "credential", "access_token", "refresh_token",
    }
    key_lower = key.lower()
    for pk in placeholder_keys:
        if pk in key_lower:
            return True

    placeholder_values = {"your-", "replace-", "insert-", "TODO", "CHANGEME"}
    for pv in placeholder_values:
        if pv in value:
            return True

    return False


def _build_connector_index(connectors: list[ConnectorSpec]) -> dict[str, Any]:
    """Build an index of all connectors."""
    return {
        "connectors": [
            {
                "name": c.name,
                "type": c.type,
                "has_placeholders": c.has_placeholders(),
                "placeholder_category": c.placeholder_category,
            }
            for c in connectors
        ],
        "total": len(connectors),
    }
