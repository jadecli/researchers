---
source: https://github.com/anthropics/claude-quickstarts/blob/main/CLAUDE.md
fetched: 2026-03-28
description: Claude Quickstarts development guide — computer-use-demo, customer support agent, financial data analyst
---

# Claude Quickstarts

This repo contains quickstart projects for building with Claude and the Anthropic API.

## Projects

### computer-use-demo

A demonstration of Claude's computer use capabilities. Shows how to set up Claude to interact with a desktop environment, take screenshots, click, type, and navigate applications.

- **Stack**: Python, Docker, Anthropic API
- **Key files**: `computer_use_demo/`, `Dockerfile`
- **Run**: `docker build -t computer-use-demo . && docker run -p 8080:8080 computer-use-demo`

### customer-support-agent

An AI-powered customer support agent built with Claude. Handles common support queries, escalates complex issues, and maintains conversation context.

- **Stack**: Python, FastAPI, Anthropic API
- **Key files**: `customer_support_agent/`
- **Run**: `cd customer_support_agent && pip install -r requirements.txt && python main.py`

### financial-data-analyst

A financial data analysis tool powered by Claude. Analyzes financial documents, generates reports, and answers questions about financial data.

- **Stack**: Python, Anthropic API
- **Key files**: `financial_data_analyst/`
- **Run**: `cd financial_data_analyst && pip install -r requirements.txt && python main.py`

## Development

- Each project has its own `requirements.txt` or `package.json`
- Set `ANTHROPIC_API_KEY` environment variable before running
- See individual project READMEs for detailed setup instructions

## Testing

- Run tests per project: `cd <project> && pytest`
- No monorepo-level test runner

## Contributing

- Follow existing code style in each project
- Add tests for new functionality
- Update project README when adding features
