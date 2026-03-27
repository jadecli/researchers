"""Tests for the crawl campaign orchestrator."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from src.models.crawl_target import CrawlPlan, CrawlTarget, PageType
from src.models.extraction_result import ContextDelta, ExtractionResult, QualityScore
from src.orchestrator.campaign import CrawlCampaign
from src.orchestrator.context_injector import inject_context
from src.orchestrator.improvement_chain import ImprovementChain


class TestCrawlTarget:
    def test_create_target(self) -> None:
        target = CrawlTarget(url="https://example.com", spider_name="test", max_pages=10)
        assert target.url == "https://example.com"
        assert target.spider_name == "test"
        assert target.max_pages == 10
        assert target.priority == 0

    def test_effective_domains_from_url(self) -> None:
        target = CrawlTarget(url="https://docs.example.com/api")
        assert target.effective_domains() == ["docs.example.com"]

    def test_effective_domains_explicit(self) -> None:
        target = CrawlTarget(
            url="https://example.com",
            allowed_domains=["example.com", "docs.example.com"],
        )
        assert target.effective_domains() == ["example.com", "docs.example.com"]


class TestCrawlPlan:
    def test_create_plan(self) -> None:
        plan = CrawlPlan(
            targets=[
                CrawlTarget(url="https://a.com", max_pages=10, priority=5),
                CrawlTarget(url="https://b.com", max_pages=20, priority=1),
            ],
            total_budget_usd=10.0,
            max_iterations=5,
        )
        assert plan.total_max_pages == 30
        assert len(plan.sorted_targets()) == 2
        assert plan.sorted_targets()[0].url == "https://a.com"

    def test_quality_threshold(self) -> None:
        plan = CrawlPlan(quality_threshold=0.9)
        assert plan.quality_threshold == 0.9


class TestQualityScore:
    def test_compute(self) -> None:
        score = QualityScore.compute(
            completeness=0.8, structure=0.7, links=0.6
        )
        expected = 0.4 * 0.8 + 0.35 * 0.7 + 0.25 * 0.6
        assert abs(score.overall - expected) < 0.001

    def test_meets_threshold(self) -> None:
        score = QualityScore(completeness=0.9, structure=0.9, links=0.9, overall=0.9)
        assert score.meets_threshold(0.8)
        assert not score.meets_threshold(0.95)


class TestExtractionResult:
    def test_create_result(self) -> None:
        result = ExtractionResult(
            url="https://example.com",
            content="Hello world",
            links=["https://example.com/page1"],
        )
        assert result.content_length == 11
        assert result.link_count == 1
        assert not result.is_empty()

    def test_empty_result(self) -> None:
        result = ExtractionResult(url="https://example.com")
        assert result.is_empty()
        assert result.content_length == 0


class TestCrawlCampaign:
    def test_plan_campaign(self) -> None:
        plan = CrawlPlan(
            targets=[CrawlTarget(url="https://example.com", max_pages=50)],
            total_budget_usd=5.0,
            max_iterations=3,
        )
        campaign = CrawlCampaign(plan=plan)
        summary = campaign.plan_campaign()
        assert summary["target_count"] == 1
        assert summary["total_pages"] == 50
        assert summary["budget_usd"] == 5.0

    @patch("src.orchestrator.campaign.HeadlessRunner")
    @patch("src.orchestrator.campaign.ResearchPipeline")
    def test_execute_parses_json_output(
        self, mock_pipeline_cls: MagicMock, mock_runner_cls: MagicMock
    ) -> None:
        mock_runner = MagicMock()
        mock_runner.run.return_value = json.dumps({
            "url": "https://example.com",
            "title": "Example",
            "content": "Example content here",
            "links": ["https://example.com/page1"],
            "selectors_used": ["h1", "p"],
        })

        mock_pipeline = MagicMock()
        mock_pipeline.classify.return_value = (PageType.DOC, 0.95)
        mock_pipeline.score_quality.return_value = QualityScore.compute(0.8, 0.7, 0.6)

        plan = CrawlPlan(
            targets=[CrawlTarget(url="https://example.com")],
        )
        campaign = CrawlCampaign(plan=plan, pipeline=mock_pipeline, runner=mock_runner)
        results = campaign.execute()

        assert len(results) == 1
        assert results[0].url == "https://example.com"
        assert results[0].title == "Example"
        assert results[0].page_type == PageType.DOC

    @patch("src.orchestrator.campaign.HeadlessRunner")
    @patch("src.orchestrator.campaign.ResearchPipeline")
    def test_execute_handles_non_json(
        self, mock_pipeline_cls: MagicMock, mock_runner_cls: MagicMock
    ) -> None:
        mock_runner = MagicMock()
        mock_runner.run.return_value = "plain text output"

        mock_pipeline = MagicMock()
        mock_pipeline.classify.return_value = (PageType.DOC, 0.5)
        mock_pipeline.score_quality.return_value = QualityScore.compute(0.3, 0.2, 0.1)

        plan = CrawlPlan(
            targets=[CrawlTarget(url="https://example.com")],
        )
        campaign = CrawlCampaign(plan=plan, pipeline=mock_pipeline, runner=mock_runner)
        results = campaign.execute()

        assert len(results) == 1
        assert results[0].content == "plain text output"


class TestContextInjector:
    def test_initial_iteration(self) -> None:
        target = CrawlTarget(url="https://example.com", spider_name="test")
        context = inject_context(iteration=0, target=target)
        assert "iteration 0" in context
        assert "initial crawl" in context.lower()
        assert "https://example.com" in context

    def test_with_chain_history(self) -> None:
        chain = ImprovementChain()
        chain.add_iteration(ContextDelta(
            iteration=0,
            new_patterns=["div.content"],
            quality_before=0.4,
            quality_after=0.6,
        ))
        context = inject_context(iteration=1, chain=chain)
        assert "Quality Trajectory" in context
        assert "div.content" in context
