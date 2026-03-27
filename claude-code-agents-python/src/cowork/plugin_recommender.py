"""Recommend plugins based on task analysis and crawled knowledge."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from .task_router import DOMAINS, CoworkTaskRouter

logger = logging.getLogger(__name__)


@dataclass
class PluginRecommendation:
    """A single plugin recommendation with reasoning."""

    plugin_name: str
    domain: str
    relevance_score: float
    reason: str
    capabilities: list[str] = field(default_factory=list)


@dataclass
class RecommendationResult:
    """Full recommendation result for a task."""

    task: str
    recommendations: list[PluginRecommendation]
    primary_domain: str
    alternative_domains: list[str]


class PluginRecommender:
    """Recommends plugins for tasks based on domain routing and knowledge.

    Combines the CoworkTaskRouter's domain classification with a catalog
    of known plugin capabilities to produce ranked recommendations.

    Usage:
        recommender = PluginRecommender()
        result = recommender.recommend("Set up CI/CD pipeline for Python project")
        for rec in result.recommendations:
            print(f"{rec.plugin_name}: {rec.reason}")
    """

    # Extended plugin catalog with capabilities
    PLUGIN_CATALOG: dict[str, dict[str, Any]] = {
        "code-review": {
            "domain": "engineering",
            "capabilities": [
                "Automated code review",
                "Security vulnerability detection",
                "Style and convention checking",
                "Performance anti-pattern detection",
            ],
        },
        "architecture-advisor": {
            "domain": "engineering",
            "capabilities": [
                "System design review",
                "Microservice boundary analysis",
                "Database schema suggestions",
                "API design patterns",
            ],
        },
        "devops-helper": {
            "domain": "engineering",
            "capabilities": [
                "CI/CD pipeline setup",
                "Docker and Kubernetes configs",
                "Infrastructure as code",
                "Monitoring and alerting setup",
            ],
        },
        "data-analyst": {
            "domain": "data",
            "capabilities": [
                "Exploratory data analysis",
                "Statistical testing",
                "SQL query optimization",
                "Data cleaning pipelines",
            ],
        },
        "ml-pipeline": {
            "domain": "data",
            "capabilities": [
                "ML model training workflows",
                "Feature engineering",
                "Model evaluation and comparison",
                "Hyperparameter tuning",
            ],
        },
        "viz-generator": {
            "domain": "data",
            "capabilities": [
                "Chart and graph generation",
                "Dashboard layout design",
                "Interactive visualization code",
                "Data storytelling",
            ],
        },
        "content-writer": {
            "domain": "marketing",
            "capabilities": [
                "Blog post drafting",
                "Social media content",
                "Email campaigns",
                "Landing page copy",
            ],
        },
        "seo-optimizer": {
            "domain": "marketing",
            "capabilities": [
                "Keyword research",
                "Meta tag optimization",
                "Content structure for SEO",
                "Backlink analysis",
            ],
        },
        "contract-reviewer": {
            "domain": "legal",
            "capabilities": [
                "Contract clause analysis",
                "Risk identification",
                "Compliance checking",
                "Redline suggestions",
            ],
        },
        "prd-writer": {
            "domain": "product",
            "capabilities": [
                "Product requirements documents",
                "User story writing",
                "Acceptance criteria",
                "Feature prioritization",
            ],
        },
        "design-system": {
            "domain": "design",
            "capabilities": [
                "Component library design",
                "Design token generation",
                "Accessibility auditing",
                "Responsive layout patterns",
            ],
        },
        "ticket-resolver": {
            "domain": "support",
            "capabilities": [
                "Issue triage and categorization",
                "Solution suggestion",
                "Knowledge base lookup",
                "Escalation routing",
            ],
        },
        "budget-analyzer": {
            "domain": "finance",
            "capabilities": [
                "Budget variance analysis",
                "Expense categorization",
                "Financial forecasting",
                "Report generation",
            ],
        },
        "job-post-writer": {
            "domain": "hr",
            "capabilities": [
                "Job description writing",
                "Interview question generation",
                "Candidate screening criteria",
                "Compensation benchmarking",
            ],
        },
    }

    def __init__(self, router: CoworkTaskRouter | None = None) -> None:
        """Initialize with optional custom router."""
        self.router = router or CoworkTaskRouter()
        self.catalog = dict(self.PLUGIN_CATALOG)

    def recommend(
        self,
        task: str,
        max_recommendations: int = 5,
        min_relevance: float = 0.1,
    ) -> RecommendationResult:
        """Recommend plugins for a given task.

        Args:
            task: Natural language task description.
            max_recommendations: Maximum number of recommendations to return.
            min_relevance: Minimum relevance score to include.

        Returns:
            RecommendationResult with ranked plugin recommendations.
        """
        route_results = self.router.route_multi(task, top_k=3)
        primary = route_results[0] if route_results else None
        primary_domain = primary.domain if primary else "engineering"

        recommendations: list[PluginRecommendation] = []

        for plugin_name, plugin_info in self.catalog.items():
            plugin_domain = plugin_info["domain"]
            relevance = self._compute_relevance(
                task, plugin_name, plugin_info, route_results
            )

            if relevance >= min_relevance:
                reason = self._generate_reason(
                    task, plugin_name, plugin_info, plugin_domain, primary_domain
                )
                recommendations.append(
                    PluginRecommendation(
                        plugin_name=plugin_name,
                        domain=plugin_domain,
                        relevance_score=round(relevance, 3),
                        reason=reason,
                        capabilities=plugin_info.get("capabilities", []),
                    )
                )

        recommendations.sort(key=lambda r: r.relevance_score, reverse=True)
        recommendations = recommendations[:max_recommendations]

        alternative_domains = [
            r.domain for r in route_results[1:]
        ] if len(route_results) > 1 else []

        return RecommendationResult(
            task=task,
            recommendations=recommendations,
            primary_domain=primary_domain,
            alternative_domains=alternative_domains,
        )

    def _compute_relevance(
        self,
        task: str,
        plugin_name: str,
        plugin_info: dict[str, Any],
        route_results: list,
    ) -> float:
        """Compute relevance score for a plugin given the task."""
        score = 0.0
        plugin_domain = plugin_info["domain"]

        # Domain match scoring
        for i, route in enumerate(route_results):
            if route.domain == plugin_domain:
                score += (1.0 - i * 0.3) * route.confidence
                break

        # Capability keyword matching
        task_lower = task.lower()
        capabilities = plugin_info.get("capabilities", [])
        for capability in capabilities:
            cap_words = capability.lower().split()
            matches = sum(1 for word in cap_words if word in task_lower and len(word) > 3)
            if matches:
                score += matches * 0.15

        # Plugin name similarity
        name_words = plugin_name.replace("-", " ").split()
        for word in name_words:
            if word in task_lower and len(word) > 2:
                score += 0.2

        return min(1.0, score)

    def _generate_reason(
        self,
        task: str,
        plugin_name: str,
        plugin_info: dict[str, Any],
        plugin_domain: str,
        primary_domain: str,
    ) -> str:
        """Generate a human-readable recommendation reason."""
        capabilities = plugin_info.get("capabilities", [])
        cap_list = ", ".join(capabilities[:2]) if capabilities else "general assistance"

        if plugin_domain == primary_domain:
            return (
                f"Primary match in the '{plugin_domain}' domain. "
                f"Key capabilities: {cap_list}."
            )
        return (
            f"Cross-domain match from '{plugin_domain}'. "
            f"Relevant capabilities: {cap_list}."
        )

    def list_plugins(self, domain: str | None = None) -> list[dict[str, Any]]:
        """List all plugins, optionally filtered by domain.

        Args:
            domain: Filter to this domain, or None for all.

        Returns:
            List of plugin info dicts.
        """
        plugins = []
        for name, info in self.catalog.items():
            if domain and info["domain"] != domain:
                continue
            plugins.append({
                "name": name,
                "domain": info["domain"],
                "capabilities": info.get("capabilities", []),
            })
        return plugins
