"""Main research pipeline orchestrating all DSPy modules."""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

import dspy

from ..models.crawl_target import PageType
from ..models.extraction_result import ExtractionResult, QualityScore
from ..models.improvement import ImprovementSuggestion, SelectorPatch
from ..models.plugin_spec import AgentSpec, ConnectorSpec, PluginSpec, SkillSpec
from .modules import (
    CodegenRouterModule,
    PageClassifierModule,
    PluginDesignerModule,
    QualityScorerModule,
    SelectorProposerModule,
)

logger = logging.getLogger(__name__)


class ResearchPipeline:
    """Orchestrates DSPy modules for the full research-to-plugin pipeline.

    Usage:
        pipeline = ResearchPipeline(model="claude-sonnet-4-20250514")
        page_type = pipeline.classify(url, title, content)
        quality = pipeline.score_quality(result)
        patches = pipeline.propose_selectors(spider, selectors, html)
        plugin = pipeline.design_plugin(domain, summaries)
        route = pipeline.route_codegen(task_desc)
    """

    def __init__(self, model: str = "claude-sonnet-4-20250514") -> None:
        """Initialize the pipeline with a specific model."""
        self.model_name = model
        self._lm: Optional[dspy.LM] = None
        self.classifier = PageClassifierModule()
        self.scorer = QualityScorerModule()
        self.proposer = SelectorProposerModule()
        self.designer = PluginDesignerModule()
        self.router = CodegenRouterModule()

    def _ensure_lm(self) -> None:
        """Lazily initialize the language model."""
        if self._lm is None:
            self._lm = dspy.LM(model=f"anthropic/{self.model_name}")
            dspy.configure(lm=self._lm)

    def classify(
        self,
        url: str,
        title: str,
        content_snippet: str,
        html_snippet: str = "",
    ) -> tuple[PageType, float]:
        """Classify a page and return (page_type, confidence).

        Args:
            url: The page URL.
            title: The page title.
            content_snippet: First 2000 chars of page content.
            html_snippet: First 1000 chars of raw HTML.

        Returns:
            Tuple of (PageType, confidence_score).
        """
        self._ensure_lm()
        prediction = self.classifier(
            url=url,
            title=title,
            content_snippet=content_snippet,
            html_snippet=html_snippet,
        )
        try:
            page_type = PageType(prediction.page_type.strip().lower())
        except ValueError:
            logger.warning(
                "Unknown page type '%s' from classifier, defaulting to DOC",
                prediction.page_type,
            )
            page_type = PageType.DOC

        confidence = float(prediction.confidence)
        confidence = max(0.0, min(1.0, confidence))
        return page_type, confidence

    def score_quality(self, result: ExtractionResult) -> QualityScore:
        """Score the quality of an extraction result.

        Args:
            result: The extraction result to score.

        Returns:
            A QualityScore with completeness, structure, links, and overall.
        """
        self._ensure_lm()
        prediction = self.scorer(
            url=result.url,
            extracted_content=result.content[:3000],
            structured_data=json.dumps(result.structured_data)[:2000],
            selectors_used=", ".join(result.selectors_used),
            link_count=result.link_count,
        )
        completeness = max(0.0, min(1.0, float(prediction.completeness)))
        structure = max(0.0, min(1.0, float(prediction.structure)))
        links = max(0.0, min(1.0, float(prediction.links)))
        return QualityScore.compute(completeness, structure, links)

    def propose_selectors(
        self,
        spider_name: str,
        current_selectors: list[str],
        failing_selectors: list[str],
        html_sample: str,
        page_type: str = "doc",
    ) -> list[SelectorPatch]:
        """Propose new selectors to replace failing ones.

        Args:
            spider_name: The spider to patch.
            current_selectors: Current selectors in use.
            failing_selectors: Selectors known to be failing.
            html_sample: A sample of HTML from the target page.
            page_type: The classified page type.

        Returns:
            List of SelectorPatch objects.
        """
        self._ensure_lm()
        prediction = self.proposer(
            spider_name=spider_name,
            current_selectors="\n".join(current_selectors),
            failing_selectors="\n".join(failing_selectors),
            html_sample=html_sample,
            page_type=page_type,
        )
        patches: list[SelectorPatch] = []
        for line in prediction.proposed_selectors.strip().split("\n"):
            line = line.strip()
            if " -> " in line:
                old, new = line.split(" -> ", 1)
                patches.append(
                    SelectorPatch(
                        spider=spider_name,
                        old_selector=old.strip(),
                        new_selector=new.strip(),
                        rationale=prediction.rationale,
                    )
                )
        return patches

    def design_plugin(
        self,
        domain: str,
        crawled_summaries: list[str],
        discovered_page_types: list[str] | None = None,
        existing_plugins: list[str] | None = None,
    ) -> PluginSpec:
        """Design a plugin specification from crawled knowledge.

        Args:
            domain: Target domain (engineering, data, legal, etc.).
            crawled_summaries: Summaries of crawled content.
            discovered_page_types: Page types found during crawling.
            existing_plugins: Names of existing plugins to avoid overlap.

        Returns:
            A PluginSpec ready for scaffold generation.
        """
        self._ensure_lm()
        prediction = self.designer(
            domain=domain,
            crawled_summaries="; ".join(crawled_summaries),
            discovered_page_types=", ".join(discovered_page_types or []),
            existing_plugins=", ".join(existing_plugins or []),
        )
        skills: list[SkillSpec] = []
        try:
            for s in json.loads(prediction.skills_json):
                skills.append(
                    SkillSpec(name=s["name"], description=s.get("description", ""))
                )
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning("Failed to parse skills JSON: %s", e)

        agents: list[AgentSpec] = []
        try:
            for a in json.loads(prediction.agents_json):
                agents.append(
                    AgentSpec(
                        name=a["name"],
                        description=a.get("description", ""),
                        tools=a.get("tools", []),
                    )
                )
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning("Failed to parse agents JSON: %s", e)

        connectors: list[ConnectorSpec] = []
        try:
            for c in json.loads(prediction.connectors_json):
                connectors.append(
                    ConnectorSpec(
                        name=c["name"],
                        type=c.get("type", "stdio"),
                        server_config=c.get("config", {}),
                    )
                )
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning("Failed to parse connectors JSON: %s", e)

        return PluginSpec(
            name=prediction.plugin_name.strip(),
            description=prediction.plugin_description.strip(),
            skills=skills,
            agents=agents,
            connectors=connectors,
        )

    def route_codegen(
        self,
        task_description: str,
        target_environment: str = "cli",
        preferred_languages: list[str] | None = None,
        constraints: str = "",
    ) -> dict[str, Any]:
        """Route a codegen task to the appropriate language and scaffold type.

        Args:
            task_description: What the generated code should do.
            target_environment: Target environment (web, cli, serverless, library).
            preferred_languages: Preferred languages or None for auto.
            constraints: Any constraints on technology choices.

        Returns:
            Dict with primary_language, secondary_languages, framework, scaffold_type.
        """
        self._ensure_lm()
        langs = ", ".join(preferred_languages) if preferred_languages else "auto"
        prediction = self.router(
            task_description=task_description,
            target_environment=target_environment,
            preferred_languages=langs,
            constraints=constraints,
        )
        secondary = []
        if prediction.secondary_languages.strip().lower() != "none":
            secondary = [
                lang.strip()
                for lang in prediction.secondary_languages.split(",")
                if lang.strip()
            ]
        return {
            "primary_language": prediction.primary_language.strip().lower(),
            "secondary_languages": secondary,
            "framework": prediction.framework.strip(),
            "scaffold_type": prediction.scaffold_type.strip(),
            "rationale": prediction.rationale.strip(),
        }
