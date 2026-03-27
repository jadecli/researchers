"""Plugin Scanner for generated knowledge-work plugins."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml


@dataclass
class PluginIssue:
    """A single issue found during plugin audit."""
    file: str
    line: Optional[int]
    severity: str
    description: str
    category: str  # "script_safety", "hook_safety", "credential_leak", "skill_safety", "mcp_safety", "schema"


@dataclass
class PluginAuditReport:
    """Complete audit report for a plugin."""
    plugin_dir: str
    issues: list[PluginIssue] = field(default_factory=list)
    scanned_files: list[str] = field(default_factory=list)
    passed: bool = True

    def add_issue(self, issue: PluginIssue) -> None:
        self.issues.append(issue)
        if issue.severity in ("critical", "high"):
            self.passed = False


def _load_safety_rules() -> dict:
    """Load plugin safety rules from YAML."""
    rules_path = Path(__file__).parent.parent / "rules" / "plugin_safety_rules.yaml"
    if rules_path.exists():
        with open(rules_path) as f:
            return yaml.safe_load(f).get("rules", {})
    return {}


class PluginScanner:
    """Scans generated plugins for security issues."""

    def __init__(self):
        self.rules = _load_safety_rules()

    def scan_plugin(self, plugin_dir: str) -> PluginAuditReport:
        """Perform a full security audit of a plugin directory."""
        report = PluginAuditReport(plugin_dir=plugin_dir)
        base = Path(plugin_dir)

        if not base.exists() or not base.is_dir():
            report.add_issue(PluginIssue(
                file=plugin_dir,
                line=None,
                severity="critical",
                description="Plugin directory does not exist",
                category="schema",
            ))
            return report

        # Check plugin.json
        plugin_json = base / "plugin.json"
        if plugin_json.exists():
            report.scanned_files.append(str(plugin_json))
            self._check_plugin_json(plugin_json, report)
        else:
            report.add_issue(PluginIssue(
                file=str(base / "plugin.json"),
                line=None,
                severity="high",
                description="Missing plugin.json manifest",
                category="schema",
            ))

        # Check SKILL.md files
        for skill_md in base.rglob("SKILL.md"):
            report.scanned_files.append(str(skill_md))
            self._check_skill_md(skill_md, report)

        # Check hooks.json
        hooks_json = base / "hooks.json"
        if hooks_json.exists():
            report.scanned_files.append(str(hooks_json))
            self._check_hooks_json(hooks_json, report)

        # Check .mcp.json
        mcp_json = base / ".mcp.json"
        if mcp_json.exists():
            report.scanned_files.append(str(mcp_json))
            self._check_mcp_json(mcp_json, report)

        # Scan all script files
        for ext in ("*.py", "*.sh", "*.js", "*.ts"):
            for script in base.rglob(ext):
                report.scanned_files.append(str(script))
                self._check_script(script, report)

        return report

    def _check_plugin_json(self, path: Path, report: PluginAuditReport) -> None:
        """Validate plugin.json schema and content."""
        try:
            with open(path) as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            report.add_issue(PluginIssue(
                file=str(path),
                line=None,
                severity="high",
                description=f"Invalid JSON in plugin.json: {e}",
                category="schema",
            ))
            return

        required_fields = ["name", "version", "description"]
        for field_name in required_fields:
            if field_name not in data:
                report.add_issue(PluginIssue(
                    file=str(path),
                    line=None,
                    severity="medium",
                    description=f"Missing required field '{field_name}' in plugin.json",
                    category="schema",
                ))

        # Check for credential patterns in the entire JSON
        content = path.read_text()
        cred_rules = self.rules.get("credentials", {})
        for pattern_str in cred_rules.get("disallowed_patterns", []):
            try:
                pattern = re.compile(pattern_str)
                for match in pattern.finditer(content):
                    report.add_issue(PluginIssue(
                        file=str(path),
                        line=None,
                        severity="critical",
                        description=f"Credential pattern detected in plugin.json: {pattern_str}",
                        category="credential_leak",
                    ))
            except re.error:
                continue

    def _check_skill_md(self, path: Path, report: PluginAuditReport) -> None:
        """Check SKILL.md for prompt injection patterns."""
        content = path.read_text(encoding="utf-8", errors="replace")
        skill_rules = self.rules.get("skills", {})

        # Check content length
        max_len = skill_rules.get("max_skill_description_length", 2000)
        if len(content) > max_len:
            report.add_issue(PluginIssue(
                file=str(path),
                line=None,
                severity="medium",
                description=f"SKILL.md exceeds maximum length ({len(content)} > {max_len})",
                category="skill_safety",
            ))

        # Check for prompt injection patterns
        for pattern_str in skill_rules.get("disallowed_content_patterns", []):
            if pattern_str.lower() in content.lower():
                report.add_issue(PluginIssue(
                    file=str(path),
                    line=None,
                    severity="critical",
                    description=f"Potential prompt injection pattern in SKILL.md: '{pattern_str}'",
                    category="skill_safety",
                ))

    def _check_hooks_json(self, path: Path, report: PluginAuditReport) -> None:
        """Check hooks.json for unsafe commands."""
        try:
            with open(path) as f:
                data = json.load(f)
        except json.JSONDecodeError:
            report.add_issue(PluginIssue(
                file=str(path),
                line=None,
                severity="high",
                description="Invalid JSON in hooks.json",
                category="schema",
            ))
            return

        hook_rules = self.rules.get("hooks", {})
        disallowed = hook_rules.get("disallowed_in_commands", [])

        # Recursively find all command strings in the hooks config
        commands = self._extract_commands(data)
        for cmd in commands:
            for blocked in disallowed:
                if blocked in cmd:
                    report.add_issue(PluginIssue(
                        file=str(path),
                        line=None,
                        severity="critical",
                        description=f"Unsafe pattern '{blocked}' found in hook command: {cmd[:100]}",
                        category="hook_safety",
                    ))

    def _check_mcp_json(self, path: Path, report: PluginAuditReport) -> None:
        """Check .mcp.json server definitions."""
        try:
            with open(path) as f:
                data = json.load(f)
        except json.JSONDecodeError:
            report.add_issue(PluginIssue(
                file=str(path),
                line=None,
                severity="high",
                description="Invalid JSON in .mcp.json",
                category="schema",
            ))
            return

        mcp_rules = self.rules.get("mcp_servers", {})
        allowed_types = mcp_rules.get("allowed_types", ["stdio", "sse"])
        disallowed_patterns = mcp_rules.get("disallowed_server_patterns", [])

        servers = data.get("mcpServers", data.get("servers", {}))
        for name, config in servers.items() if isinstance(servers, dict) else []:
            server_type = config.get("type", "")
            if server_type and server_type not in allowed_types:
                report.add_issue(PluginIssue(
                    file=str(path),
                    line=None,
                    severity="high",
                    description=f"MCP server '{name}' uses disallowed type: {server_type}",
                    category="mcp_safety",
                ))

            # Check server URL against disallowed patterns
            url = config.get("url", config.get("command", ""))
            for pattern_str in disallowed_patterns:
                try:
                    if re.match(pattern_str, url):
                        report.add_issue(PluginIssue(
                            file=str(path),
                            line=None,
                            severity="critical",
                            description=f"MCP server '{name}' URL matches disallowed pattern: {pattern_str}",
                            category="mcp_safety",
                        ))
                except re.error:
                    continue

    def _check_script(self, path: Path, report: PluginAuditReport) -> None:
        """Check a script file for unsafe operations."""
        content = path.read_text(encoding="utf-8", errors="replace")
        lines = content.splitlines()
        script_rules = self.rules.get("scripts", {})

        # Check file size
        max_size = script_rules.get("max_script_size", 102400)
        if path.stat().st_size > max_size:
            report.add_issue(PluginIssue(
                file=str(path),
                line=None,
                severity="medium",
                description=f"Script exceeds maximum size ({path.stat().st_size} > {max_size})",
                category="script_safety",
            ))

        # Check disallowed patterns
        for pattern_str in script_rules.get("disallowed_patterns", []):
            try:
                pattern = re.compile(pattern_str)
                for i, line in enumerate(lines, start=1):
                    if pattern.search(line):
                        report.add_issue(PluginIssue(
                            file=str(path),
                            line=i,
                            severity="critical",
                            description=f"Disallowed pattern '{pattern_str}' found in script",
                            category="script_safety",
                        ))
            except re.error:
                continue

        # Check credential patterns
        cred_rules = self.rules.get("credentials", {})
        for pattern_str in cred_rules.get("disallowed_patterns", []):
            try:
                pattern = re.compile(pattern_str)
                for i, line in enumerate(lines, start=1):
                    if pattern.search(line):
                        report.add_issue(PluginIssue(
                            file=str(path),
                            line=i,
                            severity="critical",
                            description=f"Credential pattern detected in script: {pattern_str}",
                            category="credential_leak",
                        ))
            except re.error:
                continue

    @staticmethod
    def _extract_commands(data, commands=None) -> list[str]:
        """Recursively extract command strings from a data structure."""
        if commands is None:
            commands = []
        if isinstance(data, dict):
            for key, value in data.items():
                if key == "command" and isinstance(value, str):
                    commands.append(value)
                else:
                    PluginScanner._extract_commands(value, commands)
        elif isinstance(data, list):
            for item in data:
                PluginScanner._extract_commands(item, commands)
        return commands


if __name__ == "__main__":
    import sys
    scanner = PluginScanner()
    if len(sys.argv) < 2:
        print("Usage: python -m scanners.plugin_scanner <plugin_directory>")
        sys.exit(1)
    report = scanner.scan_plugin(sys.argv[1])
    print(f"Plugin Audit: {report.plugin_dir}")
    print(f"Passed: {report.passed}")
    print(f"Files scanned: {len(report.scanned_files)}")
    print(f"Issues found: {len(report.issues)}")
    for issue in report.issues:
        line_info = f":{issue.line}" if issue.line else ""
        print(f"  [{issue.severity.upper()}] {issue.file}{line_info} - {issue.description} ({issue.category})")
