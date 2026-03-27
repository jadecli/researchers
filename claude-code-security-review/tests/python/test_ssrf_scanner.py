"""Tests for the SSRF Scanner."""

import os
import tempfile

import pytest

from scanners.python.ssrf_scanner import SSRFScanner, SSRFVulnerability


@pytest.fixture
def scanner():
    return SSRFScanner()


@pytest.fixture
def spider_with_private_ips(tmp_path):
    code = (
        "import scrapy\n"
        "\n"
        "class BadSpider(scrapy.Spider):\n"
        "    name = \"bad_spider\"\n"
        "    start_urls = [\"http://127.0.0.1:8080/admin\"]\n"
        "\n"
        "    def parse(self, response):\n"
        "        yield scrapy.Request(\"http://10.0.0.5/internal-api\")\n"
        "        yield scrapy.Request(\"http://192.168.1.1/router\")\n"
        "        yield scrapy.Request(\"http://172.16.0.1/data\")\n"
    )
    f = tmp_path / "bad_spider.py"
    f.write_text(code)
    return str(f)


@pytest.fixture
def spider_with_user_input_url(tmp_path):
    code = (
        "import scrapy\n"
        "\n"
        "class DynamicSpider(scrapy.Spider):\n"
        "    name = \"dynamic\"\n"
        "\n"
        "    def parse(self, response):\n"
        "        user_url = response.meta.get(\"target\")\n"
        '        yield scrapy.Request(f"https://{user_url}/api/data")\n'
    )
    f = tmp_path / "dynamic_spider.py"
    f.write_text(code)
    return str(f)


@pytest.fixture
def spider_with_redirects(tmp_path):
    code = (
        "import scrapy\n"
        "\n"
        "class RedirectSpider(scrapy.Spider):\n"
        "    name = \"redirect_spider\"\n"
        "\n"
        "    def parse(self, response):\n"
        '        next_url = response.css("a::attr(href)").get()\n'
        "        yield response.follow(next_url)\n"
    )
    f = tmp_path / "redirect_spider.py"
    f.write_text(code)
    return str(f)


@pytest.fixture
def safe_spider(tmp_path):
    code = (
        "import scrapy\n"
        "\n"
        "class SafeSpider(scrapy.Spider):\n"
        "    name = \"safe_spider\"\n"
        "    allowed_domains = [\"example.com\"]\n"
        "    start_urls = [\"https://example.com/products\"]\n"
        "\n"
        "    def parse(self, response):\n"
        "        for product in response.css(\"div.product\"):\n"
        "            yield {\"name\": product.css(\"h2::text\").get()}\n"
    )
    f = tmp_path / "safe_spider.py"
    f.write_text(code)
    return str(f)


class TestSSRFScanner:
    def test_detects_private_ips(self, scanner, spider_with_private_ips):
        vulns = scanner.scan_spider(spider_with_private_ips)
        ip_vulns = [v for v in vulns if v.vulnerability_type == "hardcoded_ip"]
        assert len(ip_vulns) >= 4

    def test_allows_public_urls(self, scanner, safe_spider):
        vulns = scanner.scan_spider(safe_spider)
        ip_vulns = [v for v in vulns if v.vulnerability_type == "hardcoded_ip"]
        assert len(ip_vulns) == 0

    def test_catches_user_input_url(self, scanner, spider_with_user_input_url):
        vulns = scanner.scan_spider(spider_with_user_input_url)
        input_vulns = [v for v in vulns if v.vulnerability_type == "user_input_url"]
        assert len(input_vulns) >= 1

    def test_catches_redirect_follow(self, scanner, spider_with_redirects):
        vulns = scanner.scan_spider(spider_with_redirects)
        redirect_vulns = [v for v in vulns if v.vulnerability_type == "redirect_follow"]
        assert len(redirect_vulns) >= 1

    def test_scan_url_allows_public(self, scanner):
        assert scanner.scan_url("https://github.com/user/repo") is True
        assert scanner.scan_url("https://anthropic.com/research") is True

    def test_scan_url_blocks_private(self, scanner):
        assert scanner.scan_url("http://127.0.0.1") is False
        assert scanner.scan_url("http://10.0.0.1/api") is False
        assert scanner.scan_url("http://192.168.1.1") is False
        assert scanner.scan_url("http://172.16.0.1") is False
        assert scanner.scan_url("http://localhost:8080") is False
        assert scanner.scan_url("http://0.0.0.0") is False

    def test_scan_url_blocks_internal_domains(self, scanner):
        assert scanner.scan_url("http://app.internal.corp") is False
        assert scanner.scan_url("http://server.local") is False
        assert scanner.scan_url("http://db.corp.net") is False

    def test_scan_url_validates_allowlist(self, scanner):
        assert scanner.scan_url("https://docs.anthropic.com/guide") is True
        assert scanner.scan_url("https://pypi.org/project/scrapy") is True
        assert scanner.scan_url("https://evil-site.example.net") is False

    def test_nonexistent_file(self, scanner):
        vulns = scanner.scan_spider("/nonexistent/spider.py")
        assert vulns == []

    def test_scan_url_rejects_bad_schemes(self, scanner):
        assert scanner.scan_url("ftp://example.com") is False
        assert scanner.scan_url("file:///etc/passwd") is False
