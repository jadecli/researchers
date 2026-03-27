"""Automated form filling for plugin submissions and login flows."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class FormField:
    """Specification for a single form field."""

    selector: str
    value: str
    field_type: str = "text"  # text, select, checkbox, radio, file, textarea
    wait_after: float = 0.0


@dataclass
class FormResult:
    """Result of a form submission attempt."""

    success: bool = False
    url_after: str = ""
    status_text: str = ""
    errors: list[str] = field(default_factory=list)
    elapsed_seconds: float = 0.0


class FormAutomator:
    """Automate form interactions via headless Chrome (Selenium or Playwright)."""

    def __init__(
        self,
        headless: bool = True,
        timeout: int = 30,
        user_agent: str | None = None,
    ) -> None:
        self.headless = headless
        self.timeout = timeout
        self.user_agent = user_agent or (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        self._driver: Any = None
        self._playwright: Any = None
        self._browser: Any = None
        self._page: Any = None
        self._backend: str | None = None

    def _init_selenium(self) -> None:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service

        options = Options()
        if self.headless:
            options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument(f"--user-agent={self.user_agent}")
        self._driver = webdriver.Chrome(service=Service(), options=options)
        self._driver.set_page_load_timeout(self.timeout)
        self._backend = "selenium"

    def _init_playwright(self) -> None:
        from playwright.sync_api import sync_playwright

        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(headless=self.headless)
        self._page = self._browser.new_page(user_agent=self.user_agent)
        self._backend = "playwright"

    def _ensure_browser(self) -> None:
        if self._backend:
            return
        try:
            self._init_playwright()
            logger.info("FormAutomator: using Playwright")
        except (ImportError, Exception):
            self._init_selenium()
            logger.info("FormAutomator: using Selenium")

    def _fill_field_playwright(self, field: FormField) -> None:
        """Fill a single form field using Playwright."""
        page = self._page

        if field.field_type == "select":
            page.select_option(field.selector, value=field.value)
        elif field.field_type == "checkbox":
            elem = page.locator(field.selector)
            checked = elem.is_checked()
            should_check = field.value.lower() in ("true", "1", "yes")
            if checked != should_check:
                elem.click()
        elif field.field_type == "radio":
            page.click(f'{field.selector}[value="{field.value}"]')
        elif field.field_type == "file":
            page.set_input_files(field.selector, field.value)
        elif field.field_type == "textarea":
            page.fill(field.selector, field.value)
        else:
            page.fill(field.selector, field.value)

        if field.wait_after > 0:
            page.wait_for_timeout(int(field.wait_after * 1000))

    def _fill_field_selenium(self, field: FormField) -> None:
        """Fill a single form field using Selenium."""
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.select import Select

        element = self._driver.find_element(By.CSS_SELECTOR, field.selector)

        if field.field_type == "select":
            Select(element).select_by_value(field.value)
        elif field.field_type == "checkbox":
            checked = element.is_selected()
            should_check = field.value.lower() in ("true", "1", "yes")
            if checked != should_check:
                element.click()
        elif field.field_type == "radio":
            radio = self._driver.find_element(By.CSS_SELECTOR, f'{field.selector}[value="{field.value}"]')
            radio.click()
        elif field.field_type == "file":
            element.send_keys(field.value)
        elif field.field_type == "textarea":
            element.clear()
            element.send_keys(field.value)
        else:
            element.clear()
            element.send_keys(field.value)

        if field.wait_after > 0:
            time.sleep(field.wait_after)

    def _fill_fields(self, fields: list[FormField]) -> list[str]:
        """Fill all form fields; return list of error messages."""
        errors: list[str] = []
        for f in fields:
            try:
                if self._backend == "playwright":
                    self._fill_field_playwright(f)
                else:
                    self._fill_field_selenium(f)
            except Exception as exc:
                msg = f"Failed to fill {f.selector}: {exc}"
                logger.error(msg)
                errors.append(msg)
        return errors

    def _submit_form(self, submit_selector: str) -> None:
        """Click the submit button."""
        if self._backend == "playwright":
            self._page.click(submit_selector)
            self._page.wait_for_load_state("networkidle", timeout=self.timeout * 1000)
        else:
            from selenium.webdriver.common.by import By
            self._driver.find_element(By.CSS_SELECTOR, submit_selector).click()
            time.sleep(2)

    def fill_plugin_submission(
        self,
        submission_url: str,
        plugin_name: str,
        plugin_version: str,
        description: str,
        entry_point: str,
        readme_path: str | None = None,
        archive_path: str | None = None,
        submit_selector: str = 'button[type="submit"]',
    ) -> FormResult:
        """Fill and submit a plugin marketplace submission form.

        Maps standard plugin fields to form selectors. Override selectors
        via the FormField objects for non-standard forms.
        """
        self._ensure_browser()
        start = time.monotonic()
        result = FormResult()

        fields = [
            FormField(selector='input[name="name"], #plugin-name', value=plugin_name),
            FormField(selector='input[name="version"], #plugin-version', value=plugin_version),
            FormField(selector='textarea[name="description"], #plugin-description', value=description, field_type="textarea"),
            FormField(selector='input[name="entry_point"], #entry-point', value=entry_point),
        ]

        if readme_path:
            fields.append(FormField(selector='input[type="file"][name="readme"]', value=readme_path, field_type="file"))
        if archive_path:
            fields.append(FormField(selector='input[type="file"][name="archive"]', value=archive_path, field_type="file"))

        try:
            if self._backend == "playwright":
                self._page.goto(submission_url, timeout=self.timeout * 1000)
            else:
                self._driver.get(submission_url)

            errors = self._fill_fields(fields)
            result.errors.extend(errors)

            if not errors:
                self._submit_form(submit_selector)
                result.success = True
                if self._backend == "playwright":
                    result.url_after = self._page.url
                    result.status_text = self._page.inner_text("body")[:500]
                else:
                    result.url_after = self._driver.current_url
                    result.status_text = self._driver.find_element("tag name", "body").text[:500]
        except Exception as exc:
            result.errors.append(str(exc))
            logger.error("Plugin submission failed: %s", exc)
        finally:
            result.elapsed_seconds = round(time.monotonic() - start, 3)

        return result

    def login_and_extract(
        self,
        login_url: str,
        username: str,
        password: str,
        target_url: str,
        username_selector: str = 'input[name="username"], input[type="email"], #username',
        password_selector: str = 'input[name="password"], input[type="password"], #password',
        submit_selector: str = 'button[type="submit"], input[type="submit"]',
        success_indicator: str = "",
    ) -> dict[str, Any]:
        """Log in to a site and extract content from a protected page.

        Returns a dict with login_success, page_title, page_text, and any errors.
        """
        self._ensure_browser()
        output: dict[str, Any] = {
            "login_success": False,
            "page_title": "",
            "page_text": "",
            "errors": [],
        }

        try:
            if self._backend == "playwright":
                self._page.goto(login_url, timeout=self.timeout * 1000)
            else:
                self._driver.get(login_url)

            login_fields = [
                FormField(selector=username_selector, value=username),
                FormField(selector=password_selector, value=password, field_type="text"),
            ]
            fill_errors = self._fill_fields(login_fields)
            output["errors"].extend(fill_errors)

            if not fill_errors:
                self._submit_form(submit_selector)

                # Check login success
                if self._backend == "playwright":
                    current_url = self._page.url
                    body = self._page.inner_text("body")
                else:
                    current_url = self._driver.current_url
                    body = self._driver.find_element("tag name", "body").text

                if success_indicator:
                    output["login_success"] = success_indicator in body
                else:
                    output["login_success"] = current_url != login_url

                if output["login_success"] and target_url:
                    if self._backend == "playwright":
                        self._page.goto(target_url, timeout=self.timeout * 1000)
                        self._page.wait_for_load_state("networkidle")
                        output["page_title"] = self._page.title()
                        output["page_text"] = self._page.inner_text("body")
                    else:
                        self._driver.get(target_url)
                        time.sleep(2)
                        output["page_title"] = self._driver.title
                        output["page_text"] = self._driver.find_element("tag name", "body").text

        except Exception as exc:
            output["errors"].append(str(exc))
            logger.error("Login and extract failed: %s", exc)

        return output

    def close(self) -> None:
        if self._backend == "playwright":
            if self._page:
                self._page.close()
            if self._browser:
                self._browser.close()
            if self._playwright:
                self._playwright.stop()
        elif self._backend == "selenium" and self._driver:
            self._driver.quit()
        self._backend = None

    def __enter__(self) -> FormAutomator:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
