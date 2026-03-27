# Skill: Slack Report

Post crawl summaries and quality alerts to Slack channels.

## When to Use

- A crawl has completed and results should be shared with the team
- Quality scores drop below threshold and the team needs an alert
- Weekly quality reports should be posted automatically

## Instructions

1. Configure Slack credentials:
   - `SLACK_BOT_TOKEN` -- Slack bot OAuth token (xoxb-...)
   - `SLACK_CHANNEL_ID` -- Target channel ID (C...)

2. Post a crawl summary after a crawl completes:
   ```python
   from integrations.slack_reporter import SlackReporter

   reporter = SlackReporter()
   reporter.post_crawl_summary(
       target="https://example.com",
       spider="default",
       iterations=3,
       quality_score=0.92,
       pages_crawled=47,
       run_url="https://github.com/org/repo/actions/runs/123"
   )
   ```

3. Post a quality alert (typically from the weekly report workflow):
   ```python
   reporter.post_quality_alert(
       report_path="reports/weekly-quality.html",
       run_url="https://github.com/org/repo/actions/runs/456",
       threshold=0.85
   )
   ```

4. Or post with explicit scores:
   ```python
   reporter.post_quality_alert(
       scores={"default": 0.92, "deep": 0.78, "breadth": 0.88, "api": 0.95},
       threshold=0.85
   )
   ```

## Message Format

Messages use Slack Block Kit with:
- Header with status indicator (pass/fail)
- Score fields for each spider and dimension
- Link button to the CI run or report
- Timestamp context

## Key Files

- `integrations/slack_reporter.py` -- SlackReporter class
- `.github/workflows/quality-report.yml` -- weekly report with Slack notification
- `.github/workflows/scheduled-crawl.yml` -- crawl summary notification
