#!/usr/bin/env python3
"""Video AI crawl campaign runner.

Configures 4 crawl targets for video AI documentation with 10% below
throttle limits (more conservative) and executes via CrawlCampaign.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from src.models.crawl_target import CrawlPlan, CrawlTarget
from src.orchestrator.campaign import CrawlCampaign
from src.dspy_pipeline.crawl_adapter import (
    convert_prompt_to_campaign,
    campaign_to_json,
    CrawlPriority,
)


# ── 10% Below Throttle Limits (more conservative) ──────────────────────
# These are set as environment variables so Scrapy settings.py can pick them up,
# and also applied directly to the campaign plan.
CONSERVATIVE_THROTTLE = {
    "DOWNLOAD_DELAY": "2.2",               # 2.0 * 1.1 = 2.2
    "CONCURRENT_REQUESTS": "1",             # max(1, floor(2 * 0.9)) = 1
    "CONCURRENT_REQUESTS_PER_DOMAIN": "1",  # already minimum
    "AUTOTHROTTLE_START_DELAY": "2.2",      # 2.0 * 1.1 = 2.2
    "AUTOTHROTTLE_TARGET_CONCURRENCY": "0.9",  # 1.0 * 0.9 = 0.9
    "AUTOTHROTTLE_MAX_DELAY": "66",         # 60 * 1.1 = 66
    "RETRY_TIMES": "5",                     # keep same
}

QUALITY_THRESHOLD = 0.65


def apply_throttle_env() -> None:
    """Apply conservative throttle settings via environment variables."""
    for key, value in CONSERVATIVE_THROTTLE.items():
        env_key = f"SCRAPY_{key}"
        os.environ[env_key] = value
        print(f"  {env_key}={value}")


def build_dspy_campaign():
    """Build campaign using DSPy crawl adapter (convert_prompt_to_campaign)."""
    source_urls = [
        {
            "url": "https://app.klingai.com/llms.txt",
            "description": "Kling 3.0 — video AI generation docs",
            "priority": "critical",
        },
        {
            "url": "https://ai.google.dev/gemini-api/docs/llms.txt",
            "description": "Google Veo 3.1 — Gemini video generation API docs",
            "priority": "critical",
        },
        {
            "url": "https://seed.bytedance.com/en/seedance2_0",
            "description": "Seedance 2.0 — ByteDance video generation",
            "priority": "high",
        },
        {
            "url": "https://docs.higgsfield.ai/llms.txt",
            "description": "Higgsfield — video AI platform docs",
            "priority": "critical",
        },
    ]

    campaign = convert_prompt_to_campaign(
        prompt_title="Video AI Documentation Crawl Campaign 2026",
        key_topics=[
            "Video generation API",
            "Model parameters and settings",
            "SDK integration patterns",
            "Rate limits and pricing",
            "Output format specifications",
        ],
        source_urls=source_urls,
        focus_areas=[
            "Extract video generation API endpoints and parameters",
            "Map model capabilities and supported formats",
            "Identify rate limits and throttle configurations",
            "Catalog SDK examples for each platform",
        ],
        max_pages_per_target=50,
        quality_threshold=QUALITY_THRESHOLD,
        iterations=3,
    )

    return campaign


def build_direct_plan():
    """Build a direct CrawlPlan with CrawlTarget objects."""
    targets = [
        CrawlTarget(
            url="https://app.klingai.com/llms.txt",
            spider_name="docs_spider",
            priority=10,
            max_pages=50,
        ),
        CrawlTarget(
            url="https://ai.google.dev/gemini-api/docs/llms.txt",
            spider_name="docs_spider",
            priority=9,
            max_pages=50,
        ),
        CrawlTarget(
            url="https://seed.bytedance.com/en/seedance2_0",
            spider_name="docs_spider",
            priority=8,
            max_pages=30,
        ),
        CrawlTarget(
            url="https://docs.higgsfield.ai/llms.txt",
            spider_name="docs_spider",
            priority=10,
            max_pages=50,
        ),
    ]

    plan = CrawlPlan(
        targets=targets,
        total_budget_usd=10.0,
        max_iterations=3,
        concurrency=1,  # conservative: 10% below limit
        quality_threshold=QUALITY_THRESHOLD,
    )

    return plan


def main() -> None:
    """Run the video AI crawl campaign."""
    print("=" * 70)
    print("Video AI Documentation Crawl Campaign")
    print("=" * 70)

    # Step 1: Apply conservative throttle settings
    print("\n[1/5] Applying 10% below throttle limits (conservative)...")
    apply_throttle_env()

    # Step 2: Build DSPy campaign via convert_prompt_to_campaign
    print("\n[2/5] Building DSPy campaign via convert_prompt_to_campaign...")
    dspy_campaign = build_dspy_campaign()
    campaign_json = campaign_to_json(dspy_campaign)
    print(f"\nDSPy Campaign Plan:")
    print(campaign_json)

    # Step 3: Build direct CrawlPlan with CrawlTarget objects
    print("\n[3/5] Building direct CrawlPlan with CrawlTarget objects...")
    plan = build_direct_plan()
    campaign_runner = CrawlCampaign(plan=plan)
    plan_summary = campaign_runner.plan_campaign()
    plan_json = json.dumps(plan_summary, indent=2)
    print(f"\nDirect Campaign Plan:")
    print(plan_json)

    # Step 4: Save campaign plan to output file
    output_path = Path("data/video_ai_crawl_results.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    campaign_output = {
        "campaign_name": dspy_campaign.name,
        "throttle_settings": CONSERVATIVE_THROTTLE,
        "quality_threshold": QUALITY_THRESHOLD,
        "dspy_campaign": json.loads(campaign_json),
        "direct_plan": plan_summary,
        "execution_status": "pending",
        "results": [],
    }

    print(f"\n[4/5] Saving campaign plan to {output_path}...")
    output_path.write_text(json.dumps(campaign_output, indent=2), encoding="utf-8")
    print(f"  Written: {output_path}")

    # Step 5: Try to execute the campaign (short timeout since claude CLI may not work)
    print("\n[5/5] Attempting campaign execution...")
    from src.orchestrator.headless_runner import HeadlessRunner

    # Use a short timeout runner to avoid hanging
    short_runner = HeadlessRunner(timeout=15)
    campaign_runner = CrawlCampaign(plan=plan, runner=short_runner)

    try:
        results = campaign_runner.run()
        campaign_output["execution_status"] = "completed"
        campaign_output["results"] = [
            {
                "url": r.url,
                "spider": r.spider_name,
                "page_type": r.page_type.value,
                "quality": r.quality.overall,
                "title": r.title,
            }
            for r in results
        ]
        print(f"\nCampaign completed: {len(results)} results")
        for r in results:
            print(f"  [{r.page_type.value}] {r.url} (quality: {r.quality.overall:.3f})")

    except RuntimeError as e:
        campaign_output["execution_status"] = "failed"
        campaign_output["error"] = str(e)
        print(f"\n  Campaign execution failed (expected if claude CLI not available):")
        print(f"  RuntimeError: {e}")
        print("  This is expected in environments without the claude CLI.")

    except Exception as e:
        campaign_output["execution_status"] = "error"
        campaign_output["error"] = f"{type(e).__name__}: {e}"
        print(f"\n  Unexpected error during campaign execution:")
        print(f"  {type(e).__name__}: {e}")

    # Write final results
    output_path.write_text(json.dumps(campaign_output, indent=2), encoding="utf-8")
    print(f"\nFinal results written to {output_path}")
    print("=" * 70)
    print("Campaign runner complete.")


if __name__ == "__main__":
    main()
