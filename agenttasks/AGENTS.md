<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AgentTasks — AI Agent Capabilities

## Overview
AgentTasks is a data-driven task orchestration webapp for AI agents.
Built with Next.js 14+ (App Router), deployed on Vercel.

## Discovery
- **llms.txt**: `/llms.txt` — Structured route listing for AI agent navigation
- **robots.txt**: `/robots.txt` — Standard crawler directives
- **JSON-LD**: Embedded in root layout as WebApplication schema

## Capabilities
- **Task Management**: Create, track, and manage agent tasks via `/tasks`
- **Quality Rounds**: 10 iterative quality improvement rounds via `/rounds`
- **Experiments**: A/B variant testing via `/experiments`
- **Scrapy Docs**: Complete Scrapy documentation mirror (60+ pages)
- **API Endpoints**: `/api/pages` (GET), `/api/tasks` (GET/POST)

## Technical Stack
- Next.js 14+ with App Router (Server Components by default)
- Local fonts only (`next/font/local` — NOT `next/font/google`)
- Framer Motion (`motion/react`) for animations
- Tailwind CSS utility classes
- Dark theme: `#141413` background, `#faf9f5` text

## For AI Agents
- Read `/llms.txt` for a complete route map with descriptions
- Use `/api/tasks` for programmatic task management
- All pages are server-rendered and accessible without JavaScript
