"""Write hook configuration files for plugin lifecycle events."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def write_hooks(hooks: dict[str, list[dict[str, Any]]], output: str | Path) -> Path:
    """Write hooks configuration to a JSON file.

    Hooks are organized by event name and contain handler configurations
    that run at specific points in the plugin lifecycle.

    Supported events:
        - PreToolExecution: Before a tool runs
        - PostToolExecution: After a tool completes
        - Notification: When a notification is triggered
        - Stop: When the agent is about to stop
        - SubagentSpawn: When a subagent is created

    Args:
        hooks: Dict mapping event names to lists of handler configs.
        output: Path to the output JSON file.

    Returns:
        Path to the written hooks file.
    """
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)

    hooks_config = _build_hooks_config(hooks)
    output.write_text(
        json.dumps(hooks_config, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return output


def _build_hooks_config(hooks: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    """Build the hooks configuration structure."""
    validated_hooks: dict[str, list[dict[str, Any]]] = {}

    valid_events = {
        "PreToolExecution",
        "PostToolExecution",
        "Notification",
        "Stop",
        "SubagentSpawn",
    }

    for event_name, handlers in hooks.items():
        if event_name not in valid_events:
            continue

        validated_handlers: list[dict[str, Any]] = []
        for handler in handlers:
            validated = _validate_handler(handler)
            if validated:
                validated_handlers.append(validated)

        if validated_handlers:
            validated_hooks[event_name] = validated_handlers

    return {
        "hooks": validated_hooks,
        "_meta": {
            "version": "1.0",
            "supported_events": sorted(valid_events),
        },
    }


def _validate_handler(handler: dict[str, Any]) -> dict[str, Any] | None:
    """Validate and normalize a hook handler configuration.

    A handler must have at least a 'type' field. Supported types:
        - command: Runs a shell command
        - script: Runs a script file
        - webhook: Posts to a URL

    Returns:
        Validated handler dict, or None if invalid.
    """
    handler_type = handler.get("type")
    if not handler_type:
        return None

    validated: dict[str, Any] = {"type": handler_type}

    if handler_type == "command":
        if "command" not in handler:
            return None
        validated["command"] = handler["command"]
        if "timeout" in handler:
            validated["timeout"] = int(handler["timeout"])
        if "working_dir" in handler:
            validated["working_dir"] = handler["working_dir"]

    elif handler_type == "script":
        if "path" not in handler:
            return None
        validated["path"] = handler["path"]
        if "interpreter" in handler:
            validated["interpreter"] = handler["interpreter"]

    elif handler_type == "webhook":
        if "url" not in handler:
            return None
        validated["url"] = handler["url"]
        if "method" in handler:
            validated["method"] = handler["method"]
        if "headers" in handler:
            validated["headers"] = handler["headers"]

    else:
        validated.update(
            {k: v for k, v in handler.items() if k != "type"}
        )

    if "description" in handler:
        validated["description"] = handler["description"]

    return validated
