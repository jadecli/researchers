"""Bloom filter tool routing with DSPy-optimized intent classification.

Ralph Kimball patterns: additive metrics, grain-per-row, no leaky abstractions.
Boris Cherny patterns: strict typing, exhaustive matching, branded values via NewType.

Architecture:
    1. Bloom filter pre-checks tool existence (O(k) constant time, zero false negatives)
    2. DSPy signature classifies user intent → tool set (optimizable via teleprompter)
    3. Combined router: bloom filter gates → DSPy refines → dispatch to Sonnet

Usage:
    router = BloomToolRouter.from_tool_names(["Read", "Write", "Edit", "Grep", "Glob"])
    decision = router.route("search for files matching *.ts")
    # → RoutingDecision(tool="Grep", confidence=0.94, gate="bloom_pass")
"""

from __future__ import annotations

import hashlib
import json
import math
import struct
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import NewType, Sequence

import dspy

# ── Branded Types (Boris Cherny via NewType) ────────────────────

BitIndex = NewType("BitIndex", int)
HashSeed = NewType("HashSeed", int)
FalsePositiveRate = NewType("FalsePositiveRate", float)
ToolName = NewType("ToolName", str)
Confidence = NewType("Confidence", float)


# ── Bloom Filter ────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class BloomFilterConfig:
    """Immutable bloom filter configuration."""

    expected_items: int
    false_positive_rate: FalsePositiveRate = FalsePositiveRate(0.01)

    def __post_init__(self) -> None:
        if self.expected_items <= 0:
            raise ValueError(f"expected_items must be positive, got {self.expected_items}")
        rate = float(self.false_positive_rate)
        if rate <= 0 or rate >= 1:
            raise ValueError(f"false_positive_rate must be in (0,1), got {rate}")


@dataclass(slots=True)
class BloomFilter:
    """Probabilistic set membership with zero false negatives.

    Grain: one filter per tool registry. Immutable after construction.
    """

    bits: bytearray
    bit_count: int
    hash_count: int
    item_count: int
    config: BloomFilterConfig

    @staticmethod
    def _optimal_bit_count(n: int, p: float) -> int:
        m = int(math.ceil(-(n * math.log(p)) / (math.log(2) ** 2)))
        return max(m, 64)

    @staticmethod
    def _optimal_hash_count(m: int, n: int) -> int:
        k = round((m / n) * math.log(2))
        return max(k, 1)

    @staticmethod
    def _hash_values(item: str, hash_count: int, bit_count: int) -> list[BitIndex]:
        """Double hashing: h(i) = h1(x) + i * h2(x)."""
        encoded = item.encode("utf-8")
        h1 = struct.unpack("<I", hashlib.md5(encoded).digest()[:4])[0]
        h2 = struct.unpack("<I", hashlib.sha1(encoded).digest()[:4])[0]
        return [BitIndex((h1 + i * h2) % bit_count) for i in range(hash_count)]

    @classmethod
    def create(cls, config: BloomFilterConfig) -> BloomFilter:
        m = cls._optimal_bit_count(config.expected_items, float(config.false_positive_rate))
        k = cls._optimal_hash_count(m, config.expected_items)
        return cls(
            bits=bytearray(math.ceil(m / 8)),
            bit_count=m,
            hash_count=k,
            item_count=0,
            config=config,
        )

    def add(self, item: str) -> None:
        """Add item to filter (mutates in place for batch loading)."""
        for idx in self._hash_values(item.lower(), self.hash_count, self.bit_count):
            byte_pos, bit_pos = divmod(idx, 8)
            self.bits[byte_pos] |= 1 << bit_pos
        self.item_count += 1

    def might_contain(self, item: str) -> bool:
        """Check membership. False = definitely absent. True = probably present."""
        for idx in self._hash_values(item.lower(), self.hash_count, self.bit_count):
            byte_pos, bit_pos = divmod(idx, 8)
            if not (self.bits[byte_pos] & (1 << bit_pos)):
                return False
        return True

    @property
    def estimated_fp_rate(self) -> float:
        """Actual false positive rate: (1 - e^(-k*n/m))^k."""
        exp = -(self.hash_count * self.item_count) / self.bit_count
        return (1 - math.exp(exp)) ** self.hash_count

    def to_json(self) -> str:
        """Serialize for Neon storage."""
        import base64

        return json.dumps(
            {
                "bits": base64.b64encode(self.bits).decode(),
                "bit_count": self.bit_count,
                "hash_count": self.hash_count,
                "item_count": self.item_count,
                "config": {
                    "expected_items": self.config.expected_items,
                    "false_positive_rate": float(self.config.false_positive_rate),
                },
            }
        )

    @classmethod
    def from_json(cls, data: str) -> BloomFilter:
        """Deserialize from Neon storage."""
        import base64

        parsed = json.loads(data)
        config = BloomFilterConfig(
            expected_items=parsed["config"]["expected_items"],
            false_positive_rate=FalsePositiveRate(parsed["config"]["false_positive_rate"]),
        )
        return cls(
            bits=bytearray(base64.b64decode(parsed["bits"])),
            bit_count=parsed["bit_count"],
            hash_count=parsed["hash_count"],
            item_count=parsed["item_count"],
            config=config,
        )


# ── DSPy Signatures ─────────────────────────────────────────────


class ToolIntentClassifier(dspy.Signature):
    """Classify user prompt intent to determine which tools are needed.

    Given a user prompt and the list of available tools, predict which
    tools will be called and estimate confidence.
    """

    prompt_text: str = dspy.InputField(desc="The user's prompt text")
    available_tools: str = dspy.InputField(desc="Comma-separated list of available tool names")
    recent_context: str = dspy.InputField(desc="Summary of recent session context (last 3 actions)")

    predicted_tools: str = dspy.OutputField(
        desc="Comma-separated predicted tool names, most likely first"
    )
    confidence: float = dspy.OutputField(desc="Overall confidence 0.0-1.0")
    reasoning: str = dspy.OutputField(desc="Brief explanation of tool selection")


class StreamEventClassifier(dspy.Signature):
    """Classify an agentstream event for routing and prioritization.

    Given a raw stream event, determine its priority, whether it needs
    immediate action, and what downstream consumers should process it.
    """

    event_type: str = dspy.InputField(desc="Stream event type: prompt, commit, crawl, decision, etc.")
    payload_summary: str = dspy.InputField(desc="Truncated payload summary (first 500 chars)")
    session_context: str = dspy.InputField(desc="Current session branch, model, recent event types")

    priority: str = dspy.OutputField(desc="One of: critical, high, normal, low")
    needs_action: bool = dspy.OutputField(desc="Whether this event needs immediate processing")
    consumers: str = dspy.OutputField(desc="Comma-separated consumer names: etl, eval, memory, alert")
    reasoning: str = dspy.OutputField(desc="Brief explanation")


# ── Routing Decision ────────────────────────────────────────────


class GateResult(str, Enum):
    """Bloom filter gate outcomes — exhaustive."""

    BLOOM_PASS = "bloom_pass"  # Bloom says probably exists
    BLOOM_REJECT = "bloom_reject"  # Bloom says definitely missing
    BYPASS = "bypass"  # No bloom filter available


@dataclass(frozen=True, slots=True)
class RoutingDecision:
    """Immutable routing decision from bloom + DSPy pipeline."""

    tool: ToolName
    confidence: Confidence
    gate: GateResult
    dspy_reasoning: str = ""


# ── Router ──────────────────────────────────────────────────────


class BloomToolRouter:
    """Combined bloom filter + DSPy tool router.

    Haiku checks bloom filter (O(k)), DSPy classifies intent, Sonnet executes.
    """

    def __init__(
        self,
        bloom: BloomFilter,
        tool_names: list[ToolName],
        dspy_module: dspy.Module | None = None,
    ) -> None:
        self._bloom = bloom
        self._tool_names = tool_names
        self._dspy = dspy_module or dspy.ChainOfThought(ToolIntentClassifier)
        self._stats = {"checks": 0, "bloom_pass": 0, "bloom_reject": 0}

    @classmethod
    def from_tool_names(
        cls,
        tools: Sequence[str],
        fp_rate: float = 0.01,
    ) -> BloomToolRouter:
        """Factory: build router from a list of tool names."""
        config = BloomFilterConfig(
            expected_items=max(len(tools), 1),
            false_positive_rate=FalsePositiveRate(fp_rate),
        )
        bloom = BloomFilter.create(config)
        tool_names: list[ToolName] = []
        for t in tools:
            bloom.add(t)
            tool_names.append(ToolName(t))
        return cls(bloom, tool_names)

    def gate(self, tool: str) -> GateResult:
        """Bloom filter gate check — O(k) constant time."""
        self._stats["checks"] += 1
        if self._bloom.might_contain(tool):
            self._stats["bloom_pass"] += 1
            return GateResult.BLOOM_PASS
        self._stats["bloom_reject"] += 1
        return GateResult.BLOOM_REJECT

    def route(
        self,
        prompt_text: str,
        recent_context: str = "",
    ) -> list[RoutingDecision]:
        """Full routing: bloom gate → DSPy classify → decisions."""
        available = ",".join(self._tool_names)

        # DSPy classification (runs through Haiku for cost efficiency)
        try:
            result = self._dspy(
                prompt_text=prompt_text,
                available_tools=available,
                recent_context=recent_context or "session start",
            )
            predicted = [t.strip() for t in result.predicted_tools.split(",") if t.strip()]
            base_confidence = float(result.confidence)
            reasoning = result.reasoning
        except Exception:
            # DSPy unavailable — fall back to all tools
            predicted = list(self._tool_names)
            base_confidence = 0.5
            reasoning = "dspy_fallback"

        decisions: list[RoutingDecision] = []
        for tool_str in predicted:
            gate_result = self.gate(tool_str)
            # Adjust confidence based on gate
            if gate_result == GateResult.BLOOM_REJECT:
                confidence = Confidence(0.0)
            else:
                confidence = Confidence(base_confidence)

            decisions.append(
                RoutingDecision(
                    tool=ToolName(tool_str),
                    confidence=confidence,
                    gate=gate_result,
                    dspy_reasoning=reasoning,
                )
            )

        return decisions

    @property
    def metrics(self) -> dict:
        """Kimball-style additive metrics for this router."""
        return {
            "tool_count": len(self._tool_names),
            "bloom_bit_count": self._bloom.bit_count,
            "bloom_hash_count": self._bloom.hash_count,
            "bloom_estimated_fp_rate": self._bloom.estimated_fp_rate,
            "total_checks": self._stats["checks"],
            "bloom_passes": self._stats["bloom_pass"],
            "bloom_rejects": self._stats["bloom_reject"],
            "reject_rate": (
                self._stats["bloom_reject"] / max(self._stats["checks"], 1)
            ),
        }

    def save(self, path: Path) -> None:
        """Persist router state to JSON file."""
        data = {
            "bloom": self._bloom.to_json(),
            "tool_names": self._tool_names,
            "stats": self._stats,
        }
        path.write_text(json.dumps(data, indent=2))

    @classmethod
    def load(cls, path: Path) -> BloomToolRouter:
        """Load router state from JSON file."""
        data = json.loads(path.read_text())
        bloom = BloomFilter.from_json(data["bloom"])
        tools = [ToolName(t) for t in data["tool_names"]]
        router = cls(bloom, tools)
        router._stats = data.get("stats", router._stats)
        return router
