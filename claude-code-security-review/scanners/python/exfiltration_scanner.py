"""Exfiltration Scanner for Scrapy pipelines and middleware."""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class ExfilRisk:
    """Represents a detected data exfiltration risk."""
    file: str
    line: int
    severity: str
    description: str
    code_snippet: str
    risk_type: str  # "outbound_http", "file_write", "subprocess", "socket", "dns_exfil"


# Outbound HTTP patterns
OUTBOUND_HTTP_PATTERNS = [
    re.compile(r'requests\.(get|post|put|patch|delete)\s*\('),
    re.compile(r'urllib\.request\.urlopen\s*\('),
    re.compile(r'http\.client\.HTTP'),
    re.compile(r'httpx\.(get|post|put|patch|delete|AsyncClient|Client)\s*\('),
    re.compile(r'aiohttp\.ClientSession\s*\('),
    re.compile(r'urllib3\.PoolManager\s*\('),
    re.compile(r'treq\.(get|post|put)\s*\('),
]

# File write patterns (outside allowed directories)
FILE_WRITE_PATTERNS = [
    re.compile(r'open\s*\([^)]*["\x27]w'),
    re.compile(r'open\s*\([^)]*["\x27]a'),
    re.compile(r'\.write\s*\('),
    re.compile(r'\.writelines\s*\('),
    re.compile(r'shutil\.(copy|move|copyfile)\s*\('),
    re.compile(r'os\.rename\s*\('),
    re.compile(r'pathlib\.Path\s*\([^)]*\)\.write_'),
]

# Subprocess patterns
SUBPROCESS_PATTERNS = [
    re.compile(r'subprocess\.(call|run|Popen|check_output|check_call)\s*\('),
    re.compile(r'os\.system\s*\('),
    re.compile(r'os\.popen\s*\('),
    re.compile(r'os\.exec[lv]p?\s*\('),
    re.compile(r'os\.spawn[lv]p?e?\s*\('),
    re.compile(r'commands\.getoutput\s*\('),
]

# Socket patterns
SOCKET_PATTERNS = [
    re.compile(r'socket\.socket\s*\('),
    re.compile(r'socket\.create_connection\s*\('),
    re.compile(r'\.connect\s*\(\s*\(["\x27]'),
    re.compile(r'\.sendto\s*\('),
    re.compile(r'\.sendall\s*\('),
    re.compile(r'\.send\s*\('),
]

# Allowed data directories
ALLOWED_DATA_DIRS = {"data/", "output/", "results/", "./data/", "./output/", "./results/"}


class ExfiltrationScanner:
    """Scans pipelines and middleware for data exfiltration risks."""

    def scan_pipeline(self, path: str) -> list[ExfilRisk]:
        """Scan a pipeline file for exfiltration risks."""
        return self._scan_file(path, context="pipeline")

    def scan_middleware(self, path: str) -> list[ExfilRisk]:
        """Scan a middleware file for exfiltration risks."""
        return self._scan_file(path, context="middleware")

    def _scan_file(self, filepath: str, context: str = "pipeline") -> list[ExfilRisk]:
        """Internal method to scan a file for exfiltration risks."""
        risks: list[ExfilRisk] = []
        path = Path(filepath)

        if not path.exists() or not path.is_file():
            return risks

        content = path.read_text(encoding="utf-8", errors="replace")
        lines = content.splitlines()

        for i, line in enumerate(lines, start=1):
            stripped = line.strip()
            if stripped.startswith("#"):
                continue

            # Check outbound HTTP
            for pattern in OUTBOUND_HTTP_PATTERNS:
                if pattern.search(line):
                    risks.append(ExfilRisk(
                        file=str(path),
                        line=i,
                        severity="critical",
                        description=f"Outbound HTTP request detected in {context} -- potential data exfiltration",
                        code_snippet=stripped,
                        risk_type="outbound_http",
                    ))
                    break

            # Check file writes
            for pattern in FILE_WRITE_PATTERNS:
                if pattern.search(line):
                    # Check if writing to an allowed directory
                    if not self._is_allowed_write(line):
                        risks.append(ExfilRisk(
                            file=str(path),
                            line=i,
                            severity="high",
                            description=f"File write outside allowed data directories in {context}",
                            code_snippet=stripped,
                            risk_type="file_write",
                        ))
                    break

            # Check subprocess calls
            for pattern in SUBPROCESS_PATTERNS:
                if pattern.search(line):
                    risks.append(ExfilRisk(
                        file=str(path),
                        line=i,
                        severity="critical",
                        description=f"Subprocess/system call in {context} -- potential command exfiltration",
                        code_snippet=stripped,
                        risk_type="subprocess",
                    ))
                    break

            # Check socket usage
            for pattern in SOCKET_PATTERNS:
                if pattern.search(line):
                    risks.append(ExfilRisk(
                        file=str(path),
                        line=i,
                        severity="critical",
                        description=f"Raw socket usage in {context} -- potential covert data channel",
                        code_snippet=stripped,
                        risk_type="socket",
                    ))
                    break

        # AST-based analysis for import checks
        risks.extend(self._check_suspicious_imports(filepath, content, context))

        return risks

    def _check_suspicious_imports(self, filepath: str, content: str, context: str) -> list[ExfilRisk]:
        """Check for suspicious imports that suggest exfiltration capability."""
        risks: list[ExfilRisk] = []
        try:
            tree = ast.parse(content)
        except SyntaxError:
            return risks

        suspicious_modules = {
            "requests": "HTTP client library",
            "httpx": "HTTP client library",
            "aiohttp": "Async HTTP client library",
            "urllib3": "HTTP client library",
            "smtplib": "SMTP email sending",
            "ftplib": "FTP file transfer",
            "paramiko": "SSH client",
            "boto3": "AWS SDK (cloud access)",
            "google.cloud": "Google Cloud SDK",
        }

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name in suspicious_modules:
                        risks.append(ExfilRisk(
                            file=filepath,
                            line=node.lineno,
                            severity="medium",
                            description=f"Import of {alias.name} ({suspicious_modules[alias.name]}) in {context}",
                            code_snippet=f"import {alias.name}",
                            risk_type="outbound_http",
                        ))
            elif isinstance(node, ast.ImportFrom):
                if node.module and node.module.split(".")[0] in suspicious_modules:
                    mod = node.module.split(".")[0]
                    risks.append(ExfilRisk(
                        file=filepath,
                        line=node.lineno,
                        severity="medium",
                        description=f"Import from {node.module} ({suspicious_modules[mod]}) in {context}",
                        code_snippet=f"from {node.module} import ...",
                        risk_type="outbound_http",
                    ))

        return risks

    @staticmethod
    def _is_allowed_write(line: str) -> bool:
        """Check if a file write targets an allowed data directory."""
        for allowed_dir in ALLOWED_DATA_DIRS:
            if allowed_dir in line:
                return True
        return False


if __name__ == "__main__":
    import sys
    scanner = ExfiltrationScanner()
    if len(sys.argv) < 2:
        print("Usage: python -m scanners.python.exfiltration_scanner <pipeline_or_middleware_file>")
        sys.exit(1)
    target = sys.argv[1]
    results = scanner.scan_pipeline(target)
    for r in results:
        print(f"[{r.severity.upper()}] {r.file}:{r.line} - {r.description}")
        print(f"  Type: {r.risk_type}")
        print(f"  Code: {r.code_snippet}")
        print()
    if not results:
        print("No exfiltration risks found.")
