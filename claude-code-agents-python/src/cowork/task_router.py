"""Route cowork tasks to appropriate knowledge-work-plugins domains."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


# Knowledge-work-plugins domain definitions
DOMAINS: dict[str, dict[str, Any]] = {
    "engineering": {
        "description": "Software engineering, code review, architecture",
        "keywords": [
            "code", "debug", "api", "deploy", "test", "refactor",
            "architecture", "microservice", "database", "git", "ci/cd",
            "docker", "kubernetes", "infrastructure", "monitoring",
        ],
        "plugins": ["code-review", "architecture-advisor", "devops-helper"],
    },
    "data": {
        "description": "Data analysis, ML/AI, analytics, pipelines",
        "keywords": [
            "data", "analytics", "machine learning", "ml", "ai",
            "pipeline", "etl", "sql", "visualization", "dashboard",
            "statistics", "model", "training", "dataset",
        ],
        "plugins": ["data-analyst", "ml-pipeline", "viz-generator"],
    },
    "sales": {
        "description": "Sales strategy, CRM, pipeline management",
        "keywords": [
            "sales", "crm", "pipeline", "lead", "prospect", "deal",
            "quota", "forecast", "revenue", "customer", "outreach",
        ],
        "plugins": ["crm-helper", "sales-forecaster", "outreach-writer"],
    },
    "marketing": {
        "description": "Content marketing, SEO, campaigns, brand",
        "keywords": [
            "marketing", "content", "seo", "campaign", "brand",
            "social media", "advertising", "copy", "engagement",
            "audience", "newsletter", "blog",
        ],
        "plugins": ["content-writer", "seo-optimizer", "campaign-planner"],
    },
    "legal": {
        "description": "Contract review, compliance, policy drafting",
        "keywords": [
            "legal", "contract", "compliance", "regulation", "policy",
            "terms", "privacy", "gdpr", "liability", "intellectual property",
            "nda", "agreement",
        ],
        "plugins": ["contract-reviewer", "compliance-checker", "policy-drafter"],
    },
    "product": {
        "description": "Product management, roadmaps, user research",
        "keywords": [
            "product", "roadmap", "feature", "user research", "prd",
            "spec", "requirements", "backlog", "sprint", "stakeholder",
            "user story", "epic",
        ],
        "plugins": ["prd-writer", "roadmap-planner", "user-research"],
    },
    "design": {
        "description": "UI/UX design, design systems, prototyping",
        "keywords": [
            "design", "ui", "ux", "prototype", "wireframe", "figma",
            "accessibility", "design system", "responsive", "layout",
            "typography", "color",
        ],
        "plugins": ["design-system", "a11y-checker", "prototype-helper"],
    },
    "support": {
        "description": "Customer support, documentation, knowledge bases",
        "keywords": [
            "support", "ticket", "help desk", "knowledge base", "faq",
            "troubleshoot", "escalation", "sla", "customer satisfaction",
            "documentation", "onboarding",
        ],
        "plugins": ["ticket-resolver", "kb-builder", "onboarding-guide"],
    },
    "finance": {
        "description": "Financial analysis, budgeting, reporting",
        "keywords": [
            "finance", "budget", "report", "accounting", "invoice",
            "expense", "revenue", "forecast", "audit", "tax",
            "financial model", "cash flow",
        ],
        "plugins": ["budget-analyzer", "report-generator", "expense-tracker"],
    },
    "hr": {
        "description": "Human resources, recruiting, employee management",
        "keywords": [
            "hr", "recruiting", "hiring", "employee", "performance",
            "onboarding", "benefits", "compensation", "culture",
            "training", "talent", "job description",
        ],
        "plugins": ["job-post-writer", "interview-prep", "performance-review"],
    },
}


@dataclass
class TaskRouteResult:
    """Result of routing a task to a domain."""

    domain: str
    confidence: float
    matched_keywords: list[str]
    suggested_plugins: list[str]
    all_scores: dict[str, float] = field(default_factory=dict)


class CoworkTaskRouter:
    """Routes tasks to knowledge-work-plugins domains.

    Analyzes task descriptions to determine the most appropriate domain
    and recommends relevant plugins.

    Usage:
        router = CoworkTaskRouter()
        result = router.route("Review this Python code for security issues")
        print(result.domain)  # "engineering"
    """

    def __init__(self, custom_domains: dict[str, dict[str, Any]] | None = None) -> None:
        """Initialize with optional custom domain definitions."""
        self.domains = {**DOMAINS, **(custom_domains or {})}

    def route(self, task_description: str) -> TaskRouteResult:
        """Route a task to the best matching domain.

        Args:
            task_description: Natural language description of the task.

        Returns:
            TaskRouteResult with the matched domain, confidence, and plugins.
        """
        scores: dict[str, tuple[float, list[str]]] = {}
        task_lower = task_description.lower()

        for domain_name, domain_config in self.domains.items():
            score, matched = self._score_domain(task_lower, domain_config)
            scores[domain_name] = (score, matched)

        if not scores:
            return TaskRouteResult(
                domain="engineering",
                confidence=0.0,
                matched_keywords=[],
                suggested_plugins=[],
            )

        best_domain = max(scores, key=lambda d: scores[d][0])
        best_score, best_matched = scores[best_domain]

        # Normalize confidence to 0-1 range
        max_possible = len(self.domains[best_domain].get("keywords", []))
        confidence = min(1.0, best_score / max(max_possible * 0.3, 1.0))

        suggested_plugins = self.domains[best_domain].get("plugins", [])

        return TaskRouteResult(
            domain=best_domain,
            confidence=round(confidence, 3),
            matched_keywords=best_matched,
            suggested_plugins=suggested_plugins,
            all_scores={d: round(s[0], 3) for d, s in scores.items()},
        )

    def route_multi(self, task_description: str, top_k: int = 3) -> list[TaskRouteResult]:
        """Route a task and return the top-k domain matches.

        Args:
            task_description: Natural language task description.
            top_k: Number of top domains to return.

        Returns:
            List of TaskRouteResult sorted by confidence descending.
        """
        task_lower = task_description.lower()
        results: list[TaskRouteResult] = []

        for domain_name, domain_config in self.domains.items():
            score, matched = self._score_domain(task_lower, domain_config)
            max_possible = len(domain_config.get("keywords", []))
            confidence = min(1.0, score / max(max_possible * 0.3, 1.0))
            results.append(
                TaskRouteResult(
                    domain=domain_name,
                    confidence=round(confidence, 3),
                    matched_keywords=matched,
                    suggested_plugins=domain_config.get("plugins", []),
                )
            )

        results.sort(key=lambda r: r.confidence, reverse=True)
        return results[:top_k]

    def _score_domain(
        self, task_lower: str, domain_config: dict[str, Any]
    ) -> tuple[float, list[str]]:
        """Score how well a task matches a domain.

        Returns:
            Tuple of (score, matched_keywords).
        """
        keywords = domain_config.get("keywords", [])
        matched: list[str] = []
        score = 0.0

        for keyword in keywords:
            if keyword in task_lower:
                matched.append(keyword)
                # Longer keyword matches are worth more
                score += 1.0 + len(keyword) * 0.1

        return score, matched

    def list_domains(self) -> list[dict[str, Any]]:
        """List all available domains with their descriptions."""
        return [
            {
                "name": name,
                "description": config.get("description", ""),
                "plugin_count": len(config.get("plugins", [])),
            }
            for name, config in self.domains.items()
        ]
