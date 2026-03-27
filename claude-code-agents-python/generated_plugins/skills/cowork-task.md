---
description: Route tasks to knowledge-work-plugins domains and get plugin recommendations.
tools:
  - Bash
  - Read
  - Grep
model: claude-sonnet-4-20250514
references:
  - src/cowork/task_router.py
  - src/cowork/plugin_recommender.py
  - src/cowork/knowledge_synthesizer.py
scripts:
  - python -m src.cli cowork-task
---

# cowork-task

Route tasks to knowledge-work-plugins domains and get plugin recommendations.

## Usage

Use this skill to determine the best domain and plugins for a given task. The router analyzes the task description against 10 knowledge-work domains:

- **Engineering**: Code review, architecture, DevOps
- **Data**: Analytics, ML/AI, data pipelines
- **Sales**: CRM, pipeline management, outreach
- **Marketing**: Content, SEO, campaigns
- **Legal**: Contracts, compliance, policy
- **Product**: PRDs, roadmaps, user research
- **Design**: UI/UX, design systems, prototyping
- **Support**: Tickets, knowledge bases, onboarding
- **Finance**: Budgets, reporting, forecasting
- **HR**: Recruiting, performance, training

## Parameters

- **task**: Task description (required).
- **top-k**: Number of top domain matches to show (default: 3).
- **recommend/no-recommend**: Include plugin recommendations (default: yes).

## Example

```bash
python -m src.cli cowork-task \
  --task "Set up CI/CD pipeline and review the deployment architecture" \
  --top-k 3
```

## Output

The command shows:
1. **Domain Matches**: Ranked domains with confidence scores and matched keywords.
2. **Plugin Recommendations**: Specific plugins with relevance scores and capabilities.

## Instructions

1. Describe the task in natural language with sufficient detail.
2. Review the top domain matches to understand task categorization.
3. Consider the recommended plugins for assistance.
4. Use the suggested plugins to complete the task or generate appropriate skills.
