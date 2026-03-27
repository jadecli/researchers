"""Scrapy Researchers — crawler settings.

Iterative crawlers for Anthropic's documentation ecosystem with:
- scrapy-deltafetch: skip pages already crawled in previous runs
- spidermon: data validation, stats monitoring, unwanted HTTP code alerts
- scrapy-magicfields: auto-inject metadata into every item
- Quality scoring + improvement feedback pipelines for iterative refinement
"""

import os

BOT_NAME = "scrapy_researchers"

SPIDER_MODULES = ["scrapy_researchers.spiders"]
NEWSPIDER_MODULE = "scrapy_researchers.spiders"

# ── Crawl responsibly ────────────────────────────────────────────
ROBOTSTXT_OBEY = True
CONCURRENT_REQUESTS = 2
CONCURRENT_REQUESTS_PER_DOMAIN = 1
DOWNLOAD_DELAY = 2.0
COOKIES_ENABLED = False
DOWNLOAD_TIMEOUT = 30
DOWNLOAD_MAXSIZE = 10_485_760  # 10 MB — skip oversized responses
DOWNLOAD_WARNSIZE = 5_242_880  # 5 MB — warn in logs

# User agent — identify as a documentation research bot
USER_AGENT = "ScrapyResearchers/0.1 (+https://github.com/researchers/scrapy-researchers)"

# ── Bloom filter duplicate filtering ────────────────────────────
# Request-level: replaces Scrapy's default set-based RFPDupeFilter
DUPEFILTER_CLASS = "scrapy_researchers.bloom_dupefilter.BloomDupeFilter"
BLOOM_EXPECTED_URLS = 100_000       # expected unique URLs across all runs
BLOOM_FP_RATE = 0.001               # 0.1% false positive rate
BLOOM_PERSIST_PATH = "scrapy_researchers/.bloomstate/dupefilter.bloom"

# Item-level: DedupPipeline bloom filter (content fingerprints)
BLOOM_DEDUP_EXPECTED_ITEMS = 100_000
BLOOM_DEDUP_FP_RATE = 0.001
BLOOM_DEDUP_PERSIST_PATH = "scrapy_researchers/.bloomstate/dedup.bloom"

# ── Downloader middlewares ───────────────────────────────────────
DOWNLOADER_MIDDLEWARES = {
    # DeltaFetch: skip pages already crawled in previous runs (BsdDb3 storage).
    "scrapy_deltafetch.DeltaFetch": 100,
    # Custom middlewares
    "scrapy_researchers.middlewares.PoliteDownloaderMiddleware": 543,
    "scrapy_researchers.middlewares.RetryMiddleware": 550,
}

# DeltaFetch settings
DELTAFETCH_ENABLED = True
DELTAFETCH_DIR = "scrapy_researchers/.deltafetch"
DELTAFETCH_RESET = False  # set True to re-crawl everything

# ── Spider middlewares ───────────────────────────────────────────
# SPIDER_MIDDLEWARES = {
#     # MagicFields disabled: incompatible with Scrapy 2.12+ (BaseItem removed)
#     # "scrapy_magicfields.MagicFieldsMiddleware": 100,
# }
SPIDER_MIDDLEWARES = {}

# MagicFields configuration — adds these fields to every item automatically
MAGIC_FIELDS = {
    "_spider": "$spider:name",
    "_utcnow": "$time",
    "_response_url": "$response:url",
    "_response_status": "$response:status",
}

# ── Pipelines ────────────────────────────────────────────────────
ITEM_PIPELINES = {
    "scrapy_researchers.pipelines.DedupPipeline": 100,
    "scrapy_researchers.pipelines.QualityScoringPipeline": 200,
    "scrapy_researchers.pipelines.ImprovementFeedbackPipeline": 300,
}

# ── Feeds ────────────────────────────────────────────────────────
FEEDS = {
    "data/%(name)s_%(time)s.jsonl": {
        "format": "jsonlines",
        "encoding": "utf-8",
        "store_empty": False,
        "overwrite": False,
    },
}

# ── Extensions ───────────────────────────────────────────────────
EXTENSIONS = {
    # Spidermon — data validation, stats monitoring, and notifications
    "spidermon.contrib.scrapy.extensions.MonitorSuite": 510,
}

# Spidermon settings
SPIDERMON_ENABLED = True
SPIDERMON_MIN_ITEMS = 0  # don't fail on empty crawls (iterative runs may find nothing new)
SPIDERMON_UNWANTED_HTTP_CODES = [400, 403, 404, 407, 429, 500, 502, 503]

# ── HTTP Cache ───────────────────────────────────────────────────
# RFC2616 conditional requests: sends If-Modified-Since / If-None-Match.
# Pages returning 304 Not Modified are served from cache (zero re-download).
HTTPCACHE_ENABLED = True
HTTPCACHE_EXPIRATION_SECS = 3600
HTTPCACHE_DIR = "httpcache"
HTTPCACHE_POLICY = "scrapy.extensions.httpcache.RFC2616Policy"
HTTPCACHE_GZIP = True
HTTPCACHE_IGNORE_HTTP_CODES = [429, 500, 502, 503, 504]

# ── AutoThrottle ─────────────────────────────────────────────────
# Adapts download delay to server response latency.
# Starts conservative, speeds up if the server is responsive.
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 2
AUTOTHROTTLE_TARGET_CONCURRENCY = 1.0
AUTOTHROTTLE_MAX_DELAY = 60
AUTOTHROTTLE_DEBUG = False

# ── Retry ────────────────────────────────────────────────────────
# 429 is first in the list — rate limit responses get retried with backoff.
# RETRY_PRIORITY_ADJUST=-1 deprioritizes retried requests so fresh ones go first.
RETRY_ENABLED = True
RETRY_TIMES = 5
RETRY_HTTP_CODES = [429, 500, 502, 503, 504, 522, 524, 408]
RETRY_PRIORITY_ADJUST = -1

# ── Depth limiting ───────────────────────────────────────────────
# Prevent runaway crawls from following infinite pagination or deep link trees.
DEPTH_LIMIT = 5
DEPTH_STATS_VERBOSE = True

# ── Logging ──────────────────────────────────────────────────────
LOG_LEVEL = "INFO"
LOG_FORMAT = "%(asctime)s [%(name)s] %(levelname)s: %(message)s"
LOG_SHORT_NAMES = True

# ── Scrapy internals ─────────────────────────────────────────────
REQUEST_FINGERPRINTER_IMPLEMENTATION = "2.7"
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"
FEED_EXPORT_ENCODING = "utf-8"
