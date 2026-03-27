"""Tests for cowork task routing and plugin recommendation."""

from __future__ import annotations

import pytest

from src.cowork.knowledge_synthesizer import KnowledgeSynthesizer
from src.cowork.plugin_recommender import PluginRecommender
from src.cowork.task_router import CoworkTaskRouter
from src.models.crawl_target import PageType
from src.models.extraction_result import ExtractionResult, QualityScore


class TestCoworkTaskRouter:
    def test_route_engineering(self) -> None:
        router = CoworkTaskRouter()
        result = router.route("Review this Python code for security vulnerabilities")
        assert result.domain == "engineering"
        assert result.confidence > 0
        assert "code" in result.matched_keywords

    def test_route_data(self) -> None:
        router = CoworkTaskRouter()
        result = router.route("Analyze the dataset and build a machine learning model")
        assert result.domain == "data"
        assert any(kw in result.matched_keywords for kw in ["data", "machine learning"])

    def test_route_marketing(self) -> None:
        router = CoworkTaskRouter()
        result = router.route("Write a blog post about our new product launch")
        assert result.domain == "marketing"

    def test_route_legal(self) -> None:
        router = CoworkTaskRouter()
        result = router.route("Review this NDA contract for compliance issues")
        assert result.domain == "legal"

    def test_route_multi(self) -> None:
        router = CoworkTaskRouter()
        results = router.route_multi("Deploy the API and monitor performance", top_k=3)
        assert len(results) == 3
        assert results[0].confidence >= results[1].confidence

    def test_list_domains(self) -> None:
        router = CoworkTaskRouter()
        domains = router.list_domains()
        assert len(domains) == 10
        names = [d["name"] for d in domains]
        assert "engineering" in names
        assert "legal" in names

    def test_custom_domain(self) -> None:
        router = CoworkTaskRouter(
            custom_domains={
                "research": {
                    "description": "Academic research",
                    "keywords": ["research", "paper", "citation", "thesis"],
                    "plugins": ["paper-reviewer"],
                }
            }
        )
        result = router.route("Review this research paper and check citations")
        assert result.domain == "research"


class TestPluginRecommender:
    def test_recommend_engineering(self) -> None:
        recommender = PluginRecommender()
        result = recommender.recommend("Set up CI/CD pipeline for deployment")
        assert len(result.recommendations) > 0
        assert result.primary_domain == "engineering"
        plugin_names = [r.plugin_name for r in result.recommendations]
        assert "devops-helper" in plugin_names

    def test_recommend_data(self) -> None:
        recommender = PluginRecommender()
        result = recommender.recommend("Analyze sales data and create visualizations")
        assert result.primary_domain == "data"

    def test_recommend_max_results(self) -> None:
        recommender = PluginRecommender()
        result = recommender.recommend("Do something", max_recommendations=2)
        assert len(result.recommendations) <= 2

    def test_list_plugins_by_domain(self) -> None:
        recommender = PluginRecommender()
        eng_plugins = recommender.list_plugins(domain="engineering")
        assert len(eng_plugins) > 0
        for p in eng_plugins:
            assert p["domain"] == "engineering"

    def test_list_all_plugins(self) -> None:
        recommender = PluginRecommender()
        all_plugins = recommender.list_plugins()
        assert len(all_plugins) > 10


class TestKnowledgeSynthesizer:
    def _make_result(
        self, url: str, quality: float, page_type: PageType = PageType.DOC, content: str = "Test"
    ) -> ExtractionResult:
        return ExtractionResult(
            url=url,
            page_type=page_type,
            content=content,
            quality=QualityScore(
                completeness=quality,
                structure=quality,
                links=quality,
                overall=quality,
            ),
            selectors_used=["h1", "p.content"],
        )

    def test_synthesize(self) -> None:
        synth = KnowledgeSynthesizer()
        results = [
            self._make_result("https://a.com", 0.9, PageType.DOC),
            self._make_result("https://b.com", 0.5, PageType.API),
            self._make_result("https://c.com", 0.1, PageType.NEWS),
        ]
        summary = synth.synthesize(results)
        assert "by_type" in summary
        assert "statistics" in summary
        assert summary["statistics"]["total"] == 3
        # c.com should be excluded (quality 0.1 < 0.3 threshold)
        assert summary["statistics"]["included"] == 2

    def test_summarize_for_plugin_design(self) -> None:
        synth = KnowledgeSynthesizer()
        results = [
            self._make_result("https://a.com", 0.9, PageType.DOC, "Important documentation"),
            self._make_result("https://b.com", 0.1, PageType.NEWS, "Low quality"),
        ]
        summaries = synth.summarize_for_plugin_design(results)
        assert len(summaries) == 1  # Only high-quality result included
        assert "doc" in summaries[0].lower()

    def test_extract_api_endpoints(self) -> None:
        synth = KnowledgeSynthesizer()
        api_result = ExtractionResult(
            url="https://api.example.com",
            page_type=PageType.API,
            content="API docs",
            structured_data={
                "paths": {
                    "/users": {
                        "get": {"summary": "List users"},
                        "post": {"summary": "Create user"},
                    }
                }
            },
            quality=QualityScore(overall=0.8, completeness=0.8, structure=0.8, links=0.8),
        )
        endpoints = synth.extract_api_endpoints([api_result])
        assert len(endpoints) == 2
        methods = {ep["method"] for ep in endpoints}
        assert "GET" in methods
        assert "POST" in methods

    def test_quality_tiers(self) -> None:
        synth = KnowledgeSynthesizer(min_quality=0.0)
        results = [
            self._make_result("https://high.com", 0.9),
            self._make_result("https://med.com", 0.6),
            self._make_result("https://low.com", 0.2),
        ]
        summary = synth.synthesize(results)
        tiers = summary["by_quality_tier"]
        assert "https://high.com" in tiers["high"]
        assert "https://med.com" in tiers["medium"]
        assert "https://low.com" in tiers["low"]
