"""Linear integration for creating improvement issues and syncing campaign tasks."""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any

import requests

logger = logging.getLogger(__name__)

LINEAR_API_URL = "https://api.linear.app/graphql"


@dataclass
class LinearIssue:
    """Represents a Linear issue."""

    id: str = ""
    identifier: str = ""
    title: str = ""
    description: str = ""
    state: str = ""
    url: str = ""
    labels: list[str] = field(default_factory=list)
    priority: int = 0


class LinearSync:
    """Sync spider improvement tasks with Linear project management."""

    def __init__(
        self,
        api_key: str | None = None,
        team_id: str | None = None,
        project_id: str | None = None,
    ) -> None:
        self.api_key = api_key or os.environ.get("LINEAR_API_KEY", "")
        self.team_id = team_id or os.environ.get("LINEAR_TEAM_ID", "")
        self.project_id = project_id or os.environ.get("LINEAR_PROJECT_ID", "")

        if not self.api_key:
            logger.warning("LINEAR_API_KEY not set; Linear operations will fail")

    def _graphql(self, query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
        """Execute a GraphQL query against the Linear API."""
        headers = {
            "Authorization": self.api_key,
            "Content-Type": "application/json",
        }
        payload: dict[str, Any] = {"query": query}
        if variables:
            payload["variables"] = variables

        try:
            resp = requests.post(LINEAR_API_URL, headers=headers, json=payload, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            if "errors" in data:
                logger.error("Linear GraphQL errors: %s", data["errors"])
            return data
        except requests.RequestException as exc:
            logger.error("Linear API request failed: %s", exc)
            return {"errors": [{"message": str(exc)}]}

    def create_improvement_issue(
        self,
        spider_name: str,
        dimension: str,
        current_score: float,
        target_score: float = 0.85,
        details: str = "",
        priority: int = 2,
        labels: list[str] | None = None,
    ) -> LinearIssue:
        """Create a Linear issue for a spider quality improvement task.

        Args:
            spider_name: Name of the spider to improve
            dimension: Quality dimension (completeness, accuracy, freshness)
            current_score: Current quality score (0.0-1.0)
            target_score: Target quality score
            details: Additional context about the improvement needed
            priority: Linear priority (0=none, 1=urgent, 2=high, 3=medium, 4=low)
            labels: Optional label IDs to attach
        """
        title = f"Improve {spider_name} spider: {dimension} ({current_score:.0%} -> {target_score:.0%})"

        description = f"""## Spider Improvement Task

**Spider:** {spider_name}
**Dimension:** {dimension}
**Current Score:** {current_score:.1%}
**Target Score:** {target_score:.1%}

### Details
{details or 'Automated improvement task created by quality gate.'}

### Acceptance Criteria
- [ ] {dimension.capitalize()} score reaches {target_score:.0%} or higher
- [ ] All existing tests continue to pass
- [ ] Quality report confirms improvement
"""

        mutation = """
        mutation CreateIssue($input: IssueCreateInput!) {
            issueCreate(input: $input) {
                success
                issue {
                    id
                    identifier
                    title
                    url
                    state { name }
                }
            }
        }
        """

        variables: dict[str, Any] = {
            "input": {
                "teamId": self.team_id,
                "title": title,
                "description": description,
                "priority": priority,
            }
        }

        if self.project_id:
            variables["input"]["projectId"] = self.project_id

        if labels:
            variables["input"]["labelIds"] = labels

        result = self._graphql(mutation, variables)

        issue = LinearIssue(title=title, description=description, priority=priority)

        issue_data = (
            result.get("data", {}).get("issueCreate", {}).get("issue", {})
        )
        if issue_data:
            issue.id = issue_data.get("id", "")
            issue.identifier = issue_data.get("identifier", "")
            issue.url = issue_data.get("url", "")
            issue.state = issue_data.get("state", {}).get("name", "")
            logger.info("Created Linear issue: %s (%s)", issue.identifier, issue.url)
        else:
            logger.error("Failed to create Linear issue: %s", result)

        return issue

    def sync_campaign_tasks(
        self,
        campaign_name: str,
        spider_scores: dict[str, dict[str, float]],
        threshold: float = 0.85,
    ) -> list[LinearIssue]:
        """Sync a full improvement campaign to Linear.

        For each spider with scores below threshold, creates or updates
        a Linear issue. Returns the list of created/existing issues.

        Args:
            campaign_name: Name for this improvement campaign
            spider_scores: Dict of {spider_name: {dimension: score}}
            threshold: Quality threshold below which issues are created
        """
        issues: list[LinearIssue] = []

        # First, fetch existing issues for this campaign
        existing = self._fetch_campaign_issues(campaign_name)
        existing_keys = {(i.title.split(":")[0].replace("Improve ", "").strip()) for i in existing}

        for spider_name, dimensions in spider_scores.items():
            for dimension, score in dimensions.items():
                if score >= threshold:
                    continue

                if spider_name in existing_keys:
                    logger.info("Issue already exists for %s, skipping", spider_name)
                    matched = [i for i in existing if spider_name in i.title]
                    issues.extend(matched)
                    continue

                issue = self.create_improvement_issue(
                    spider_name=spider_name,
                    dimension=dimension,
                    current_score=score,
                    target_score=threshold,
                    details=f"Part of campaign: {campaign_name}",
                    priority=1 if score < 0.5 else 2 if score < 0.7 else 3,
                )
                issues.append(issue)

        logger.info(
            "Campaign '%s': %d issues synced (%d new)",
            campaign_name,
            len(issues),
            len(issues) - len([i for i in issues if i in existing]),
        )
        return issues

    def _fetch_campaign_issues(self, campaign_name: str) -> list[LinearIssue]:
        """Fetch existing issues that match a campaign name."""
        query = """
        query SearchIssues($filter: IssueFilter) {
            issues(filter: $filter, first: 100) {
                nodes {
                    id
                    identifier
                    title
                    description
                    url
                    state { name }
                    labels { nodes { name } }
                    priority
                }
            }
        }
        """

        variables = {
            "filter": {
                "description": {"contains": campaign_name},
                "team": {"id": {"eq": self.team_id}},
            }
        }

        result = self._graphql(query, variables)
        nodes = result.get("data", {}).get("issues", {}).get("nodes", [])

        issues = []
        for node in nodes:
            issue = LinearIssue(
                id=node.get("id", ""),
                identifier=node.get("identifier", ""),
                title=node.get("title", ""),
                description=node.get("description", ""),
                url=node.get("url", ""),
                state=node.get("state", {}).get("name", ""),
                labels=[l["name"] for l in node.get("labels", {}).get("nodes", [])],
                priority=node.get("priority", 0),
            )
            issues.append(issue)

        return issues

    def close_issue(self, issue_id: str, state_name: str = "Done") -> bool:
        """Transition an issue to a completed state."""
        # First, look up the state ID
        state_query = """
        query TeamStates($teamId: String!) {
            team(id: $teamId) {
                states { nodes { id name } }
            }
        }
        """
        state_result = self._graphql(state_query, {"teamId": self.team_id})
        states = state_result.get("data", {}).get("team", {}).get("states", {}).get("nodes", [])
        target_state = next((s for s in states if s["name"].lower() == state_name.lower()), None)

        if not target_state:
            logger.error("State '%s' not found for team %s", state_name, self.team_id)
            return False

        mutation = """
        mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
            issueUpdate(id: $id, input: $input) {
                success
            }
        }
        """
        result = self._graphql(mutation, {
            "id": issue_id,
            "input": {"stateId": target_state["id"]},
        })

        success = result.get("data", {}).get("issueUpdate", {}).get("success", False)
        if success:
            logger.info("Closed issue %s -> %s", issue_id, state_name)
        return success
