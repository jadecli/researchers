"""PII (Personally Identifiable Information) Scanner for crawled data."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import yaml


@dataclass
class PIIMatch:
    """Represents a detected PII match."""
    type: str
    value: str
    location: str  # "file:line" or "content:offset"
    confidence: float


def _load_patterns() -> dict:
    """Load PII patterns from rules file."""
    rules_path = Path(__file__).parent.parent.parent / "rules" / "pii_patterns.yaml"
    if rules_path.exists():
        with open(rules_path) as f:
            return yaml.safe_load(f).get("patterns", {})
    return {}


class PIIScanner:
    """Scans content and files for PII data."""

    def __init__(self):
        raw_patterns = _load_patterns()
        self._patterns: dict[str, tuple[re.Pattern, float]] = {}
        for name, config in raw_patterns.items():
            try:
                self._patterns[name] = (
                    re.compile(config["regex"]),
                    config.get("confidence", 0.5),
                )
            except re.error:
                continue

    def scan_content(self, content: str, source: str = "<string>") -> list[PIIMatch]:
        """Scan a string of content for PII matches."""
        matches: list[PIIMatch] = []
        lines = content.splitlines()

        for line_num, line in enumerate(lines, start=1):
            for pii_type, (pattern, confidence) in self._patterns.items():
                for m in pattern.finditer(line):
                    value = m.group(0)
                    # Apply additional validation to reduce false positives
                    if self._validate_match(pii_type, value):
                        matches.append(PIIMatch(
                            type=pii_type,
                            value=self._redact(value),
                            location=f"{source}:{line_num}",
                            confidence=confidence,
                        ))

        return matches

    def scan_file(self, path: str) -> list[PIIMatch]:
        """Scan a single file for PII."""
        file_path = Path(path)
        if not file_path.exists() or not file_path.is_file():
            return []

        # Skip binary files
        try:
            content = file_path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            return []

        return self.scan_content(content, source=str(file_path))

    def scan_directory(self, path: str, extensions: Optional[set[str]] = None) -> list[PIIMatch]:
        """Recursively scan a directory for PII in all text files."""
        if extensions is None:
            extensions = {
                ".txt", ".csv", ".json", ".jsonl", ".xml", ".html", ".htm",
                ".yaml", ".yml", ".log", ".md", ".py", ".js", ".ts",
            }

        all_matches: list[PIIMatch] = []
        dir_path = Path(path)

        if not dir_path.exists() or not dir_path.is_dir():
            return all_matches

        for root, _dirs, files in os.walk(dir_path):
            # Skip hidden directories and common non-data dirs
            root_path = Path(root)
            if any(part.startswith(".") for part in root_path.parts):
                continue
            if any(part in ("node_modules", "__pycache__", ".git", "venv") for part in root_path.parts):
                continue

            for filename in files:
                file_path = root_path / filename
                if file_path.suffix.lower() in extensions:
                    all_matches.extend(self.scan_file(str(file_path)))

        return all_matches

    @staticmethod
    def _validate_match(pii_type: str, value: str) -> bool:
        """Apply additional validation to reduce false positives."""
        if pii_type == "credit_card":
            # Luhn algorithm check
            digits = re.sub(r"\D", "", value)
            if len(digits) < 13 or len(digits) > 19:
                return False
            total = 0
            reverse_digits = digits[::-1]
            for i, d in enumerate(reverse_digits):
                n = int(d)
                if i % 2 == 1:
                    n *= 2
                    if n > 9:
                        n -= 9
                total += n
            return total % 10 == 0

        if pii_type == "ssn":
            # Filter out obvious non-SSNs
            digits = re.sub(r"\D", "", value)
            if len(digits) != 9:
                return False
            # SSN cannot start with 000, 666, or 9xx
            area = int(digits[:3])
            if area in (0, 666) or area >= 900:
                return False
            return True

        if pii_type == "phone_us":
            digits = re.sub(r"\D", "", value)
            if len(digits) < 10:
                return False
            return True

        if pii_type == "ip_address":
            # Filter out version-like strings (e.g., 1.2.3.4 in version context)
            parts = value.split(".")
            if all(p == "0" for p in parts):
                return False
            return True

        return True

    @staticmethod
    def _redact(value: str) -> str:
        """Partially redact a PII value for safe logging."""
        if len(value) <= 4:
            return "****"
        visible = max(2, len(value) // 4)
        return value[:visible] + "*" * (len(value) - visible * 2) + value[-visible:]


if __name__ == "__main__":
    import sys
    scanner = PIIScanner()
    if len(sys.argv) < 2:
        print("Usage: python -m scanners.python.pii_scanner <file_or_directory>")
        sys.exit(1)
    target = sys.argv[1]
    if os.path.isdir(target):
        results = scanner.scan_directory(target)
    else:
        results = scanner.scan_file(target)
    for m in results:
        print(f"[{m.type}] {m.location} (confidence: {m.confidence:.0%}): {m.value}")
    if not results:
        print("No PII detected.")
