"""Conservative throttle settings override — 10% below standard limits.

This module provides a settings override that applies more conservative
crawl throttling, reducing throughput by 10% to stay safely within
rate limits for external documentation sites.

Usage:
    # Apply via Scrapy custom_settings in a spider:
    custom_settings = get_conservative_settings()

    # Or import individual values:
    from scrapy_researchers.throttle_conservative import CONSERVATIVE_SETTINGS

    # Or apply via environment variable:
    SCRAPY_SETTINGS_MODULE=scrapy_researchers.throttle_conservative
"""

from __future__ import annotations

import os

# ── Conservative throttle values (10% below limits) ────────────────────
# "10% below" means MORE conservative: slower delays, fewer concurrent requests.
#
# DOWNLOAD_DELAY:                2.0 * 1.1 = 2.2 seconds (10% longer delay)
# CONCURRENT_REQUESTS:           max(1, floor(2 * 0.9)) = 1 (10% fewer)
# CONCURRENT_REQUESTS_PER_DOMAIN: 1 (already at minimum)
# AUTOTHROTTLE_START_DELAY:      2.0 * 1.1 = 2.2 seconds (10% longer)
# AUTOTHROTTLE_TARGET_CONCURRENCY: 1.0 * 0.9 = 0.9 (10% lower)
# AUTOTHROTTLE_MAX_DELAY:        60 * 1.1 = 66 seconds (10% longer max)
# RETRY_TIMES:                   5 (unchanged)

CONSERVATIVE_SETTINGS: dict[str, float | int | bool] = {
    "DOWNLOAD_DELAY": 2.2,
    "CONCURRENT_REQUESTS": 1,
    "CONCURRENT_REQUESTS_PER_DOMAIN": 1,
    "AUTOTHROTTLE_ENABLED": True,
    "AUTOTHROTTLE_START_DELAY": 2.2,
    "AUTOTHROTTLE_TARGET_CONCURRENCY": 0.9,
    "AUTOTHROTTLE_MAX_DELAY": 66,
    "RETRY_TIMES": 5,
}


def get_conservative_settings() -> dict[str, float | int | bool]:
    """Return a copy of the conservative throttle settings dict.

    Suitable for use as spider ``custom_settings`` or passed to
    ``CrawlerProcess(settings=...)``.

    Returns:
        Dict of Scrapy setting names to their conservative values.
    """
    return dict(CONSERVATIVE_SETTINGS)


def apply_to_environ() -> None:
    """Export conservative settings as SCRAPY_* environment variables.

    This allows Scrapy's settings.py to pick them up via ``os.environ``
    when the crawler process starts.
    """
    for key, value in CONSERVATIVE_SETTINGS.items():
        env_key = f"SCRAPY_{key}"
        os.environ[env_key] = str(value)


# ── Full Scrapy settings module (if used as SCRAPY_SETTINGS_MODULE) ────
# Import all base settings first, then override with conservative values.

from scrapy_researchers.settings import *  # noqa: F401, F403, E402

# Override with conservative values
DOWNLOAD_DELAY = 2.2
CONCURRENT_REQUESTS = 1
CONCURRENT_REQUESTS_PER_DOMAIN = 1
AUTOTHROTTLE_START_DELAY = 2.2
AUTOTHROTTLE_TARGET_CONCURRENCY = 0.9
AUTOTHROTTLE_MAX_DELAY = 66
RETRY_TIMES = 5
