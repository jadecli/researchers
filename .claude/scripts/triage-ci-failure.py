#!/usr/bin/env python3
"""CI/CD failure triage with decision tree routing.

Headless script that reads CI failure logs and routes through a decision tree:
  1. Can haiku classify the failure type? → Route to cheap model
  2. Can sonnet propose a fix? → Apply fix in worktree
  3. Is this out of scope? → Create Linear ticket + Slack alert
  4. Fallback → Log TODO locally, never fail silent

Usage:
  python3 .claude/scripts/triage-ci-failure.py --run-url <url> [--log-file <path>]
  python3 .claude/scripts/triage-ci-failure.py --log-file ci-output.log
  echo "<error output>" | python3 .claude/scripts/triage-ci-failure.py --stdin

Environment:
  ANTHROPIC_API_KEY — Required for Claude API calls
  SLACK_WEBHOOK_URL — Optional, for Slack notifications
  LINEAR_API_KEY    — Optional, for Linear ticket creation
  LINEAR_TEAM_ID    — Required with LINEAR_API_KEY
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

ROOT = Path(subprocess.run(
    ["git", "rev-parse", "--show-toplevel"],
    capture_output=True, text=True
).stdout.strip() or ".")


# ── Failure Classification ────────────────────────────────────

class FailureType(str, Enum):
    TYPE_ERROR = "type_error"
    LINT_ERROR = "lint_error"
    BUILD_FAILURE = "build_failure"
    TEST_FAILURE = "test_failure"
    SECURITY_FINDING = "security_finding"
    DEPENDENCY_ERROR = "dependency_error"
    ARCHITECTURE_VIOLATION = "architecture_violation"
    UNKNOWN = "unknown"


class Severity(str, Enum):
    CRITICAL = "critical"  # Blocks deployment, needs immediate fix
    HIGH = "high"          # Blocks PR merge, fix before next commit
    MEDIUM = "medium"      # Should fix, but doesn't block
    LOW = "low"            # Nice to fix, log as TODO


class Action(str, Enum):
    FIX_INLINE = "fix_inline"          # Cheap model can fix it
    FIX_WITH_CONTEXT = "fix_context"   # Sonnet needs codebase context
    ESCALATE_SLACK = "slack"           # Alert team via Slack
    ESCALATE_LINEAR = "linear"         # Create Linear ticket
    LOG_TODO = "todo"                  # Local TODO fallback


@dataclass
class TriageResult:
    """Result of triaging a CI failure."""
    failure_type: FailureType
    severity: Severity
    action: Action
    description: str
    file_path: str = ""
    line_number: int = 0
    suggested_fix: str = ""
    raw_error: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


# ── Classifier (runs locally, no API needed) ─────────────────

def classify_failure(error_text: str) -> list[TriageResult]:
    """Classify CI failures using pattern matching (no API call).

    This is the fast path — deterministic regex classification.
    Falls back to Claude only for unclassifiable errors.
    """
    results: list[TriageResult] = []
    lines = error_text.split("\n")

    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue

        # TypeScript errors: TS2307, TS7006, etc.
        if "error TS" in stripped:
            ts_code = _extract_pattern(stripped, r"error (TS\d+)")
            file_path = _extract_pattern(stripped, r"^([^(]+)\(")
            line_num = int(_extract_pattern(stripped, r"\((\d+),") or "0")

            severity = Severity.HIGH if ts_code in ("TS2307", "TS2345", "TS2322") else Severity.MEDIUM
            results.append(TriageResult(
                failure_type=FailureType.TYPE_ERROR,
                severity=severity,
                action=Action.FIX_WITH_CONTEXT if severity == Severity.HIGH else Action.FIX_INLINE,
                description=f"TypeScript {ts_code}: {stripped}",
                file_path=file_path or "",
                line_number=line_num,
                raw_error=stripped,
            ))

        # Python lint errors (ruff)
        elif any(code in stripped for code in ["E501", "F401", "F841", "E711", "E712"]):
            results.append(TriageResult(
                failure_type=FailureType.LINT_ERROR,
                severity=Severity.LOW,
                action=Action.FIX_INLINE,
                description=f"Ruff lint: {stripped}",
                raw_error=stripped,
            ))

        # Build failures
        elif any(kw in stripped.lower() for kw in ["build failed", "compilation failed", "error: cannot find module"]):
            results.append(TriageResult(
                failure_type=FailureType.BUILD_FAILURE,
                severity=Severity.CRITICAL,
                action=Action.FIX_WITH_CONTEXT,
                description=f"Build failure: {stripped}",
                raw_error=stripped,
            ))

        # Test failures
        elif any(kw in stripped for kw in ["FAIL ", "✗ ", "AssertionError", "expect(", "assert "]):
            results.append(TriageResult(
                failure_type=FailureType.TEST_FAILURE,
                severity=Severity.HIGH,
                action=Action.FIX_WITH_CONTEXT,
                description=f"Test failure: {stripped}",
                raw_error=stripped,
            ))

        # Security findings
        elif any(kw in stripped.lower() for kw in ["vulnerability", "cve-", "security", "credential", "secret"]):
            results.append(TriageResult(
                failure_type=FailureType.SECURITY_FINDING,
                severity=Severity.CRITICAL,
                action=Action.ESCALATE_SLACK,
                description=f"Security: {stripped}",
                raw_error=stripped,
            ))

        # Dependency errors
        elif any(kw in stripped for kw in ["npm ERR!", "pip install", "ModuleNotFoundError", "Cannot find package"]):
            results.append(TriageResult(
                failure_type=FailureType.DEPENDENCY_ERROR,
                severity=Severity.HIGH,
                action=Action.FIX_INLINE,
                description=f"Dependency: {stripped}",
                raw_error=stripped,
            ))

        # Architecture violations
        elif "cross-boundary" in stripped.lower() or "import violation" in stripped.lower():
            results.append(TriageResult(
                failure_type=FailureType.ARCHITECTURE_VIOLATION,
                severity=Severity.HIGH,
                action=Action.ESCALATE_LINEAR,
                description=f"Architecture: {stripped}",
                raw_error=stripped,
            ))

    # If nothing classified, mark as unknown
    if not results and error_text.strip():
        results.append(TriageResult(
            failure_type=FailureType.UNKNOWN,
            severity=Severity.MEDIUM,
            action=Action.ESCALATE_LINEAR,
            description="Unclassified CI failure — needs human review",
            raw_error=error_text[:500],
        ))

    return results


def _extract_pattern(text: str, pattern: str) -> str:
    """Extract first match from text using regex."""
    import re
    match = re.search(pattern, text)
    return match.group(1) if match else ""


# ── Decision Tree Executor ────────────────────────────────────

def execute_decision_tree(results: list[TriageResult], dry_run: bool = False) -> dict[str, Any]:
    """Execute the escalation chain for each triage result.

    Decision tree:
      1. FIX_INLINE → Generate fix with haiku (cheap), apply if possible
      2. FIX_WITH_CONTEXT → Generate fix with sonnet (needs codebase), apply if possible
      3. ESCALATE_SLACK → Post to Slack webhook
      4. ESCALATE_LINEAR → Create Linear ticket
      5. LOG_TODO → Append to todos.jsonl (ALWAYS happens as fallback)

    Gradual degradation: if any step fails, fall through to next.
    Never fail silent — LOG_TODO is the guaranteed final step.
    """
    summary: dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_findings": len(results),
        "actions_taken": [],
        "fixes_attempted": 0,
        "fixes_succeeded": 0,
        "slack_sent": False,
        "linear_tickets": 0,
        "todos_created": 0,
    }

    for result in results:
        action_log: dict[str, Any] = {
            "type": result.failure_type.value,
            "severity": result.severity.value,
            "intended_action": result.action.value,
            "actual_actions": [],
        }

        try:
            # Step 1: Try to fix
            if result.action in (Action.FIX_INLINE, Action.FIX_WITH_CONTEXT) and not dry_run:
                summary["fixes_attempted"] += 1
                fix_result = _attempt_fix(result)
                if fix_result:
                    summary["fixes_succeeded"] += 1
                    action_log["actual_actions"].append("fix_applied")
                    result.suggested_fix = fix_result
                else:
                    # Fix failed, escalate
                    action_log["actual_actions"].append("fix_failed_escalating")
                    result.action = Action.ESCALATE_SLACK

            # Step 2: Slack alert for critical/security
            if result.action == Action.ESCALATE_SLACK and not dry_run:
                slack_ok = _send_slack_alert(result)
                if slack_ok:
                    summary["slack_sent"] = True
                    action_log["actual_actions"].append("slack_sent")
                else:
                    action_log["actual_actions"].append("slack_failed_degrading")
                    # Slack failed, degrade to Linear
                    result.action = Action.ESCALATE_LINEAR

            # Step 3: Linear ticket for architecture/complex issues
            if result.action == Action.ESCALATE_LINEAR and not dry_run:
                linear_ok = _create_linear_ticket(result)
                if linear_ok:
                    summary["linear_tickets"] += 1
                    action_log["actual_actions"].append("linear_created")
                else:
                    action_log["actual_actions"].append("linear_failed_degrading")

        except Exception as e:
            logger.warning("Escalation error: %s — falling through to TODO", e)
            action_log["actual_actions"].append(f"error:{e}")

        # Step 4: ALWAYS log TODO locally (guaranteed final step)
        todo_ok = _log_todo(result, dry_run=dry_run)
        if todo_ok:
            summary["todos_created"] += 1
            action_log["actual_actions"].append("todo_logged")

        summary["actions_taken"].append(action_log)

    return summary


# ── Fix Attempt (headless Claude) ─────────────────────────────

def _attempt_fix(result: TriageResult) -> str:
    """Attempt to fix using headless Claude.

    Routes to haiku for simple fixes, sonnet for complex ones.
    Returns the fix description if successful, empty string if not.
    """
    if not os.environ.get("ANTHROPIC_API_KEY"):
        logger.info("No ANTHROPIC_API_KEY — skipping auto-fix attempt")
        return ""

    model = "haiku" if result.action == Action.FIX_INLINE else "sonnet"
    max_tokens = "1024" if model == "haiku" else "4096"

    prompt = f"""You are a CI/CD fix agent. Analyze this error and suggest a fix.

Error type: {result.failure_type.value}
File: {result.file_path or 'unknown'}
Line: {result.line_number or 'unknown'}
Error: {result.raw_error[:300]}

Rules:
- Only suggest fixes you are confident about
- Output ONLY the fix, no explanation
- If the fix requires reading more context, output: NEEDS_CONTEXT
- If this is not fixable automatically, output: ESCALATE
"""

    try:
        cmd = [
            "claude", "-p", prompt,
            "--model", model,
            "--max-turns", "1",
            "--output-format", "text",
        ]
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=30,
            env={**os.environ, "CLAUDE_CODE_MAX_OUTPUT_TOKENS": max_tokens},
        )
        output = proc.stdout.strip()
        if proc.returncode == 0 and output and "ESCALATE" not in output and "NEEDS_CONTEXT" not in output:
            return output
        return ""
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        logger.info("Claude headless unavailable (%s) — skipping auto-fix", e)
        return ""


# ── Slack Alert ───────────────────────────────────────────────

def _send_slack_alert(result: TriageResult) -> bool:
    """Send Slack alert via webhook. Returns True if sent."""
    webhook_url = os.environ.get("SLACK_WEBHOOK_URL")
    if not webhook_url:
        logger.info("No SLACK_WEBHOOK_URL — skipping Slack alert")
        return False

    try:
        import requests
    except ImportError:
        logger.info("requests not available — skipping Slack alert")
        return False

    severity_emoji = {
        Severity.CRITICAL: ":rotating_light:",
        Severity.HIGH: ":warning:",
        Severity.MEDIUM: ":information_source:",
        Severity.LOW: ":memo:",
    }

    payload = {
        "text": f"{severity_emoji.get(result.severity, ':question:')} CI Failure: {result.description[:100]}",
        "blocks": [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"CI Triage: {result.failure_type.value}"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Severity:*\n{result.severity.value}"},
                    {"type": "mrkdwn", "text": f"*Type:*\n{result.failure_type.value}"},
                    {"type": "mrkdwn", "text": f"*File:*\n`{result.file_path or 'N/A'}`"},
                    {"type": "mrkdwn", "text": f"*Action:*\n{result.action.value}"},
                ],
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"```{result.raw_error[:300]}```"},
            },
        ],
    }

    try:
        resp = requests.post(webhook_url, json=payload, timeout=10)
        return resp.status_code == 200
    except Exception as e:
        logger.warning("Slack post failed: %s", e)
        return False


# ── Linear Ticket ─────────────────────────────────────────────

def _create_linear_ticket(result: TriageResult) -> bool:
    """Create Linear ticket for the failure. Returns True if created."""
    api_key = os.environ.get("LINEAR_API_KEY")
    team_id = os.environ.get("LINEAR_TEAM_ID")
    if not api_key or not team_id:
        logger.info("No LINEAR_API_KEY/LINEAR_TEAM_ID — skipping Linear ticket")
        return False

    try:
        import requests
    except ImportError:
        logger.info("requests not available — skipping Linear ticket")
        return False

    priority_map = {
        Severity.CRITICAL: 1,  # Urgent
        Severity.HIGH: 2,      # High
        Severity.MEDIUM: 3,    # Medium
        Severity.LOW: 4,       # Low
    }

    title = f"[CI Triage] {result.failure_type.value}: {result.description[:80]}"
    description = f"""## CI/CD Failure — Auto-triaged

**Type:** {result.failure_type.value}
**Severity:** {result.severity.value}
**File:** {result.file_path or 'N/A'}
**Line:** {result.line_number or 'N/A'}

### Error
```
{result.raw_error[:500]}
```

### Suggested Fix
{result.suggested_fix or '_No auto-fix available — needs manual review._'}

### Triage Decision
Action: `{result.action.value}`
Triaged at: {datetime.now(timezone.utc).isoformat()}
Source: `triage-ci-failure.py` headless script
"""

    mutation = """
    mutation($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier url }
      }
    }
    """
    variables = {
        "input": {
            "teamId": team_id,
            "title": title,
            "description": description,
            "priority": priority_map.get(result.severity, 3),
        }
    }

    project_id = os.environ.get("LINEAR_PROJECT_ID")
    if project_id:
        variables["input"]["projectId"] = project_id

    try:
        resp = requests.post(
            "https://api.linear.app/graphql",
            headers={"Authorization": api_key, "Content-Type": "application/json"},
            json={"query": mutation, "variables": variables},
            timeout=15,
        )
        data = resp.json()
        issue = data.get("data", {}).get("issueCreate", {}).get("issue", {})
        if issue.get("identifier"):
            logger.info("Created Linear ticket: %s (%s)", issue["identifier"], issue.get("url", ""))
            return True
        logger.warning("Linear creation response: %s", data)
        return False
    except Exception as e:
        logger.warning("Linear API error: %s", e)
        return False


# ── TODO Logger (guaranteed fallback) ────────────────────────

def _log_todo(result: TriageResult, dry_run: bool = False) -> bool:
    """Append a TODO entry to todos.jsonl. ALWAYS succeeds."""
    todos_file = ROOT / "todos.jsonl"

    # Find next ID
    next_id = 1
    if todos_file.exists():
        try:
            for line in todos_file.read_text().strip().split("\n"):
                if line.strip():
                    entry = json.loads(line)
                    next_id = max(next_id, entry.get("id", 0) + 1)
        except (json.JSONDecodeError, KeyError):
            pass

    todo_entry = {
        "id": next_id,
        "repo": _guess_repo(result.file_path),
        "file": result.file_path or "unknown",
        "line": result.line_number,
        "marker": f"CI-{result.failure_type.value.upper()}",
        "content": result.description[:200],
        "status": "open",
        "priority": "high" if result.severity in (Severity.CRITICAL, Severity.HIGH) else "medium",
        "created": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "triage_action": result.action.value,
        "severity": result.severity.value,
    }

    if dry_run:
        logger.info("DRY RUN — would append TODO: %s", json.dumps(todo_entry))
        return True

    try:
        with open(todos_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(todo_entry, ensure_ascii=False) + "\n")
        logger.info("Logged TODO #%d: %s", next_id, result.description[:80])
        return True
    except OSError as e:
        # Last resort: print to stderr (literally cannot fail silent)
        print(f"CANNOT LOG TODO: {e} — {json.dumps(todo_entry)}", file=sys.stderr)
        return False


def _guess_repo(file_path: str) -> str:
    """Guess the sub-repo from a file path."""
    if not file_path:
        return "unknown"
    parts = file_path.split("/")
    known_repos = [
        "agenttasks", "claude-code", "claude-code-actions",
        "claude-code-agents-python", "claude-code-security-review",
        "claude-multi-agent-sdk", "claude-multi-agent-dispatch",
        "claude-channel-dispatch-routing", "claude-dspy-crawl-planning",
    ]
    for part in parts:
        if part in known_repos:
            return part
    return parts[0] if parts else "unknown"


# ── CLI Entry Point ───────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Triage CI/CD failures with decision tree routing")
    parser.add_argument("--log-file", help="Path to CI log file")
    parser.add_argument("--run-url", help="GitHub Actions run URL")
    parser.add_argument("--stdin", action="store_true", help="Read error from stdin")
    parser.add_argument("--dry-run", action="store_true", help="Classify only, don't take actions")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    # Read error text
    error_text = ""
    if args.stdin or not sys.stdin.isatty():
        error_text = sys.stdin.read()
    elif args.log_file:
        error_text = Path(args.log_file).read_text(encoding="utf-8", errors="replace")
    else:
        parser.error("Provide --log-file, --stdin, or pipe input")

    # Classify
    results = classify_failure(error_text)
    logger.info("Classified %d failure(s)", len(results))

    for r in results:
        logger.info("  [%s] %s — %s → %s", r.severity.value, r.failure_type.value, r.description[:60], r.action.value)

    # Execute decision tree
    summary = execute_decision_tree(results, dry_run=args.dry_run)

    if args.json:
        print(json.dumps(summary, indent=2, default=str))
    else:
        print(f"\nTriage complete: {summary['total_findings']} findings")
        print(f"  Fixes: {summary['fixes_succeeded']}/{summary['fixes_attempted']} succeeded")
        print(f"  Slack: {'sent' if summary['slack_sent'] else 'not sent'}")
        print(f"  Linear: {summary['linear_tickets']} ticket(s)")
        print(f"  TODOs: {summary['todos_created']} logged")


if __name__ == "__main__":
    main()
