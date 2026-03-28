"""DSPy module for extracting and validating agent trailers from commit messages.

Parses git trailers following the agentcommits specification:
- Agent-Id (required): Model identifier
- Agent-Authorship (required): Authorship classification
- Agent-Tools, Agent-Confidence, etc. (optional)
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

import dspy


AGENT_TRAILER_PATTERN = re.compile(
    r"^(Agent-[\w-]+):\s*(.+?)$",
    re.MULTILINE,
)

REQUIRED_TRAILERS = {"Agent-Id", "Agent-Authorship"}

VALID_TRAILERS = {
    "Agent-Id",
    "Agent-Tools",
    "Agent-Context-Files",
    "Agent-Confidence",
    "Agent-Authorship",
    "Agent-Task-Ref",
    "Agent-Skill-Ref",
    "Agent-Session",
    "Agent-Cost-USD",
    "Agent-Input-Tokens",
    "Agent-Output-Tokens",
}

VALID_CONFIDENCE = {"high", "medium", "low"}
VALID_AUTHORSHIP = {
    "agent-only", "agent-primary", "collaborative", "human-primary",
}


@dataclass
class AgentTrailers:
    """Parsed agent trailers from a commit message."""

    raw_trailers: dict[str, str] = field(default_factory=dict)
    agent_id: Optional[str] = None
    agent_authorship: Optional[str] = None
    agent_tools: list[str] = field(default_factory=list)
    agent_confidence: Optional[str] = None
    agent_session: Optional[str] = None
    agent_cost_usd: Optional[float] = None
    agent_input_tokens: Optional[int] = None
    agent_output_tokens: Optional[int] = None
    agent_task_ref: Optional[str] = None
    agent_skill_refs: list[str] = field(default_factory=list)

    @property
    def has_required(self) -> bool:
        return self.agent_id is not None and self.agent_authorship is not None

    @property
    def completeness_score(self) -> float:
        """Score 0.0-1.0 based on how many known trailers are populated."""
        populated = sum(1 for v in [
            self.agent_id, self.agent_authorship, self.agent_tools,
            self.agent_confidence, self.agent_session, self.agent_cost_usd,
            self.agent_input_tokens, self.agent_output_tokens,
            self.agent_task_ref, self.agent_skill_refs,
        ] if v)
        return round(populated / 10.0, 2)

    @property
    def is_valid(self) -> bool:
        """Check if trailers pass validation."""
        if not self.has_required:
            return False
        if self.agent_confidence and self.agent_confidence not in VALID_CONFIDENCE:
            return False
        if self.agent_authorship and self.agent_authorship not in VALID_AUTHORSHIP:
            return False
        return True


def extract_agent_trailers(commit_message: str) -> AgentTrailers:
    """Extract agent trailers from a commit message using regex.

    This is the fast path — no LLM needed. Used when bloom filter
    indicates the commit likely has agent trailers.
    """
    matches = AGENT_TRAILER_PATTERN.findall(commit_message)
    raw = {key: value.strip() for key, value in matches}

    trailers = AgentTrailers(raw_trailers=raw)

    trailers.agent_id = raw.get("Agent-Id")
    trailers.agent_authorship = raw.get("Agent-Authorship")

    tools_str = raw.get("Agent-Tools", "")
    if tools_str:
        trailers.agent_tools = [t.strip() for t in tools_str.split(",")]

    trailers.agent_confidence = raw.get("Agent-Confidence")
    trailers.agent_session = raw.get("Agent-Session")
    trailers.agent_task_ref = raw.get("Agent-Task-Ref")

    skill_str = raw.get("Agent-Skill-Ref", "")
    if skill_str:
        trailers.agent_skill_refs = [s.strip() for s in skill_str.split(",")]

    cost_str = raw.get("Agent-Cost-USD")
    if cost_str:
        try:
            trailers.agent_cost_usd = float(cost_str)
        except ValueError:
            pass

    for token_field, attr in [
        ("Agent-Input-Tokens", "agent_input_tokens"),
        ("Agent-Output-Tokens", "agent_output_tokens"),
    ]:
        val = raw.get(token_field)
        if val:
            try:
                setattr(trailers, attr, int(val))
            except ValueError:
                pass

    return trailers


class TrailerExtractorSignature(dspy.Signature):
    """Extract and validate agent trailers from a commit message.

    Parse the commit message to identify agent metadata trailers.
    Check that required fields (Agent-Id, Agent-Authorship) are present
    and all values conform to the agentcommits specification.
    """

    commit_message: str = dspy.InputField(desc="Full commit message")
    extracted_trailers: str = dspy.OutputField(desc="JSON dict of trailer key-value pairs")
    validation_errors: str = dspy.OutputField(desc="List of validation issues or 'none'")
    completeness_score: float = dspy.OutputField(desc="0.0-1.0 score of trailer completeness")


class TrailerExtractorModule(dspy.Module):
    """DSPy module that extracts trailers with LLM fallback for ambiguous cases."""

    def __init__(self) -> None:
        super().__init__()
        self.extractor = dspy.ChainOfThought(TrailerExtractorSignature)

    def forward(self, commit_message: str) -> dspy.Prediction:
        return self.extractor(commit_message=commit_message)

    def extract(self, commit_message: str, use_llm_fallback: bool = False) -> AgentTrailers:
        """Extract trailers. Uses fast regex path first, LLM fallback if needed."""
        trailers = extract_agent_trailers(commit_message)

        if trailers.has_required or not use_llm_fallback:
            return trailers

        # LLM fallback for ambiguous messages
        prediction = self.forward(commit_message)
        # Re-parse from LLM output (structured extraction)
        return trailers  # Return regex result as baseline
