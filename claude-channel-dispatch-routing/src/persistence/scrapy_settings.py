"""
Scrapy settings fragment for enabling Neon Postgres persistence.

Usage
-----
In your Scrapy project's ``settings.py``::

    from src.persistence.scrapy_settings import NEON_SETTINGS

    DOWNLOADER_MIDDLEWARES.update(NEON_SETTINGS["DOWNLOADER_MIDDLEWARES"])
    HTTPCACHE_STORAGE = NEON_SETTINGS["HTTPCACHE_STORAGE"]
    HTTPCACHE_POLICY  = NEON_SETTINGS["HTTPCACHE_POLICY"]
"""

# Settings to add when using Neon persistence
NEON_SETTINGS = {
    'DOWNLOADER_MIDDLEWARES': {'src.persistence.neon_middleware.NeonDeltaFetchMiddleware': 50},
    'HTTPCACHE_STORAGE': 'src.persistence.neon_middleware.NeonPostgresCacheStorage',
    'HTTPCACHE_POLICY': 'scrapy.extensions.httpcache.RFC2616Policy',
}
