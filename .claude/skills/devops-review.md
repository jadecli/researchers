---
name: devops-review
description: Review all open PRs against team architectural decisions and return a polished report with action items. Designed for non-technical operators using Claude Cowork — no CLI knowledge needed.
---

# DevOps PR Review

Review all open pull requests in the jadecli/researchers repository and produce a clear, actionable report.

## What this skill does

When you say "Review my PRs" or "What needs my attention?", this skill:

1. **Pulls all open PRs** from GitHub
2. **Reads the changes** in each PR (files added, modified, deleted)
3. **Checks each PR** against 12 team engineering decisions (type safety, security, test coverage, naming, architecture)
4. **Finds cross-PR issues** — conflicts between PRs, dependency ordering, duplicated work
5. **Produces a report** you can review before anything is posted

## How to use it

### One-time review
> "Review all open PRs and tell me what needs attention"

### Scheduled (daily briefing)
> "Every morning at 9am, review open PRs and give me a summary"

This uses Cowork's scheduled tasks — set it once, get it daily.

### Targeted review
> "Review PR #7 — does the taxonomy DDL follow our Kimball conventions?"

### Before merging
> "Which PRs are safe to merge right now?"

## What you'll get back

A **deliverable report** with:
- Per-PR verdict (approve / needs changes / comment)
- Blockers that must be fixed before merge
- Warnings to consider
- Cross-PR analysis (merge order, conflicts)
- Action items checklist

## Approval gate

This skill **never posts comments automatically**. It shows you the review first. You decide:
- "Post this feedback to all PRs" — posts comments on GitHub
- "Just the blockers" — posts only blocker findings
- "Don't post, just save the report" — keeps it local

## Connectors used

| Connector | What it does |
|-----------|-------------|
| **GitHub** | Reads PRs, diffs, posts review comments |
| **Slack** | Posts summary to team channel (optional) |
| **Linear** | Creates issues for blockers (optional) |

## How it relates to Claude Code

This skill wraps the same DevOps engine that technical operators use via `claude --agent devops-reviewer` in the terminal. The engine is in `devops-review/src/`. You're getting the same analysis — just with a polished report instead of terminal output.

## Team decisions it checks

| # | Decision | What it means |
|---|----------|---------------|
| TD-001 | Branded types | IDs can't be mixed up (e.g., you can't accidentally pass a user ID where a project ID is expected) |
| TD-002 | Error handling | Functions return errors explicitly instead of crashing |
| TD-003 | Database layers | Data is organized in 3 layers: write, read, and business metrics |
| TD-004 | Type safety | No shortcuts in TypeScript — strict checking everywhere |
| TD-005 | Event logging | All important actions are logged for audit |
| TD-006 | Test coverage | New code must include tests |
| TD-007 | Security | No passwords or API keys in code |
| TD-008 | Naming rules | Consistent naming across Python and TypeScript |
| TD-009 | MCP servers | Integration servers follow a standard pattern |
| TD-010 | Agent definitions | AI agent configs use a standard format |
| TD-011 | Dependencies | No unnecessary packages |
| TD-012 | Learning loops | Each iteration builds on the last |
