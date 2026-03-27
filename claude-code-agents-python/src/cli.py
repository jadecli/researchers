"""Click CLI for claude-code-agents-python."""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Optional

import click

from .codegen.language_router import LanguageRouter
from .codegen.multi_lang_scaffold import MultiLangScaffold
from .cowork.plugin_recommender import PluginRecommender
from .cowork.task_router import CoworkTaskRouter
from .models.crawl_target import CrawlPlan, CrawlTarget
from .models.extraction_result import ExtractionResult, QualityScore
from .models.plugin_spec import AgentSpec, PluginSpec, SkillSpec
from .orchestrator.campaign import CrawlCampaign
from .plugin_gen.scaffold import generate_plugin


@click.group()
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose logging")
def cli(verbose: bool) -> None:
    """Claude Code Agents: orchestrate crawl campaigns, generate plugins, and produce multi-lang code."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


@cli.command()
@click.option("--target", "-t", required=True, help="URL to crawl")
@click.option("--spider", "-s", default="generic", help="Spider name")
@click.option("--max-pages", "-m", default=50, type=int, help="Max pages per target")
@click.option("--iterations", "-i", default=3, type=int, help="Max improvement iterations")
@click.option("--budget", "-b", default=5.0, type=float, help="Budget in USD")
@click.option("--threshold", default=0.8, type=float, help="Quality threshold to stop")
@click.option("--output", "-o", default=None, help="Output file for results JSON")
def campaign(
    target: str,
    spider: str,
    max_pages: int,
    iterations: int,
    budget: float,
    threshold: float,
    output: Optional[str],
) -> None:
    """Run an iterative crawl campaign against a target URL."""
    click.echo(f"Starting campaign against {target}")
    click.echo(f"  Spider: {spider}, Max pages: {max_pages}, Iterations: {iterations}")
    click.echo(f"  Budget: ${budget:.2f}, Quality threshold: {threshold}")

    plan = CrawlPlan(
        targets=[
            CrawlTarget(url=target, spider_name=spider, max_pages=max_pages)
        ],
        total_budget_usd=budget,
        max_iterations=iterations,
        quality_threshold=threshold,
    )

    campaign_runner = CrawlCampaign(plan=plan)

    try:
        results = campaign_runner.run()
    except RuntimeError as e:
        click.echo(f"Campaign failed: {e}", err=True)
        sys.exit(1)

    click.echo(f"\nCampaign complete: {len(results)} results")
    for result in results:
        click.echo(
            f"  [{result.page_type.value}] {result.url} "
            f"(quality: {result.quality.overall:.3f})"
        )

    if output:
        output_path = Path(output)
        data = [r.model_dump(mode="json") for r in results]
        output_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        click.echo(f"Results written to {output_path}")


@cli.command("generate-plugin")
@click.option("--name", "-n", required=True, help="Plugin name")
@click.option("--domain", "-d", default="engineering", help="Target domain")
@click.option("--description", default="", help="Plugin description")
@click.option("--output-dir", "-o", default="./generated_plugins", help="Output directory")
@click.option("--skills", multiple=True, help="Skill names to include")
@click.option("--agents", multiple=True, help="Agent names to include")
def generate_plugin_cmd(
    name: str,
    domain: str,
    description: str,
    output_dir: str,
    skills: tuple[str, ...],
    agents: tuple[str, ...],
) -> None:
    """Generate a Claude Code plugin from a specification."""
    click.echo(f"Generating plugin '{name}' for domain '{domain}'")

    skill_specs = [
        SkillSpec(name=s, description=f"{s} skill for {domain}")
        for s in skills
    ] if skills else [
        SkillSpec(name=f"{domain}-default", description=f"Default {domain} skill"),
    ]

    agent_specs = [
        AgentSpec(name=a, description=f"{a} agent for {domain}")
        for a in agents
    ] if agents else [
        AgentSpec(name=f"{domain}-assistant", description=f"{domain} domain assistant"),
    ]

    spec = PluginSpec(
        name=name,
        description=description or f"Plugin for {domain} domain tasks",
        skills=skill_specs,
        agents=agent_specs,
    )

    plugin_dir = generate_plugin(spec, output_dir)
    click.echo(f"Plugin generated at: {plugin_dir}")
    click.echo(f"  Skills: {spec.skill_count}, Agents: {spec.agent_count}")


@cli.command()
@click.option("--task", "-t", required=True, help="Task description")
@click.option("--project-name", "-n", default="project", help="Project name")
@click.option("--environment", "-e", default="cli", help="Target environment")
@click.option("--language", "-l", multiple=True, help="Preferred language(s)")
@click.option("--output-dir", "-o", default="./generated_code", help="Output directory")
def codegen(
    task: str,
    project_name: str,
    environment: str,
    language: tuple[str, ...],
    output_dir: str,
) -> None:
    """Generate a multi-language project scaffold."""
    click.echo(f"Generating code for: {task}")
    click.echo(f"  Project: {project_name}, Environment: {environment}")

    preferred = list(language) if language else None
    scaffold = MultiLangScaffold()

    try:
        paths = scaffold.create(
            task=task,
            output_dir=output_dir,
            project_name=project_name,
            environment=environment,
            preferred_languages=preferred,
        )
    except Exception as e:
        click.echo(f"Code generation failed: {e}", err=True)
        sys.exit(1)

    click.echo(f"\nGenerated {len(paths)} files:")
    for path in paths:
        click.echo(f"  {path}")


@cli.command("cowork-task")
@click.option("--task", "-t", required=True, help="Task description")
@click.option("--top-k", "-k", default=3, type=int, help="Number of domain matches")
@click.option("--recommend/--no-recommend", default=True, help="Include plugin recommendations")
def cowork_task(task: str, top_k: int, recommend: bool) -> None:
    """Route a task to knowledge-work-plugins domains and get recommendations."""
    click.echo(f"Analyzing task: {task}\n")

    router = CoworkTaskRouter()
    results = router.route_multi(task, top_k=top_k)

    click.echo("Domain Matches:")
    for i, result in enumerate(results, 1):
        click.echo(
            f"  {i}. {result.domain} (confidence: {result.confidence:.3f})"
        )
        if result.matched_keywords:
            click.echo(f"     Keywords: {', '.join(result.matched_keywords)}")
        if result.suggested_plugins:
            click.echo(f"     Plugins: {', '.join(result.suggested_plugins)}")

    if recommend:
        click.echo("\nPlugin Recommendations:")
        recommender = PluginRecommender(router=router)
        rec_result = recommender.recommend(task)
        for i, rec in enumerate(rec_result.recommendations, 1):
            click.echo(
                f"  {i}. {rec.plugin_name} [{rec.domain}] "
                f"(relevance: {rec.relevance_score:.3f})"
            )
            click.echo(f"     {rec.reason}")


@cli.command()
@click.option("--input-file", "-i", required=True, help="JSON file with extraction results")
@click.option("--threshold", default=0.8, type=float, help="Quality threshold")
def analyze(input_file: str, threshold: float) -> None:
    """Analyze quality of extraction results from a previous campaign."""
    input_path = Path(input_file)
    if not input_path.exists():
        click.echo(f"File not found: {input_path}", err=True)
        sys.exit(1)

    data = json.loads(input_path.read_text(encoding="utf-8"))
    results = [ExtractionResult.model_validate(item) for item in data]

    click.echo(f"Analyzing {len(results)} extraction results (threshold: {threshold})\n")

    total_quality = 0.0
    below_threshold = 0
    by_type: dict[str, list[float]] = {}

    for result in results:
        quality = result.quality.overall
        total_quality += quality
        if quality < threshold:
            below_threshold += 1

        ptype = result.page_type.value
        if ptype not in by_type:
            by_type[ptype] = []
        by_type[ptype].append(quality)

    avg_quality = total_quality / len(results) if results else 0.0

    click.echo(f"Overall Statistics:")
    click.echo(f"  Total results: {len(results)}")
    click.echo(f"  Average quality: {avg_quality:.3f}")
    click.echo(f"  Below threshold: {below_threshold}")
    click.echo(f"  Above threshold: {len(results) - below_threshold}")

    click.echo(f"\nQuality by Page Type:")
    for ptype, qualities in sorted(by_type.items()):
        avg = sum(qualities) / len(qualities)
        click.echo(
            f"  {ptype}: avg={avg:.3f}, count={len(qualities)}, "
            f"min={min(qualities):.3f}, max={max(qualities):.3f}"
        )

    failing_selectors: set[str] = set()
    for result in results:
        if result.quality.overall < threshold:
            failing_selectors.update(result.selectors_used)

    if failing_selectors:
        click.echo(f"\nPotentially Failing Selectors ({len(failing_selectors)}):")
        for selector in sorted(failing_selectors)[:10]:
            click.echo(f"  - {selector}")


if __name__ == "__main__":
    cli()
