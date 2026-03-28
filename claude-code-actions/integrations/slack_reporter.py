"""Slack integration for posting crawl summaries and quality alerts."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

logger = logging.getLogger(__name__)


class SlackReporter:
    """Post structured messages to Slack channels via the Slack Web API."""

    def __init__(
        self,
        token: str | None = None,
        channel: str | None = None,
        base_url: str = "https://slack.com/api",
    ) -> None:
        self.token = token or os.environ.get("SLACK_BOT_TOKEN", "")
        self.channel = channel or os.environ.get("SLACK_CHANNEL_ID", "")
        self.base_url = base_url.rstrip("/")

        if not self.token:
            logger.warning("SLACK_BOT_TOKEN not set; messages will not be delivered")

    def _post_message(self, blocks: list[dict[str, Any]], text: str = "") -> dict[str, Any]:
        """Send a block-kit message to the configured Slack channel."""
        if not self.token or not self.channel:
            logger.warning("Slack not configured, skipping message")
            return {"ok": False, "error": "not_configured"}

        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json; charset=utf-8",
        }
        payload = {
            "channel": self.channel,
            "text": text or "Claude Code Actions notification",
            "blocks": blocks,
        }

        try:
            resp = requests.post(
                f"{self.base_url}/chat.postMessage",
                headers=headers,
                json=payload,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            if not data.get("ok"):
                logger.error("Slack API error: %s", data.get("error"))
            return data
        except requests.RequestException as exc:
            logger.error("Failed to post to Slack: %s", exc)
            return {"ok": False, "error": str(exc)}

    def post_crawl_summary(
        self,
        target: str,
        spider: str,
        iterations: int,
        run_url: str = "",
        quality_score: float | None = None,
        pages_crawled: int = 0,
        errors: int = 0,
    ) -> dict[str, Any]:
        """Post a crawl run summary to Slack.

        Includes target URL, spider name, iteration count, quality score,
        and a link to the CI run.
        """
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        status_emoji = ":white_check_mark:" if (quality_score or 0) >= 0.85 else ":warning:"

        score_text = f"{quality_score:.1%}" if quality_score is not None else "N/A"

        blocks: list[dict[str, Any]] = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"Crawl Complete {status_emoji}", "emoji": True},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Target:*\n{target}"},
                    {"type": "mrkdwn", "text": f"*Spider:*\n{spider}"},
                    {"type": "mrkdwn", "text": f"*Iterations:*\n{iterations}"},
                    {"type": "mrkdwn", "text": f"*Quality Score:*\n{score_text}"},
                    {"type": "mrkdwn", "text": f"*Pages Crawled:*\n{pages_crawled}"},
                    {"type": "mrkdwn", "text": f"*Errors:*\n{errors}"},
                ],
            },
            {"type": "context", "elements": [{"type": "mrkdwn", "text": f"Completed at {now}"}]},
        ]

        if run_url:
            blocks.append({
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "View Run"},
                        "url": run_url,
                        "action_id": "view_run",
                    }
                ],
            })

        return self._post_message(blocks, text=f"Crawl complete: {target} ({spider})")

    def post_quality_alert(
        self,
        report_path: str = "",
        run_url: str = "",
        threshold: float = 0.85,
        scores: dict[str, float] | None = None,
    ) -> dict[str, Any]:
        """Post a quality alert when scores are available.

        If a report HTML file is provided, extracts summary data from it.
        Otherwise uses the scores dict directly.
        """
        if scores is None:
            scores = self._extract_scores_from_report(report_path) if report_path else {}

        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        failing = {k: v for k, v in scores.items() if v < threshold}
        passing = {k: v for k, v in scores.items() if v >= threshold}

        if failing:
            header_text = f":rotating_light: Quality Alert - {len(failing)} spider(s) below threshold"
        elif scores:
            header_text = ":white_check_mark: All Spiders Passing Quality Gate"
        else:
            header_text = ":information_source: Quality Report Generated"

        blocks: list[dict[str, Any]] = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": header_text, "emoji": True},
            },
        ]

        if scores:
            score_lines = []
            for spider, score in sorted(scores.items()):
                icon = ":white_check_mark:" if score >= threshold else ":x:"
                score_lines.append(f"{icon} *{spider}*: {score:.1%}")
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": "\n".join(score_lines)},
            })

        blocks.append({
            "type": "context",
            "elements": [{"type": "mrkdwn", "text": f"Threshold: {threshold:.0%} | Report generated at {now}"}],
        })

        if run_url:
            blocks.append({
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "View Report"},
                        "url": run_url,
                        "action_id": "view_report",
                    }
                ],
            })

        return self._post_message(blocks, text=header_text)

    def post_ci_failure(
        self,
        repo: str,
        branch: str,
        commit_sha: str,
        author: str,
        failed_jobs: list[str],
        run_url: str = "",
        error_summary: str = "",
    ) -> dict[str, Any]:
        """Post a CI/CD failure alert to Slack.

        Called by GitHub Actions on quality gate, security scan, or build failures.
        """
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        jobs_text = "\n".join(f":x: {job}" for job in failed_jobs) if failed_jobs else ":x: Unknown job"

        blocks: list[dict[str, Any]] = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": ":rotating_light: CI/CD Failure", "emoji": True},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Repo:*\n{repo}"},
                    {"type": "mrkdwn", "text": f"*Branch:*\n{branch}"},
                    {"type": "mrkdwn", "text": f"*Author:*\n{author}"},
                    {"type": "mrkdwn", "text": f"*Commit:*\n`{commit_sha[:8]}`"},
                ],
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Failed Jobs:*\n{jobs_text}"},
            },
        ]

        if error_summary:
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Error Summary:*\n```{error_summary[:500]}```"},
            })

        blocks.append({"type": "context", "elements": [{"type": "mrkdwn", "text": f"Failed at {now}"}]})

        if run_url:
            blocks.append({
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "View Failed Run"},
                        "url": run_url,
                        "style": "danger",
                        "action_id": "view_failed_run",
                    }
                ],
            })

        return self._post_message(blocks, text=f"CI failed: {repo} ({branch})")

    def post_security_alert(
        self,
        repo: str,
        scan_type: str,
        findings: list[dict[str, str]],
        run_url: str = "",
    ) -> dict[str, Any]:
        """Post a security scan alert to Slack.

        Args:
            repo: Repository name
            scan_type: Type of scan (secrets, PII, SSRF, dependency)
            findings: List of {severity, file, description} dicts
            run_url: Link to the CI run
        """
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        critical = sum(1 for f in findings if f.get("severity") == "critical")
        high = sum(1 for f in findings if f.get("severity") == "high")

        severity_text = f":rotating_light: {critical} critical, :warning: {high} high"
        finding_lines = []
        for f in findings[:10]:
            icon = ":rotating_light:" if f.get("severity") == "critical" else ":warning:"
            finding_lines.append(f"{icon} `{f.get('file', '?')}`: {f.get('description', '?')}")

        blocks: list[dict[str, Any]] = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f":shield: Security Alert — {scan_type}", "emoji": True},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Repo:*\n{repo}"},
                    {"type": "mrkdwn", "text": f"*Findings:*\n{severity_text}"},
                ],
            },
        ]

        if finding_lines:
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": "\n".join(finding_lines)},
            })

        if len(findings) > 10:
            blocks.append({
                "type": "context",
                "elements": [{"type": "mrkdwn", "text": f"Showing 10 of {len(findings)} findings"}],
            })

        blocks.append({"type": "context", "elements": [{"type": "mrkdwn", "text": f"Scanned at {now}"}]})

        if run_url:
            blocks.append({
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "View Scan"},
                        "url": run_url,
                        "action_id": "view_scan",
                    }
                ],
            })

        return self._post_message(blocks, text=f"Security alert: {scan_type} in {repo}")

    @staticmethod
    def _extract_scores_from_report(report_path: str) -> dict[str, float]:
        """Attempt to extract quality scores from a generated HTML report.

        Looks for a JSON data block embedded in the report. Falls back to
        scanning for quality JSON files in sibling output directories.
        """
        scores: dict[str, float] = {}

        report = Path(report_path)
        if not report.exists():
            logger.warning("Report file not found: %s", report_path)
            return scores

        html = report.read_text(encoding="utf-8")

        # Look for embedded JSON: <script id="report-data">...</script>
        marker_start = 'id="report-data">'
        marker_end = "</script>"
        idx = html.find(marker_start)
        if idx >= 0:
            start = idx + len(marker_start)
            end = html.find(marker_end, start)
            if end >= 0:
                try:
                    data = json.loads(html[start:end])
                    if isinstance(data, dict) and "spiders" in data:
                        for spider_name, info in data["spiders"].items():
                            if isinstance(info, dict) and "overall_score" in info:
                                scores[spider_name] = float(info["overall_score"])
                        return scores
                except (json.JSONDecodeError, ValueError):
                    pass

        # Fallback: scan output/*/quality.json
        output_dir = report.parent.parent / "output"
        if output_dir.is_dir():
            for quality_file in output_dir.glob("*/quality.json"):
                try:
                    data = json.loads(quality_file.read_text())
                    spider_name = quality_file.parent.name
                    if "overall_score" in data:
                        scores[spider_name] = float(data["overall_score"])
                except (json.JSONDecodeError, ValueError, KeyError):
                    pass

        return scores
