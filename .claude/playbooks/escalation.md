# Escalation Playbook

> Decision tree for CI/CD failures, code quality issues, and architecture violations.
> Used by: triage-ci-failure.py, context-pre-commit.sh, context-pre-pr.sh, ci-quality-gate.yml

## Principles

1. **Never fail silent** — Every failure produces at least one artifact (TODO, Slack, or Linear)
2. **Gradual degradation** — If Slack fails, fall through to Linear; if Linear fails, log TODO
3. **Fix at root cause** — Don't band-aid; create the right ticket or TODO with context
4. **Delegate responsibility** — Route to the cheapest model that can handle it
5. **Escalate with context** — Each step enriches the failure with more information

## Decision Tree

```
CI/CD Failure Detected
│
├─ Can we classify it? (deterministic regex)
│  ├─ YES: FailureType assigned (type_error, lint, build, test, security, dep, arch)
│  └─ NO:  Route to haiku for classification ($0.001)
│
├─ Is it auto-fixable? (severity + type check)
│  ├─ FIX_INLINE (lint, simple type, dependency):
│  │  └─ Route haiku ($0.001, max 1024 tokens, 1 turn)
│  │     ├─ Fix succeeds → Apply + commit + continue
│  │     └─ Fix fails → Escalate to SLACK
│  │
│  ├─ FIX_WITH_CONTEXT (complex type, test, build):
│  │  └─ Route sonnet ($0.01, max 4096 tokens, 3 turns)
│  │     ├─ Fix succeeds → Apply in worktree + PR
│  │     └─ Fix fails → Escalate to LINEAR
│  │
│  └─ NOT_FIXABLE (security, architecture, unknown):
│     └─ Escalate to SLACK + LINEAR
│
├─ Slack Alert (SLACK_WEBHOOK_URL)
│  ├─ Available → Post Block Kit message with severity, file, error
│  └─ Unavailable → Fall through to LINEAR
│
├─ Linear Ticket (LINEAR_API_KEY + LINEAR_TEAM_ID)
│  ├─ Available → Create issue with full context, priority, acceptance criteria
│  └─ Unavailable → Fall through to TODO
│
└─ TODO Log (ALWAYS — guaranteed final step)
   └─ Append to todos.jsonl with:
      - failure type, severity, file, line
      - triage action taken, timestamp
      - marker: CI-{FAILURE_TYPE}
```

## Model Routing for Fixes

| Fix Type | Model | Max Tokens | Max Turns | Budget Cap | Use Case |
|----------|-------|------------|-----------|------------|----------|
| FIX_INLINE | haiku | 1,024 | 1 | $0.01 | Lint fixes, missing imports, simple types |
| FIX_WITH_CONTEXT | sonnet | 4,096 | 3 | $0.10 | Complex type errors, test fixes, build errors |
| CLASSIFY_UNKNOWN | haiku | 512 | 1 | $0.005 | Unrecognized error pattern classification |
| REVIEW_ARCH | opus | 8,192 | 1 | $0.50 | Architecture violation assessment (rare) |

## Hook Event Map

| Event | Hook Script | What It Checks | Blocks? |
|-------|-------------|----------------|---------|
| SessionStart | session-setup.sh | Environment, deps, context load | Never |
| PreToolUse(Bash→git commit) | context-pre-commit.sh | Format, types, arch, secrets | Yes |
| PreToolUse(Bash→gh pr / MCP PR) | context-pre-pr.sh | Build, push, conflicts, security | Yes |
| GitHub Actions (push/PR) | ci-quality-gate.yml | TS, Python, arch, security | Yes (CI) |
| GitHub Actions (failure) | triage-ci-failure.py | Classify → fix → slack → linear → todo | N/A |

## Severity → Action Matrix

| Severity | Auto-Fix? | Slack? | Linear? | TODO? |
|----------|-----------|--------|---------|-------|
| CRITICAL | Try sonnet | Always | Always | Always |
| HIGH | Try haiku/sonnet | On failure | On failure | Always |
| MEDIUM | Try haiku | No | Optional | Always |
| LOW | No | No | No | Always |

## Environment Variables

| Variable | Required By | Purpose |
|----------|------------|---------|
| ANTHROPIC_API_KEY | triage-ci-failure.py | Headless Claude for auto-fixes |
| SLACK_WEBHOOK_URL | triage-ci-failure.py, ci-quality-gate.yml | Slack failure notifications |
| LINEAR_API_KEY | triage-ci-failure.py | Linear ticket creation |
| LINEAR_TEAM_ID | triage-ci-failure.py | Linear team routing |
| LINEAR_PROJECT_ID | triage-ci-failure.py (optional) | Linear project scoping |
