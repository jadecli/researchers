"""Context injection for HeadlessRunner prompts."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from ..models.crawl_target import CrawlTarget
    from .improvement_chain import ImprovementChain


def inject_context(
    iteration: int,
    chain: Optional[ImprovementChain] = None,
    target: Optional[CrawlTarget] = None,
) -> str:
    """Generate a context fragment to inject into HeadlessRunner prompts.

    Aggregates information from the improvement chain history and current
    target to provide steering guidance for the next crawl iteration.

    Args:
        iteration: Current iteration number (0-based).
        chain: The improvement chain with historical deltas.
        target: The current crawl target.

    Returns:
        A prompt fragment string with accumulated context.
    """
    sections: list[str] = []

    sections.append(f"## Iteration Context (iteration {iteration})")

    if chain and chain.iteration_count > 0:
        cumulative = chain.get_cumulative_delta()
        if cumulative:
            sections.append(
                f"### Quality Trajectory\n"
                f"- Starting quality: {cumulative.quality_before:.3f}\n"
                f"- Current quality: {cumulative.quality_after:.3f}\n"
                f"- Total improvement: {chain.total_improvement:+.3f}\n"
                f"- Iterations completed: {chain.iteration_count}"
            )

            if cumulative.new_patterns:
                patterns_str = "\n".join(f"  - `{p}`" for p in cumulative.new_patterns[:10])
                sections.append(f"### Discovered Patterns\n{patterns_str}")

            if cumulative.failing_selectors:
                failing_str = "\n".join(
                    f"  - `{s}`" for s in cumulative.failing_selectors[:10]
                )
                sections.append(
                    f"### Failing Selectors (avoid these)\n{failing_str}"
                )

            if cumulative.discovered_page_types:
                types_str = ", ".join(cumulative.discovered_page_types)
                sections.append(f"### Discovered Page Types\n{types_str}")

            if cumulative.steer_direction:
                sections.append(
                    f"### Steering Direction\n{cumulative.steer_direction}"
                )

        history = chain.get_history()
        if len(history) >= 2:
            recent = history[-1]
            sections.append(
                f"### Last Iteration Summary\n"
                f"- Quality change: {recent.quality_improvement:+.3f}\n"
                f"- New patterns found: {len(recent.new_patterns)}\n"
                f"- Selectors failing: {len(recent.failing_selectors)}"
            )
    else:
        sections.append(
            "This is the initial crawl iteration. "
            "Focus on broad extraction and discovery."
        )

    if target:
        sections.append(
            f"### Current Target\n"
            f"- URL: {target.url}\n"
            f"- Spider: {target.spider_name}\n"
            f"- Max pages: {target.max_pages}\n"
            f"- Priority: {target.priority}"
        )
        if target.page_type_hint:
            sections.append(f"- Expected page type: {target.page_type_hint.value}")

    return "\n\n".join(sections)
