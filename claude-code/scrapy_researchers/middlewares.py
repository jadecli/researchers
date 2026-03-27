"""Custom Scrapy middlewares for polite crawling and smart retrying."""

from __future__ import annotations

import random
import time
from typing import Any

from scrapy import Request, Spider, signals
from scrapy.crawler import Crawler
from scrapy.exceptions import IgnoreRequest
from scrapy.http import Response


class PoliteDownloaderMiddleware:
    """Respects robots.txt delays and adds random jitter to avoid detection."""

    def __init__(self, base_delay: float = 1.5, jitter_range: float = 1.0) -> None:
        self.base_delay = base_delay
        self.jitter_range = jitter_range
        self.last_request_time: dict[str, float] = {}

    @classmethod
    def from_crawler(cls, crawler: Crawler) -> "PoliteDownloaderMiddleware":
        base_delay = crawler.settings.getfloat("DOWNLOAD_DELAY", 1.5)
        jitter_range = crawler.settings.getfloat("POLITE_JITTER_RANGE", 1.0)
        middleware = cls(base_delay=base_delay, jitter_range=jitter_range)
        crawler.signals.connect(middleware.spider_opened, signal=signals.spider_opened)
        return middleware

    def spider_opened(self, spider: Spider) -> None:
        spider.logger.info(
            f"PoliteDownloaderMiddleware: base_delay={self.base_delay}s, "
            f"jitter_range={self.jitter_range}s"
        )

    def process_request(self, request: Request, spider: Spider) -> None:
        domain = self._get_domain(request.url)
        now = time.monotonic()

        if domain in self.last_request_time:
            elapsed = now - self.last_request_time[domain]
            required_delay = self.base_delay + random.uniform(0, self.jitter_range)

            if elapsed < required_delay:
                wait_time = required_delay - elapsed
                spider.logger.debug(
                    f"Polite delay: waiting {wait_time:.2f}s for {domain}"
                )
                time.sleep(wait_time)

        self.last_request_time[domain] = time.monotonic()

    def process_response(
        self, request: Request, response: Response, spider: Spider
    ) -> Response:
        return response

    def process_exception(
        self, request: Request, exception: Exception, spider: Spider
    ) -> None:
        spider.logger.warning(
            f"PoliteDownloaderMiddleware exception for {request.url}: {exception}"
        )

    def _get_domain(self, url: str) -> str:
        from urllib.parse import urlparse

        parsed = urlparse(url)
        return parsed.netloc


class RetryMiddleware:
    """Exponential backoff retry middleware."""

    def __init__(
        self,
        max_retries: int = 3,
        base_backoff: float = 2.0,
        retry_http_codes: set[int] | None = None,
    ) -> None:
        self.max_retries = max_retries
        self.base_backoff = base_backoff
        self.retry_http_codes = retry_http_codes or {500, 502, 503, 504, 408, 429}

    @classmethod
    def from_crawler(cls, crawler: Crawler) -> "RetryMiddleware":
        max_retries = crawler.settings.getint("RETRY_TIMES", 3)
        base_backoff = crawler.settings.getfloat("RETRY_BACKOFF_BASE", 2.0)
        retry_codes = set(
            crawler.settings.getlist("RETRY_HTTP_CODES", [500, 502, 503, 504, 408, 429])
        )
        middleware = cls(
            max_retries=max_retries,
            base_backoff=base_backoff,
            retry_http_codes=retry_codes,
        )
        crawler.signals.connect(middleware.spider_opened, signal=signals.spider_opened)
        return middleware

    def spider_opened(self, spider: Spider) -> None:
        spider.logger.info(
            f"RetryMiddleware: max_retries={self.max_retries}, "
            f"base_backoff={self.base_backoff}s, codes={self.retry_http_codes}"
        )

    def process_response(
        self, request: Request, response: Response, spider: Spider
    ) -> Response | Request:
        if response.status in self.retry_http_codes:
            return self._retry_or_drop(request, spider, response.status)
        return response

    def process_exception(
        self, request: Request, exception: Exception, spider: Spider
    ) -> Request | None:
        spider.logger.warning(f"RetryMiddleware: exception for {request.url}: {exception}")
        return self._retry_or_drop(request, spider, reason=str(exception))

    def _retry_or_drop(
        self, request: Request, spider: Spider, reason: Any = None
    ) -> Request | None:
        retry_count = request.meta.get("retry_count", 0)

        if retry_count >= self.max_retries:
            spider.logger.warning(
                f"Gave up retrying {request.url} after {retry_count} attempts "
                f"(reason: {reason})"
            )
            return None

        retry_count += 1
        backoff = self.base_backoff ** retry_count + random.uniform(0, 1)

        spider.logger.info(
            f"Retrying {request.url} (attempt {retry_count}/{self.max_retries}, "
            f"backoff {backoff:.1f}s, reason: {reason})"
        )

        time.sleep(backoff)

        new_request = request.copy()
        new_request.meta["retry_count"] = retry_count
        new_request.dont_filter = True
        return new_request
