"""Headless Chrome page extraction with JavaScript rendering support."""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

logger = logging.getLogger(__name__)


@dataclass
class ExtractionResult:
    """Result of a Chrome-based page extraction."""

    url: str
    title: str = ""
    html: str = ""
    text: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
    links: list[str] = field(default_factory=list)
    images: list[str] = field(default_factory=list)
    scripts_executed: bool = False
    elapsed_seconds: float = 0.0
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "url": self.url,
            "title": self.title,
            "text": self.text,
            "metadata": self.metadata,
            "links": self.links,
            "images": self.images,
            "scripts_executed": self.scripts_executed,
            "elapsed_seconds": self.elapsed_seconds,
            "error": self.error,
        }


class ChromeExtractor:
    """Extract page content using headless Chrome via Selenium or Playwright."""

    def __init__(
        self,
        chrome_path: str | None = None,
        headless: bool = True,
        timeout: int = 30,
        wait_for_js: bool = True,
        user_agent: str | None = None,
        viewport_width: int = 1920,
        viewport_height: int = 1080,
    ) -> None:
        self.chrome_path = chrome_path or os.environ.get("CHROME_PATH")
        self.headless = headless
        self.timeout = timeout
        self.wait_for_js = wait_for_js
        self.viewport_width = viewport_width
        self.viewport_height = viewport_height
        self.user_agent = user_agent or (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        self._driver: Any = None
        self._playwright: Any = None
        self._browser: Any = None
        self._backend: str | None = None

    def _init_selenium(self) -> None:
        """Initialize Selenium WebDriver with Chrome."""
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service

        options = Options()
        if self.headless:
            options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument(f"--window-size={self.viewport_width},{self.viewport_height}")
        options.add_argument(f"--user-agent={self.user_agent}")
        options.add_argument("--disable-blink-features=AutomationControlled")

        if self.chrome_path:
            options.binary_location = self.chrome_path

        service = Service()
        self._driver = webdriver.Chrome(service=service, options=options)
        self._driver.set_page_load_timeout(self.timeout)
        self._backend = "selenium"

    def _init_playwright(self) -> None:
        """Initialize Playwright with Chromium."""
        from playwright.sync_api import sync_playwright

        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(
            headless=self.headless,
            executable_path=self.chrome_path,
        )
        self._backend = "playwright"

    def _ensure_browser(self) -> None:
        """Lazily initialize browser backend, preferring Playwright."""
        if self._backend:
            return
        try:
            self._init_playwright()
            logger.info("Using Playwright backend")
        except (ImportError, Exception):
            self._init_selenium()
            logger.info("Using Selenium backend")

    def extract(self, url: str) -> ExtractionResult:
        """Extract full page content from the given URL.

        Renders JavaScript, waits for dynamic content, then extracts
        text, links, images, and metadata.
        """
        self._ensure_browser()
        start = time.monotonic()
        result = ExtractionResult(url=url)

        try:
            if self._backend == "playwright":
                result = self._extract_playwright(url, result)
            else:
                result = self._extract_selenium(url, result)
            result.scripts_executed = self.wait_for_js
        except Exception as exc:
            logger.error("Extraction failed for %s: %s", url, exc)
            result.error = str(exc)
        finally:
            result.elapsed_seconds = round(time.monotonic() - start, 3)

        return result

    def _extract_playwright(self, url: str, result: ExtractionResult) -> ExtractionResult:
        """Extract using Playwright."""
        page = self._browser.new_page(
            user_agent=self.user_agent,
            viewport={"width": self.viewport_width, "height": self.viewport_height},
        )
        try:
            page.goto(url, timeout=self.timeout * 1000, wait_until="networkidle" if self.wait_for_js else "load")

            if self.wait_for_js:
                self._wait_for_js_playwright(page)

            result.title = page.title()
            result.html = page.content()
            result.text = page.inner_text("body")

            result.metadata = page.evaluate("""() => {
                const metas = {};
                document.querySelectorAll('meta').forEach(m => {
                    const name = m.getAttribute('name') || m.getAttribute('property') || '';
                    const content = m.getAttribute('content') || '';
                    if (name && content) metas[name] = content;
                });
                return metas;
            }""")

            result.links = page.evaluate("""() =>
                [...document.querySelectorAll('a[href]')].map(a => a.href).filter(h => h.startsWith('http'))
            """)

            result.images = page.evaluate("""() =>
                [...document.querySelectorAll('img[src]')].map(img => img.src).filter(s => s.startsWith('http'))
            """)
        finally:
            page.close()

        return result

    def _extract_selenium(self, url: str, result: ExtractionResult) -> ExtractionResult:
        """Extract using Selenium."""
        self._driver.get(url)

        if self.wait_for_js:
            self._wait_for_js_selenium()

        result.title = self._driver.title
        result.html = self._driver.page_source
        result.text = self._driver.find_element("tag name", "body").text

        metas = self._driver.find_elements("css selector", "meta[name], meta[property]")
        for meta in metas:
            name = meta.get_attribute("name") or meta.get_attribute("property") or ""
            content = meta.get_attribute("content") or ""
            if name and content:
                result.metadata[name] = content

        anchors = self._driver.find_elements("css selector", "a[href]")
        for anchor in anchors:
            href = anchor.get_attribute("href")
            if href and href.startswith("http"):
                result.links.append(href)

        imgs = self._driver.find_elements("css selector", "img[src]")
        for img in imgs:
            src = img.get_attribute("src")
            if src and src.startswith("http"):
                result.images.append(src)

        return result

    def _wait_for_js_playwright(self, page: Any, poll_interval: float = 0.5, max_wait: float = 10.0) -> None:
        """Wait for JavaScript-rendered content to stabilize on a Playwright page."""
        previous_height = 0
        waited = 0.0
        while waited < max_wait:
            current_height = page.evaluate("document.body.scrollHeight")
            if current_height == previous_height:
                break
            previous_height = current_height
            page.wait_for_timeout(int(poll_interval * 1000))
            waited += poll_interval

    def _wait_for_js_selenium(self, poll_interval: float = 0.5, max_wait: float = 10.0) -> None:
        """Wait for JavaScript-rendered content to stabilize on a Selenium driver."""
        previous_height = 0
        waited = 0.0
        while waited < max_wait:
            current_height = self._driver.execute_script("return document.body.scrollHeight")
            if current_height == previous_height:
                break
            previous_height = current_height
            time.sleep(poll_interval)
            waited += poll_interval

    def wait_for_js(self, timeout: float = 10.0) -> None:
        """Public method: wait for JS rendering to complete on the current page."""
        if self._backend == "playwright":
            logger.warning("wait_for_js() requires an active page context; use extract() instead")
            return
        if self._backend == "selenium" and self._driver:
            self._wait_for_js_selenium(max_wait=timeout)

    def extract_spa_content(self, url: str, route_selector: str = "body", routes: list[str] | None = None) -> list[ExtractionResult]:
        """Extract content from a Single Page Application across multiple routes.

        Navigates to each route within the SPA and extracts content from the
        specified container selector.
        """
        self._ensure_browser()
        results: list[ExtractionResult] = []

        if routes is None:
            initial = self.extract(url)
            results.append(initial)
            parsed = urlparse(url)
            base = f"{parsed.scheme}://{parsed.netloc}"
            seen = {url}
            for link in initial.links:
                link_parsed = urlparse(link)
                if link_parsed.netloc == parsed.netloc and link not in seen:
                    seen.add(link)
                    if len(seen) > 50:
                        break
                    route_result = self.extract(link)
                    results.append(route_result)
        else:
            for route in routes:
                full_url = urljoin(url, route)
                route_result = self.extract(full_url)
                results.append(route_result)

        return results

    def save_results(self, results: list[ExtractionResult], output_dir: str) -> list[str]:
        """Save extraction results as JSON files."""
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)
        paths = []
        for i, r in enumerate(results):
            slug = urlparse(r.url).path.strip("/").replace("/", "_") or "index"
            filename = f"{slug}_{i}.json"
            filepath = out / filename
            filepath.write_text(json.dumps(r.to_dict(), indent=2, ensure_ascii=False))
            paths.append(str(filepath))
        return paths

    def close(self) -> None:
        """Shut down the browser."""
        if self._backend == "playwright":
            if self._browser:
                self._browser.close()
            if self._playwright:
                self._playwright.stop()
        elif self._backend == "selenium" and self._driver:
            self._driver.quit()
        self._backend = None

    def __enter__(self) -> ChromeExtractor:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
