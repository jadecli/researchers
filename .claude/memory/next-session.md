# Next Session Context

> This file is dynamically replaced at the end of each Claude Code session.
> It captures out-of-scope items from the current session that should be
> addressed in a fresh PR. Read by the SessionStart hook for continuity.
>
> Last updated: 2026-03-27 (session: typescript-data-warehouse-artifacts)

## Claude Code Version Pin

**Last reviewed:** `2.1.80`
**Current latest:** `2.1.85`
**Changelog:** https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md

At session start, diff the changelog from the pinned version to current.
Incorporate relevant improvements into this repo's structure, hooks, and workflows.
After reviewing, bump the pin to the latest version in this file.

### Notable changes since 2.1.80 to evaluate for adoption:
- **2.1.81**: `--bare` flag for scripted API calls; `--channels` permission relay for mobile approval
- **2.1.82**: Worktree session initialization fixes
- **2.1.83**: Drop-in directory support for modular policy; `CwdChanged`/`FileChanged` reactive hooks; `initialPrompt` frontmatter for agents
- **2.1.84**: `TaskCreated` hook for task lifecycle; `PreToolUse` hooks can provide headless answers; model capability detection env vars
- **2.1.85**: Conditional hook execution via permission rule syntax; MCP OAuth RFC 9728; org-managed plugin blocking

## Out of Scope (do NOT add to current PR)

### ci: add Claude Code CI/CD checks to GitHub Actions

Add two GitHub Actions workflows using `CLAUDE_CODE_OAUTH_TOKEN` from repo secrets
(alternative to `ANTHROPIC_API_KEY` for Claude Code Pro Max subscribers at $200/month):

1. **Claude Code CI check** (`claude-code-ci.yml`)
   - Trigger: on PR to `main`
   - Runs `claude -p "review this PR for correctness"` against the diff
   - Uses `anthropics/claude-code-action@v1` with `CLAUDE_CODE_OAUTH_TOKEN`
   - Scope: `agenttasks/` changes only (skip non-deployed sub-repos)

2. **Claude Code security review** (`claude-code-security.yml`)
   - Trigger: on PR to `main`
   - Runs the `claude-code-security-review/` scanners (PII, SSRF, injection, exfiltration)
   - Uses `CLAUDE_CODE_OAUTH_TOKEN` for AI-assisted triage of findings
   - Posts findings as PR review comments

### feat: dual-format agenttasks — human-readable webapp + AI agent-optimized markup

Make agenttasks.io serve both humans (browser) and AI agents (crawlers, Claude, GPT, etc.)
across all seven areas of the agent-readable web spec:

#### 1. Site-level discovery
- `public/llms.txt` — structured site index for LLM crawlers (llmstxt.org spec)
- `public/robots.txt` — allow AI user-agents, link to sitemaps
- Dual sitemaps: XML (`sitemap.xml`) for search engines + Markdown (`sitemap.md`) for LLMs
- `AGENTS.md` at repo root — describes capabilities, API surface, tool usage for agent consumers

#### 2. Page-level HTML requirements
- Canonical `<link rel="canonical">` on every page
- `<meta name="description">` and `<meta name="robots">` tags
- JSON-LD structured data (`@type: WebSite`, `@type: WebPage`, `@type: TechArticle`)
- Clean heading hierarchy (single `<h1>`, logical `<h2>`–`<h4>` nesting)
- High signal-to-noise ratio: minimize boilerplate, maximize content density

#### 3. Markdown mirrors + content negotiation
- Static `.md` files alongside each page route (e.g., `/specification.md`)
- Next.js middleware: `Accept: text/markdown` header serves `.md` instead of HTML
- `<link rel="alternate" type="text/markdown" href="...">` in HTML `<head>`
- Cloudflare/Vercel edge fallback: redirect `*.md` URLs to markdown content

#### 4. Code/API docs
- Language-tagged code blocks with `data-language` attributes
- OpenAPI/JSON Schema links for the task specification format
- Inline `<code>` with semantic markup for type references

#### 5. Next.js-specific tooling
- Evaluate `@agentmarkup/next` package for automated agent markup generation
- Use Next.js built-in `metadata` API for all SEO/agent meta tags
- Middleware pattern for content negotiation (`middleware.ts`)
- `generateStaticParams` for pre-rendering markdown variants

#### 6. Implementation checklist (5 phases for agenttasks)
- Phase 1: `llms.txt` + `robots.txt` + `AGENTS.md` (site discovery)
- Phase 2: Meta tags + JSON-LD + canonical links (page-level HTML)
- Phase 3: Markdown mirrors + `Accept` negotiation middleware (content negotiation)
- Phase 4: Code block markup + OpenAPI schema links (API docs)
- Phase 5: `@agentmarkup/next` integration + dual sitemap generation (tooling)

#### 7. Reference URLs
- llmstxt.org spec: https://llmstxt.org/
- AGENTS.md convention: https://agents-md.org/ (if standardized) or follow Vercel's pattern
- JSON-LD: https://json-ld.org/ and https://schema.org/TechArticle
- @agentmarkup/next: https://www.npmjs.com/package/@agentmarkup/next
- Next.js Metadata API: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- Sitemap generation: https://nextjs.org/docs/app/api-reference/file-conventions/sitemap

#### Key files to create/modify
- `agenttasks/public/llms.txt` — CREATE
- `agenttasks/public/robots.txt` — CREATE
- `agenttasks/src/app/sitemap.ts` — CREATE (Next.js sitemap route)
- `agenttasks/src/middleware.ts` — CREATE (content negotiation)
- `agenttasks/src/app/layout.tsx` — MODIFY (JSON-LD, meta tags)
- `AGENTS.md` — CREATE (root level)
- Per-route `.md` static files — CREATE alongside each page.tsx

### References
- Existing workflows in `claude-code-actions/.github/workflows/` (7 workflows)
- Security scanners in `claude-code-security-review/scanners/` (Python, TS, Go, Rust)
- Hook profiles in `claude-multi-agent-sdk/src/hooks/profiles.ts` (CI profile pattern)
- `CLAUDE_CODE_OAUTH_TOKEN`: GitHub repo secret, OAuth token from Claude Code Pro Max subscription
