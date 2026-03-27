"""SSRF (Server-Side Request Forgery) Scanner for Scrapy spiders."""

from __future__ import annotations

import ast
import ipaddress
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import yaml


@dataclass
class SSRFVulnerability:
    """Represents a detected SSRF vulnerability."""
    file: str
    line: int
    severity: str  # "critical", "high", "medium", "low"
    description: str
    code_snippet: str
    vulnerability_type: str  # "hardcoded_ip", "user_input_url", "redirect_follow", "dns_rebinding"


PRIVATE_RANGES = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]

# Patterns that indicate URL construction from user/external input
URL_CONSTRUCTION_PATTERNS = [
    re.compile(r'f["\']https?://\{'),
    re.compile(r'["\']https?://["\']\s*\+\s*'),
    re.compile(r'\.format\s*\(.*url', re.IGNORECASE),
    re.compile(r'%s.*https?://', re.IGNORECASE),
    re.compile(r'urljoin\s*\(.*(?:response|request|input|arg|param)', re.IGNORECASE),
]

# Patterns indicating redirect following
REDIRECT_PATTERNS = [
    re.compile(r'meta_redirect\s*=\s*True', re.IGNORECASE),
    re.compile(r'handle_httpstatus_list.*3\d\d'),
    re.compile(r'dont_redirect\s*=\s*False', re.IGNORECASE),
    re.compile(r'follow_redirects?\s*=\s*True', re.IGNORECASE),
    re.compile(r'response\.follow\s*\(', re.IGNORECASE),
]

# Hardcoded private IP patterns in strings
PRIVATE_IP_PATTERN = re.compile(
    r'(?:https?://)?'
    r'(?:'
    r'127\.\d{1,3}\.\d{1,3}\.\d{1,3}'
    r'|10\.\d{1,3}\.\d{1,3}\.\d{1,3}'
    r'|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}'
    r'|192\.168\.\d{1,3}\.\d{1,3}'
    r'|0\.0\.0\.0'
    r'|localhost'
    r'|\[::1\]'
    r')'
)


def _load_allowlist() -> dict:
    """Load URL allowlist from rules file."""
    rules_path = Path(__file__).parent.parent.parent / "rules" / "url_allowlist.yaml"
    if rules_path.exists():
        with open(rules_path) as f:
            return yaml.safe_load(f)
    return {"allowed_domains": [], "blocked_patterns": []}


class SSRFScanner:
    """Scans spider code for SSRF vulnerabilities."""

    def __init__(self):
        self.allowlist = _load_allowlist()

    def scan_spider(self, spider_path: str) -> list[SSRFVulnerability]:
        """Scan a spider file for SSRF vulnerabilities."""
        vulns: list[SSRFVulnerability] = []
        path = Path(spider_path)

        if not path.exists() or not path.is_file():
            return vulns

        content = path.read_text(encoding="utf-8", errors="replace")
        lines = content.splitlines()

        for i, line in enumerate(lines, start=1):
            stripped = line.strip()
            if stripped.startswith("#"):
                continue

            # Check for hardcoded private IPs
            match = PRIVATE_IP_PATTERN.search(line)
            if match:
                vulns.append(SSRFVulnerability(
                    file=str(path),
                    line=i,
                    severity="critical",
                    description=f"Hardcoded private/internal IP address found: {match.group()}",
                    code_snippet=stripped,
                    vulnerability_type="hardcoded_ip",
                ))

            # Check for URL construction from user input
            for pattern in URL_CONSTRUCTION_PATTERNS:
                if pattern.search(line):
                    vulns.append(SSRFVulnerability(
                        file=str(path),
                        line=i,
                        severity="high",
                        description="URL constructed from potentially untrusted input",
                        code_snippet=stripped,
                        vulnerability_type="user_input_url",
                    ))
                    break

            # Check for redirect following
            for pattern in REDIRECT_PATTERNS:
                if pattern.search(line):
                    vulns.append(SSRFVulnerability(
                        file=str(path),
                        line=i,
                        severity="medium",
                        description="Spider follows redirects, which may lead to internal network access",
                        code_snippet=stripped,
                        vulnerability_type="redirect_follow",
                    ))
                    break

        # AST-based analysis for DNS rebinding potential
        vulns.extend(self._check_dns_rebinding(spider_path, content))

        return vulns

    def _check_dns_rebinding(self, filepath: str, content: str) -> list[SSRFVulnerability]:
        """Check for DNS rebinding potential using AST analysis."""
        vulns: list[SSRFVulnerability] = []
        try:
            tree = ast.parse(content)
        except SyntaxError:
            return vulns

        for node in ast.walk(tree):
            # Look for socket/DNS resolution calls without pinning
            if isinstance(node, ast.Call):
                func_name = ""
                if isinstance(node.func, ast.Attribute):
                    func_name = node.func.attr
                elif isinstance(node.func, ast.Name):
                    func_name = node.func.id

                if func_name in ("getaddrinfo", "gethostbyname", "resolve"):
                    vulns.append(SSRFVulnerability(
                        file=filepath,
                        line=node.lineno,
                        severity="high",
                        description="DNS resolution without pinning detected -- potential DNS rebinding vector",
                        code_snippet=ast.get_source_segment(content, node) or "",
                        vulnerability_type="dns_rebinding",
                    ))

        return vulns

    def scan_url(self, url: str) -> bool:
        """Check if a URL is safe to access. Returns True if safe, False if blocked."""
        try:
            parsed = urlparse(url)
        except Exception:
            return False

        # Block non-http(s) schemes
        if parsed.scheme not in ("http", "https", ""):
            return False

        hostname = parsed.hostname
        if not hostname:
            return False

        # Check against blocked patterns
        for pattern in self.allowlist.get("blocked_patterns", []):
            regex = pattern.replace(".", r"\.").replace("*", ".*")
            if re.match(regex, hostname, re.IGNORECASE):
                return False

        # Check if it resolves to a private IP
        if self._is_private_ip(hostname):
            return False

        # Check against allowlist if it exists and is non-empty
        allowed = self.allowlist.get("allowed_domains", [])
        if allowed:
            for domain in allowed:
                if hostname == domain or hostname.endswith("." + domain):
                    return True
            return False

        return True

    @staticmethod
    def _is_private_ip(hostname: str) -> bool:
        """Check if a hostname is a known private/internal address."""
        if hostname in ("localhost", "0.0.0.0", "::1"):
            return True
        try:
            addr = ipaddress.ip_address(hostname)
            return any(addr in network for network in PRIVATE_RANGES)
        except ValueError:
            return False


if __name__ == "__main__":
    import sys
    scanner = SSRFScanner()
    if len(sys.argv) < 2:
        print("Usage: python -m scanners.python.ssrf_scanner <spider_file>")
        sys.exit(1)
    results = scanner.scan_spider(sys.argv[1])
    for v in results:
        print(f"[{v.severity.upper()}] {v.file}:{v.line} - {v.description}")
        print(f"  Type: {v.vulnerability_type}")
        print(f"  Code: {v.code_snippet}")
        print()
    if not results:
        print("No SSRF vulnerabilities found.")
