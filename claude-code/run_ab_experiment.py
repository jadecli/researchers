"""A/B experiment runner for Spotify stats crawler variants.

Runs all four crawl strategy variants (control, thinking, tool_search, ptc)
against the Spotify GitHub org and generates a comparison report.

Usage:
    PYTHONPATH=. python3 run_ab_experiment.py
    PYTHONPATH=. python3 run_ab_experiment.py --variants control,ptc --max-repos 10
    PYTHONPATH=. python3 run_ab_experiment.py --org spotify --category experimentation
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

VARIANTS = ["control", "thinking", "tool_search", "ptc"]
METRICS_DIR = Path("metrics")
DATA_DIR = Path("data")


def run_variant(
    variant: str,
    org: str,
    experiment_id: str,
    max_repos: int,
    category_filter: str,
) -> dict:
    """Run a single crawl variant and return timing + stats."""
    output_file = DATA_DIR / f"ab_{experiment_id}_{variant}.jsonl"

    cmd = [
        sys.executable, "-m", "scrapy", "crawl", "spotify_stats",
        "-a", f"variant={variant}",
        "-a", f"org={org}",
        "-a", f"experiment_id={experiment_id}",
        "-a", f"max_repos={max_repos}",
        "-s", "DELTAFETCH_ENABLED=False",
        "-s", "HTTPCACHE_ENABLED=False",
        "-s", "LOG_LEVEL=INFO",
        "-s", f"EFFICIENCY_METRICS_DIR={METRICS_DIR}",
        "-o", str(output_file),
    ]

    if category_filter:
        cmd.extend(["-a", f"category_filter={category_filter}"])

    print(f"\n{'='*60}")
    print(f"  Variant: {variant}")
    print(f"  Org: {org} | Max repos: {max_repos}")
    print(f"  Output: {output_file}")
    print(f"{'='*60}")

    start = time.perf_counter()
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=str(Path(__file__).parent),
        env={
            **__import__("os").environ,
            "PYTHONPATH": str(Path(__file__).parent),
            "http_proxy": "", "https_proxy": "",
            "HTTP_PROXY": "", "HTTPS_PROXY": "",
        },
        timeout=600,  # 10 minute timeout per variant
    )
    elapsed = time.perf_counter() - start

    # Parse output items
    items = []
    variant_metrics = None
    if output_file.exists():
        for line in output_file.read_text().strip().split("\n"):
            if not line.strip():
                continue
            try:
                item = json.loads(line)
                if item.get("metadata", {}).get("is_metrics") == "true":
                    variant_metrics = json.loads(item.get("content_markdown", "{}"))
                else:
                    items.append(item)
            except json.JSONDecodeError:
                continue

    # Extract spider log stats
    tool_calls = 0
    pages_crawled = len(items)
    if variant_metrics:
        tool_calls = variant_metrics.get("tool_calls", 0)
        pages_crawled = variant_metrics.get("pages_crawled", pages_crawled)

    ratio = tool_calls / pages_crawled if pages_crawled > 0 else float("inf")

    # Print summary
    status = "OK" if result.returncode == 0 else f"FAIL({result.returncode})"
    print(f"  [{status}] {elapsed:.1f}s | {pages_crawled} pages | {tool_calls} tool calls | ratio={ratio:.2f}")

    if result.returncode != 0 and result.stderr:
        # Show last few error lines
        for line in result.stderr.strip().split("\n")[-5:]:
            if "ERROR" in line:
                print(f"    {line.strip()}")

    return {
        "variant": variant,
        "experiment_id": experiment_id,
        "org": org,
        "elapsed_seconds": round(elapsed, 2),
        "pages_crawled": pages_crawled,
        "tool_calls": tool_calls,
        "ratio": round(ratio, 4) if ratio != float("inf") else "inf",
        "pages_per_second": round(pages_crawled / elapsed, 4) if elapsed > 0 else 0,
        "items_count": len(items),
        "exit_code": result.returncode,
        "avg_quality": round(
            sum(i.get("quality_score", 0) for i in items) / len(items), 4
        ) if items else 0,
        "categories": list(set(
            i.get("metadata", {}).get("category", "")
            for i in items if i.get("metadata", {}).get("category")
        )),
        "output_file": str(output_file),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def generate_report(results: list[dict], experiment_id: str) -> Path:
    """Generate comparison report from all variant results."""
    report = {
        "experiment_id": experiment_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "variants": results,
        "comparison": {},
    }

    # Find winner (lowest ratio with pages > 0)
    valid = [r for r in results if r["pages_crawled"] > 0 and r["ratio"] != "inf"]
    if valid:
        by_ratio = sorted(valid, key=lambda r: r["ratio"])
        by_speed = sorted(valid, key=lambda r: r["pages_per_second"], reverse=True)
        by_quality = sorted(valid, key=lambda r: r["avg_quality"], reverse=True)

        report["comparison"] = {
            "best_efficiency": {
                "winner": by_ratio[0]["variant"],
                "ratio": by_ratio[0]["ratio"],
                "runner_up": by_ratio[1]["variant"] if len(by_ratio) > 1 else None,
                "runner_up_ratio": by_ratio[1]["ratio"] if len(by_ratio) > 1 else None,
                "improvement_pct": round(
                    (1 - by_ratio[0]["ratio"] / by_ratio[-1]["ratio"]) * 100, 1
                ) if by_ratio[-1]["ratio"] > 0 else 0,
            },
            "best_speed": {
                "winner": by_speed[0]["variant"],
                "pages_per_second": by_speed[0]["pages_per_second"],
            },
            "best_quality": {
                "winner": by_quality[0]["variant"],
                "avg_quality": by_quality[0]["avg_quality"],
            },
        }

    report_path = METRICS_DIR / f"ab_experiment_{experiment_id}.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    return report_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Run A/B crawl experiment")
    parser.add_argument(
        "--variants", default=",".join(VARIANTS),
        help=f"Comma-separated variants to test (default: {','.join(VARIANTS)})",
    )
    parser.add_argument("--org", default="spotify", help="GitHub org to crawl")
    parser.add_argument("--max-repos", type=int, default=10, help="Max repos per variant")
    parser.add_argument("--category", default="", help="Filter to specific category")
    parser.add_argument("--experiment-id", default="", help="Experiment ID (auto-generated if empty)")
    args = parser.parse_args()

    variants = [v.strip() for v in args.variants.split(",")]
    experiment_id = args.experiment_id or f"ab_{uuid.uuid4().hex[:8]}"

    METRICS_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print(f"A/B Experiment: {experiment_id}")
    print(f"Org: {args.org} | Variants: {variants} | Max repos: {args.max_repos}")
    if args.category:
        print(f"Category filter: {args.category}")

    results = []
    for variant in variants:
        try:
            result = run_variant(
                variant=variant,
                org=args.org,
                experiment_id=experiment_id,
                max_repos=args.max_repos,
                category_filter=args.category,
            )
            results.append(result)
        except subprocess.TimeoutExpired:
            print(f"  [TIMEOUT] Variant {variant} timed out after 600s")
            results.append({
                "variant": variant,
                "experiment_id": experiment_id,
                "error": "timeout",
                "pages_crawled": 0,
                "tool_calls": 0,
                "ratio": "inf",
                "pages_per_second": 0,
                "elapsed_seconds": 600,
                "exit_code": -1,
                "avg_quality": 0,
                "categories": [],
                "items_count": 0,
            })

    # Generate report
    report_path = generate_report(results, experiment_id)

    print(f"\n{'='*60}")
    print(f"  EXPERIMENT COMPLETE: {experiment_id}")
    print(f"{'='*60}")
    print(f"  Report: {report_path}")

    # Print comparison table
    print(f"\n  {'Variant':<15} {'Pages':>6} {'Calls':>6} {'Ratio':>8} {'Speed':>8} {'Quality':>8}")
    print(f"  {'-'*15} {'-'*6} {'-'*6} {'-'*8} {'-'*8} {'-'*8}")
    for r in results:
        ratio_str = f"{r['ratio']:.2f}" if isinstance(r["ratio"], (int, float)) else r["ratio"]
        print(
            f"  {r['variant']:<15} {r['pages_crawled']:>6} "
            f"{r['tool_calls']:>6} {ratio_str:>8} "
            f"{r['pages_per_second']:>7.2f}/s {r['avg_quality']:>7.3f}"
        )

    # Load gap analysis if available
    from scrapy_researchers.metrics.gap_analyzer import GapAnalyzer
    analyzer = GapAnalyzer(metrics_dir=str(METRICS_DIR))

    # Compare best two variants
    if len(results) >= 2:
        valid = [r for r in results if r["pages_crawled"] > 0]
        if len(valid) >= 2:
            sorted_by_ratio = sorted(
                valid,
                key=lambda r: r["ratio"] if isinstance(r["ratio"], (int, float)) else float("inf"),
            )
            best = sorted_by_ratio[0]["variant"]
            worst = sorted_by_ratio[-1]["variant"]
            comparison = analyzer.compare_experiments(best, worst)
            if "error" not in comparison:
                print(f"\n  Winner: {comparison['winner']} "
                      f"(improvement: {comparison['improvement_pct']}%)")


if __name__ == "__main__":
    main()
