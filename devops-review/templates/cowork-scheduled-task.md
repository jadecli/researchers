# Cowork Scheduled Task: Daily PR Briefing

## How to set this up in Claude Cowork

Open Claude Desktop (or mobile) and say:

> "Every weekday morning at 9am, review all open PRs in jadecli/researchers
> and give me a briefing. Check for blockers, merge conflicts, and anything
> that needs my attention before the team standup."

Claude Cowork will:
1. Confirm the schedule (weekdays, 9am your local time)
2. Ask which connectors to use (GitHub — required; Slack — optional)
3. Save it as a recurring scheduled task

## What happens each morning

1. Claude opens the GitHub connector and pulls all open PRs
2. For each PR, it reads the diff and runs the DevOps review skill
3. It produces a **Daily PR Briefing** deliverable (see template below)
4. The briefing appears in your Cowork conversation — ready for review

## Briefing template

The deliverable follows this structure:

```
# Daily PR Briefing — [date]

## Quick Summary
- X PRs open, Y ready to merge, Z need attention

## Needs Your Attention
[PRs with blockers or warnings, sorted by severity]

### PR #N: [title]
- **Verdict**: CHANGES REQUESTED
- **Blockers**: [list]
- **What to do**: [specific action items]

## Ready to Merge
[PRs that passed all checks]

### PR #N: [title]
- **Verdict**: APPROVE
- All checks passed

## Cross-PR Notes
[Any conflicts, dependencies, or merge ordering]

## Action Items
- [ ] Review blockers in PR #N
- [ ] Merge PR #M (approved, no conflicts)
- [ ] Coordinate PR #X and #Y (touching same files)
```

## Modifying the schedule

Say any of these to Claude:
- "Change my PR briefing to 8am"
- "Add a Friday afternoon PR summary too"
- "Pause the daily briefing this week"
- "Also post the briefing to #dev-ops in Slack"

## How it relates to Claude Code

Technical operators can get the same analysis by running:
```bash
claude --agent devops-reviewer
```

The Cowork scheduled task is the non-technical equivalent — same engine, polished delivery, approval gates before posting.
