"""DSPy module for validating conventional commit format compliance.

Checks that commit messages follow both the conventional commits v1.0.0 spec
and the agentcommits trailer extension.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

import dspy


# Conventional commit regex based on v1.0.0 spec
# type(optional-scope)!: description
CONVENTIONAL_COMMIT_PATTERN = re.compile(
    r"^(?P<type>[a-z]+)"
    r"(?:\((?P<scope>[^)]+)\))?"
    r"(?P<breaking>!)?"
    r":\s+"
    r"(?P<description>.+)$",
    re.MULTILINE,
)

STANDARD_TYPES = {
    "feat", "fix", "chore", "docs", "style", "refactor",
    "perf", "test", "ci", "build", "revert",
}


@dataclass
class ConventionCheckResult:
    """Result of checking a commit against conventional commits + agentcommits."""

    is_conventional: bool
    commit_type: Optional[str] = None
    scope: Optional[str] = None
    is_breaking: bool = False
    description: Optional[str] = None
    has_body: bool = False
    has_footers: bool = False
    has_agent_trailers: bool = False
    errors: list[str] = None
    warnings: list[str] = None

    def __post_init__(self) -> None:
        if self.errors is None:
            self.errors = []
        if self.warnings is None:
            self.warnings = []

    @property
    def compliance_score(self) -> float:
        """Score 0.0-1.0 for overall compliance."""
        if not self.is_conventional:
            return 0.0
        score = 0.5  # Base for valid conventional commit
        if self.commit_type in STANDARD_TYPES:
            score += 0.1
        if self.has_body:
            score += 0.1
        if self.has_footers:
            score += 0.1
        if self.has_agent_trailers:
            score += 0.2
        if not self.errors:
            score = min(score, 1.0)
        else:
            score *= 0.5
        return round(score, 2)


def check_conventional_commit(commit_message: str) -> ConventionCheckResult:
    """Check if a commit message follows conventional commits v1.0.0.

    Fast path — pure regex, no LLM needed.
    """
    lines = commit_message.strip().split("\n")
    if not lines:
        return ConventionCheckResult(is_conventional=False, errors=["Empty commit message"])

    first_line = lines[0].strip()
    match = CONVENTIONAL_COMMIT_PATTERN.match(first_line)

    if not match:
        return ConventionCheckResult(
            is_conventional=False,
            errors=[f"First line does not match conventional commit format: {first_line[:80]}"],
        )

    result = ConventionCheckResult(
        is_conventional=True,
        commit_type=match.group("type"),
        scope=match.group("scope"),
        is_breaking=match.group("breaking") == "!",
        description=match.group("description"),
    )

    # Check for body (blank line after first line, then content)
    if len(lines) > 2 and lines[1].strip() == "":
        result.has_body = True

    # Check for footers (lines matching token: value or token #value)
    footer_pattern = re.compile(r"^[\w-]+:\s|^[\w-]+\s#")
    for line in lines[2:]:
        if footer_pattern.match(line.strip()):
            result.has_footers = True
            break

    # Check for agent trailers
    result.has_agent_trailers = "Agent-Id:" in commit_message

    # Warnings for non-standard types
    if result.commit_type not in STANDARD_TYPES:
        result.warnings.append(
            f"Non-standard type '{result.commit_type}' — valid but may not be recognized by tools"
        )

    # Check description length
    if result.description and len(result.description) > 100:
        result.warnings.append("Description exceeds 100 characters")

    # Check for BREAKING CHANGE footer consistency
    has_breaking_footer = "BREAKING CHANGE:" in commit_message or "BREAKING-CHANGE:" in commit_message
    if has_breaking_footer and not result.is_breaking:
        result.warnings.append(
            "BREAKING CHANGE footer found but `!` not in type — consider adding for clarity"
        )

    return result


class ConventionCheckerSignature(dspy.Signature):
    """Check a commit message against conventional commits v1.0.0 spec.

    Validate format, type, scope, breaking changes, body, and footers.
    Also check agentcommits trailer compliance if agent trailers are present.
    """

    commit_message: str = dspy.InputField(desc="Full commit message")
    is_valid: bool = dspy.OutputField(desc="Whether the message is a valid conventional commit")
    compliance_score: float = dspy.OutputField(desc="0.0-1.0 compliance score")
    issues: str = dspy.OutputField(desc="List of issues found, or 'none'")


class ConventionCheckerModule(dspy.Module):
    """DSPy module for convention checking with LLM for edge cases."""

    def __init__(self) -> None:
        super().__init__()
        self.checker = dspy.ChainOfThought(ConventionCheckerSignature)

    def forward(self, commit_message: str) -> dspy.Prediction:
        return self.checker(commit_message=commit_message)

    def check(self, commit_message: str) -> ConventionCheckResult:
        """Check convention compliance. Uses fast regex path."""
        return check_conventional_commit(commit_message)
