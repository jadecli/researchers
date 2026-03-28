"""Spider for crawling official vendor skills from skills.sh registry.

Crawls ONLY official skills (creator-owned repos) to avoid security risk from
community/non-official skills. Uses GitHub API via `gh` CLI to:
1. List repos for each official creator org
2. Find all SKILL.md files in each repo
3. Extract YAML frontmatter + markdown body
4. Yield structured SkillSpec items

Entry point: https://skills.sh/official
Rate-limited: respects GitHub API X-RateLimit-Remaining headers.
"""

from __future__ import annotations

import json
import re
import subprocess
import time
import yaml
from base64 import b64decode
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Generator

import scrapy
from scrapy.http import Response

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


# ── Official creators from skills.sh/official ───────────────────
# Only vendor-owned repos. Community skills are excluded for security.
OFFICIAL_CREATORS: list[dict[str, str]] = [
    {"org": "anthropics", "repo": "skills"},
    {"org": "apify", "repo": "agent-skills"},
    {"org": "apollographql", "repo": "skills"},
    {"org": "auth0", "repo": "agent-skills"},
    {"org": "automattic", "repo": "agent-skills"},
    {"org": "axiomhq", "repo": "skills"},
    {"org": "base", "repo": "skills"},
    {"org": "better-auth", "repo": "skills"},
    {"org": "bitwarden", "repo": "ai-plugins"},
    {"org": "box", "repo": "box-for-ai"},
    {"org": "brave", "repo": "brave-search-skills"},
    {"org": "browser-use", "repo": "browser-use"},
    {"org": "browserbase", "repo": "skills"},
    {"org": "callstackincubator", "repo": "agent-skills"},
    {"org": "clerk", "repo": "skills"},
    {"org": "clickhouse", "repo": "agent-skills"},
    {"org": "cloudflare", "repo": "skills"},
    {"org": "coderabbitai", "repo": "skills"},
    {"org": "coinbase", "repo": "agentic-wallet-skills"},
    {"org": "dagster-io", "repo": "erk"},
    {"org": "datadog-labs", "repo": "agent-skills"},
    {"org": "dbt-labs", "repo": "dbt-agent-skills"},
    {"org": "denoland", "repo": "skills"},
    {"org": "elevenlabs", "repo": "skills"},
    {"org": "encoredev", "repo": "skills"},
    {"org": "expo", "repo": "skills"},
    {"org": "facebook", "repo": "react"},
    {"org": "figma", "repo": "mcp-server-guide"},
    {"org": "firebase", "repo": "agent-skills"},
    {"org": "firecrawl", "repo": "cli"},
    {"org": "flutter", "repo": "skills"},
    {"org": "getsentry", "repo": "skills"},
    {"org": "github", "repo": "awesome-copilot"},
    {"org": "google-gemini", "repo": "gemini-skills"},
    {"org": "google-labs-code", "repo": "stitch-skills"},
    {"org": "hashicorp", "repo": "agent-skills"},
    {"org": "huggingface", "repo": "skills"},
    {"org": "kotlin", "repo": "kotlin-agent-skills"},
    {"org": "langchain-ai", "repo": "langchain-skills"},
    {"org": "langfuse", "repo": "skills"},
    {"org": "launchdarkly", "repo": "agent-skills"},
    {"org": "livekit", "repo": "agent-skills"},
    {"org": "makenotion", "repo": "claude-code-notion-plugin"},
    {"org": "mapbox", "repo": "mapbox-agent-skills"},
    {"org": "mastra-ai", "repo": "skills"},
    {"org": "mcp-use", "repo": "mcp-use"},
    {"org": "medusajs", "repo": "medusa-agent-skills"},
    {"org": "microsoft", "repo": "github-copilot-for-azure"},
    {"org": "n8n-io", "repo": "n8n"},
    {"org": "neondatabase", "repo": "agent-skills"},
    {"org": "nuxt", "repo": "ui"},
    {"org": "openai", "repo": "skills"},
    {"org": "openshift", "repo": "hypershift"},
    {"org": "planetscale", "repo": "database-skills"},
    {"org": "posthog", "repo": "posthog"},
    {"org": "prisma", "repo": "skills"},
    {"org": "pulumi", "repo": "agent-skills"},
    {"org": "pytorch", "repo": "pytorch"},
    {"org": "redis", "repo": "agent-skills"},
    {"org": "remotion-dev", "repo": "skills"},
    {"org": "resend", "repo": "resend-skills"},
    {"org": "rivet-dev", "repo": "skills"},
    {"org": "runwayml", "repo": "skills"},
    {"org": "sanity-io", "repo": "agent-toolkit"},
    {"org": "semgrep", "repo": "skills"},
    {"org": "streamlit", "repo": "agent-skills"},
    {"org": "stripe", "repo": "ai"},
    {"org": "sveltejs", "repo": "mcp"},
    {"org": "tavily-ai", "repo": "skills"},
    {"org": "tinybirdco", "repo": "tinybird-agent-skills"},
    {"org": "tldraw", "repo": "tldraw"},
    {"org": "triggerdotdev", "repo": "skills"},
    {"org": "upstash", "repo": "context7"},
    {"org": "vercel", "repo": "ai"},
    {"org": "vercel-labs", "repo": "agent-skills"},
    {"org": "webflow", "repo": "webflow-skills"},
]


class OfficialSkillsSpider(BaseResearchSpider):
    """Crawls official vendor skill repos from skills.sh/official registry.

    Only crawls creator-owned repos listed on skills.sh/official.
    Non-official/community skills are excluded to avoid security risk.

    Usage:
        # Crawl all official creators
        scrapy crawl official_skills_spider

        # Crawl specific creator
        scrapy crawl official_skills_spider -a creator=anthropics

        # Crawl with creator pattern filter
        scrapy crawl official_skills_spider -a pattern="cloud|firebase|supabase"

        # Limit skills per creator
        scrapy crawl official_skills_spider -a max_skills_per_creator=10

        # Set round number for improvement tracking
        scrapy crawl official_skills_spider -a round_number=7
    """

    name = "official_skills_spider"
    custom_settings = {
        "DEPTH_LIMIT": 0,
        "DOWNLOAD_DELAY": 0,
        "CONCURRENT_REQUESTS": 1,
        "ROBOTSTXT_OBEY": False,  # GitHub API, not web pages
    }

    def __init__(
        self,
        creator: str = "",
        pattern: str = "",
        max_skills_per_creator: int = 50,
        round_number: int = 7,
        *args: Any,
        **kwargs: Any,
    ) -> None:
        super().__init__(*args, **kwargs)
        self.creator_filter = creator
        self.pattern = re.compile(pattern, re.IGNORECASE) if pattern else None
        self.max_skills_per_creator = int(max_skills_per_creator)
        self.round_number = int(round_number)
        self.rate_limiter = RateLimiter()
        self.stats: dict[str, int] = {
            "creators_crawled": 0,
            "repos_crawled": 0,
            "skills_found": 0,
            "skills_parsed": 0,
            "skills_failed": 0,
        }
        # Dummy start URL — actual crawling uses gh api
        self.start_urls = ["https://skills.sh/official"]

    def _gh_api(self, endpoint: str) -> dict | list | None:
        """Call GitHub API via gh CLI (handles auth automatically)."""
        self.rate_limiter.wait()
        try:
            result = subprocess.run(
                ["gh", "api", endpoint],
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode == 0 and result.stdout.strip():
                return json.loads(result.stdout)
            if result.returncode != 0:
                self.logger.debug(f"gh api {endpoint}: {result.stderr.strip()}")
            return None
        except (subprocess.TimeoutExpired, json.JSONDecodeError) as e:
            self.logger.warning(f"gh api error for {endpoint}: {e}")
            return None

    def parse(self, response: Response) -> Generator[dict[str, Any], None, None]:
        """Entry point — iterate over official creators and crawl their repos."""
        creators = OFFICIAL_CREATORS

        # Apply creator filter
        if self.creator_filter:
            creators = [c for c in creators if c["org"] == self.creator_filter]
            if not creators:
                self.logger.error(f"Creator '{self.creator_filter}' not in official list")
                return

        # Apply pattern filter
        if self.pattern:
            creators = [c for c in creators if self.pattern.search(c["org"])]

        self.logger.info(
            f"Crawling {len(creators)} official creators "
            f"(round {self.round_number})"
        )

        for creator in creators:
            org = creator["org"]
            repo = creator["repo"]
            self.stats["creators_crawled"] += 1
            self.logger.info(
                f"[{self.stats['creators_crawled']}/{len(creators)}] "
                f"{org}/{repo}"
            )
            yield from self._crawl_creator_repo(org, repo)

        self.logger.info(
            f"Crawl complete: {self.stats['creators_crawled']} creators, "
            f"{self.stats['repos_crawled']} repos, "
            f"{self.stats['skills_found']} skills found, "
            f"{self.stats['skills_parsed']} parsed, "
            f"{self.stats['skills_failed']} failed, "
            f"rate limit remaining: {self.rate_limiter.remaining}"
        )

    def _crawl_creator_repo(
        self, org: str, repo: str
    ) -> Generator[dict[str, Any], None, None]:
        """Crawl a single creator's skill repo for SKILL.md files."""
        # Get repo metadata
        repo_info = self._gh_api(f"repos/{org}/{repo}")
        if not repo_info or not isinstance(repo_info, dict):
            self.logger.warning(f"Could not access {org}/{repo}")
            return

        self.stats["repos_crawled"] += 1
        default_branch = repo_info.get("default_branch", "main")
        description = repo_info.get("description") or ""
        stars = repo_info.get("stargazers_count", 0)
        license_info = repo_info.get("license") or {}
        license_name = license_info.get("spdx_id", "unknown") if isinstance(license_info, dict) else "unknown"

        # Recursively find all SKILL.md files via git tree API
        skill_paths = self._find_skill_files(org, repo, default_branch)

        if not skill_paths:
            self.logger.info(f"  No SKILL.md files found in {org}/{repo}")
            return

        self.logger.info(f"  Found {len(skill_paths)} SKILL.md files in {org}/{repo}")

        skills_yielded = 0
        for skill_path in skill_paths:
            if skills_yielded >= self.max_skills_per_creator:
                self.logger.info(
                    f"  Reached max_skills_per_creator={self.max_skills_per_creator}"
                )
                break

            item = self._fetch_and_parse_skill(
                org=org,
                repo=repo,
                path=skill_path,
                branch=default_branch,
                description=description,
                stars=stars,
                license_name=license_name,
            )
            if item:
                skills_yielded += 1
                self.stats["skills_parsed"] += 1
                yield item

    def _find_skill_files(
        self, org: str, repo: str, branch: str
    ) -> list[str]:
        """Find all SKILL.md files in a repo using the git tree API."""
        tree = self._gh_api(
            f"repos/{org}/{repo}/git/trees/{branch}?recursive=1"
        )
        if not tree or not isinstance(tree, dict):
            return []

        entries = tree.get("tree", [])
        skill_paths = [
            entry["path"]
            for entry in entries
            if isinstance(entry, dict)
            and entry.get("path", "").endswith("SKILL.md")
            and entry.get("type") == "blob"
        ]

        self.stats["skills_found"] += len(skill_paths)
        return skill_paths

    def _fetch_and_parse_skill(
        self,
        org: str,
        repo: str,
        path: str,
        branch: str,
        description: str,
        stars: int,
        license_name: str,
    ) -> dict[str, Any] | None:
        """Fetch a SKILL.md file and parse its frontmatter + body."""
        data = self._gh_api(
            f"repos/{org}/{repo}/contents/{path}?ref={branch}"
        )
        if not data or not isinstance(data, dict):
            self.stats["skills_failed"] += 1
            return None

        content_b64 = data.get("content")
        if not content_b64:
            self.stats["skills_failed"] += 1
            return None

        try:
            raw_content = b64decode(content_b64).decode("utf-8", errors="replace")
        except Exception:
            self.stats["skills_failed"] += 1
            return None

        # Parse YAML frontmatter
        frontmatter, body = self._parse_frontmatter(raw_content)
        skill_name = frontmatter.get("name", "")
        skill_description = frontmatter.get("description", "")

        if not skill_name:
            # Derive name from directory path
            parts = path.split("/")
            if len(parts) >= 2:
                skill_name = parts[-2]  # parent directory name
            else:
                skill_name = f"{org}-unknown"

        # Derive skill directory for context
        skill_dir = "/".join(path.split("/")[:-1]) if "/" in path else ""

        url = f"https://github.com/{org}/{repo}/blob/{branch}/{path}"

        # Quality scoring
        quality = self._score_skill_quality(frontmatter, body, raw_content)

        return {
            "url": url,
            "title": f"{org}/{skill_name}",
            "content_markdown": raw_content,
            "content_html": "",  # No HTML — source is markdown
            "content_raw": body,
            "quality_score": quality,
            "metadata": {
                "source": "skills.sh-official",
                "source_type": "official_vendor_skill",
                "org": org,
                "repo": repo,
                "skill_name": skill_name,
                "skill_description": skill_description[:500],
                "skill_dir": skill_dir,
                "file_path": path,
                "branch": branch,
                "stars": str(stars),
                "repo_description": description[:200],
                "license": license_name,
                "frontmatter_fields": ",".join(sorted(frontmatter.keys())),
                "word_count": str(len(body.split())),
                "line_count": str(body.count("\n") + 1),
                "has_examples": str("example" in body.lower() or "## Example" in body),
                "has_scripts": str("scripts/" in body or "```bash" in body or "```sh" in body),
                "round_number": str(self.round_number),
            },
            "skill_spec": {
                "name": skill_name,
                "description": skill_description,
                "frontmatter": frontmatter,
                "body": body,
                "creator": org,
                "repo": repo,
                "official": True,
            },
            "extraction_timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def _parse_frontmatter(self, content: str) -> tuple[dict[str, Any], str]:
        """Parse YAML frontmatter from SKILL.md content.

        Returns (frontmatter_dict, body_markdown).
        """
        if not content.startswith("---"):
            return {}, content

        # Find closing ---
        end_idx = content.find("---", 3)
        if end_idx == -1:
            return {}, content

        frontmatter_str = content[3:end_idx].strip()
        body = content[end_idx + 3:].strip()

        try:
            frontmatter = yaml.safe_load(frontmatter_str)
            if not isinstance(frontmatter, dict):
                return {}, content
            return frontmatter, body
        except yaml.YAMLError as e:
            self.logger.debug(f"YAML parse error: {e}")
            return {}, content

    def _score_skill_quality(
        self,
        frontmatter: dict[str, Any],
        body: str,
        raw: str,
    ) -> float:
        """Score skill quality based on spec completeness and documentation depth."""
        score = 0.0

        # Frontmatter completeness (0.3)
        has_name = bool(frontmatter.get("name"))
        has_description = bool(frontmatter.get("description"))
        has_license = bool(frontmatter.get("license"))
        fm_score = sum([has_name, has_description, has_license]) / 3.0
        score += 0.3 * fm_score

        # Body length (0.25)
        words = len(body.split())
        if words >= 1000:
            length_score = 1.0
        elif words >= 300:
            length_score = 0.7
        elif words >= 100:
            length_score = 0.5
        elif words >= 30:
            length_score = 0.3
        else:
            length_score = 0.1
        score += 0.25 * length_score

        # Structure quality (0.25)
        headings = body.count("\n#")
        has_examples = "example" in body.lower()
        has_code = "```" in body
        has_lists = any(
            line.strip().startswith(("- ", "* ", "1. "))
            for line in body.split("\n")
        )
        structure_points = min(headings / 5.0, 1.0) * 0.4
        structure_points += 0.2 * has_examples
        structure_points += 0.2 * has_code
        structure_points += 0.2 * has_lists
        score += 0.25 * min(structure_points, 1.0)

        # Actionability signals (0.2)
        has_trigger = "trigger" in frontmatter.get("description", "").lower()
        has_guidelines = "guideline" in body.lower() or "best practice" in body.lower()
        has_scripts = "scripts/" in body or "```bash" in body
        action_score = sum([has_trigger, has_guidelines, has_scripts]) / 3.0
        score += 0.2 * action_score

        return round(min(score, 1.0), 4)
