"""Notion integration for publishing crawled pages and quality dashboards."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

logger = logging.getLogger(__name__)

NOTION_API_URL = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"


class NotionPublisher:
    """Publish crawled content and quality data to Notion databases."""

    def __init__(
        self,
        token: str | None = None,
        database_id: str | None = None,
        dashboard_database_id: str | None = None,
    ) -> None:
        self.token = token or os.environ.get("NOTION_TOKEN", "")
        self.database_id = database_id or os.environ.get("NOTION_DATABASE_ID", "")
        self.dashboard_database_id = dashboard_database_id or os.environ.get("NOTION_DASHBOARD_DATABASE_ID", "")

        if not self.token:
            logger.warning("NOTION_TOKEN not set; Notion operations will fail")

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "Notion-Version": NOTION_VERSION,
        }

    def _request(self, method: str, endpoint: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        """Make an authenticated request to the Notion API."""
        url = f"{NOTION_API_URL}/{endpoint.lstrip('/')}"
        try:
            resp = requests.request(method, url, headers=self._headers(), json=body, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            logger.error("Notion API request failed: %s %s -> %s", method, endpoint, exc)
            return {"error": str(exc)}

    def _rich_text(self, content: str, max_length: int = 2000) -> list[dict[str, Any]]:
        """Create a Notion rich_text array, splitting if needed."""
        blocks = []
        for i in range(0, len(content), max_length):
            blocks.append({
                "type": "text",
                "text": {"content": content[i:i + max_length]},
            })
        return blocks or [{"type": "text", "text": {"content": ""}}]

    def _text_block(self, content: str, block_type: str = "paragraph") -> dict[str, Any]:
        """Create a Notion text block."""
        return {
            "object": "block",
            "type": block_type,
            block_type: {"rich_text": self._rich_text(content)},
        }

    def publish_crawled_page(
        self,
        url: str,
        title: str,
        text_content: str,
        metadata: dict[str, Any] | None = None,
        spider: str = "",
        quality_score: float | None = None,
        tags: list[str] | None = None,
    ) -> dict[str, Any]:
        """Publish a crawled page as a new Notion database entry.

        Creates a page in the configured database with properties for URL,
        title, spider name, quality score, and tags. The page body contains
        the extracted text content.
        """
        if not self.database_id:
            logger.error("No database_id configured for publishing")
            return {"error": "no_database_id"}

        now = datetime.now(timezone.utc).isoformat()

        properties: dict[str, Any] = {
            "Name": {"title": self._rich_text(title[:200])},
            "URL": {"url": url},
            "Crawled At": {"date": {"start": now}},
        }

        if spider:
            properties["Spider"] = {"select": {"name": spider}}

        if quality_score is not None:
            properties["Quality Score"] = {"number": round(quality_score, 4)}

        if tags:
            properties["Tags"] = {"multi_select": [{"name": t} for t in tags[:10]]}

        # Build page body blocks
        children: list[dict[str, Any]] = []

        # Header with source info
        children.append({
            "object": "block",
            "type": "heading_2",
            "heading_2": {"rich_text": self._rich_text("Extracted Content")},
        })

        # Split text content into blocks (Notion limit: 2000 chars per block)
        content_chunks = [text_content[i:i + 1900] for i in range(0, len(text_content), 1900)]
        for chunk in content_chunks[:50]:  # Max 50 blocks
            children.append(self._text_block(chunk))

        # Metadata section
        if metadata:
            children.append({
                "object": "block",
                "type": "heading_2",
                "heading_2": {"rich_text": self._rich_text("Metadata")},
            })
            children.append({
                "object": "block",
                "type": "code",
                "code": {
                    "rich_text": self._rich_text(json.dumps(metadata, indent=2, ensure_ascii=False)),
                    "language": "json",
                },
            })

        body: dict[str, Any] = {
            "parent": {"database_id": self.database_id},
            "properties": properties,
            "children": children[:100],  # Notion limit
        }

        result = self._request("POST", "/pages", body)

        if "id" in result:
            logger.info("Published page to Notion: %s (%s)", title[:50], result["id"])
        else:
            logger.error("Failed to publish page: %s", result)

        return result

    def update_quality_dashboard(
        self,
        spider_scores: dict[str, dict[str, float]],
        campaign_name: str = "",
        run_url: str = "",
        threshold: float = 0.85,
    ) -> dict[str, Any]:
        """Update or create a quality dashboard entry in Notion.

        Creates a new page in the dashboard database summarizing quality
        scores across all spiders and dimensions.
        """
        db_id = self.dashboard_database_id or self.database_id
        if not db_id:
            logger.error("No dashboard database configured")
            return {"error": "no_database_id"}

        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        date_str = now.strftime("%Y-%m-%d %H:%M UTC")

        # Calculate overall stats
        all_scores = [s for dims in spider_scores.values() for s in dims.values()]
        avg_score = sum(all_scores) / len(all_scores) if all_scores else 0.0
        min_score = min(all_scores) if all_scores else 0.0
        passing = sum(1 for s in all_scores if s >= threshold)
        total = len(all_scores)

        title = campaign_name or f"Quality Dashboard {date_str}"

        properties: dict[str, Any] = {
            "Name": {"title": self._rich_text(title[:200])},
            "Date": {"date": {"start": now_iso}},
            "Average Score": {"number": round(avg_score, 4)},
            "Min Score": {"number": round(min_score, 4)},
            "Passing": {"number": passing},
            "Total Checks": {"number": total},
        }

        if run_url:
            properties["Run URL"] = {"url": run_url}

        # Build dashboard body
        children: list[dict[str, Any]] = []

        # Summary header
        children.append({
            "object": "block",
            "type": "heading_2",
            "heading_2": {"rich_text": self._rich_text("Quality Summary")},
        })

        summary_text = (
            f"Average: {avg_score:.1%} | Min: {min_score:.1%} | "
            f"Passing: {passing}/{total} | Threshold: {threshold:.0%}"
        )
        children.append(self._text_block(summary_text))

        # Per-spider breakdown
        children.append({
            "object": "block",
            "type": "heading_2",
            "heading_2": {"rich_text": self._rich_text("Spider Breakdown")},
        })

        for spider_name, dimensions in sorted(spider_scores.items()):
            spider_avg = sum(dimensions.values()) / len(dimensions) if dimensions else 0.0
            status = "PASS" if spider_avg >= threshold else "FAIL"

            children.append({
                "object": "block",
                "type": "heading_3",
                "heading_3": {"rich_text": self._rich_text(f"{spider_name} [{status}] ({spider_avg:.1%})")},
            })

            for dim, score in sorted(dimensions.items()):
                icon = "+" if score >= threshold else "-"
                children.append(self._text_block(f"  [{icon}] {dim}: {score:.1%}"))

        # Raw data
        children.append({
            "object": "block",
            "type": "heading_2",
            "heading_2": {"rich_text": self._rich_text("Raw Data")},
        })
        children.append({
            "object": "block",
            "type": "code",
            "code": {
                "rich_text": self._rich_text(json.dumps(spider_scores, indent=2)),
                "language": "json",
            },
        })

        body: dict[str, Any] = {
            "parent": {"database_id": db_id},
            "properties": properties,
            "children": children[:100],
        }

        result = self._request("POST", "/pages", body)

        if "id" in result:
            logger.info("Updated quality dashboard: %s", result["id"])
        else:
            logger.error("Failed to update dashboard: %s", result)

        return result

    def query_pages(
        self,
        database_id: str | None = None,
        filter_obj: dict[str, Any] | None = None,
        sorts: list[dict[str, Any]] | None = None,
        page_size: int = 100,
    ) -> list[dict[str, Any]]:
        """Query pages from a Notion database with optional filters and sorting."""
        db_id = database_id or self.database_id
        body: dict[str, Any] = {"page_size": min(page_size, 100)}
        if filter_obj:
            body["filter"] = filter_obj
        if sorts:
            body["sorts"] = sorts

        result = self._request("POST", f"/databases/{db_id}/query", body)
        return result.get("results", [])
