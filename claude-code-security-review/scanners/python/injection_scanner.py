"""Injection Scanner for Scrapy spider selectors and pipelines."""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class InjectionRisk:
    """Represents a detected injection risk."""
    file: str
    line: int
    severity: str  # "critical", "high", "medium", "low"
    description: str
    code_snippet: str
    risk_type: str  # "fstring_selector", "unsanitized_xpath", "unsanitized_css", "eval_result", "sql_injection", "command_injection"


# Patterns for f-string selectors with external input
FSTRING_SELECTOR_PATTERNS = [
    re.compile(r'\.xpath\s*\(\s*f["\x27]'),
    re.compile(r'\.css\s*\(\s*f["\x27]'),
    re.compile(r'\.xpath\s*\(\s*["\x27].*%s'),
    re.compile(r'\.css\s*\(\s*["\x27].*%s'),
    re.compile(r'\.xpath\s*\(\s*["\x27].*\.format\s*\('),
    re.compile(r'\.css\s*\(\s*["\x27].*\.format\s*\('),
]

# Patterns for unsanitized selector construction
UNSANITIZED_XPATH = [
    re.compile(r'\.xpath\s*\([^)]*\+\s*(?![\x27"])'),
    re.compile(r'\.xpath\s*\(\s*(?:response|request|item|arg|param|input)'),
]

UNSANITIZED_CSS = [
    re.compile(r'\.css\s*\([^)]*\+\s*(?![\x27"])'),
    re.compile(r'\.css\s*\(\s*(?:response|request|item|arg|param|input)'),
]

# Eval of selector results
EVAL_PATTERNS = [
    re.compile(r'eval\s*\(\s*.*\.(?:xpath|css|get|getall|extract)'),
    re.compile(r'exec\s*\(\s*.*\.(?:xpath|css|get|getall|extract)'),
    re.compile(r'compile\s*\(\s*.*\.(?:xpath|css|get|getall|extract)'),
]

# Pipeline injection patterns
SQL_INJECTION_PATTERNS = [
    re.compile(r'(?:execute|cursor\.execute)\s*\(\s*f["\x27]'),
    re.compile(r'(?:execute|cursor\.execute)\s*\(\s*["\x27].*%s'),
    re.compile(r'(?:execute|cursor\.execute)\s*\(\s*["\x27].*\.format\s*\('),
    re.compile(r'(?:execute|cursor\.execute)\s*\(\s*["\x27].*\+\s*(?:item|response|str\()'),
]

COMMAND_INJECTION_PATTERNS = [
    re.compile(r'os\.system\s*\(\s*f["\x27]'),
    re.compile(r'os\.system\s*\(\s*["\x27].*%s'),
    re.compile(r'os\.popen\s*\(\s*f["\x27]'),
    re.compile(r'subprocess\.\w+\s*\([^)]*shell\s*=\s*True'),
    re.compile(r'subprocess\.call\s*\(\s*f["\x27]'),
]


class InjectionScanner:
    """Scans spider code and pipelines for injection vulnerabilities."""

    def scan_selectors(self, spider_path: str) -> list[InjectionRisk]:
        """Scan a spider file for injection risks in CSS/XPath selectors."""
        risks: list[InjectionRisk] = []
        path = Path(spider_path)

        if not path.exists() or not path.is_file():
            return risks

        content = path.read_text(encoding="utf-8", errors="replace")
        lines = content.splitlines()

        for i, line in enumerate(lines, start=1):
            stripped = line.strip()
            if stripped.startswith("#"):
                continue

            # Check f-string selectors
            for pattern in FSTRING_SELECTOR_PATTERNS:
                if pattern.search(line):
                    risks.append(InjectionRisk(
                        file=str(path),
                        line=i,
                        severity="high",
                        description="Selector built with f-string or format string using potentially untrusted input",
                        code_snippet=stripped,
                        risk_type="fstring_selector",
                    ))
                    break

            # Check unsanitized xpath
            for pattern in UNSANITIZED_XPATH:
                if pattern.search(line):
                    risks.append(InjectionRisk(
                        file=str(path),
                        line=i,
                        severity="high",
                        description="XPath selector constructed with unsanitized external input",
                        code_snippet=stripped,
                        risk_type="unsanitized_xpath",
                    ))
                    break

            # Check unsanitized css
            for pattern in UNSANITIZED_CSS:
                if pattern.search(line):
                    risks.append(InjectionRisk(
                        file=str(path),
                        line=i,
                        severity="high",
                        description="CSS selector constructed with unsanitized external input",
                        code_snippet=stripped,
                        risk_type="unsanitized_css",
                    ))
                    break

            # Check eval of selector results
            for pattern in EVAL_PATTERNS:
                if pattern.search(line):
                    risks.append(InjectionRisk(
                        file=str(path),
                        line=i,
                        severity="critical",
                        description="Eval/exec called on selector results -- code execution from crawled data",
                        code_snippet=stripped,
                        risk_type="eval_result",
                    ))
                    break

        # AST-based deeper analysis
        risks.extend(self._ast_analysis(spider_path, content))

        return risks

    def scan_pipeline(self, pipeline_path: str) -> list[InjectionRisk]:
        """Scan a pipeline file for injection risks."""
        risks: list[InjectionRisk] = []
        path = Path(pipeline_path)

        if not path.exists() or not path.is_file():
            return risks

        content = path.read_text(encoding="utf-8", errors="replace")
        lines = content.splitlines()

        for i, line in enumerate(lines, start=1):
            stripped = line.strip()
            if stripped.startswith("#"):
                continue

            # SQL injection
            for pattern in SQL_INJECTION_PATTERNS:
                if pattern.search(line):
                    risks.append(InjectionRisk(
                        file=str(path),
                        line=i,
                        severity="critical",
                        description="SQL query built with string interpolation from item data",
                        code_snippet=stripped,
                        risk_type="sql_injection",
                    ))
                    break

            # Command injection
            for pattern in COMMAND_INJECTION_PATTERNS:
                if pattern.search(line):
                    risks.append(InjectionRisk(
                        file=str(path),
                        line=i,
                        severity="critical",
                        description="OS command constructed with untrusted input",
                        code_snippet=stripped,
                        risk_type="command_injection",
                    ))
                    break

        return risks

    def _ast_analysis(self, filepath: str, content: str) -> list[InjectionRisk]:
        """Perform AST-based analysis for deeper injection detection."""
        risks: list[InjectionRisk] = []
        try:
            tree = ast.parse(content)
        except SyntaxError:
            return risks

        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                # Check for eval/exec with selector-like arguments
                func_name = ""
                if isinstance(node.func, ast.Name):
                    func_name = node.func.id
                elif isinstance(node.func, ast.Attribute):
                    func_name = node.func.attr

                if func_name in ("eval", "exec", "compile"):
                    # Check if arguments involve response/selector data
                    for arg in node.args:
                        src = ast.get_source_segment(content, arg) or ""
                        if any(kw in src for kw in ("response", "selector", "xpath", "css", "extract", "get")):
                            risks.append(InjectionRisk(
                                file=filepath,
                                line=node.lineno,
                                severity="critical",
                                description=f"{func_name}() called with data derived from crawled content",
                                code_snippet=ast.get_source_segment(content, node) or "",
                                risk_type="eval_result",
                            ))

        return risks


if __name__ == "__main__":
    import sys
    scanner = InjectionScanner()
    if len(sys.argv) < 2:
        print("Usage: python -m scanners.python.injection_scanner <spider_or_pipeline_file>")
        sys.exit(1)
    target = sys.argv[1]
    selector_risks = scanner.scan_selectors(target)
    pipeline_risks = scanner.scan_pipeline(target)
    all_risks = selector_risks + pipeline_risks
    for r in all_risks:
        print(f"[{r.severity.upper()}] {r.file}:{r.line} - {r.description}")
        print(f"  Type: {r.risk_type}")
        print(f"  Code: {r.code_snippet}")
        print()
    if not all_risks:
        print("No injection risks found.")
