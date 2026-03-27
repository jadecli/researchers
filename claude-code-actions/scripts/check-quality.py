#!/usr/bin/env python3
"""Quality gate script. Evaluates crawl output and exits 1 if below threshold."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import click


def compute_completeness(results: list[dict[str, Any]]) -> float:
    """Score how complete each crawled page is (0.0-1.0).

    Checks for presence of: title, text content (>100 chars),
    metadata, at least one link, and no error.
    """
    if not results:
        return 0.0

    scores: list[float] = []
    for page in results:
        points = 0.0
        total = 5.0

        if page.get("title") or page.get("url"):
            points += 1.0
        if len(page.get("text", page.get("content", ""))) > 100:
            points += 1.0
        if page.get("metadata") and len(page.get("metadata", {})) > 0:
            points += 1.0
        if page.get("links") and len(page.get("links", [])) > 0:
            points += 1.0
        if not page.get("error"):
            points += 1.0

        scores.append(points / total)

    return sum(scores) / len(scores)


def compute_accuracy(results: list[dict[str, Any]]) -> float:
    """Score data accuracy (0.0-1.0).

    Checks for valid URLs, non-empty content, consistent encoding,
    and reasonable page sizes.
    """
    if not results:
        return 0.0

    scores: list[float] = []
    for page in results:
        points = 0.0
        total = 4.0

        url = page.get("url", "")
        if url.startswith("http://") or url.startswith("https://"):
            points += 1.0

        content = page.get("text", page.get("content", ""))
        if content and len(content.strip()) > 10:
            points += 1.0

        # Check for encoding issues (mojibake indicators)
        if content and "\ufffd" not in content and "Ã" not in content[:200]:
            points += 1.0

        # Reasonable size (not just boilerplate, not absurdly large)
        content_len = len(content)
        if 50 < content_len < 5_000_000:
            points += 1.0

        scores.append(points / total)

    return sum(scores) / len(scores)


def compute_freshness(results: list[dict[str, Any]], meta: dict[str, Any] | None = None) -> float:
    """Score data freshness (0.0-1.0).

    Based on crawl metadata: was the crawl recent? Did it complete?
    Are HTTP status codes successful?
    """
    if not results:
        return 0.0

    points = 0.0
    total = 3.0

    # Crawl produced results
    if len(results) > 0:
        points += 1.0

    # Most pages returned successfully
    success = sum(1 for r in results if not r.get("error") and r.get("status", 200) < 400)
    if success / len(results) > 0.8:
        points += 1.0

    # Crawl metadata indicates reasonable timing
    if meta:
        elapsed = meta.get("elapsed_seconds", meta.get("elapsed", 0))
        if isinstance(elapsed, (int, float)) and 0 < elapsed < 3600:
            points += 1.0
    else:
        points += 0.5  # No meta available, partial credit

    return points / total


def evaluate_spider(output_dir: Path) -> dict[str, Any]:
    """Evaluate quality of a spider's output directory."""
    results: list[dict[str, Any]] = []
    meta: dict[str, Any] = {}

    # Load crawl results
    results_file = output_dir / "crawl-results.json"
    if results_file.exists():
        try:
            results = json.loads(results_file.read_text())
        except json.JSONDecodeError:
            pass

    # Load crawl summary as fallback
    summary_file = output_dir / "crawl-summary.json"
    if summary_file.exists():
        try:
            meta = json.loads(summary_file.read_text())
        except json.JSONDecodeError:
            pass

    # If no results file, look for individual page JSON files
    if not results:
        for page_file in sorted(output_dir.glob("*.json")):
            if page_file.name in ("crawl-meta.json", "crawl-summary.json", "crawl-status.json", "quality.json"):
                continue
            try:
                data = json.loads(page_file.read_text())
                if isinstance(data, list):
                    results.extend(data)
                elif isinstance(data, dict):
                    results.append(data)
            except json.JSONDecodeError:
                continue

    completeness = compute_completeness(results)
    accuracy = compute_accuracy(results)
    freshness = compute_freshness(results, meta)

    overall = (completeness + accuracy + freshness) / 3.0

    return {
        "completeness": round(completeness, 4),
        "accuracy": round(accuracy, 4),
        "freshness": round(freshness, 4),
        "overall_score": round(overall, 4),
        "pages_evaluated": len(results),
    }


@click.command()
@click.option("--spider", default="", help="Spider name (subdirectory of output/)")
@click.option("--threshold", default=0.85, type=float, help="Minimum overall score to pass")
@click.option("--output", default="", help="Path to write quality JSON report")
@click.option("--output-dir", default="output", help="Base output directory")
@click.option("--dry-run", is_flag=True, help="Evaluate but always exit 0")
def main(spider: str, threshold: float, output: str, output_dir: str, dry_run: bool) -> None:
    """Evaluate crawl quality and enforce a score threshold."""
    base = Path(output_dir)

    if spider:
        spider_dir = base / spider
        if not spider_dir.is_dir():
            click.echo(f"ERROR: Spider output directory not found: {spider_dir}", err=True)
            if not dry_run:
                sys.exit(1)
            return
        scores = evaluate_spider(spider_dir)
        spider_name = spider
    else:
        # Evaluate all spiders in output/
        if not base.is_dir():
            click.echo(f"ERROR: Output directory not found: {base}", err=True)
            if not dry_run:
                sys.exit(1)
            return

        all_scores: dict[str, dict[str, Any]] = {}
        for sub in sorted(base.iterdir()):
            if sub.is_dir():
                all_scores[sub.name] = evaluate_spider(sub)

        if not all_scores:
            click.echo("WARNING: No spider output found to evaluate")
            if not dry_run:
                sys.exit(1)
            return

        # Aggregate
        overall_values = [s["overall_score"] for s in all_scores.values()]
        scores = {
            "spiders": all_scores,
            "overall_score": round(sum(overall_values) / len(overall_values), 4),
            "min_score": round(min(overall_values), 4),
            "max_score": round(max(overall_values), 4),
        }
        spider_name = "all"

    # Write output
    if output:
        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(scores, indent=2))
        click.echo(f"Quality report written to {output_path}")
    else:
        # Write to spider dir by default
        if spider:
            default_output = base / spider / "quality.json"
        else:
            default_output = base / "quality.json"
        default_output.parent.mkdir(parents=True, exist_ok=True)
        default_output.write_text(json.dumps(scores, indent=2))

    # Display results
    overall = scores.get("overall_score", 0.0)
    click.echo(f"\nQuality Report: {spider_name}")
    click.echo(f"{'=' * 40}")

    if "spiders" in scores:
        for name, s in scores["spiders"].items():
            status = "PASS" if s["overall_score"] >= threshold else "FAIL"
            click.echo(
                f"  [{status}] {name}: "
                f"completeness={s['completeness']:.1%} "
                f"accuracy={s['accuracy']:.1%} "
                f"freshness={s['freshness']:.1%} "
                f"overall={s['overall_score']:.1%}"
            )
    else:
        click.echo(
            f"  completeness={scores['completeness']:.1%} "
            f"accuracy={scores['accuracy']:.1%} "
            f"freshness={scores['freshness']:.1%}"
        )

    click.echo(f"\nOverall: {overall:.1%} (threshold: {threshold:.0%})")

    if overall >= threshold:
        click.echo("PASSED")
        sys.exit(0)
    else:
        click.echo(f"FAILED: {overall:.1%} < {threshold:.0%}")
        if dry_run:
            click.echo("(dry-run mode, exiting 0)")
            sys.exit(0)
        sys.exit(1)


if __name__ == "__main__":
    main()
