"""Tests for the DSPy pipeline (signature and module structure)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from src.dspy_pipeline.modules import (
    CodegenRouterModule,
    PageClassifierModule,
    PluginDesignerModule,
    QualityScorerModule,
    SelectorProposerModule,
)
from src.dspy_pipeline.signatures import (
    CodegenRouter,
    PageClassifier,
    PluginDesigner,
    QualityScorer,
    SelectorProposer,
)


class TestSignatures:
    """Test that signatures are properly defined with correct fields."""

    def test_page_classifier_fields(self) -> None:
        sig = PageClassifier
        # Check input fields exist
        assert hasattr(sig, "url")
        assert hasattr(sig, "title")
        assert hasattr(sig, "content_snippet")
        assert hasattr(sig, "html_snippet")
        # Check output fields
        assert hasattr(sig, "page_type")
        assert hasattr(sig, "confidence")
        assert hasattr(sig, "reasoning")

    def test_quality_scorer_fields(self) -> None:
        sig = QualityScorer
        assert hasattr(sig, "url")
        assert hasattr(sig, "extracted_content")
        assert hasattr(sig, "completeness")
        assert hasattr(sig, "structure")
        assert hasattr(sig, "links")
        assert hasattr(sig, "issues")

    def test_selector_proposer_fields(self) -> None:
        sig = SelectorProposer
        assert hasattr(sig, "spider_name")
        assert hasattr(sig, "current_selectors")
        assert hasattr(sig, "proposed_selectors")
        assert hasattr(sig, "rationale")

    def test_plugin_designer_fields(self) -> None:
        sig = PluginDesigner
        assert hasattr(sig, "domain")
        assert hasattr(sig, "crawled_summaries")
        assert hasattr(sig, "plugin_name")
        assert hasattr(sig, "skills_json")
        assert hasattr(sig, "agents_json")

    def test_codegen_router_fields(self) -> None:
        sig = CodegenRouter
        assert hasattr(sig, "task_description")
        assert hasattr(sig, "primary_language")
        assert hasattr(sig, "scaffold_type")


class TestModules:
    """Test that modules are properly initialized."""

    def test_page_classifier_module_init(self) -> None:
        module = PageClassifierModule()
        assert hasattr(module, "classify")

    def test_quality_scorer_module_init(self) -> None:
        module = QualityScorerModule()
        assert hasattr(module, "score")

    def test_selector_proposer_module_init(self) -> None:
        module = SelectorProposerModule()
        assert hasattr(module, "propose")

    def test_plugin_designer_module_init(self) -> None:
        module = PluginDesignerModule()
        assert hasattr(module, "design")

    def test_codegen_router_module_init(self) -> None:
        module = CodegenRouterModule()
        assert hasattr(module, "route")


class TestPipeline:
    """Test the ResearchPipeline with mocked LM."""

    @patch("src.dspy_pipeline.pipeline.dspy")
    def test_classify_returns_page_type(self, mock_dspy: MagicMock) -> None:
        from src.dspy_pipeline.pipeline import ResearchPipeline

        pipeline = ResearchPipeline()
        pipeline._lm = MagicMock()

        # Mock the classifier module
        mock_prediction = MagicMock()
        mock_prediction.page_type = "doc"
        mock_prediction.confidence = 0.95
        pipeline.classifier = MagicMock(return_value=mock_prediction)

        page_type, confidence = pipeline.classify(
            url="https://example.com",
            title="Test Page",
            content_snippet="This is documentation.",
        )
        from src.models.crawl_target import PageType
        assert page_type == PageType.DOC
        assert confidence == 0.95

    @patch("src.dspy_pipeline.pipeline.dspy")
    def test_classify_unknown_type_defaults_to_doc(self, mock_dspy: MagicMock) -> None:
        from src.dspy_pipeline.pipeline import ResearchPipeline

        pipeline = ResearchPipeline()
        pipeline._lm = MagicMock()

        mock_prediction = MagicMock()
        mock_prediction.page_type = "unknown_type"
        mock_prediction.confidence = 0.3
        pipeline.classifier = MagicMock(return_value=mock_prediction)

        page_type, confidence = pipeline.classify(
            url="https://example.com",
            title="Test",
            content_snippet="Content",
        )
        from src.models.crawl_target import PageType
        assert page_type == PageType.DOC

    @patch("src.dspy_pipeline.pipeline.dspy")
    def test_propose_selectors_parses_output(self, mock_dspy: MagicMock) -> None:
        from src.dspy_pipeline.pipeline import ResearchPipeline

        pipeline = ResearchPipeline()
        pipeline._lm = MagicMock()

        mock_prediction = MagicMock()
        mock_prediction.proposed_selectors = "div.old -> div.new\nspan.x -> span.y"
        mock_prediction.rationale = "Better specificity"
        mock_prediction.expected_improvement = 0.3
        pipeline.proposer = MagicMock(return_value=mock_prediction)

        patches = pipeline.propose_selectors(
            spider_name="test",
            current_selectors=["div.old", "span.x"],
            failing_selectors=["div.old"],
            html_sample="<div class='new'>content</div>",
        )
        assert len(patches) == 2
        assert patches[0].old_selector == "div.old"
        assert patches[0].new_selector == "div.new"
        assert patches[1].old_selector == "span.x"
        assert patches[1].new_selector == "span.y"
