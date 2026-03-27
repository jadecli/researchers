"""Crawl campaign orchestrator driving iterative crawl-improve loops."""

from __future__ import annotations

import logging
from typing import Any, Optional

from ..dspy_pipeline.pipeline import ResearchPipeline
from ..models.crawl_target import CrawlPlan, CrawlTarget
from ..models.extraction_result import ContextDelta, ExtractionResult, QualityScore
from ..models.improvement import SelectorPatch
from .context_injector import inject_context
from .headless_runner import HeadlessRunner
from .improvement_chain import ImprovementChain

logger = logging.getLogger(__name__)


class CrawlCampaign:
    """Orchestrates a full crawl campaign with iterative improvement.

    A campaign consists of:
    1. Planning: Determine targets, budget, and iteration count.
    2. Execution: Run crawls via HeadlessRunner.
    3. Improvement: Score quality, propose selector patches, re-crawl.
    4. Run: Full loop combining plan, execute, and improve.

    Usage:
        campaign = CrawlCampaign(
            plan=CrawlPlan(targets=[CrawlTarget(url="https://docs.example.com")]),
            pipeline=ResearchPipeline(),
        )
        results = campaign.run()
    """

    def __init__(
        self,
        plan: CrawlPlan,
        pipeline: Optional[ResearchPipeline] = None,
        runner: Optional[HeadlessRunner] = None,
    ) -> None:
        """Initialize campaign with a plan and optional pipeline/runner."""
        self.plan = plan
        self.pipeline = pipeline or ResearchPipeline()
        self.runner = runner or HeadlessRunner()
        self.chain = ImprovementChain()
        self.results: list[ExtractionResult] = []
        self._current_iteration = 0

    def plan_campaign(self) -> dict[str, Any]:
        """Produce a structured plan summary for the campaign.

        Returns:
            Dict with target_count, total_pages, budget, iterations, and sorted targets.
        """
        sorted_targets = self.plan.sorted_targets()
        return {
            "target_count": len(sorted_targets),
            "total_pages": self.plan.total_max_pages,
            "budget_usd": self.plan.total_budget_usd,
            "max_iterations": self.plan.max_iterations,
            "quality_threshold": self.plan.quality_threshold,
            "targets": [
                {
                    "url": t.url,
                    "spider": t.spider_name,
                    "max_pages": t.max_pages,
                    "priority": t.priority,
                }
                for t in sorted_targets
            ],
        }

    def execute(self, targets: list[CrawlTarget] | None = None) -> list[ExtractionResult]:
        """Execute crawls for the given targets (or all plan targets).

        Args:
            targets: Specific targets to crawl, or None for all plan targets.

        Returns:
            List of extraction results.
        """
        targets = targets or self.plan.sorted_targets()
        iteration_results: list[ExtractionResult] = []

        for target in targets:
            logger.info(
                "Crawling %s with spider '%s' (max %d pages)",
                target.url,
                target.spider_name,
                target.max_pages,
            )
            context_fragment = inject_context(
                iteration=self._current_iteration,
                chain=self.chain,
                target=target,
            )
            prompt = self._build_crawl_prompt(target, context_fragment)
            raw_output = self.runner.run(prompt)
            result = self._parse_crawl_output(target, raw_output)

            page_type, confidence = self.pipeline.classify(
                url=result.url,
                title=result.title or "",
                content_snippet=result.content[:2000],
                html_snippet=result.raw_html_snippet or "",
            )
            result.page_type = page_type

            quality = self.pipeline.score_quality(result)
            result.quality = quality

            iteration_results.append(result)

        self.results.extend(iteration_results)
        return iteration_results

    def improve(self, results: list[ExtractionResult]) -> list[SelectorPatch]:
        """Analyze results and propose improvements.

        Args:
            results: Extraction results from the latest crawl iteration.

        Returns:
            List of selector patches to apply before re-crawling.
        """
        quality_before = self._average_quality(results)
        all_patches: list[SelectorPatch] = []
        failing_selectors: list[str] = []
        new_patterns: list[str] = []
        discovered_types: list[str] = []

        for result in results:
            if result.quality.overall < self.plan.quality_threshold:
                failing = [
                    s for s in result.selectors_used
                    if result.quality.completeness < 0.5
                ]
                failing_selectors.extend(failing)

                patches = self.pipeline.propose_selectors(
                    spider_name=result.spider_name,
                    current_selectors=result.selectors_used,
                    failing_selectors=failing,
                    html_sample=result.raw_html_snippet or "",
                    page_type=result.page_type.value,
                )
                all_patches.extend(patches)
                new_patterns.extend(p.new_selector for p in patches)

            discovered_types.append(result.page_type.value)

        delta = ContextDelta(
            iteration=self._current_iteration,
            new_patterns=new_patterns,
            failing_selectors=failing_selectors,
            quality_before=quality_before,
            quality_after=quality_before,
            steer_direction=self._compute_steer_direction(all_patches),
            discovered_page_types=list(set(discovered_types)),
        )
        self.chain.add_iteration(delta)
        self._current_iteration += 1

        return all_patches

    def run(self) -> list[ExtractionResult]:
        """Execute the full campaign loop: execute -> improve -> re-execute.

        Returns:
            All extraction results across all iterations.
        """
        logger.info("Starting campaign with %d targets", len(self.plan.targets))
        plan_summary = self.plan_campaign()
        logger.info("Plan: %s", plan_summary)

        results = self.execute()

        for iteration in range(1, self.plan.max_iterations):
            avg_quality = self._average_quality(results)
            logger.info(
                "Iteration %d: average quality %.3f (threshold: %.3f)",
                iteration,
                avg_quality,
                self.plan.quality_threshold,
            )

            if avg_quality >= self.plan.quality_threshold:
                logger.info("Quality threshold met, stopping iterations")
                break

            if not self.chain.should_continue():
                logger.info("Improvement chain suggests stopping")
                break

            patches = self.improve(results)
            if not patches:
                logger.info("No patches proposed, stopping iterations")
                break

            logger.info("Applying %d patches and re-crawling", len(patches))
            results = self.execute()

        logger.info(
            "Campaign complete: %d total results across %d iterations",
            len(self.results),
            self._current_iteration + 1,
        )
        return self.results

    def _build_crawl_prompt(self, target: CrawlTarget, context: str) -> str:
        """Build the prompt for HeadlessRunner."""
        return (
            f"Crawl the website at {target.url} using the '{target.spider_name}' spider.\n"
            f"Extract up to {target.max_pages} pages.\n"
            f"Focus on domains: {', '.join(target.effective_domains())}\n\n"
            f"{context}\n\n"
            f"Return structured JSON with fields: url, title, content, links, selectors_used, "
            f"raw_html_snippet (first 2000 chars)."
        )

    def _parse_crawl_output(self, target: CrawlTarget, raw_output: str) -> ExtractionResult:
        """Parse HeadlessRunner output into an ExtractionResult."""
        import json

        try:
            data = json.loads(raw_output)
            return ExtractionResult(
                url=data.get("url", target.url),
                spider_name=target.spider_name,
                title=data.get("title"),
                content=data.get("content", ""),
                structured_data=data.get("structured_data", {}),
                links=data.get("links", []),
                selectors_used=data.get("selectors_used", []),
                raw_html_snippet=data.get("raw_html_snippet"),
            )
        except (json.JSONDecodeError, KeyError):
            logger.warning("Failed to parse crawl output as JSON, using raw text")
            return ExtractionResult(
                url=target.url,
                spider_name=target.spider_name,
                content=raw_output,
            )

    def _average_quality(self, results: list[ExtractionResult]) -> float:
        """Compute average overall quality across results."""
        if not results:
            return 0.0
        return sum(r.quality.overall for r in results) / len(results)

    def _compute_steer_direction(self, patches: list[SelectorPatch]) -> str:
        """Compute a steer direction hint from the patches."""
        if not patches:
            return "maintain current approach"
        unique_spiders = set(p.spider for p in patches)
        return (
            f"Focus on improving selectors for: {', '.join(unique_spiders)}. "
            f"{len(patches)} patches proposed."
        )
