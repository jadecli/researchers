"""Spider for crawling Spotify GitHub org — modern statistical & measurement packages.

Targets repos focused on statistics, experimentation, A/B testing, metrics,
and data infrastructure. Supports A/B experiment variants via the
`variant` parameter for split-testing crawl strategies.

Variant strategies (inspired by Claude API cookbook patterns):
- control: Standard sequential crawl, one API call per file
- thinking: Deeper analysis — fetches DEEP_FILES for richer context
- tool_search: Targeted file discovery — fetches tree first, cherry-picks
  only stat-relevant source files (reduces wasted API calls)
- ptc: Batch fetching — uses git tree API to fetch entire repo tree in one
  call, then selectively decodes files (minimizes total API round-trips)

Uses the same gh api approach as GitHubOrgSpider but with Spotify-specific
target files and package category classification. Emits live tool_call_made
signals for precise per-window efficiency tracking.
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
from scrapy.http import Response

from scrapy_researchers.metrics.efficiency_tracker import tool_call_made
from scrapy_researchers.spiders.base_spider import BaseResearchSpider


# Package categories for modern stat/measurement libraries
STAT_PACKAGE_CATEGORIES = [
    "experimentation",     # A/B testing, causal inference
    "metrics",             # Metrics collection, time series
    "statistics",          # Statistical analysis, hypothesis testing
    "data-quality",        # Data validation, profiling
    "feature-engineering", # Feature stores, transformations
    "ml-evaluation",       # Model evaluation, fairness metrics
    "observability",       # Distributed tracing, logging
    "streaming",           # Real-time data processing
]

# Keywords that signal a repo is relevant to statistics/measurement
STAT_KEYWORDS = re.compile(
    r"(?i)(statistic|metric|experiment|a/b\s*test|hypothesis|"
    r"confidence|p-value|sample|variance|bayesian|"
    r"causal|treatment|control\s*group|uplift|"
    r"measure|observ|telemetry|monitor|"
    r"feature\s*store|data\s*quality|profil|"
    r"time\s*series|anomaly\s*detect|streaming)"
)


@dataclass
class SpotifyRateLimiter:
    """Rate limiter for GitHub API with Spotify-specific defaults."""

    remaining: int = 5000
    reset_at: float = 0
    min_remaining: int = 100
    delay: float = 0.5

    def wait(self) -> None:
        if self.remaining < self.min_remaining:
            wait_time = max(0, self.reset_at - time.time()) + 5
            print(f"  Rate limit low ({self.remaining}), waiting {wait_time:.0f}s")
            time.sleep(wait_time)
        else:
            time.sleep(self.delay)

    def update(self, headers: dict[str, str]) -> None:
        self.remaining = int(headers.get("X-RateLimit-Remaining", self.remaining))
        self.reset_at = float(headers.get("X-RateLimit-Reset", self.reset_at))


class SpotifyStatsSpider(BaseResearchSpider):
    """Crawls Spotify GitHub org for statistical and measurement packages.

    Supports A/B experiment variants via the `variant` parameter:
    - control: Standard crawl, no special tool strategy
    - thinking: Simulates extended thinking approach (deeper file analysis)
    - tool_search: Simulates tool search approach (targeted file discovery)
    - ptc: Simulates PTC approach (batch file fetching)

    Usage:
        scrapy crawl spotify_stats -a variant=control
        scrapy crawl spotify_stats -a variant=ptc -a max_repos=50
    """

    name = "spotify_stats"
    custom_settings = {
        "DEPTH_LIMIT": 0,
        "DOWNLOAD_DELAY": 0,
        "CONCURRENT_REQUESTS": 1,
    }

    # Files to fetch for stat/measurement analysis
    TARGET_FILES = [
        "README.md",
        "CLAUDE.md",
        "pyproject.toml",
        "setup.py",
        "setup.cfg",
        "package.json",
        "Cargo.toml",
        "go.mod",
        "pom.xml",
        "build.gradle.kts",
        "requirements.txt",
        "poetry.lock",
    ]

    # Additional files for deeper analysis (thinking/ptc variants)
    DEEP_FILES = [
        "docs/index.md",
        "docs/README.md",
        "CONTRIBUTING.md",
        "CHANGELOG.md",
        "examples/README.md",
    ]

    def __init__(
        self,
        org: str = "spotify",
        variant: str = "control",
        max_repos: int = 0,
        max_files_per_repo: int = 12,
        category_filter: str = "",
        experiment_id: str = "",
        round_number: int = 11,
        *args: Any,
        **kwargs: Any,
    ) -> None:
        super().__init__(*args, **kwargs)
        self.org = org
        self.variant = variant
        self.max_repos = int(max_repos)
        self.max_files_per_repo = int(max_files_per_repo)
        self.category_filter = category_filter
        self.experiment_id = experiment_id
        self.round_number = int(round_number)
        self.rate_limiter = SpotifyRateLimiter()
        self.start_urls = [
            f"https://api.github.com/orgs/{org}/repos?per_page=100&type=public"
        ]
        # Variant-specific metrics
        self._tool_calls = 0
        self._pages_crawled = 0
        self._variant_start = time.monotonic()

    def _gh_api(self, endpoint: str) -> dict | list | None:
        """Call GitHub API via gh CLI. Emits tool_call_made signal for live tracking."""
        self.rate_limiter.wait()
        self._tool_calls += 1
        # Emit live signal for EfficiencyTracker per-window attribution
        if self.crawler:
            self.crawler.signals.send_catch_log(tool_call_made, spider=self)
        try:
            result = subprocess.run(
                ["gh", "api", endpoint],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode == 0 and result.stdout.strip():
                return json.loads(result.stdout)
            return None
        except Exception as e:
            self.logger.warning(f"gh api error for {endpoint}: {e}")
            return None

    def parse(self, response: Response) -> Generator[dict[str, Any], None, None]:
        """Entry point: list repos, filter for stat/measurement packages, crawl."""
        # Fetch all pages of repos
        all_repos: list[dict] = []
        page = 1
        while True:
            repos = self._gh_api(
                f"orgs/{self.org}/repos?per_page=100&type=public&sort=updated&page={page}"
            )
            if not repos or not isinstance(repos, list) or len(repos) == 0:
                break
            all_repos.extend(repos)
            page += 1
            if len(repos) < 100:
                break

        self.logger.info(f"Found {len(all_repos)} total repos in {self.org}/")

        # Filter for stat/measurement relevance
        relevant_repos = self._filter_stat_repos(all_repos)
        self.logger.info(
            f"Filtered to {len(relevant_repos)} stat/measurement repos"
        )

        count = 0
        for repo, category in relevant_repos:
            count += 1
            if self.max_repos and count > self.max_repos:
                self.logger.info(f"Reached max_repos={self.max_repos}")
                break

            repo_name = repo.get("name", "")
            self.logger.info(
                f"  [{count}] {self.org}/{repo_name} (category: {category})"
            )
            yield from self._crawl_repo(repo, category)

        # Emit variant metrics as final item
        yield self._build_variant_metrics()

    def _filter_stat_repos(
        self, repos: list[dict]
    ) -> list[tuple[dict, str]]:
        """Filter repos for statistical/measurement relevance."""
        relevant: list[tuple[dict, str]] = []

        for repo in repos:
            name = repo.get("name", "").lower()
            desc = (repo.get("description") or "").lower()
            topics = [t.lower() for t in repo.get("topics", [])]
            language = (repo.get("language") or "").lower()

            combined = f"{name} {desc} {' '.join(topics)}"

            # Category classification
            category = self._classify_category(combined, topics)
            if not category:
                continue

            # Apply category filter if specified
            if self.category_filter and category != self.category_filter:
                continue

            relevant.append((repo, category))

        # Sort by stars (most popular first)
        relevant.sort(key=lambda x: x[0].get("stargazers_count", 0), reverse=True)
        return relevant

    def _classify_category(
        self, combined_text: str, topics: list[str]
    ) -> str | None:
        """Classify a repo into a stat/measurement category."""
        # Direct topic matches
        topic_set = set(topics)
        topic_categories = {
            "experimentation": {"ab-testing", "experiment", "experimentation", "causal-inference"},
            "metrics": {"metrics", "monitoring", "telemetry", "observability"},
            "statistics": {"statistics", "statistical-analysis", "hypothesis-testing", "bayesian"},
            "data-quality": {"data-quality", "data-validation", "profiling", "data-testing"},
            "feature-engineering": {"feature-store", "feature-engineering", "ml-features"},
            "ml-evaluation": {"ml-evaluation", "model-evaluation", "fairness", "bias-detection"},
            "observability": {"tracing", "distributed-tracing", "logging", "apm"},
            "streaming": {"streaming", "real-time", "stream-processing", "kafka"},
        }

        for cat, keywords in topic_categories.items():
            if topic_set & keywords:
                return cat

        # Keyword-based classification from name + description
        if STAT_KEYWORDS.search(combined_text):
            # More specific classification
            if any(w in combined_text for w in ["experiment", "a/b", "treatment", "control group"]):
                return "experimentation"
            if any(w in combined_text for w in ["metric", "monitor", "telemetry"]):
                return "metrics"
            if any(w in combined_text for w in ["statistic", "hypothesis", "p-value", "bayesian"]):
                return "statistics"
            if any(w in combined_text for w in ["data quality", "profil", "valid"]):
                return "data-quality"
            if any(w in combined_text for w in ["feature store", "feature eng"]):
                return "feature-engineering"
            if any(w in combined_text for w in ["time series", "anomal"]):
                return "metrics"
            return "statistics"  # default stat category

        return None

    def _crawl_repo(
        self, repo: dict, category: str
    ) -> Generator[dict[str, Any], None, None]:
        """Crawl a single repo with variant-specific strategy.

        Variant strategies:
        - control: Sequential file-by-file fetch (TARGET_FILES only)
        - thinking: Deeper analysis (TARGET_FILES + DEEP_FILES)
        - tool_search: Fetch repo tree first, cherry-pick stat-relevant files
          (1 tree call instead of N miss calls)
        - ptc: Batch fetch via recursive tree API — 1 API call for full tree,
          then decode blobs for matching files (minimizes round-trips)
        """
        repo_name = repo.get("name", "")
        default_branch = repo.get("default_branch", "main")
        language = repo.get("language") or "unknown"
        stars = repo.get("stargazers_count", 0)
        description = repo.get("description") or ""
        topics = repo.get("topics", [])

        # PTC variant: batch fetch entire tree in 1 API call
        if self.variant == "ptc":
            yield from self._crawl_repo_ptc(
                repo_name, default_branch, language, stars,
                description, category, topics,
            )
            return

        # tool_search variant: targeted tree + selective fetch
        if self.variant == "tool_search":
            yield from self._crawl_repo_tool_search(
                repo_name, default_branch, language, stars,
                description, category, topics,
            )
            return

        # control / thinking: sequential file-by-file
        files_fetched = 0
        target_files = list(self.TARGET_FILES)
        if self.variant == "thinking":
            target_files.extend(self.DEEP_FILES)

        for filename in target_files:
            if files_fetched >= self.max_files_per_repo:
                break

            content = self._fetch_file(repo_name, filename, default_branch)
            if content is not None:
                files_fetched += 1
                self._pages_crawled += 1
                yield self._build_item(
                    repo_name=repo_name,
                    file_path=filename,
                    content=content,
                    language=language,
                    stars=stars,
                    description=description,
                    category=category,
                    topics=topics,
                )

    def _crawl_repo_ptc(
        self,
        repo_name: str,
        default_branch: str,
        language: str,
        stars: int,
        description: str,
        category: str,
        topics: list[str],
    ) -> Generator[dict[str, Any], None, None]:
        """PTC strategy: 1 recursive tree call, then selective blob fetches.

        Inspired by Programmatic Tool Calling cookbook — minimize round-trips
        by fetching the full tree in one call, then only fetching blobs for
        files we actually want. Saves N-1 API calls for repos where most
        TARGET_FILES don't exist.
        """
        # 1 API call: get recursive tree
        tree_data = self._gh_api(
            f"repos/{self.org}/{repo_name}/git/trees/{default_branch}?recursive=1"
        )
        if not tree_data or not isinstance(tree_data, dict):
            return

        tree_entries = tree_data.get("tree", [])
        # Build path→sha index
        path_index: dict[str, str] = {}
        for entry in tree_entries:
            if entry.get("type") == "blob":
                path_index[entry["path"]] = entry["sha"]

        # Determine which files to fetch
        all_targets = list(self.TARGET_FILES) + list(self.DEEP_FILES)
        # Also add stat-relevant source files from tree
        stat_source_files = self._find_stat_relevant_files(tree_entries)

        files_fetched = 0
        # Fetch target files first (by blob SHA — avoids contents API overhead)
        for filename in all_targets:
            if files_fetched >= self.max_files_per_repo:
                break
            sha = path_index.get(filename)
            if not sha:
                continue
            content = self._fetch_blob(repo_name, sha)
            if content is not None:
                files_fetched += 1
                self._pages_crawled += 1
                yield self._build_item(
                    repo_name=repo_name,
                    file_path=filename,
                    content=content,
                    language=language,
                    stars=stars,
                    description=description,
                    category=category,
                    topics=topics,
                )

        # Then fetch stat-relevant source files
        for filepath, sha in stat_source_files:
            if files_fetched >= self.max_files_per_repo:
                break
            content = self._fetch_blob(repo_name, sha)
            if content is not None:
                files_fetched += 1
                self._pages_crawled += 1
                yield self._build_item(
                    repo_name=repo_name,
                    file_path=filepath,
                    content=content,
                    language=language,
                    stars=stars,
                    description=description,
                    category=category,
                    topics=topics,
                )

    def _crawl_repo_tool_search(
        self,
        repo_name: str,
        default_branch: str,
        language: str,
        stars: int,
        description: str,
        category: str,
        topics: list[str],
    ) -> Generator[dict[str, Any], None, None]:
        """Tool search strategy: fetch root tree, then targeted subdirectories.

        Inspired by Tool Search with Embeddings cookbook — instead of blindly
        trying every TARGET_FILE, fetch the root listing first to see what
        exists, then only fetch files that are actually present.
        """
        # 1 API call: root listing
        root_contents = self._gh_api(
            f"repos/{self.org}/{repo_name}/contents/?ref={default_branch}"
        )
        if not root_contents or not isinstance(root_contents, list):
            return

        root_files = {entry["name"]: entry for entry in root_contents if entry.get("type") == "file"}
        root_dirs = {entry["name"]: entry for entry in root_contents if entry.get("type") == "dir"}

        files_fetched = 0

        # Fetch only TARGET_FILES that actually exist in root
        for filename in self.TARGET_FILES:
            if files_fetched >= self.max_files_per_repo:
                break
            if filename not in root_files:
                continue  # Skip — no wasted API call
            content = self._fetch_file(repo_name, filename, default_branch)
            if content is not None:
                files_fetched += 1
                self._pages_crawled += 1
                yield self._build_item(
                    repo_name=repo_name,
                    file_path=filename,
                    content=content,
                    language=language,
                    stars=stars,
                    description=description,
                    category=category,
                    topics=topics,
                )

        # Check docs/ and examples/ if they exist
        for subdir in ["docs", "examples"]:
            if files_fetched >= self.max_files_per_repo:
                break
            if subdir not in root_dirs:
                continue
            subdir_contents = self._gh_api(
                f"repos/{self.org}/{repo_name}/contents/{subdir}?ref={default_branch}"
            )
            if not subdir_contents or not isinstance(subdir_contents, list):
                continue
            for entry in subdir_contents[:3]:
                if files_fetched >= self.max_files_per_repo:
                    break
                if entry.get("type") != "file":
                    continue
                name = entry.get("name", "")
                if name.endswith((".md", ".rst", ".txt")):
                    content = self._fetch_file(
                        repo_name, f"{subdir}/{name}", default_branch
                    )
                    if content is not None:
                        files_fetched += 1
                        self._pages_crawled += 1
                        yield self._build_item(
                            repo_name=repo_name,
                            file_path=f"{subdir}/{name}",
                            content=content,
                            language=language,
                            stars=stars,
                            description=description,
                            category=category,
                            topics=topics,
                        )

        # Fetch stat-relevant source files from src-like directories
        for src_dir in ["src", "lib", "core", "pkg"]:
            if files_fetched >= self.max_files_per_repo:
                break
            if src_dir not in root_dirs:
                continue
            yield from self._crawl_source_files(
                repo_name, default_branch, language, stars, description,
                category, topics, files_fetched,
            )
            break

    def _find_stat_relevant_files(
        self, tree_entries: list[dict],
    ) -> list[tuple[str, str]]:
        """From a recursive tree, find source files likely related to statistics."""
        stat_file_patterns = re.compile(
            r"(?i)(statistic|metric|experiment|test|sample|"
            r"hypothesis|confidence|bayes|causal|treatment|"
            r"measure|monitor|evaluat|benchmark)"
        )
        source_exts = {".py", ".ts", ".go", ".rs", ".java", ".scala", ".kt"}

        matches: list[tuple[str, str]] = []
        for entry in tree_entries:
            if entry.get("type") != "blob":
                continue
            path = entry.get("path", "")
            # Must be a source file
            if not any(path.endswith(ext) for ext in source_exts):
                continue
            # Must match stat keywords in filename or path
            if stat_file_patterns.search(path):
                matches.append((path, entry["sha"]))

        # Sort by path depth (prefer shallow files)
        matches.sort(key=lambda x: x[0].count("/"))
        return matches[:5]  # Limit to 5 stat-relevant source files

    def _fetch_blob(self, repo_name: str, sha: str) -> str | None:
        """Fetch a blob by SHA — lighter than contents API for known files."""
        data = self._gh_api(
            f"repos/{self.org}/{repo_name}/git/blobs/{sha}"
        )
        if not data or not isinstance(data, dict):
            return None
        content_b64 = data.get("content")
        if not content_b64:
            return None
        try:
            return b64decode(content_b64).decode("utf-8", errors="replace")
        except Exception:
            return None

    def _crawl_source_files(
        self,
        repo_name: str,
        default_branch: str,
        language: str,
        stars: int,
        description: str,
        category: str,
        topics: list[str],
        files_fetched: int,
    ) -> Generator[dict[str, Any], None, None]:
        """Fetch source files — used by tool_search and ptc variants."""
        src_dirs = ["src", "lib", "pkg", "internal", "core"]

        for src_dir in src_dirs:
            if files_fetched >= self.max_files_per_repo:
                break

            tree = self._gh_api(
                f"repos/{self.org}/{repo_name}/contents/{src_dir}"
            )
            if tree and isinstance(tree, list):
                for entry in tree[:5]:  # Up to 5 source files
                    if files_fetched >= self.max_files_per_repo:
                        break
                    if entry.get("type") != "file":
                        continue
                    name = entry.get("name", "")
                    if not any(
                        name.endswith(ext)
                        for ext in [".py", ".ts", ".go", ".rs", ".java", ".scala", ".kt"]
                    ):
                        continue

                    content = self._fetch_file(
                        repo_name, f"{src_dir}/{name}", default_branch
                    )
                    if content is not None:
                        files_fetched += 1
                        self._pages_crawled += 1
                        yield self._build_item(
                            repo_name=repo_name,
                            file_path=f"{src_dir}/{name}",
                            content=content,
                            language=language,
                            stars=stars,
                            description=description,
                            category=category,
                            topics=topics,
                        )
                break  # Only try first found src dir

    def _fetch_file(
        self, repo_name: str, path: str, branch: str
    ) -> str | None:
        """Fetch a single file's content via GitHub API."""
        data = self._gh_api(
            f"repos/{self.org}/{repo_name}/contents/{path}?ref={branch}"
        )
        if not data or not isinstance(data, dict):
            return None

        content_b64 = data.get("content")
        if not content_b64:
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
        category: str,
        topics: list[str],
    ) -> dict[str, Any]:
        """Build a standardized item with stat/measurement metadata."""
        url = f"https://github.com/{self.org}/{repo_name}/blob/main/{file_path}"
        is_markdown = file_path.endswith(".md")

        # Extract dependency info from manifest files
        dependencies = self._extract_stat_dependencies(content, file_path)

        quality = self._score_quality(content, is_markdown, category)

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
                "category": category,
                "topics": ",".join(topics[:10]),
                "variant": self.variant,
                "experiment_id": self.experiment_id,
                "is_markdown": str(is_markdown),
                "word_count": str(len(content.split())),
                "stat_dependencies": ",".join(dependencies[:20]),
            },
            "extraction_timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def _extract_stat_dependencies(
        self, content: str, file_path: str
    ) -> list[str]:
        """Extract names of statistical/measurement dependencies from manifests."""
        deps: list[str] = []
        stat_dep_patterns = re.compile(
            r"(?i)(scipy|numpy|pandas|statsmodels|scikit-learn|"
            r"pymc|arviz|lifelines|causalml|dowhy|"
            r"great-expectations|pandera|pydantic|"
            r"mlflow|wandb|neptune|"
            r"prometheus|grafana|datadog|"
            r"apache-beam|flink|kafka|"
            r"dbt|singer|airbyte|"
            r"polars|duckdb|clickhouse|"
            r"jax|torch|tensorflow)"
        )

        if file_path in ("pyproject.toml", "setup.py", "setup.cfg", "requirements.txt"):
            for match in stat_dep_patterns.finditer(content):
                dep = match.group(0).lower()
                if dep not in deps:
                    deps.append(dep)

        elif file_path == "package.json":
            for match in re.finditer(r'"([@\w/-]+)":\s*"', content):
                pkg = match.group(1)
                if any(
                    kw in pkg.lower()
                    for kw in ["stat", "metric", "experiment", "monitor", "analytics"]
                ):
                    deps.append(pkg)

        return deps

    def _score_quality(
        self, content: str, is_markdown: bool, category: str
    ) -> float:
        """Score content quality with stat/measurement relevance boost."""
        if not content or len(content) < 10:
            return 0.0

        words = len(content.split())

        # Base length score
        if words >= 500:
            length_score = 1.0
        elif words >= 100:
            length_score = 0.7
        elif words >= 30:
            length_score = 0.5
        else:
            length_score = 0.3

        # Structure score
        if is_markdown:
            headings = content.count("\n#")
            code_blocks = content.count("```") // 2
            links = content.count("](")
            structure = min(1.0, (headings + code_blocks + links) / 10)
        else:
            has_imports = "import " in content or "from " in content
            has_functions = "def " in content or "func " in content or "function " in content
            has_classes = "class " in content or "struct " in content
            structure = sum([has_imports, has_functions, has_classes]) / 3.0

        # Stat relevance boost
        stat_matches = len(STAT_KEYWORDS.findall(content))
        relevance_boost = min(0.2, stat_matches * 0.02)

        base = length_score * 0.4 + structure * 0.4 + relevance_boost
        return round(min(base + 0.2, 1.0), 2)  # +0.2 baseline for being in filtered set

    def _build_variant_metrics(self) -> dict[str, Any]:
        """Emit variant-level metrics as a special item."""
        duration = time.monotonic() - self._variant_start
        return {
            "url": f"metrics://{self.org}/{self.variant}",
            "title": f"Variant metrics: {self.variant}",
            "content_markdown": json.dumps(
                {
                    "variant": self.variant,
                    "experiment_id": self.experiment_id,
                    "org": self.org,
                    "pages_crawled": self._pages_crawled,
                    "tool_calls": self._tool_calls,
                    "efficiency_ratio": (
                        self._tool_calls / self._pages_crawled
                        if self._pages_crawled > 0
                        else 0
                    ),
                    "duration_seconds": round(duration, 2),
                    "pages_per_second": (
                        self._pages_crawled / duration if duration > 0 else 0
                    ),
                },
                indent=2,
            ),
            "content_raw": "",
            "quality_score": 1.0,
            "metadata": {
                "source": f"variant-metrics-{self.org}",
                "org": self.org,
                "variant": self.variant,
                "experiment_id": self.experiment_id,
                "is_metrics": "true",
                "pages_crawled": str(self._pages_crawled),
                "tool_calls": str(self._tool_calls),
            },
            "extraction_timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def closed(self, reason: str) -> None:
        """Log variant efficiency on close."""
        ratio = (
            self._tool_calls / self._pages_crawled
            if self._pages_crawled > 0
            else 0
        )
        self.logger.info(
            f"SpotifyStats [{self.variant}]: "
            f"{self._pages_crawled} pages, {self._tool_calls} tool calls, "
            f"ratio={ratio:.2f}"
        )
        super().closed(reason)
