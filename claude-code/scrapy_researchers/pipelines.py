"""Scrapy pipelines for quality scoring, deduplication, and improvement feedback."""

from __future__ import annotations

import hashlib
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from scrapy import Spider
from scrapy.exceptions import DropItem

from scrapy_researchers.bloom_filter import BloomDupeFilter  # noqa: F401 — used in settings

logger = logging.getLogger(__name__)


class QualityScoringPipeline:
    """Scores items on a 0-1 scale based on field completeness, content length, and structure."""

    REQUIRED_FIELDS = {"url", "title", "content_markdown"}
    DESIRED_FIELDS = {"metadata", "content_html"}

    MINIMUM_CONTENT_LENGTH = 50
    GOOD_CONTENT_LENGTH = 500
    EXCELLENT_CONTENT_LENGTH = 2000

    def process_item(self, item: dict[str, Any], spider: Spider) -> dict[str, Any]:
        score = self._compute_score(item)
        item["quality_score"] = round(score, 4)
        spider.logger.debug(f"Quality score for {item.get('url', 'unknown')}: {score:.4f}")
        return item

    def _compute_score(self, item: dict[str, Any]) -> float:
        scores: list[float] = []

        # Field completeness (weight: 0.3)
        filled_required = sum(
            1 for f in self.REQUIRED_FIELDS if item.get(f) and str(item[f]).strip()
        )
        required_ratio = filled_required / len(self.REQUIRED_FIELDS) if self.REQUIRED_FIELDS else 1
        filled_desired = sum(
            1 for f in self.DESIRED_FIELDS if item.get(f) and str(item[f]).strip()
        )
        all_fields = self.REQUIRED_FIELDS | self.DESIRED_FIELDS
        total_ratio = (filled_required + filled_desired) / len(all_fields) if all_fields else 1
        scores.append(0.3 * (0.7 * required_ratio + 0.3 * total_ratio))

        # Content length (weight: 0.3)
        content = item.get("content_markdown", "")
        content_len = len(content)
        if content_len >= self.EXCELLENT_CONTENT_LENGTH:
            length_score = 1.0
        elif content_len >= self.GOOD_CONTENT_LENGTH:
            length_score = 0.7 + 0.3 * (
                (content_len - self.GOOD_CONTENT_LENGTH)
                / (self.EXCELLENT_CONTENT_LENGTH - self.GOOD_CONTENT_LENGTH)
            )
        elif content_len >= self.MINIMUM_CONTENT_LENGTH:
            length_score = 0.3 + 0.4 * (
                (content_len - self.MINIMUM_CONTENT_LENGTH)
                / (self.GOOD_CONTENT_LENGTH - self.MINIMUM_CONTENT_LENGTH)
            )
        else:
            length_score = 0.3 * (content_len / self.MINIMUM_CONTENT_LENGTH) if content_len > 0 else 0
        scores.append(0.3 * length_score)

        # Structure quality (weight: 0.25)
        structure_score = self._score_structure(content)
        scores.append(0.25 * structure_score)

        # Metadata richness (weight: 0.15)
        metadata = item.get("metadata", {})
        meta_fields = ["title", "description", "author", "date", "tags", "canonical_url"]
        meta_filled = sum(1 for f in meta_fields if metadata.get(f))
        meta_score = min(meta_filled / 3.0, 1.0)
        scores.append(0.15 * meta_score)

        return min(sum(scores), 1.0)

    def _score_structure(self, content: str) -> float:
        if not content:
            return 0.0

        lines = content.split("\n")
        has_headings = any(line.strip().startswith("#") for line in lines)
        heading_count = sum(1 for line in lines if line.strip().startswith("#"))
        has_code_blocks = "```" in content
        has_lists = any(
            line.strip().startswith(("- ", "* ", "1. ", "2. ")) for line in lines
        )
        has_links = "](" in content

        structure_points = 0.0
        if has_headings:
            structure_points += 0.3
        if heading_count >= 3:
            structure_points += 0.1
        if has_code_blocks:
            structure_points += 0.2
        if has_lists:
            structure_points += 0.2
        if has_links:
            structure_points += 0.2

        return min(structure_points, 1.0)


class DedupPipeline:
    """Bloom filter-backed deduplication pipeline.

    Replaces the previous in-memory SHA256 fingerprint set with a Bloom filter
    for ~50x memory reduction at scale (100K items: ~120KB vs ~6.4MB).

    Persists state to disk so duplicates are tracked across crawl runs,
    complementing DeltaFetch's request-level dedup with content-level dedup.

    Settings:
        BLOOM_DEDUP_EXPECTED_ITEMS: Expected unique items (default 100_000)
        BLOOM_DEDUP_FP_RATE: False positive rate (default 0.001)
        BLOOM_DEDUP_PERSIST_PATH: Path to persist state (default .bloomstate/dedup.bloom)
    """

    def __init__(self) -> None:
        self.bloom: BloomFilter | None = None
        self.persist_path: str = ""
        self._dupes_dropped = 0
        self._items_seen = 0

    def open_spider(self, spider: Spider) -> None:
        settings = spider.crawler.settings
        expected = settings.getint("BLOOM_DEDUP_EXPECTED_ITEMS", 100_000)
        fp_rate = settings.getfloat("BLOOM_DEDUP_FP_RATE", 0.001)
        # Use spider name in fallback path to prevent cross-spider collisions
        default_path = f"scrapy_researchers/.bloomstate/{spider.name}_dedup.bloom"
        self.persist_path = settings.get(
            "BLOOM_DEDUP_PERSIST_PATH",
            default_path,
        )

        if Path(self.persist_path).exists():
            try:
                self.bloom = BloomFilter.load(self.persist_path)
                spider.logger.info(
                    f"DedupPipeline: loaded bloom filter ({self.bloom.count} items, "
                    f"{self.bloom.memory_bytes}B, est FP: {self.bloom.estimated_fp_rate:.6f})"
                )
            except Exception as e:
                spider.logger.warning(f"DedupPipeline: failed to load bloom state: {e}")
                self.bloom = BloomFilter(expected, fp_rate)
        else:
            self.bloom = BloomFilter(expected, fp_rate)
            spider.logger.info(
                f"DedupPipeline: new bloom filter ({self.bloom.num_bits} bits, "
                f"{self.bloom.num_hashes} hashes, {self.bloom.memory_bytes}B)"
            )

    def process_item(self, item: dict[str, Any], spider: Spider) -> dict[str, Any]:
        fingerprint = self._compute_fingerprint(item)
        self._items_seen += 1

        assert self.bloom is not None
        if fingerprint in self.bloom:
            self._dupes_dropped += 1
            raise DropItem(f"Duplicate item (bloom): {item.get('url', 'unknown')}")

        self.bloom.add(fingerprint)
        return item

    def close_spider(self, spider: Spider) -> None:
        if self.bloom and self.persist_path:
            self.bloom.save(self.persist_path)
            spider.logger.info(
                f"DedupPipeline: saved bloom filter ({self.bloom.count} items, "
                f"{self.bloom.memory_bytes}B). "
                f"Session: {self._items_seen} seen, {self._dupes_dropped} dupes dropped"
            )

    def _compute_fingerprint(self, item: dict[str, Any]) -> str:
        url = item.get("url", "")
        content = item.get("content_markdown", "")
        raw = f"{url}:{content[:500]}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class ImprovementFeedbackPipeline:
    """Writes improvement entries to improvements/ directory as JSONL."""

    def __init__(self) -> None:
        self.entries: list[dict[str, Any]] = []
        self.improvements_dir = Path("improvements")

    def open_spider(self, spider: Spider) -> None:
        self.improvements_dir.mkdir(parents=True, exist_ok=True)
        self.entries = []

    def process_item(self, item: dict[str, Any], spider: Spider) -> dict[str, Any]:
        quality = item.get("quality_score", 0.0)
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "spider": spider.name,
            "url": item.get("url", ""),
            "quality_score": quality,
            "title": item.get("title", ""),
            "content_length": len(item.get("content_markdown", "")),
            "metadata_fields": list(item.get("metadata", {}).keys()),
            "needs_improvement": quality < 0.7,
        }

        if quality < 0.7:
            entry["improvement_hints"] = self._generate_hints(item)

        self.entries.append(entry)
        return item

    def close_spider(self, spider: Spider) -> None:
        if not self.entries:
            return

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = self.improvements_dir / f"{spider.name}_{timestamp}.jsonl"

        with open(filename, "w", encoding="utf-8") as f:
            for entry in self.entries:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")

        spider.logger.info(
            f"Wrote {len(self.entries)} improvement entries to {filename}"
        )

    def _generate_hints(self, item: dict[str, Any]) -> list[str]:
        hints: list[str] = []

        if not item.get("title"):
            hints.append("Missing title - check title selector")
        if len(item.get("content_markdown", "")) < 100:
            hints.append("Very short content - main content selector may be wrong")
        if not item.get("metadata", {}).get("description"):
            hints.append("Missing meta description")
        if "```" not in item.get("content_markdown", ""):
            hints.append("No code blocks found - check code extraction")
        if not any(
            line.startswith("#")
            for line in item.get("content_markdown", "").split("\n")
        ):
            hints.append("No headings found - check heading extraction")

        return hints


class NeonSkillsPipeline:
    """Persists official skill items to runtime.skill_events in Neon Postgres.

    Only active when DATABASE_URL is set. Falls back silently to allow
    local development without a database connection.

    Follows Kimball runtime layer conventions:
    - Append-only inserts into runtime.skill_events
    - Content hash for change detection across crawl rounds
    - ON CONFLICT upsert on (org, repo, skill_name) to track latest state
    """

    INSERT_SQL = """
        INSERT INTO runtime.skill_events (
            url, org, repo, skill_name, skill_description,
            skill_dir, file_path, branch, license,
            frontmatter, body, content_hash,
            quality_score, stars, round_number,
            has_examples, has_scripts, word_count
        ) VALUES (
            %(url)s, %(org)s, %(repo)s, %(skill_name)s, %(skill_description)s,
            %(skill_dir)s, %(file_path)s, %(branch)s, %(license)s,
            %(frontmatter)s, %(body)s, %(content_hash)s,
            %(quality_score)s, %(stars)s, %(round_number)s,
            %(has_examples)s, %(has_scripts)s, %(word_count)s
        )
        ON CONFLICT (org, repo, skill_name) DO UPDATE SET
            skill_description = EXCLUDED.skill_description,
            body = EXCLUDED.body,
            content_hash = EXCLUDED.content_hash,
            quality_score = EXCLUDED.quality_score,
            stars = EXCLUDED.stars,
            round_number = EXCLUDED.round_number,
            has_examples = EXCLUDED.has_examples,
            has_scripts = EXCLUDED.has_scripts,
            word_count = EXCLUDED.word_count,
            updated_at = now()
        WHERE runtime.skill_events.content_hash != EXCLUDED.content_hash
    """

    def __init__(self) -> None:
        self._client = None
        self._enabled = False
        self._count = 0
        self._skipped = 0

    def open_spider(self, spider: Spider) -> None:
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            logger.info("NeonSkillsPipeline: DATABASE_URL not set, skipping Neon persistence")
            return

        # Only activate for the official_skills_spider
        if spider.name != "official_skills_spider":
            return

        try:
            # Import here to avoid hard dependency when DATABASE_URL is not set
            from claude_channel_dispatch_routing.persistence.neon_client import NeonClient
        except ImportError:
            try:
                # Fallback: try relative import path
                import sys
                sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "claude-channel-dispatch-routing"))
                from src.persistence.neon_client import NeonClient
            except ImportError:
                logger.warning("NeonSkillsPipeline: NeonClient not importable, skipping")
                return

        try:
            self._client = NeonClient(database_url=database_url, min_conn=1, max_conn=3)
            self._enabled = True
            logger.info("NeonSkillsPipeline: connected to Neon")
        except Exception as e:
            logger.warning(f"NeonSkillsPipeline: connection failed: {e}")

    def process_item(self, item: dict[str, Any], spider: Spider) -> dict[str, Any]:
        if not self._enabled or spider.name != "official_skills_spider":
            return item

        metadata = item.get("metadata", {})
        skill_spec = item.get("skill_spec", {})

        # Only persist items with skill_spec (from official_skills_spider)
        if not skill_spec:
            return item

        content_hash = hashlib.sha256(
            item.get("content_markdown", "").encode("utf-8")
        ).hexdigest()

        params = {
            "url": item.get("url", ""),
            "org": metadata.get("org", ""),
            "repo": metadata.get("repo", ""),
            "skill_name": skill_spec.get("name", ""),
            "skill_description": skill_spec.get("description", "")[:500],
            "skill_dir": metadata.get("skill_dir", ""),
            "file_path": metadata.get("file_path", ""),
            "branch": metadata.get("branch", "main"),
            "license": metadata.get("license", "unknown"),
            "frontmatter": json.dumps(skill_spec.get("frontmatter", {})),
            "body": skill_spec.get("body", ""),
            "content_hash": content_hash,
            "quality_score": item.get("quality_score", 0.0),
            "stars": int(metadata.get("stars", 0)),
            "round_number": int(metadata.get("round_number", 0)),
            "has_examples": metadata.get("has_examples", "False") == "True",
            "has_scripts": metadata.get("has_scripts", "False") == "True",
            "word_count": int(metadata.get("word_count", 0)),
        }

        try:
            self._client.execute(self.INSERT_SQL, params)
            self._count += 1
        except Exception as e:
            self._skipped += 1
            logger.warning(f"NeonSkillsPipeline: insert failed for {params['skill_name']}: {e}")

        return item

    def close_spider(self, spider: Spider) -> None:
        if self._enabled:
            logger.info(
                f"NeonSkillsPipeline: {self._count} skills persisted, "
                f"{self._skipped} skipped"
            )
            if self._client:
                self._client.close()
