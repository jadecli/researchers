"""ImprovementChain tracks quality deltas across campaign iterations."""

from __future__ import annotations

import logging
from typing import Optional

from ..models.extraction_result import ContextDelta

logger = logging.getLogger(__name__)


class ImprovementChain:
    """Accumulates ContextDelta objects across iterations and determines convergence.

    Tracks the history of improvements, computes cumulative quality changes,
    and advises whether to continue iterating based on diminishing returns
    or regression detection.

    Usage:
        chain = ImprovementChain(max_stagnant=2)
        chain.add_iteration(delta)
        if chain.should_continue():
            ...
    """

    def __init__(
        self,
        max_stagnant: int = 2,
        regression_tolerance: int = 1,
        min_improvement: float = 0.01,
    ) -> None:
        """Initialize the improvement chain.

        Args:
            max_stagnant: Max consecutive stagnant iterations before stopping.
            regression_tolerance: Max consecutive regressions before stopping.
            min_improvement: Minimum quality improvement to count as non-stagnant.
        """
        self._history: list[ContextDelta] = []
        self.max_stagnant = max_stagnant
        self.regression_tolerance = regression_tolerance
        self.min_improvement = min_improvement

    def add_iteration(self, delta: ContextDelta) -> None:
        """Add a new iteration delta to the chain.

        Args:
            delta: The context delta from the latest iteration.
        """
        self._history.append(delta)
        logger.info(
            "Iteration %d: quality %.3f -> %.3f (improvement: %+.3f)",
            delta.iteration,
            delta.quality_before,
            delta.quality_after,
            delta.quality_improvement,
        )

    def get_cumulative_delta(self) -> Optional[ContextDelta]:
        """Compute a cumulative delta summarizing all iterations.

        Returns:
            A ContextDelta summarizing the full chain, or None if empty.
        """
        if not self._history:
            return None

        all_patterns: list[str] = []
        all_failing: list[str] = []
        all_page_types: list[str] = []

        for delta in self._history:
            all_patterns.extend(delta.new_patterns)
            all_failing.extend(delta.failing_selectors)
            all_page_types.extend(delta.discovered_page_types)

        return ContextDelta(
            iteration=len(self._history),
            new_patterns=list(set(all_patterns)),
            failing_selectors=list(set(all_failing)),
            quality_before=self._history[0].quality_before,
            quality_after=self._history[-1].quality_after,
            steer_direction=self._history[-1].steer_direction,
            discovered_page_types=list(set(all_page_types)),
        )

    def should_continue(self) -> bool:
        """Determine whether the campaign should continue iterating.

        Returns False if:
        - Consecutive stagnant iterations exceed max_stagnant.
        - Consecutive regressions exceed regression_tolerance.

        Returns:
            True if the campaign should continue, False otherwise.
        """
        if not self._history:
            return True

        consecutive_stagnant = 0
        consecutive_regressions = 0

        for delta in reversed(self._history):
            improvement = delta.quality_after - delta.quality_before
            if improvement < self.min_improvement:
                consecutive_stagnant += 1
            else:
                break

        for delta in reversed(self._history):
            if delta.is_regression:
                consecutive_regressions += 1
            else:
                break

        if consecutive_stagnant >= self.max_stagnant:
            logger.info(
                "Stopping: %d consecutive stagnant iterations (max %d)",
                consecutive_stagnant,
                self.max_stagnant,
            )
            return False

        if consecutive_regressions >= self.regression_tolerance:
            logger.info(
                "Stopping: %d consecutive regressions (tolerance %d)",
                consecutive_regressions,
                self.regression_tolerance,
            )
            return False

        return True

    def get_history(self) -> list[ContextDelta]:
        """Return the full history of iteration deltas.

        Returns:
            List of ContextDelta objects in iteration order.
        """
        return list(self._history)

    @property
    def iteration_count(self) -> int:
        """Number of iterations recorded."""
        return len(self._history)

    @property
    def total_improvement(self) -> float:
        """Total quality improvement from first to last iteration."""
        if not self._history:
            return 0.0
        return self._history[-1].quality_after - self._history[0].quality_before

    @property
    def all_discovered_patterns(self) -> list[str]:
        """All unique patterns discovered across iterations."""
        patterns: set[str] = set()
        for delta in self._history:
            patterns.update(delta.new_patterns)
        return sorted(patterns)
