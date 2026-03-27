"""DSPy ChainOfThought wrapper modules for each pipeline signature."""

from __future__ import annotations

import dspy

from .signatures import (
    CodegenRouter,
    PageClassifier,
    PluginDesigner,
    QualityScorer,
    SelectorProposer,
)


class PageClassifierModule(dspy.Module):
    """ChainOfThought wrapper for page classification."""

    def __init__(self) -> None:
        super().__init__()
        self.classify = dspy.ChainOfThought(PageClassifier)

    def forward(
        self,
        url: str,
        title: str,
        content_snippet: str,
        html_snippet: str = "",
    ) -> dspy.Prediction:
        """Classify a page given its URL, title, and content."""
        return self.classify(
            url=url,
            title=title,
            content_snippet=content_snippet[:2000],
            html_snippet=html_snippet[:1000],
        )


class QualityScorerModule(dspy.Module):
    """ChainOfThought wrapper for extraction quality scoring."""

    def __init__(self) -> None:
        super().__init__()
        self.score = dspy.ChainOfThought(QualityScorer)

    def forward(
        self,
        url: str,
        extracted_content: str,
        structured_data: str = "{}",
        selectors_used: str = "",
        link_count: int = 0,
    ) -> dspy.Prediction:
        """Score extraction quality."""
        return self.score(
            url=url,
            extracted_content=extracted_content,
            structured_data=structured_data,
            selectors_used=selectors_used,
            link_count=link_count,
        )


class SelectorProposerModule(dspy.Module):
    """ChainOfThought wrapper for selector improvement proposals."""

    def __init__(self) -> None:
        super().__init__()
        self.propose = dspy.ChainOfThought(SelectorProposer)

    def forward(
        self,
        spider_name: str,
        current_selectors: str,
        failing_selectors: str,
        html_sample: str,
        page_type: str = "doc",
    ) -> dspy.Prediction:
        """Propose improved selectors."""
        return self.propose(
            spider_name=spider_name,
            current_selectors=current_selectors,
            failing_selectors=failing_selectors,
            html_sample=html_sample[:5000],
            page_type=page_type,
        )


class PluginDesignerModule(dspy.Module):
    """ChainOfThought wrapper for plugin design."""

    def __init__(self) -> None:
        super().__init__()
        self.design = dspy.ChainOfThought(PluginDesigner)

    def forward(
        self,
        domain: str,
        crawled_summaries: str,
        discovered_page_types: str = "",
        existing_plugins: str = "",
    ) -> dspy.Prediction:
        """Design a plugin from crawled knowledge."""
        return self.design(
            domain=domain,
            crawled_summaries=crawled_summaries,
            discovered_page_types=discovered_page_types,
            existing_plugins=existing_plugins,
        )


class CodegenRouterModule(dspy.Module):
    """ChainOfThought wrapper for code generation routing."""

    def __init__(self) -> None:
        super().__init__()
        self.route = dspy.ChainOfThought(CodegenRouter)

    def forward(
        self,
        task_description: str,
        target_environment: str = "cli",
        preferred_languages: str = "auto",
        constraints: str = "",
    ) -> dspy.Prediction:
        """Route a codegen task to appropriate languages."""
        return self.route(
            task_description=task_description,
            target_environment=target_environment,
            preferred_languages=preferred_languages,
            constraints=constraints,
        )
