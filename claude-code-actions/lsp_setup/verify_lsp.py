#!/usr/bin/env python3
"""Verify all LSP server installations by checking binaries and config validity."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

import click

CONFIGS_DIR = Path(__file__).parent / "lsp_configs"

REQUIRED_CONFIG_KEYS = {"name", "command", "filetypes"}


class VerifyResult:
    """Result of verifying a single LSP server."""

    def __init__(self, name: str) -> None:
        self.name = name
        self.config_valid = False
        self.binary_found = False
        self.version = ""
        self.errors: list[str] = []

    @property
    def passed(self) -> bool:
        return self.config_valid and self.binary_found


def load_config(config_path: Path) -> tuple[dict[str, Any] | None, list[str]]:
    """Load and validate a single LSP config JSON file."""
    errors: list[str] = []
    try:
        with open(config_path) as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        return None, [f"Invalid JSON: {e}"]

    missing = REQUIRED_CONFIG_KEYS - set(config.keys())
    if missing:
        errors.append(f"Missing required keys: {missing}")

    if not isinstance(config.get("filetypes"), list):
        errors.append("'filetypes' must be a list")

    if not isinstance(config.get("command"), str):
        errors.append("'command' must be a string")

    return config, errors


def check_binary(command: str) -> tuple[bool, str]:
    """Check if the LSP binary is available on PATH.

    Returns (found, version_string).
    """
    # Extract the base binary from the command
    binary = command.split()[0]

    # Handle special cases
    if binary == "npx":
        binary = "npx"
    elif binary == "dotnet":
        binary = "dotnet"

    if not shutil.which(binary):
        return False, ""

    # Try to get version
    version = ""
    version_flags = ["--version", "-version", "-v"]
    for flag in version_flags:
        try:
            result = subprocess.run(
                [binary, flag],
                capture_output=True,
                text=True,
                timeout=10,
            )
            output = (result.stdout + result.stderr).strip()
            if output and len(output) < 200:
                version = output.split("\n")[0]
                break
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            continue

    return True, version


def verify_all(configs_dir: Path, strict: bool = False) -> list[VerifyResult]:
    """Verify all LSP configs and their binary availability."""
    results: list[VerifyResult] = []

    if not configs_dir.is_dir():
        click.echo(f"ERROR: Config directory not found: {configs_dir}", err=True)
        sys.exit(1)

    config_files = sorted(configs_dir.glob("*.json"))
    if not config_files:
        click.echo(f"WARNING: No config files found in {configs_dir}", err=True)
        return results

    for config_path in config_files:
        name = config_path.stem
        result = VerifyResult(name=name)

        config, errors = load_config(config_path)
        if config and not errors:
            result.config_valid = True
        else:
            result.errors.extend(errors)

        if config:
            command = config.get("command", "")
            found, version = check_binary(command)
            result.binary_found = found
            result.version = version
            if not found:
                result.errors.append(f"Binary not found: {command.split()[0]}")

        results.append(result)

    return results


@click.command()
@click.option("--configs-dir", default=str(CONFIGS_DIR), help="Path to LSP config directory")
@click.option("--strict", is_flag=True, help="Exit 1 if any server fails verification")
@click.option("--json-output", is_flag=True, help="Output results as JSON")
def main(configs_dir: str, strict: bool, json_output: bool) -> None:
    """Verify LSP server installations."""
    results = verify_all(Path(configs_dir), strict=strict)

    if json_output:
        output = {
            "results": [
                {
                    "name": r.name,
                    "config_valid": r.config_valid,
                    "binary_found": r.binary_found,
                    "version": r.version,
                    "errors": r.errors,
                    "passed": r.passed,
                }
                for r in results
            ],
            "total": len(results),
            "passed": sum(1 for r in results if r.passed),
            "failed": sum(1 for r in results if not r.passed),
        }
        click.echo(json.dumps(output, indent=2))
    else:
        click.echo(f"Verifying {len(results)} LSP servers...\n")

        for r in results:
            status = "PASS" if r.passed else "FAIL"
            version_str = f" ({r.version})" if r.version else ""
            click.echo(f"  [{status}] {r.name}{version_str}")
            for err in r.errors:
                click.echo(f"         {err}")

        passed = sum(1 for r in results if r.passed)
        failed = len(results) - passed
        click.echo(f"\nResults: {passed} passed, {failed} failed out of {len(results)}")

    if strict:
        failed_count = sum(1 for r in results if not r.passed)
        if failed_count > 0:
            sys.exit(1)


if __name__ == "__main__":
    main()
