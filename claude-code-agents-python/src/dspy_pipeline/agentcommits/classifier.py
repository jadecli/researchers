"""DSPy module for classifying commits as agent-authored, human-authored, or mixed.

Uses a ChainOfThought signature to analyze commit messages, diff patterns, and
trailer presence to determine authorship type and confidence.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

import dspy


class AuthorshipType(str, Enum):
    AGENT_ONLY = "agent-only"
    AGENT_PRIMARY = "agent-primary"
    COLLABORATIVE = "collaborative"
    HUMAN_PRIMARY = "human-primary"
    HUMAN_ONLY = "human-only"


class CommitClassifierSignature(dspy.Signature):
    """Classify a git commit's authorship based on message, trailers, and diff patterns.

    Analyze the commit message structure, presence of agent trailers, diff
    characteristics (file count, change patterns), and conventional commit
    compliance to determine whether this commit was written by an AI agent,
    a human, or collaboratively.
    """

    commit_message: str = dspy.InputField(desc="Full commit message including trailers")
    diff_summary: str = dspy.InputField(desc="Summary of files changed and diff statistics")
    has_agent_trailers: bool = dspy.InputField(desc="Whether Agent-* trailers are present")

    authorship_type: str = dspy.OutputField(
        desc="One of: agent-only, agent-primary, collaborative, human-primary, human-only"
    )
    confidence: float = dspy.OutputField(desc="Confidence score 0.0-1.0")
    reasoning: str = dspy.OutputField(desc="Brief explanation of classification")


class CommitClassifierModule(dspy.Module):
    """ChainOfThought module for commit authorship classification."""

    def __init__(self) -> None:
        super().__init__()
        self.classifier = dspy.ChainOfThought(CommitClassifierSignature)

    def forward(
        self,
        commit_message: str,
        diff_summary: str = "",
        has_agent_trailers: bool = False,
    ) -> dspy.Prediction:
        return self.classifier(
            commit_message=commit_message,
            diff_summary=diff_summary,
            has_agent_trailers=has_agent_trailers,
        )

    def classify(
        self,
        commit_message: str,
        diff_summary: str = "",
    ) -> tuple[AuthorshipType, float]:
        """Classify a commit and return (authorship_type, confidence).

        Checks for agent trailers before calling the LLM for efficiency.
        """
        has_trailers = "Agent-Id:" in commit_message or "Agent-Authorship:" in commit_message

        prediction = self.forward(
            commit_message=commit_message,
            diff_summary=diff_summary,
            has_agent_trailers=has_trailers,
        )

        try:
            authorship = AuthorshipType(prediction.authorship_type.strip().lower())
        except ValueError:
            authorship = AuthorshipType.HUMAN_ONLY

        confidence = max(0.0, min(1.0, float(prediction.confidence)))
        return authorship, confidence
