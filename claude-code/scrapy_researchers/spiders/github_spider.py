"""Spider for crawling GitHub org repos via REST API.

Does NOT clone repos — reads files via gh api to avoid disk usage.
Rate-limited: checks X-RateLimit-Remaining, pauses when low.
Extracts README.md, CLAUDE.md, pyproject.toml/package.json, and key source files.
"""

from __future__ import annotations

import json
import re
import subprocess
import time
from base64 import b64decode
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Generator

import scrapy
from scrapy.http import Response, TextResponse

from scrapy_researchers.spiders.base_spider import BaseResearchSpider


@dataclass
class RateLimiter:
    """Tracks GitHub API rate limit and pauses when low."""
    remaining: int = 5000
    reset_at: float = 0
    min_remaining: int = 100
    delay: float = 0.5

    def wait(self) -> None:
        if self.remaining < self.min_remaining:
            wait_time = max(0, self.reset_at - time.time()) + 5
            print(f"  ⚠ Rate limit low ({self.remaining}), waiting {wait_time:.0f}s")
            time.sleep(wait_time)
        else:
            time.sleep(self.delay)

    def update(self, headers: dict[str, str]) -> None:
        self.remaining = int(headers.get("X-RateLimit-Remaining", self.remaining))
        self.reset_at = float(headers.get("X-RateLimit-Reset", self.reset_at))


class GitHubOrgSpider(BaseResearchSpider):
    """Crawls GitHub org repos via REST API with rate limiting."""

    name = "github_spider"
    custom_settings = {
        "DEPTH_LIMIT": 0,
        "DOWNLOAD_DELAY": 0,
        "CONCURRENT_REQUESTS": 1,
    }

    # Files to fetch from each repo (in priority order)
    TARGET_FILES = [
        "README.md",
        "CLAUDE.md",
        "AGENTS.md",
        "pyproject.toml",
        "package.json",
        "Cargo.toml",
        "go.mod",
        "pom.xml",
        "build.gradle.kts",
    ]

    def __init__(
        self,
        org: str = "anthropics",
        pattern: str = "",
        max_repos: int = 0,
        max_files_per_repo: int = 10,
        round_number: int = 6,
        *args: Any,
        **kwargs: Any,
    ) -> None:
        super().__init__(*args, **kwargs)
        self.org = org
        self.pattern = re.compile(pattern, re.IGNORECASE) if pattern else None
        self.max_repos = int(max_repos)
        self.max_files_per_repo = int(max_files_per_repo)
        self.round_number = int(round_number)
        self.rate_limiter = RateLimiter()
        self.start_urls = [f"https://api.github.com/orgs/{org}/repos?per_page=100&type=public"]

    def _gh_api(self, endpoint: str) -> dict | list | None:
        """Call GitHub API via gh CLI (handles auth automatically)."""
        self.rate_limiter.wait()
        try:
            result = subprocess.run(
                ["gh", "api", endpoint, "--include"],
                capture_output=True, text=True, timeout=30,
            )
            # Parse headers and body
            parts = result.stdout.split("\r\n\r\n", 1)
            if len(parts) == 2:
                headers_str, body = parts
                headers = {}
                for line in headers_str.split("\r\n"):
                    if ": " in line:
                        key, val = line.split(": ", 1)
                        headers[key] = val
                self.rate_limiter.update(headers)
                return json.loads(body) if body.strip() else None
            elif result.stdout.strip():
                return json.loads(result.stdout)
            return None
        except (subprocess.TimeoutExpired, json.JSONDecodeError, Exception) as e:
            self.logger.warning(f"gh api error for {endpoint}: {e}")
            return None

    def _gh_api_simple(self, endpoint: str) -> dict | list | None:
        """Simpler gh api call without header parsing."""
        self.rate_limiter.wait()
        try:
            result = subprocess.run(
                ["gh", "api", endpoint],
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode == 0 and result.stdout.strip():
                return json.loads(result.stdout)
            return None
        except Exception as e:
            self.logger.warning(f"gh api error: {e}")
            return None

    def parse(self, response: Response) -> Generator[dict[str, Any], None, None]:
        """Entry point — list repos then crawl each."""
        # Use gh api instead of scrapy's HTTP (better auth handling)
        repos = self._gh_api_simple(
            f"orgs/{self.org}/repos?per_page=100&type=public&sort=updated"
        )
        if not repos or not isinstance(repos, list):
            self.logger.error(f"Failed to list repos for {self.org}")
            return

        self.logger.info(f"Found {len(repos)} repos in {self.org}/")

        count = 0
        for repo in repos:
            repo_name = repo.get("name", "")

            # Apply pattern filter
            if self.pattern and not self.pattern.search(repo_name):
                continue

            count += 1
            if self.max_repos and count > self.max_repos:
                self.logger.info(f"Reached max_repos={self.max_repos}")
                return

            self.logger.info(f"  [{count}] {self.org}/{repo_name}")
            yield from self._crawl_repo(repo)

        self.logger.info(
            f"Crawl complete: {count} repos, "
            f"rate limit remaining: {self.rate_limiter.remaining}"
        )

    def _crawl_repo(self, repo: dict) -> Generator[dict[str, Any], None, None]:
        """Crawl a single repo — fetch key files."""
        repo_name = repo.get("name", "")
        default_branch = repo.get("default_branch", "main")
        language = repo.get("language") or "unknown"
        stars = repo.get("stargazers_count", 0)
        description = repo.get("description") or ""

        files_fetched = 0

        # Fetch target files
        for filename in self.TARGET_FILES:
            if files_fetched >= self.max_files_per_repo:
                break

            content = self._fetch_file(repo_name, filename, default_branch)
            if content is not None:
                files_fetched += 1
                yield self._build_item(
                    repo_name=repo_name,
                    file_path=filename,
                    content=content,
                    language=language,
                    stars=stars,
                    description=description,
                )

        # Fetch source directory listing for structure analysis
        src_dirs = ["src", "lib", "pkg", "cmd", "internal"]
        for src_dir in src_dirs:
            if files_fetched >= self.max_files_per_repo:
                break

            tree = self._gh_api_simple(
                f"repos/{self.org}/{repo_name}/contents/{src_dir}"
            )
            if tree and isinstance(tree, list):
                # Fetch up to 3 top-level source files
                for entry in tree[:3]:
                    if files_fetched >= self.max_files_per_repo:
                        break
                    if entry.get("type") != "file":
                        continue
                    name = entry.get("name", "")
                    if not any(name.endswith(ext) for ext in
                              [".py", ".ts", ".go", ".rs", ".java", ".rb", ".kt", ".cs", ".swift"]):
                        continue

                    content = self._fetch_file(
                        repo_name, f"{src_dir}/{name}", default_branch
                    )
                    if content is not None:
                        files_fetched += 1
                        yield self._build_item(
                            repo_name=repo_name,
                            file_path=f"{src_dir}/{name}",
                            content=content,
                            language=language,
                            stars=stars,
                            description=description,
                        )
                break  # Only try first found src dir

    def _fetch_file(self, repo_name: str, path: str, branch: str) -> str | None:
        """Fetch a single file's content via GitHub API."""
        data = self._gh_api_simple(
            f"repos/{self.org}/{repo_name}/contents/{path}?ref={branch}"
        )
        if not data or not isinstance(data, dict):
            return None

        content_b64 = data.get("content")
        if not content_b64:
            # File might be too large for API — skip
            return None

        try:
            return b64decode(content_b64).decode("utf-8", errors="replace")
        except Exception:
            return None

    def _build_item(
        self,
        repo_name: str,
        file_path: str,
        content: str,
        language: str,
        stars: int,
        description: str,
    ) -> dict[str, Any]:
        """Build a standardized item from a fetched file."""
        url = f"https://github.com/{self.org}/{repo_name}/blob/main/{file_path}"

        # Determine content type
        is_markdown = file_path.endswith(".md")
        is_config = file_path in ("pyproject.toml", "package.json", "Cargo.toml",
                                    "go.mod", "pom.xml", "build.gradle.kts")

        # Quality scoring
        quality = self._score_quality(content, is_markdown)

        return {
            "url": url,
            "title": f"{self.org}/{repo_name}/{file_path}",
            "content_markdown": content if is_markdown else "",
            "content_raw": content if not is_markdown else "",
            "quality_score": quality,
            "metadata": {
                "source": f"github-{self.org}",
                "org": self.org,
                "repo": repo_name,
                "file_path": file_path,
                "language": language,
                "stars": str(stars),
                "description": description[:200],
                "is_markdown": str(is_markdown),
                "is_config": str(is_config),
                "word_count": str(len(content.split())),
                "line_count": str(content.count("\n") + 1),
            },
            "extraction_timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def _score_quality(self, content: str, is_markdown: bool) -> float:
        """Score content quality."""
        if not content or len(content) < 10:
            return 0.0

        words = len(content.split())
        lines = content.count("\n") + 1

        # Length score
        if words >= 500:
            length_score = 1.0
        elif words >= 100:
            length_score = 0.7
        elif words >= 30:
            length_score = 0.5
        else:
            length_score = 0.3

        if is_markdown:
            headings = content.count("\n#")
            code_blocks = content.count("```") // 2
            links = content.count("](")
            structure = min(1.0, (headings + code_blocks + links) / 10)
            return round(length_score * 0.5 + structure * 0.5, 2)
        else:
            # Code file — score based on meaningful content
            has_imports = "import " in content or "from " in content or "require(" in content
            has_functions = "def " in content or "func " in content or "function " in content or "fn " in content
            has_classes = "class " in content or "struct " in content or "interface " in content
            structure = sum([has_imports, has_functions, has_classes]) / 3.0
            return round(length_score * 0.6 + structure * 0.4, 2)
