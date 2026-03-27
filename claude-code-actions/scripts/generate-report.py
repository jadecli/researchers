#!/usr/bin/env python3
"""Generate a self-contained HTML quality dashboard from crawl output."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import click
from jinja2 import Template

REPORT_TEMPLATE = Template("""\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ title }}</title>
<style>
  :root { --pass: #22c55e; --fail: #ef4444; --warn: #f59e0b; --bg: #0f172a; --card: #1e293b; --text: #e2e8f0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 2rem; }
  h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
  .meta { color: #94a3b8; margin-bottom: 2rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
  .card { background: var(--card); border-radius: 12px; padding: 1.5rem; border: 1px solid #334155; }
  .card h2 { font-size: 1.2rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; }
  .badge.pass { background: var(--pass); color: #000; }
  .badge.fail { background: var(--fail); color: #fff; }
  .badge.warn { background: var(--warn); color: #000; }
  .score-row { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #334155; }
  .score-row:last-child { border-bottom: none; }
  .score-label { color: #94a3b8; }
  .score-value { font-weight: 600; }
  .bar { height: 8px; border-radius: 4px; background: #334155; margin-top: 4px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
  .bar-fill.pass { background: var(--pass); }
  .bar-fill.fail { background: var(--fail); }
  .bar-fill.warn { background: var(--warn); }
  .summary { background: var(--card); border-radius: 12px; padding: 2rem; margin-bottom: 2rem; border: 1px solid #334155; }
  .summary-stats { display: flex; gap: 3rem; flex-wrap: wrap; margin-top: 1rem; }
  .stat { text-align: center; }
  .stat-value { font-size: 2rem; font-weight: 700; }
  .stat-label { color: #94a3b8; font-size: 0.85rem; }
  .trend { font-size: 0.8rem; margin-left: 0.5rem; }
  .trend.up { color: var(--pass); }
  .trend.down { color: var(--fail); }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #334155; }
  th { color: #94a3b8; font-weight: 500; font-size: 0.85rem; text-transform: uppercase; }
  footer { text-align: center; color: #64748b; margin-top: 3rem; font-size: 0.85rem; }
</style>
</head>
<body>
<h1>{{ title }}</h1>
<p class="meta">Generated {{ generated_at }} | Threshold: {{ threshold_pct }}</p>

<div class="summary">
  <h2>Overall Quality</h2>
  <div class="summary-stats">
    <div class="stat">
      <div class="stat-value" style="color: {{ 'var(--pass)' if overall_score >= threshold else 'var(--fail)' }}">{{ overall_pct }}</div>
      <div class="stat-label">Overall Score</div>
    </div>
    <div class="stat">
      <div class="stat-value">{{ spiders | length }}</div>
      <div class="stat-label">Spiders Evaluated</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color: var(--pass)">{{ passing_count }}</div>
      <div class="stat-label">Passing</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color: {{ 'var(--fail)' if failing_count > 0 else 'var(--pass)' }}">{{ failing_count }}</div>
      <div class="stat-label">Failing</div>
    </div>
    <div class="stat">
      <div class="stat-value">{{ total_pages }}</div>
      <div class="stat-label">Pages Evaluated</div>
    </div>
  </div>
</div>

<div class="grid">
{% for spider in spiders %}
<div class="card">
  <h2>
    {{ spider.name }}
    <span class="badge {{ 'pass' if spider.overall >= threshold else 'fail' }}">
      {{ 'PASS' if spider.overall >= threshold else 'FAIL' }}
    </span>
  </h2>
  {% for dim in spider.dimensions %}
  <div class="score-row">
    <span class="score-label">{{ dim.name }}</span>
    <span class="score-value">{{ dim.pct }}</span>
  </div>
  <div class="bar">
    <div class="bar-fill {{ 'pass' if dim.value >= threshold else ('warn' if dim.value >= 0.7 else 'fail') }}"
         style="width: {{ (dim.value * 100) | round(1) }}%"></div>
  </div>
  {% endfor %}
  <div class="score-row" style="margin-top: 0.5rem; font-weight: 600;">
    <span>Overall</span>
    <span>{{ spider.overall_pct }}</span>
  </div>
  <div class="score-row">
    <span class="score-label">Pages</span>
    <span>{{ spider.pages }}</span>
  </div>
</div>
{% endfor %}
</div>

{% if trends %}
<div class="card" style="margin-bottom: 2rem;">
  <h2>Trend History</h2>
  <table>
    <thead><tr><th>Date</th><th>Overall</th>{% for s in spider_names %}<th>{{ s }}</th>{% endfor %}</tr></thead>
    <tbody>
    {% for row in trends %}
    <tr>
      <td>{{ row.date }}</td>
      <td>{{ row.overall }}</td>
      {% for s in spider_names %}<td>{{ row.scores.get(s, 'N/A') }}</td>{% endfor %}
    </tr>
    {% endfor %}
    </tbody>
  </table>
</div>
{% endif %}

<script id="report-data" type="application/json">{{ raw_json }}</script>

<footer>
  Claude Code Actions Quality Dashboard | {{ generated_at }}
</footer>
</body>
</html>
""")


def load_spider_quality(output_dir: Path) -> dict[str, dict[str, Any]]:
    """Load quality.json files from spider output directories."""
    spiders: dict[str, dict[str, Any]] = {}
    for sub in sorted(output_dir.iterdir()):
        if not sub.is_dir():
            continue
        quality_file = sub / "quality.json"
        if quality_file.exists():
            try:
                data = json.loads(quality_file.read_text())
                spiders[sub.name] = data
            except json.JSONDecodeError:
                continue
    return spiders


def load_trend_data(output_dir: Path) -> list[dict[str, Any]]:
    """Load historical trend data from reports directory."""
    trends: list[dict[str, Any]] = []
    reports_dir = output_dir.parent / "reports"
    if not reports_dir.is_dir():
        return trends

    for report_file in sorted(reports_dir.glob("*.json")):
        try:
            data = json.loads(report_file.read_text())
            if "overall_score" in data:
                trends.append({
                    "date": report_file.stem,
                    "overall": f"{data['overall_score']:.1%}",
                    "scores": {
                        name: f"{info['overall_score']:.1%}"
                        for name, info in data.get("spiders", {}).items()
                    },
                })
        except (json.JSONDecodeError, KeyError):
            continue

    return trends[-20:]  # Last 20 entries


@click.command()
@click.option("--title", default="Quality Dashboard", help="Report title")
@click.option("--output", default="reports/quality-dashboard.html", help="Output HTML path")
@click.option("--output-dir", default="output", help="Base output directory with spider results")
@click.option("--threshold", default=0.85, type=float, help="Quality threshold")
@click.option("--include-trends", is_flag=True, help="Include historical trend data")
def main(title: str, output: str, output_dir: str, threshold: float, include_trends: bool) -> None:
    """Generate a self-contained HTML quality dashboard."""
    base = Path(output_dir)

    spider_data = load_spider_quality(base)

    if not spider_data:
        click.echo("WARNING: No quality data found. Generating empty report.", err=True)

    # Build template context
    spiders_ctx = []
    total_pages = 0
    all_overall: list[float] = []

    for name, data in sorted(spider_data.items()):
        overall = data.get("overall_score", 0.0)
        pages = data.get("pages_evaluated", 0)
        total_pages += pages
        all_overall.append(overall)

        dimensions = []
        for dim_name in ("completeness", "accuracy", "freshness"):
            val = data.get(dim_name, 0.0)
            dimensions.append({
                "name": dim_name.capitalize(),
                "value": val,
                "pct": f"{val:.1%}",
            })

        spiders_ctx.append({
            "name": name,
            "overall": overall,
            "overall_pct": f"{overall:.1%}",
            "pages": pages,
            "dimensions": dimensions,
        })

    avg_overall = sum(all_overall) / len(all_overall) if all_overall else 0.0
    passing = sum(1 for s in all_overall if s >= threshold)
    failing = len(all_overall) - passing

    trends = load_trend_data(base) if include_trends else []
    spider_names = sorted(spider_data.keys())

    raw_data = {"spiders": spider_data, "overall_score": avg_overall}

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    html = REPORT_TEMPLATE.render(
        title=title,
        generated_at=now,
        threshold=threshold,
        threshold_pct=f"{threshold:.0%}",
        overall_score=avg_overall,
        overall_pct=f"{avg_overall:.1%}",
        spiders=spiders_ctx,
        passing_count=passing,
        failing_count=failing,
        total_pages=total_pages,
        trends=trends,
        spider_names=spider_names,
        raw_json=json.dumps(raw_data, indent=2),
    )

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html, encoding="utf-8")

    click.echo(f"Report generated: {output_path} ({len(html)} bytes)")
    click.echo(f"Spiders: {len(spiders_ctx)} | Overall: {avg_overall:.1%} | Passing: {passing}/{len(all_overall)}")


if __name__ == "__main__":
    main()
