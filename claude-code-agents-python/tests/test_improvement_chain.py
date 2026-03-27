"""Tests for the ImprovementChain."""

from __future__ import annotations

import pytest

from src.models.extraction_result import ContextDelta
from src.models.improvement import ImprovementSuggestion, SelectorPatch
from src.orchestrator.improvement_chain import ImprovementChain


class TestImprovementChain:
    def test_empty_chain(self) -> None:
        chain = ImprovementChain()
        assert chain.iteration_count == 0
        assert chain.total_improvement == 0.0
        assert chain.should_continue()
        assert chain.get_cumulative_delta() is None

    def test_add_iteration(self) -> None:
        chain = ImprovementChain()
        delta = ContextDelta(
            iteration=0,
            new_patterns=["div.content"],
            quality_before=0.4,
            quality_after=0.6,
        )
        chain.add_iteration(delta)
        assert chain.iteration_count == 1
        assert chain.total_improvement == pytest.approx(0.2, abs=0.001)

    def test_cumulative_delta(self) -> None:
        chain = ImprovementChain()
        chain.add_iteration(ContextDelta(
            iteration=0,
            new_patterns=["p.text"],
            quality_before=0.3,
            quality_after=0.5,
            discovered_page_types=["doc"],
        ))
        chain.add_iteration(ContextDelta(
            iteration=1,
            new_patterns=["h1.title"],
            quality_before=0.5,
            quality_after=0.7,
            discovered_page_types=["api"],
        ))
        cumulative = chain.get_cumulative_delta()
        assert cumulative is not None
        assert cumulative.iteration == 2
        assert cumulative.quality_before == 0.3
        assert cumulative.quality_after == 0.7
        assert "p.text" in cumulative.new_patterns
        assert "h1.title" in cumulative.new_patterns
        assert "doc" in cumulative.discovered_page_types
        assert "api" in cumulative.discovered_page_types

    def test_should_continue_on_improvement(self) -> None:
        chain = ImprovementChain(max_stagnant=2)
        chain.add_iteration(ContextDelta(
            iteration=0, quality_before=0.3, quality_after=0.5,
        ))
        assert chain.should_continue()

    def test_should_stop_on_stagnation(self) -> None:
        chain = ImprovementChain(max_stagnant=2)
        chain.add_iteration(ContextDelta(
            iteration=0, quality_before=0.5, quality_after=0.5,
        ))
        chain.add_iteration(ContextDelta(
            iteration=1, quality_before=0.5, quality_after=0.5,
        ))
        assert not chain.should_continue()

    def test_should_stop_on_regression(self) -> None:
        chain = ImprovementChain(regression_tolerance=1)
        chain.add_iteration(ContextDelta(
            iteration=0, quality_before=0.6, quality_after=0.5,
        ))
        assert not chain.should_continue()

    def test_should_continue_after_one_regression_with_tolerance_2(self) -> None:
        chain = ImprovementChain(regression_tolerance=2)
        chain.add_iteration(ContextDelta(
            iteration=0, quality_before=0.6, quality_after=0.5,
        ))
        assert chain.should_continue()

    def test_get_history(self) -> None:
        chain = ImprovementChain()
        d1 = ContextDelta(iteration=0, quality_before=0.3, quality_after=0.5)
        d2 = ContextDelta(iteration=1, quality_before=0.5, quality_after=0.7)
        chain.add_iteration(d1)
        chain.add_iteration(d2)
        history = chain.get_history()
        assert len(history) == 2
        assert history[0].iteration == 0
        assert history[1].iteration == 1

    def test_all_discovered_patterns(self) -> None:
        chain = ImprovementChain()
        chain.add_iteration(ContextDelta(
            iteration=0, new_patterns=["a", "b"], quality_before=0.3, quality_after=0.5,
        ))
        chain.add_iteration(ContextDelta(
            iteration=1, new_patterns=["b", "c"], quality_before=0.5, quality_after=0.7,
        ))
        patterns = chain.all_discovered_patterns
        assert patterns == ["a", "b", "c"]


class TestContextDelta:
    def test_quality_improvement(self) -> None:
        delta = ContextDelta(
            iteration=0, quality_before=0.4, quality_after=0.7,
        )
        assert delta.quality_improvement == pytest.approx(0.3, abs=0.001)

    def test_is_regression(self) -> None:
        delta = ContextDelta(
            iteration=0, quality_before=0.7, quality_after=0.5,
        )
        assert delta.is_regression

    def test_is_stagnant(self) -> None:
        delta = ContextDelta(
            iteration=0, quality_before=0.5, quality_after=0.5,
        )
        assert delta.is_stagnant

    def test_not_stagnant(self) -> None:
        delta = ContextDelta(
            iteration=0, quality_before=0.5, quality_after=0.6,
        )
        assert not delta.is_stagnant


class TestImprovementSuggestion:
    def test_high_confidence(self) -> None:
        suggestion = ImprovementSuggestion(
            spider="test",
            selector="div.old",
            issue="Too generic",
            proposed_fix="div.content",
            confidence=0.9,
        )
        assert suggestion.is_high_confidence

    def test_to_patch(self) -> None:
        suggestion = ImprovementSuggestion(
            spider="test",
            selector="div.old",
            issue="Not specific enough",
            proposed_fix="div.content",
        )
        patch = suggestion.to_patch()
        assert patch.spider == "test"
        assert patch.old_selector == "div.old"
        assert patch.new_selector == "div.content"
        assert patch.rationale == "Not specific enough"


class TestSelectorPatch:
    def test_apply_to_source(self) -> None:
        patch = SelectorPatch(
            spider="test",
            old_selector="div.old",
            new_selector="div.new",
        )
        source = 'response.css("div.old")'
        result = patch.apply_to_source(source)
        assert result == 'response.css("div.new")'

    def test_apply_to_source_missing(self) -> None:
        patch = SelectorPatch(
            spider="test",
            old_selector="div.nonexistent",
            new_selector="div.new",
        )
        with pytest.raises(ValueError, match="not found"):
            patch.apply_to_source('response.css("div.other")')

    def test_as_diff_line(self) -> None:
        patch = SelectorPatch(
            spider="test",
            old_selector="div.old",
            new_selector="div.new",
        )
        diff = patch.as_diff_line()
        assert "- div.old" in diff
        assert "+ div.new" in diff
