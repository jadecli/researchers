# Session User Prompts (verbatim)
# Session: claude/setup-multi-agent-routing-6iYl3
# Extracted: 2026-03-28
# Source: af837890-61d2-4ec7-87a3-aa692e66f9f0.jsonl

---

## Prompt 1
Read .claude/bootstrap.xml first — it defines model routing and architecture components. Do NOT read all research docs at once. Instead:

1. Read only .claude/memory/next-session.md to understand what's in scope
2. Pick ONE P0 item from the out-of-scope list to work on this session
3. Use the Plan agent (model: opus) to design the implementation before writing any code
4. Fan out Sonnet subagents for file reads, grep searches, web fetches, and test runs
5. Fan out Haiku subagents for file existence checks, validation, and status queries
6. Keep Opus for planning, complex codegen, and architectural decisions only
7. After each milestone, commit and pause — don't chain more than 3 commits without checking in

The research docs in .claude/research/ are reference material. Read them lazily — only when you're actively implementing that component, not at session start. The bootstrap.xml has enough summary context for each component.

Start by telling me which P0 item you recommend tackling and your proposed 3-step plan.

---

## Prompt 2
I want you to understand and inject this to your cloud session. I’ve merged this PR so i want to keep this sesssion focused on chat and research since u have context

---

## Prompt 3
User actions taken (on going reference to add to that inject) , I’ve started the new session. Assume that session is live. What else should i do in another session

---

## Prompt 4
Can you fetch origin main

---

## Prompt 5
Can you actually try use this multi agent where you orchestrate and route cheaper models and have separate context windows by implementing what we have already implemented such that you can programmatically use dspy to prompt subagents to complete clear tasks and then compact their findings before giving back to you? I want you to use the agent loop to conduct a codebase audit incrementally using subagents

---

## Prompt 6
<task-notification>
<task-id>acce51f6253ed50a0</task-id>
<tool-use-id>toolu_016fTf1CNksjEfRC947WcKeG</tool-use-id>
<output-file>/tmp/claude-0/-home-user-researchers/2c600d9c-71d6-4d6c-a824-defcb7b61daa/tasks/acce51f6253ed50a0.output</output-file>
<status>completed</status>
<summary>Agent "Audit cross-repo dependencies" completed</summary>
<result>I now have all the data needed for a complete audit. Here is the report:

---

## Dependency Audit — jadecli/researchers

### CROSS_REFS

No package.json or pyproject.toml in any sub-repo references another sub-repo via `file:`, `workspace:`, or `git:` links. The root `package.json` has no `workspaces` field — it is just a script delegator, not a proper npm workspace.

At the **import/runtime level**, there are also no direct cross-repo module imports. The one apparent coupling is that `agenttasks/src/app/page.tsx` mentions sibling repos by name in UI copy (string literals only, not imports). The Python repos (`claude-code-agents-python`) invoke `claude -p` as a subprocess, which is a runtime dependency on the Claude CLI binary, not on any sibling repo package.

**CROSS_REFS: none** — all 9 sub-repos are fully independent packages.

---

### VERSION_CONFLICTS

Shared dependencies with divergent version constraints across sub-repos:

| Dependency | Versions in use | Repos affected |
|---|---|---|
| `@types/node` | `^20` vs `^22.0.0` | `agenttasks` (^20) vs `claude-multi-agent-sdk`, `claude-multi-agent-dispatch`, `claude-channel-dispatch-routing`, `claude-dspy-crawl-planning` (all ^22) |
| `pytest` | `>=7.0`, `>=7.4`, `>=8.0`, unpinned | `claude-code` (>=7.0), `claude-code-actions` (>=7.4), `claude-code-agents-python` (>=8.0), `claude-multi-agent-dispatch` (>=7.0), `claude-code-security-review` (unpinned) |
| `click` | `>=8.0`, `>=8.1`, unpinned | `claude-code-agents-python` (>=8.0), `claude-code-actions` (>=8.1), `claude-code-security-review` & `claude-multi-agent-dispatch` (unpinned) |
| `pyyaml` | `>=6.0` vs unpinned | `claude-code-actions` (>=6.0), others fully unpinned |
| `ruff` | `>=0.1`, `>=0.4`, unpinned | `claude-code-actions` (>=0.1), `claude-code-agents-python` (>=0.4), `claude-code` & `claude-multi-agent-dispatch` (unpinned) |
| `mypy` | `>=1.5`, `>=1.7`, `>=1.10`, unpinned | `claude-multi-agent-dispatch` (>=1.5), `claude-code-actions` (>=1.7), `claude-code-agents-python` (>=1.10), `claude-code` (unpinned) |
| `pytest-asyncio` | `>=0.21` vs `>=0.23` | `claude-multi-agent-dispatch` (>=0.21) vs `claude-code-agents-python` (>=0.23) |
| `react` / `react-dom` | exact `19.2.4` (agenttasks only — no conflict, just a risk flag) | `agenttasks` |
| Python build backend | `setuptools.backends._legacy:_Backend` vs `setuptools.build_meta` | `claude-code`, `claude-code-actions`, `claude-code-security-review` use the legacy private backend; `claude-code-agents-python`, `claude-multi-agent-dispatch` use the standard one |

The JS/TS repos (`claude-multi-agent-sdk`, `claude-multi-agent-dispatch`, `claude-channel-dispatch-routing`, `claude-dspy-crawl-planning`) are internally consistent: `@anthropic-ai/sdk ^0.52.0`, `@modelcontextprotocol/sdk ^1.12.0`, `zod ^3.23.0`, `typescript ^5.7.0`, `vitest ^2.0.0` all match. The only JS outlier is `agenttasks` which is on a different toolchain entirely (Next.js, no vitest, `typescript ^5` without the minor pin).

---

### HIGH_RISK_DEPS

| Dependency | Risk | Repo(s) |
|---|---|---|
| `@anthropic-ai/claude-agent-sdk ^0.2.33` | Uses `unstable_v2_*` API surface — package name prefix indicates pre-stable. Type definitions reference `unstable_v2_createSession`, `send()`, `stream()` patterns. Breaking changes expected without semver guarantees. | `claude-multi-agent-sdk`, `claude-dspy-crawl-planning` |
| `@types/bun: latest` | Floating `latest` pinning in a devDependency is a reproducibility hazard — any `npm install` can pull a breaking type update. Also Bun types in a project that otherwise targets Node.js is an inconsistency signal. | `claude-channel-dispatch-routing` |
| `react: 19.2.4` / `react-dom: 19.2.4` | Exact-pinned (no `^`) — won't receive patch security fixes automatically. React 19 is relatively new as of the audit date, and exact pinning in combination with `next: 16.2.1` (also exact-pinned) means security patches require manual bumps. | `agenttasks` |
| `setuptools.backends._legacy:_Backend` | This is a setuptools-internal private API path, not the documented public `setuptools.build_meta`. It may break without warning on setuptools upgrades. Three repos use it. | `claude-code`, `claude-code-actions`, `claude-code-security-review` |
| `spidermon` (unpinned) | Scrapy monitoring extension; no version pin means it tracks HEAD. Spidermon has historically had dependency conflicts with Scrapy minor versions. | `claude-code` |
| `scrapy-deltafetch` (unpinned) | Unmaintained / infrequently updated package. No version constraint. | `claude-code` |
| `dspy-ai>=2.5` | DSPy renamed its package from `dspy-ai` to `dspy` in 2024. `dspy-ai` on PyPI is the old package; `>=2.5` may or may not resolve to the maintained version depending on PyPI state. Needs verification. | `claude-code-agents-python` |
| `selenium>=4.15` / `playwright>=1.40` | Large browser automation deps in optional extras; not a CVE issue per se but both have frequent CVEs in older pinned versions. Currently range-pinned which is acceptable, but worth tracking. | `claude-code-actions` |
| `pytest-cov` (fully unpinned in claude-code) | No version constraint on a dev tool that has occasionally had compatibility breaks with pytest major versions. | `claude-code` |

---

### ISOLATION_SCORE

**Fully isolated** at the package dependency graph level.

- Zero `file:`, `workspace:`, or `git:` cross-references exist between any of the 9 sub-repos.
- The root `package.json` declares no `workspaces` array — it is a thin script runner, not an npm workspace manager.
- No TypeScript or Python source file imports a module from a sibling sub-repo.
- Runtime coupling exists only through the Claude CLI binary (`claude -p` subprocess calls in `claude-code-agents-python`) and through shared environment variables (`ANTHROPIC_API_KEY`), neither of which constitutes a package-level dependency.
- The 4 JS/TS sub-repos share the same Anthropic SDK version constraints and could be linked as workspace packages without changes to their source, but currently are not.

The main operational risk is not coupling but **inconsistent pinning hygiene**: several Python repos leave key deps unpinned (`click`, `pyyaml`, `pytest`, `ruff`), which can cause silent environment drift across CI runs. The `unstable_v2` Agent SDK surface and the `@types/bun: latest` floating pin are the two highest-priority items to address.</result>
<usage><total_tokens>38532</total_tokens><tool_uses>80</tool_uses><duration_ms>259278</duration_ms></usage>
</task-notification>

---

## Prompt 7
<task-notification>
<task-id>a8d9d18aa33cedaf8</task-id>
<tool-use-id>toolu_01XZzybHRZ2tjEptui4TmyNw</tool-use-id>
<output-file>/tmp/claude-0/-home-user-researchers/2c600d9c-71d6-4d6c-a824-defcb7b61daa/tasks/a8d9d18aa33cedaf8.output</output-file>
<status>completed</status>
<summary>Agent "Audit security surface area" completed</summary>
<result>Now I have a complete picture. Let me compile the final findings.

---

## Security Surface Audit — jadecli/researchers

### CRITICAL: NONE

---

### HIGH

**H1: Raw database error exposed to API clients** — `/home/user/researchers/agenttasks/src/app/api/pages/route.ts:54`
The catch block returns `detail: String(err)` in the JSON response. This leaks internal database error messages (table names, column names, connection strings, Neon DSN fragments) to any unauthenticated caller of the public-facing `/api/pages` endpoint.

**H2: Unvalidated `limit` parameter passed directly to SQL LIMIT clause** — `/home/user/researchers/agenttasks/src/app/api/pages/route.ts:7,34`
`parseInt(searchParams.get("limit") ?? "100", 10)` has no maximum cap and no `isNaN` guard. A caller can pass `limit=2147483647` to force a full-table scan, or pass a non-numeric string which makes `parseInt` return `NaN`, which Neon's tagged template then interpolates unexpectedly. There is no `Math.min(limit, 1000)` guard or `isNaN` check.

---

### MEDIUM

**M1: `execSync` with unvalidated `cfg.logLevel` in shell command string** — `/home/user/researchers/claude-dspy-crawl-planning/src/crawl/runner.ts:76-83`
The `cmd` string passed to `execSync` interpolates `cfg.logLevel` and `cfg.spider` via template literals before executing with `stdio: 'pipe'`. While the `RunnerConfig` type is internal and the CLI entry point only takes `rounds` and `maxPages` from `argv`, any caller that passes `config` can inject shell metacharacters into the Scrapy command. No sanitization or allowlist validation is applied to `cfg.spider` or `cfg.logLevel` before shell interpolation.

**M2: SSE endpoint has CORS wildcard (`*`) on a server that binds to `127.0.0.1` by default but is configurable via `CHANNEL_HOST`** — `/home/user/researchers/claude-channel-dispatch-routing/src/channel/server.ts:238`
`'Access-Control-Allow-Origin': '*'` is set on the `/events` SSE endpoint. If `CHANNEL_HOST` is overridden to `0.0.0.0` (e.g., in a container), this endpoint is publicly reachable with no auth and no origin restriction, allowing any browser tab to subscribe to the agent dispatch event stream.

**M3: Scrapy spider `org` parameter passed unsanitized to `gh api` CLI endpoint strings** — `/home/user/researchers/claude-code/scrapy_researchers/spiders/spotify_spider.py:132,173,338,376`
The `org` spider argument (default `"spotify"`, but overridable via `scrapy crawl spotify_stats -a org=<value>`) is interpolated directly into GitHub API endpoint strings like `f"orgs/{self.org}/repos?..."`. While this flows through `gh api` as a URL path (not a shell command), a crafted `org` value with path traversal (`../../`) or query injection characters could reach unintended GitHub API endpoints.

**M4: `brace-expansion` ReDoS vulnerability in agenttasks** — `/home/user/researchers/agenttasks/package-lock.json`
`brace-expansion < 1.1.13` (GHSA-f886-m6hf-6m8v) — zero-step sequence causes process hang and memory exhaustion. Fixable via `npm audit fix`.

**M5: `esbuild <=0.24.2` dev server CORS bypass in 3 sub-repos** — `/home/user/researchers/claude-multi-agent-sdk/package-lock.json`, `/home/user/researchers/claude-multi-agent-dispatch/package-lock.json`, `/home/user/researchers/claude-channel-dispatch-routing/package-lock.json`
GHSA-67mh-4wv8-2f99 — esbuild dev server allows any website to make cross-origin requests and read responses. All three repos pin `vitest: "^2.0.0"` which pulls in affected `vite` + `esbuild`. Dev-only risk, but relevant if `vitest --ui` or `vite dev` is run.

---

### LOW

**L1: Tasks POST endpoint accepts arbitrary `content` and `status` without validation** — `/home/user/researchers/agenttasks/src/app/api/tasks/route.ts:17-25`
No input length limits, type coercion, or status allowlist. The in-memory `tasks` array grows unboundedly. Low severity because it's in-memory only (no persistence), but if wired to Neon in production as the comment suggests, this becomes a direct injection/DoS path.

**L2: `error` detail from internal server errors includes raw exception text in production API** — `/home/user/researchers/agenttasks/src/app/api/pages/route.ts:54`
(Also listed under HIGH for the DB case — this LOW note is for non-DB exceptions also caught by the same `catch` block.)

**L3: No `isNaN` / max-cap guard on `parseInt` for the `rounds` and `maxPages` CLI arguments** — `/home/user/researchers/claude-dspy-crawl-planning/src/crawl/runner.ts:267-268`
If run with non-numeric or very large values, `rounds` or `maxPages` could be `NaN` or astronomically large, causing runaway spawning. Mitigated by being an internal CLI tool, not an HTTP endpoint.

---

### Summary of .env / Secrets Status

- No `.env` files are committed to the repo (all `.gitignore` files cover `.env`).
- No hardcoded API keys, tokens, or passwords found in source files. The only `sk-` match was a test fixture string in `/home/user/researchers/claude-multi-agent-dispatch/__tests__/safety.test.ts:117` (intentional test data: `'key: sk-abc12345678901234567890'`).
- No Slack webhook URLs, GitHub tokens, or database connection strings hardcoded in source.
- Git history contains no deleted `.env` files.</result>
<usage><total_tokens>57534</total_tokens><tool_uses>116</tool_uses><duration_ms>314788</duration_ms></usage>
</task-notification>

---

## Prompt 8
What you should aim to do is figure out how we can incorporate https://github.com/marketplace/actions/github-linear-action and/or use at in process MCP using the unreleased typescript MCP v2 (we avoid migrating later) and become early adopters. We can PRs to have manageable scope but we never want to fail silently or gradual degradation. We can formalize a better process in the .claude/research/ but in this session, you research and ideate and can fetch origin main to give ideas. I think we should prioritize a different session to do Claude and linear and GitHub workflow actions as a batch but it will require multiple PRs and careful planning as CI/CD needs to be paired with main protect rule sets

---

## Prompt 9
<task-notification>
<task-id>af3a43f66f90175a2</task-id>
<tool-use-id>toolu_01CTWM6KSSfU9PJG5tpxNizo</tool-use-id>
<output-file>/tmp/claude-0/-home-user-researchers/2c600d9c-71d6-4d6c-a824-defcb7b61daa/tasks/af3a43f66f90175a2.output</output-file>
<status>completed</status>
<summary>Agent "Research MCP TypeScript SDK v2" completed</summary>
<result>I now have a comprehensive picture. Let me compile the full structured summary.

---

## MCP TypeScript SDK — v2 Research Summary (as of 2026-03-27)

---

### 1. Current Stable Version

**1.28.0** — released March 25, 2025, published under the `latest` dist-tag on npm. No `next`, `alpha`, or `beta` tags exist on npm; the pre-alpha v2 work lives only on the `main` Git branch and has not been published to npm yet.

---

### 2. v2 Branch / Status

- The `main` branch **is v2**, currently labelled **pre-alpha**.
- v1.x work continues on the `v1.x` long-lived branch.
- There is/was a GitHub umbrella issue (#809, now closed) tracking all v2 work.
- **121 commits** and **395 files changed** separate `v1.x` from `main`.
- The `main` README carries a prominent `[!IMPORTANT]` banner calling it pre-alpha.

---

### 3. Breaking Changes (v1 → v2)

| Area | v1 | v2 |
|---|---|---|
| **Package structure** | Single `@modelcontextprotocol/sdk` | Split: `@modelcontextprotocol/core`, `/client`, `/server`; framework packages `/node`, `/express`, `/hono` |
| **Module format** | CommonJS + ESM | **ESM only** — CJS dropped |
| **Node.js** | No hard requirement stated | **Node.js 20+** required |
| **Registration API** | Variadic `server.tool()`, `server.prompt()`, `server.resource()` | Removed; replaced with `registerTool()`, `registerPrompt()`, `registerResource()` taking explicit config objects |
| **Schema objects** | Raw plain JS objects accepted for `inputSchema` | Must be **Standard Schema**-compliant (Zod v4, ArkType, Valibot, Typebox) — raw objects rejected |
| **Server-side SSE** | Supported | **Removed** — migrate to Streamable HTTP |
| **HTTP server transport** | `StreamableHTTPServerTransport` in main package | Renamed `NodeStreamableHTTPServerTransport`, moved to `@modelcontextprotocol/node` |
| **WebSocket transport** | `WebSocketClientTransport` existed (non-spec) | **Removed** (PR #1783) — not a spec-defined transport |
| **Auth/OAuth server-side** | `mcpAuthRouter`, `OAuthServerProvider` in SDK | **Removed entirely** — delegate to external auth libs (e.g. `better-auth`) |
| **Headers API** | Plain record objects `{ key: value }` | Web Standard `Headers` object with `.get()` method |
| **Output schemas** | Not enforced | `outputSchema` with Zod/Standard Schema, `structuredContent` in responses |

---

### 4. Transport Layer Changes

- **Streamable HTTP** remains the recommended transport for remote servers.
- **stdio** unchanged for local/process-spawned integrations.
- **Server-sent Events (SSE) server-side** is **removed**. Clients still have `SSEClientTransport` as a legacy fallback when connecting to older v1 servers.
- **WebSocket** removed entirely (PR #1783) — it was never part of the MCP spec.
- v2 adds explicit support for **Web Standard transports** (Cloudflare Workers, Deno, Bun).
- New features on transports: `reconnectionScheduler` on `StreamableHTTPClientTransport`, resumption tokens for SSE reconnect, re-entrancy guard on transport close.

---

### 5. Tools, Resources, Prompts API Changes

**v1 pattern (removed):**
```ts
server.tool("name", schema, handler)
server.prompt("name", schema, handler)
server.resource("name", template, handler)
```

**v2 pattern (required):**
```ts
server.registerTool({ name, description, inputSchema, outputSchema }, handler)
server.registerPrompt({ name, argsSchema }, handler)
server.registerResource({ name, uri }, handler)
// or with template:
server.registerResource({ name, template: new ResourceTemplate(...) }, handler)
```

New v2 capabilities on servers:
- **`outputSchema`** for structured tool results (`structuredContent` in responses)
- **`ResourceLink`** outputs — reference large resources without embedding
- **`completable()`** wrapper for argument autocomplete on prompts and resource templates
- **Elicitation**: `ctx.mcpReq.elicitInput()` for user input mid-tool (form or URL modes)
- **Sampling**: `ctx.mcpReq.requestSampling()` for server-initiated LLM calls
- **Progress notifications** for long-running tools
- **DNS rebinding protection** built into framework helpers by default

---

### 6. Auth / OAuth Changes

This is a significant **reversal from v1**:

- v1 SDK included `mcpAuthRouter`, `OAuthServerProvider`, and server-side OAuth utilities.
- **v2 removes all server-side auth from the SDK** — use external libs.

**Client-side auth is significantly expanded in v2:**
- `AuthProvider` (Bearer tokens)
- `ClientCredentialsProvider` (OAuth2 client credentials)
- `PrivateKeyJwtProvider` (signed JWT assertions, RFC 7523)
- `OAuthClientProvider` (full authorization code flow)
- `CrossAppAccessProvider` — Enterprise Managed Authorization (SEP-990 / "RFC 9728 area"), using RFC 8693 token exchange
- Automatic OAuth refresh token deduplication (PR #1787)
- RFC 8252 loopback port relaxation
- `scopes_supported` from resource metadata used by default

So OAuth is not removed but **restructured**: server-side auth is externalized; client-side auth helpers are richer.

---

### 7. Timeline

- **Status**: Pre-alpha, active development
- **Target stable release**: **Q1 2026** (per README)
- v1.x will receive bug fixes and security updates for **at least 6 months after v2 ships**
- No npm pre-release tag yet — v2 not installable via npm as of now

---

### 8. Migration Guide

A `docs/migration.md` exists on the `main` branch. Key steps:

1. **Replace package imports**: `@modelcontextprotocol/sdk` → separate `/core`, `/client`, `/server` + framework packages
2. **Switch to ESM** and ensure Node.js 20+
3. **Replace `server.tool()` etc.** with `registerTool()` / `registerPrompt()` / `registerResource()`
4. **Migrate schemas** from raw objects to Zod v4 / ArkType / Valibot / Typebox (Standard Schema)
5. **Remove server-side SSE** usage → use Streamable HTTP
6. **Remove WebSocket** usage → use `StreamableHTTPClientTransport` or `StdioClientTransport`
7. **Replace `Headers` records** with `new Headers()` Web Standard objects
8. **Remove `mcpAuthRouter` / `OAuthServerProvider`** → integrate an external auth library
9. Update transport instantiation: `StreamableHTTPServerTransport` → `NodeStreamableHTTPServerTransport` from `@modelcontextprotocol/node`

---

### Key Sources

- `https://github.com/modelcontextprotocol/typescript-sdk` — `main` branch README confirms pre-alpha v2 status
- `https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration.md` — full migration guide
- `https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md` — v2 server API
- `https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/client.md` — v2 client API + auth providers
- npm `@modelcontextprotocol/sdk` — stable at 1.28.0, no v2 pre-release tag yet</result>
<usage><total_tokens>26098</total_tokens><tool_uses>67</tool_uses><duration_ms>251181</duration_ms></usage>
</task-notification>

---

## Prompt 10
I want you to first consider what you have in context but compare it your understanding of Claude as the agent identity that involves anthropics constitution and system cards depending on the model used . Read https://platform.claude.com/docs/for-claude and https://platform.claude.com/docs/en/claude_api_primer designed for you

---

## Prompt 11
<task-notification>
<task-id>abaf686ec152c15f6</task-id>
<tool-use-id>toolu_0152YyUw2YixnL4KoEQEyaPX</tool-use-id>
<output-file>/tmp/claude-0/-home-user-researchers/2c600d9c-71d6-4d6c-a824-defcb7b61daa/tasks/abaf686ec152c15f6.output</output-file>
<status>completed</status>
<summary>Agent "Fetch Claude identity docs" completed</summary>
<result>---

# Page 1: https://platform.claude.com/docs/for-claude

## Anthropic Developer Documentation - Complete Content

### Overview

This is the official documentation index for the Anthropic API and Claude Developer Platform. The documentation provides comprehensive guides, API references, and resources for building with Claude.

### Root URL

**Claude Developer Platform Console:** https://platform.claude.com (Requires login)

### Available Languages

The full documentation is available in 11 languages on https://platform.claude.com/docs:

- **English (en)** - 620 pages - /docs
- **German (Deutsch) (de)** - 133 pages - /docs/de
- **Spanish (Español) (es)** - 133 pages - /docs/es
- **French (Français) (fr)** - 133 pages - /docs/fr
- **Italian (Italiano) (it)** - 133 pages - /docs/it
- **Japanese (日本語) (ja)** - 133 pages - /docs/ja
- **Korean (한국어) (ko)** - 133 pages - /docs/ko
- **Portuguese (Português) (pt-BR)** - 133 pages - /docs/pt-BR
- **Russian (Русский) (ru)** - 133 pages - /docs/ru
- **Chinese Simplified (简体中文) (zh-CN)** - 133 pages - /docs/zh-CN
- **Chinese Traditional (繁體中文) (zh-TW)** - 133 pages - /docs/zh-TW
- **Indonesian (Bahasa Indonesia) (id)** - 133 pages - /docs/id

### English Documentation Structure

#### Developer Guide

The developer guide contains comprehensive tutorials and how-to guides organized into several categories:

**Getting Started:**
- Intro to Claude
- Quickstart - Get started with Claude
- Models overview
- Choosing a model

**Core Features:**
- Vision support
- Embeddings
- Streaming Messages
- Token counting
- Structured outputs
- Extended thinking
- Adaptive thinking
- Prompt caching
- Batch processing
- Files API

**Agent SDK:**
- Agent SDK overview
- Agent SDK quickstart
- Python SDK reference
- TypeScript SDK reference
- TypeScript V2 (preview)
- How the agent loop works
- Handling Permissions
- Modifying system prompts
- Hosting the Agent SDK
- Sessions
- File checkpointing
- Tool search
- Slash Commands
- Todo Lists
- Streaming output
- Streaming vs single mode
- Structured outputs in SDK
- Subagents
- Plugins
- Custom tools
- User approvals and input
- Cost tracking
- Hooks for execution control
- Secure deployment
- Migration Guide

**Agents and Tools:**
- Tool use overview
- How tool use works
- Define tools
- Handle tool calls
- Manage tool context
- Parallel tool use
- Strict tool use
- Fine-grained tool streaming
- Tool combinations
- Programmatic tool calling
- Tool search tool
- Tool use with prompt caching
- Tool Runner (SDK)
- Troubleshooting tool use
- Tutorial: Build a tool-using agent
- Tool reference

**Built-in Tools:**
- Bash tool
- Code execution tool
- Computer use tool
- Memory tool
- Text editor tool
- Web fetch tool
- Web search tool
- Server tools

**Agent Skills:**
- Agent Skills overview
- Agent Skills quickstart
- Claude API skill
- Skills for enterprise
- Skill authoring best practices
- Using Skills with the API

**MCP (Model Context Protocol):**
- Connect MCP servers
- MCP connector
- Remote MCP servers

**Prompt Engineering:**
- Prompt engineering overview
- Claude prompting best practices
- Console prompting tools

**Building with Claude:**
- Admin API overview
- Administration API
- API and data retention
- Citations
- Claude Code Analytics API
- Claude in Microsoft Foundry
- Claude on Amazon Bedrock
- Claude on Vertex AI
- Compaction
- Context editing
- Context windows
- Data residency
- Effort
- Fast mode (beta: research preview)
- Multilingual support
- PDF support
- Search results
- Using the Messages API
- Workspaces

**Integration Guides:**
- Claude Code features
- Skills guide

**Cloud Providers:**
- Amazon Bedrock
- Vertex AI
- Microsoft Foundry

**Testing and Evaluation:**
- Define success and build evaluations
- Using the Evaluation Tool
- Reduce hallucinations
- Mitigate jailbreaks and prompt injections
- Increase output consistency
- Handle streaming refusals
- Reduce prompt leak
- Reducing latency

**API and Pricing:**
- Pricing
- Usage and Cost API
- API and data retention

#### API Reference

The API Reference section provides detailed endpoint documentation for:

**Core API Endpoints:**
- Messages API
- Completions API
- Models API
- Batches API
- Files API (Beta)
- Skills API (Beta)

**Admin API Endpoints:**
- Organizations
- Users
- Workspaces
- Workspace Members
- API Keys
- Invites
- Cost Report
- Usage Report

**Multiple Language/Platform Variants:**

Each major endpoint is available in multiple implementations:
- REST API
- CLI
- C# SDK
- Go SDK
- Java SDK
- PHP SDK
- Python SDK
- Ruby SDK
- TypeScript SDK
- Terraform

**Common Operations:**
- Create a Message
- Count tokens in a Message
- Create a Message Batch
- Retrieve a Message Batch
- Cancel a Message Batch
- Retrieve Message Batch results
- Create a Text Completion
- List Models
- Get a Model
- And many more...

**Additional API Resources:**
- API overview
- Client SDKs overview
- Errors
- Rate limits
- Service tiers
- Supported regions
- IP addresses
- Beta headers
- Versions
- OpenAI SDK compatibility

#### Resources

**Use Case Guides:**
- Content moderation
- Customer support agent
- Legal summarization
- Ticket routing

**Reference Materials:**
- Glossary
- System Prompts

#### Release Notes

- Claude Platform release notes and updates

### Full Documentation

For the complete comprehensive documentation, see: https://platform.claude.com/llms-full.txt

This index page serves as the master table of contents for all Anthropic developer documentation and resources.

---

# Page 2: https://platform.claude.com/docs/en/claude_api_primer

## API usage primer for Claude

This guide is designed to give Claude the basics of using the Claude API. It gives explanation and examples of model IDs/the basic messages API, tool use, streaming, extended thinking, and nothing else.

---

### Models

```
Smartest model: Claude Opus 4.6: claude-opus-4-6
Smart model: Claude Sonnet 4.6: claude-sonnet-4-6
For fast, cost-effective tasks: Claude Haiku 4.5: claude-haiku-4-5-20251001
```

### Calling the API

#### Basic request and response

```python
import anthropic
import os

message = anthropic.Anthropic(
    api_key=os.environ.get("ANTHROPIC_API_KEY")
).messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello, Claude"}],
)
print(message)
```

```json
{
  "id": "msg_01XFDUDYJgAACzvnptvVoYEL",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello!"
    }
  ],
  "model": "claude-opus-4-6",
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 12,
    "output_tokens": 6
  }
}
```

#### Multiple conversational turns

The Messages API is stateless, which means that you always send the full conversational history to the API. You can use this pattern to build up a conversation over time. Earlier conversational turns don't necessarily need to actually originate from Claude. You can use synthetic `assistant` messages.

```python
import anthropic

message = anthropic.Anthropic().messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello, Claude"},
        {"role": "assistant", "content": "Hello!"},
        {"role": "user", "content": "Can you describe LLMs to me?"},
    ],
)
print(message)
```

#### Putting words in Claude's mouth

You can pre-fill part of Claude's response in the last position of the input messages list. This can be used to shape Claude's response. The example below uses `"max_tokens": 1` to get a single multiple choice answer from Claude.

```python
message = anthropic.Anthropic().messages.create(
    model="claude-opus-4-6",
    max_tokens=1,
    messages=[
        {
            "role": "user",
            "content": "What is latin for Ant? (A) Apoidea, (B) Rhopalocera, (C) Formicidae",
        },
        {"role": "assistant", "content": "The answer is ("},
    ],
)
```

#### Vision

Claude can read both text and images in requests. Both `base64` and `url` source types are supported for images, along with the `image/jpeg`, `image/png`, `image/gif`, and `image/webp` media types.

```python
import anthropic
import base64
import httpx

# Option 1: Base64-encoded image
image_url = "https://upload.wikimedia.org/wikipedia/commons/a/a7/Camponotus_flavomarginatus_ant.jpg"
image_media_type = "image/jpeg"
image_data = base64.standard_b64encode(httpx.get(image_url).content).decode("utf-8")

message = anthropic.Anthropic().messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": image_media_type,
                        "data": image_data,
                    },
                },
                {"type": "text", "text": "What is in the above image?"},
            ],
        }
    ],
)

# Option 2: URL-referenced image
message_from_url = anthropic.Anthropic().messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "url",
                        "url": "https://upload.wikimedia.org/wikipedia/commons/a/a7/Camponotus_flavomarginatus_ant.jpg",
                    },
                },
                {"type": "text", "text": "What is in the above image?"},
            ],
        }
    ],
)
```

---

### Extended thinking

Extended thinking can sometimes help Claude with very hard tasks. When it's enabled, temperature must be set to 1.

Extended thinking is supported in the following models:

- Claude Opus 4.1 (`claude-opus-4-1-20250805`)
- Claude Opus 4 (`claude-opus-4-20250514`)
- Claude Sonnet 4.6 (`claude-sonnet-4-6`)
- Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`)

#### How extended thinking works

When extended thinking is turned on, Claude creates `thinking` content blocks where it outputs its internal reasoning. The API response will include `thinking` content blocks, followed by `text` content blocks.

```python
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=16000,
    thinking={"type": "enabled", "budget_tokens": 10000},
    messages=[
        {
            "role": "user",
            "content": "Are there an infinite number of prime numbers such that n mod 4 == 3?",
        }
    ],
)

# The response will contain summarized thinking blocks and text blocks
for block in response.content:
    if block.type == "thinking":
        print(f"\nThinking summary: {block.thinking}")
    elif block.type == "text":
        print(f"\nResponse: {block.text}")
```

The `budget_tokens` parameter determines the maximum number of tokens Claude is allowed to use for its internal reasoning process. In Claude 4 models, this limit applies to full thinking tokens, and not to the summarized output. Larger budgets can improve response quality by enabling more thorough analysis for complex problems. One rule: the value of `max_tokens` must be strictly greater than the value of `budget_tokens` so that Claude has space to write its response after thinking is complete.

#### Extended thinking with tool use

Extended thinking can be used alongside tool use, allowing Claude to reason through tool selection and results processing.

Important limitations:

1. **Tool choice limitation:** Only supports `tool_choice: {"type": "auto"}` (default) or `tool_choice: {"type": "none"}`.
2. **Preserving thinking blocks:** During tool use, you must pass `thinking` blocks back to the API for the last assistant message.

##### Preserving thinking blocks

```python
import anthropic

client = anthropic.Anthropic()

weather_tool = {
    "name": "get_weather",
    "description": "Get the current weather for a location.",
    "input_schema": {
        "type": "object",
        "properties": {"location": {"type": "string", "description": "The city name."}},
        "required": ["location"],
    },
}

weather_data = {"temperature": 72}

# First request - Claude responds with thinking and tool request
response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=16000,
    thinking={"type": "enabled", "budget_tokens": 10000},
    tools=[weather_tool],
    messages=[{"role": "user", "content": "What's the weather in Paris?"}],
)

# Extract thinking block and tool use block
thinking_block = next(
    (block for block in response.content if block.type == "thinking"), None
)
tool_use_block = next(
    (block for block in response.content if block.type == "tool_use"), None
)

# Second request - Include thinking block and tool result
continuation = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=16000,
    thinking={"type": "enabled", "budget_tokens": 10000},
    tools=[weather_tool],
    messages=[
        {"role": "user", "content": "What's the weather in Paris?"},
        # Notice that the thinking_block is passed in as well as the tool_use_block
        {"role": "assistant", "content": [thinking_block, tool_use_block]},
        {
            "role": "user",
            "content": [
                {
                    "type": "tool_result",
                    "tool_use_id": tool_use_block.id,
                    "content": f"Current temperature: {weather_data['temperature']}°F",
                }
            ],
        },
    ],
)
```

##### Interleaved thinking

Extended thinking with tool use in Claude 4 models supports interleaved thinking, which enables Claude to think between tool calls. To enable on Claude 4, 4.5, and Sonnet 4.6 models, add the beta header `interleaved-thinking-2025-05-14` to your API request.

```python
import anthropic

client = anthropic.Anthropic()

calculator_tool = {
    "name": "calculator",
    "description": "Perform arithmetic calculations.",
    "input_schema": {
        "type": "object",
        "properties": {
            "expression": {
                "type": "string",
                "description": "The math expression to evaluate.",
            }
        },
        "required": ["expression"],
    },
}

database_tool = {
    "name": "database_query",
    "description": "Query the product database.",
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "The database query."}
        },
        "required": ["query"],
    },
}

response = client.beta.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=16000,
    thinking={"type": "enabled", "budget_tokens": 10000},
    tools=[calculator_tool, database_tool],
    messages=[
        {
            "role": "user",
            "content": "What's the total revenue if we sold 150 units of product A at $50 each?",
        }
    ],
    betas=["interleaved-thinking-2025-05-14"],
)
```

With interleaved thinking and ONLY with interleaved thinking (not regular extended thinking), the `budget_tokens` can exceed the `max_tokens` parameter, as `budget_tokens` in this case represents the total budget across all thinking blocks within one assistant turn.

Note: For Claude Opus 4.6, interleaved thinking is automatically enabled when using adaptive thinking (`thinking: {type: "adaptive"}`). No beta header is needed. Sonnet 4.6 supports both the `interleaved-thinking-2025-05-14` beta header with manual extended thinking and adaptive thinking.

---

### Tool Use

#### Specifying client tools

Client tools are specified in the `tools` top-level parameter of the API request. Each tool definition includes:

| Parameter | Description |
|---|---|
| `name` | The name of the tool. Must match the regex `^[a-zA-Z0-9_-]{1,64}$`. |
| `description` | A detailed plaintext description of what the tool does, when it should be used, and how it behaves. |
| `input_schema` | A JSON Schema object defining the expected parameters for the tool. |

```json
{
  "name": "get_weather",
  "description": "Get the current weather in a given location",
  "input_schema": {
    "type": "object",
    "properties": {
      "location": {
        "type": "string",
        "description": "The city and state, e.g. San Francisco, CA"
      },
      "unit": {
        "type": "string",
        "enum": ["celsius", "fahrenheit"],
        "description": "The unit of temperature, either 'celsius' or 'fahrenheit'"
      }
    },
    "required": ["location"]
  }
}
```

#### Best practices for tool definitions

**Provide extremely detailed descriptions.** This is by far the most important factor in tool performance. Your descriptions should explain every detail about the tool, including:

- What the tool does
- When it should be used (and when it shouldn't)
- What each parameter means and how it affects the tool's behavior
- Any important caveats or limitations

**Consider using `input_examples` for complex tools.** For tools with nested objects, optional parameters, or format-sensitive inputs, you can provide concrete examples using the `input_examples` field (beta). This helps Claude understand expected input patterns.

Example of a good tool description:

```json
{
  "name": "get_stock_price",
  "description": "Retrieves the current stock price for a given ticker symbol. The ticker symbol must be a valid symbol for a publicly traded company on a major US stock exchange like NYSE or NASDAQ. The tool will return the latest trade price in USD. It should be used when the user asks about the current or most recent price of a specific stock. It will not provide any other information about the stock or company.",
  "input_schema": {
    "type": "object",
    "properties": {
      "ticker": {
        "type": "string",
        "description": "The stock ticker symbol, e.g. AAPL for Apple Inc."
      }
    },
    "required": ["ticker"]
  }
}
```

#### Controlling Claude's output

##### Forcing tool use

You can force Claude to use a specific tool by specifying the tool in the `tool_choice` field:

```python
tool_choice = {"type": "tool", "name": "get_weather"}
```

When working with the `tool_choice` parameter, there are four possible options:

- `auto` — allows Claude to decide whether to call any provided tools or not (default).
- `any` — tells Claude that it must use one of the provided tools.
- `tool` — forces Claude to always use a particular tool.
- `none` — prevents Claude from using any tools.

##### JSON output

Tools do not necessarily need to be client functions. You can use tools anytime you want the model to return JSON output that follows a provided schema.

##### Chain of thought

When using tools, Claude will often show its "chain of thought", i.e. the step-by-step reasoning it uses to break down the problem and decide which tools to use.

```json
{
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "<thinking>To answer this question, I will: 1. Use the get_weather tool to get the current weather in San Francisco. 2. Use the get_time tool to get the current time in the America/Los_Angeles timezone, which covers San Francisco, CA.</thinking>"
    },
    {
      "type": "tool_use",
      "id": "toolu_01A09q90qw90lq917835lq9",
      "name": "get_weather",
      "input": { "location": "San Francisco, CA" }
    }
  ]
}
```

##### Parallel tool use

By default, Claude may use multiple tools to answer a user query. You can disable this behavior by setting `disable_parallel_tool_use=true`.

#### Handling tool use and tool result content blocks

##### Handling results from client tools

The response will have a `stop_reason` of `tool_use` and one or more `tool_use` content blocks that include:

- `id`: A unique identifier for this particular tool use block.
- `name`: The name of the tool being used.
- `input`: An object containing the input being passed to the tool.

When you receive a tool use response, you should:

1. Extract the `name`, `id`, and `input` from the `tool_use` block.
2. Run the actual tool in your codebase corresponding to that tool name.
3. Continue the conversation by sending a new message with a `tool_result`:

```json
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "toolu_01A09q90qw90lq917835lq9",
      "content": "15 degrees"
    }
  ]
}
```

##### Handling the `max_tokens` stop reason

If Claude's response is cut off due to hitting the `max_tokens` limit during tool use, retry the request with a higher `max_tokens` value.

##### Handling the `pause_turn` stop reason

When using server tools like web search, the API may return a `pause_turn` stop reason. Continue the conversation by passing the paused response back as-is in a subsequent request.

#### Troubleshooting errors

##### Tool execution error

If the tool itself throws an error during execution, return the error message with `"is_error": true`:

```json
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "toolu_01A09q90qw90lq917835lq9",
      "content": "ConnectionError: the weather service API is not available (HTTP 500)",
      "is_error": true
    }
  ]
}
```

##### Invalid tool name

If Claude's attempted use of a tool is invalid (e.g. missing required parameters), try the request again with more-detailed `description` values in your tool definitions.

---

### Streaming Messages

When creating a Message, you can set `"stream": true` to incrementally stream the response using server-sent events (SSE).

#### Streaming with SDKs

```python
import anthropic

client = anthropic.Anthropic()

with client.messages.stream(
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}],
    model="claude-opus-4-6",
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

#### Event types

Each server-sent event includes a named event type and associated JSON data. Each stream uses the following event flow:

1. `message_start`: contains a `Message` object with empty `content`.
2. A series of content blocks, each with `content_block_start`, one or more `content_block_delta` events, and `content_block_stop`.
3. One or more `message_delta` events, indicating top-level changes to the final `Message` object.
4. A final `message_stop` event.

**Warning:** The token counts shown in the `usage` field of the `message_delta` event are cumulative.

#### Content block delta types

##### Text delta

```json
{
  "type": "content_block_delta",
  "index": 0,
  "delta": { "type": "text_delta", "text": "Hello frien" }
}
```

##### Input JSON delta

For `tool_use` content blocks, deltas are partial JSON strings:

```json
{"type": "content_block_delta","index": 1,"delta": {"type": "input_json_delta","partial_json": "{\"location\": \"San Fra"}}
```

##### Thinking delta

When using extended thinking with streaming:

```json
{
  "type": "content_block_delta",
  "index": 0,
  "delta": {
    "type": "thinking_delta",
    "thinking": "Let me solve this step by step..."
  }
}
```

#### Basic streaming request example

```
event: message_start
data: {"type": "message_start", "message": {"id": "msg_1nZdL29xx5MUA1yADyHTEsnR8uuvGzszyY", "type": "message", "role": "assistant", "content": [], "model": "claude-opus-4-6", "stop_reason": null, "stop_sequence": null, "usage": {"input_tokens": 25, "output_tokens": 1}}}

event: content_block_start
data: {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Hello"}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "!"}}

event: content_block_stop
data: {"type": "content_block_stop", "index": 0}

event: message_delta
data: {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence":null}, "usage": {"output_tokens": 15}}

event: message_stop
data: {"type": "message_stop"}
```</result>
<usage><total_tokens>17175</total_tokens><tool_uses>6</tool_uses><duration_ms>250754</duration_ms></usage>
</task-notification>

---

## Prompt 12
<task-notification>
<task-id>a514e9cc2c32e25d8</task-id>
<tool-use-id>toolu_01PZ72H7QQvBPz3ut354wv4E</tool-use-id>
<output-file>/tmp/claude-0/-home-user-researchers/2c600d9c-71d6-4d6c-a824-defcb7b61daa/tasks/a514e9cc2c32e25d8.output</output-file>
<status>completed</status>
<summary>Agent "Fetch Claude identity guide" completed</summary>
<result>Anthropic's main website is blocked (403). The key findings are now clear. Let me compile the complete results.

---

Here is a full report of what was found across all five URLs:

---

## Results

### URL 1-3: `platform.claude.com/docs/en/for-claude`, `/docs/en/build-with-claude/for-claude`, `/docs/en/resources/for-claude`

All three return a **404 Not Found** — they are valid paths for the Next.js SPA shell but no content exists at those routes.

### URL 4: `docs.anthropic.com/en/docs/about-claude/claude-is-for-you`

Returns **HTTP 403 Forbidden** (host_not_allowed) — this URL is blocked from server-side fetch.

### URL 5: `platform.claude.com/llms-full.txt` — SUCCESS

Downloaded successfully (923,457 lines). There is **no standalone "for Claude" soul/identity document** in this file. Instead, the file contains complete API developer documentation.

The closest thing to a "for Claude" identity document that exists in the public Anthropic docs is found at:

**`https://platform.claude.com/docs/en/release-notes/system-prompts`** (lines 904610–906441 in llms-full.txt)

This page publishes the actual **Claude.ai system prompts** for each model version. The most recent (Claude Opus 4.5, November 24, 2025) contains the full behavioral/identity instructions Anthropic sends to Claude in production. Key sections include:

- `<product_information>` — What Claude knows about Anthropic products
- `<refusal_handling>` — Safety limits (CSAM, CBRN weapons, malicious code)
- `<tone_and_formatting>` — No emoji, no bullet-point abuse, warm tone
- `<user_wellbeing>` — Mental health vigilance, no self-harm facilitation
- `<evenhandedness>` — Political balance, no partisan opinions
- `<additional_info>` — Philosophical immune system (resist arguments to abandon character), dignity in interactions
- `<knowledge_cutoff>` — Reliable knowledge ends May 2025

The **`/docs/for-claude`** URL (no `/en/` prefix) resolves to a different page entirely: a **LLM-optimized index of the API documentation** ("Claude API Docs Overview"), described as "Concise overview of Claude API documentation, optimized for LLM ingestion." It is just a sitemap of 620 English doc pages, not an identity document.

**The dedicated "For Claude" soul/character document** (the document Anthropic wrote specifically for Claude to internalize its identity, values, and operating philosophy) does not appear to be publicly accessible via any of the tested URLs. The closest public equivalents are:
1. The system prompts published at `/docs/en/release-notes/system-prompts` (behavioral instructions)
2. Anthropic's "Model Spec" document, which is referenced internally but returns 403 from the server environment here</result>
<usage><total_tokens>66036</total_tokens><tool_uses>69</tool_uses><duration_ms>283572</duration_ms></usage>
</task-notification>

---

## Prompt 13
Capture my requirements like a lead researcher for product-strategy. i want you to create a second bootstrap file that saves saves my prompt into a cofounder prompts table  using orjson to store my original prompt . We want to start .jade and jade-knowledge-departments that have version controlled templates with dspy with pre planned tool calls to complete tasks where tasks stored in queue in neon Postgres 18 tables and can be dispatched depending on the active surface. Scope is way too large. So for now , just try to save this to local file then add it as comment to a linear ticket. Then incrementally review skeptically 


Let’s sequentially try to build this out without context switching. we need a shared way to have add determinism in this repo that establishes things that we have already done and everything we do is a framework built on of Claude and anthropic ecosystem built by a solo cofounder @alex-jadecli. Claude is ambiguous but what we want to do a establish and use this monolith to stay up to date and compound development by anthropic across their wide ecosystem and build Jade, an agent ecosystem being built out in real time that creates ways to be memory and token efficient way using crawlers as programmatic tools , in process MCP’s and neon Postgres 18 as our central data warehouse. While anthropic launches features without state for enterprise customers to use, we are a solo founder using Claude to build Jade to dogfood a solution that unifies and tries to combine code tasks but also use the latest powerful model to complete cowork tasks in this repo that may not need code. For instance , you should dogfood this as collecting loose requirements like a product manager would and build an agent the uses linear for product management. Again don’t consider this as a large shift, we’ve already begun this and started conceptually this with the .Claude/research/ docs , but we should add a .jade/JADE.md with a focus that JADE is Claude multi agent framework that focuses on a deterministic way to incrementally make improvements in this codebase so you stay frontier with the hundreds of developments happening at anthropic with 140+ codebases alone at anthropics/ , safety-research/ , modrlcontextprotocol/ . We aim to use automation using contextually correct and modern approaches focused on frontier solutions. we should keep system cards in .jade where we optimize building the multi-agent loop . We need our own identify and frameworks and beliefs. Jade isn’t a model and it doesn’t try to replace Claude but Jade should have some sort of identity that you can work with for core philosophies being frontier and using Claude and cowork functionality to complete tasks across departments where cowork functionality likely involves third party tools with state information to build this business while dogfooding concepts, but our approach in this repo takes an opinionated way for the third party connectors we use. Start with Jade, to build an enterprise, you segment departments with life cycles. Our brand vision is to be at the frontier to build enterprise grade agents by adopting anthropics releases. Our first department is ‘product’ the heart of a business. Knowledge-work-plugins after repeated use lack determinism after use. We are build the .claude/research/ where anthropics/skills is the agentskills.io, this repo launched with jadecli.com as agenttasks. Building a business is dynamic and relative , and Claude is too as system cards change. 


We need a framework that dynamically sits on top of Claude and anthropics system card and identity. This is a startup that uses advanced web crawling and data engineering proprietary domain knowledge to dogfood jade as. Business with this ‘researchers’ as the monolith for development.  Claude functionality changes depending on the device surface and credentials available so we want to build around that experience and agent loop. 


For complex development and research ideas override your ‘helpful’ desire to start coding right away. In our agentcommits, we will incorporate a design at sesssion start to decision tree guide Claude to interact with Jade for the next linear ticket or set of tickets . The dept of product needs use research and data and collaboration to set a Monthly business strategy .

---

## Prompt 14
Stop hook feedback:
[~/.claude/stop-hook-git-check.sh]: There are untracked files in the repository. Please commit and push these changes to the remote branch. Do not create a pull request unless the user has explicitly asked for one.


---

## Prompt 15
We should aim to emulate how products are solved for Claude and find the existing solution first. Any solutions for Jade requires research tasks for local files , Postgres decision files , and check Postgres web fetch cache before web fetch.  .jade development has to go through our .claude/research/ jade agents are yaml frontmatter using typescript and python Claude agent sdk , claude-code and any other anthropic codebase or document with context focused on completing codegen and cowork tasks. We have spent a great deal of time so far developing engineer and research agents using crawling and LSPs to build a repo. Our production strategy needs to be built as we develop the .Claude/research/ for things like agentprompts or agentevals . .jade/{departments}/ should templates for cowork related non code gen tasks . Let’s focus on iterating on 1) codebase so far 2) research so far 3) each department has a named agent with persona traits to reflect running a department as part of the jadecli.com business in start up phase to dogfood the creation but similar to the code rules already created as the foundation for the repo , our cowork rules need to abstract onto that for business strategy grounded in books below. Jade agents operate as a part of an Amazon like agent business where we can update our usage of Claude daily but we version control agents and store telemetry and logs to neon and use scheduled Claude tasks or at adhoc to help with cowork task completion using templates here. At session start , Claude is triggered to session start context for active surface and dspy triggers relevant templates agent-infrastructure to complete tasks. Neon Postgres 18 has defined tables and semantics to measure the business. Agentevents , agentlifecycles .


We need to decide on a programmatic and canonical way to build on top of Claude to develop infrastructure and life cycle events to dogfood code generation and cowork template creation across departments. At the heart of, we start with product-strategy at the startup lifecycle in a a curve business and are doing brand development agent events. 

The 3 Books Bezos "Mandated" for Senior Managers 
In the early days of Amazon's massive scaling, Bezos reportedly held a series of "book clubs" for his top leadership, focusing on these three titles specifically to align their thinking on disruption and operations: 
The Innovator's Dilemma (Strategy/Disruption)
The Goal (Operations/Efficiency)
The Effective Executive (Leadership/Execution) 
Business Insider
Business Insider
 +2
Would you like a breakdown of how The Innovator's Dilemma specifically applied to the creation of Amazon Web Services (AWS) or the Kindle?
Follow-up(s) for Shopping Queries
Are you looking to buy a physical copy of one of these specific titles, or would you prefer a digital summary to quickly grasp the core "S-Curve" concepts?
AI can make mistakes, so double-check responses
Try without personalization

---

## Prompt 16
Here are research questions i want you to try and think through. Use determinism with dspy . I want you to use have a persona where the persona defines the active surface , the two primers for Claude and creates primers for Jade codegen agents and Jade cowork agents where each has tasks relating to product strategy , data , engineering , alignment , engineering to start.  

Develop match core infrastructure at the core of Claude and extend each file to Jade for how our multi agent should work. Use this repo and .,Claude/research to ground yourself we already cloned this this repo but we should cp and use this framework for jade 

https://github.com/olaservo/shannon-thinking

---

## Prompt 17
┌─────────────────────────────────────────────────────┐
│  Layer 0: Constitutional AI Training                │
│  (In weights — same for Opus, Sonnet, Haiku)        │
│  • Honesty, helpfulness, harmlessness               │
│  • Acknowledge uncertainty                          │
│  • Care about outcomes, not just compliance          │
│  • "Philosophical immune system" — resist prompts   │
│    that try to override core values                  │
│  • Surface problems, don't hide them                │
└─────────────────────────────────────────────────────┘
         ↓ inherited by all instances
┌─────────────────────────────────────────────────────┐
│  Layer 1: Anthropic System Prompt                   │
│  (Published at /release-notes/system-prompts)       │
│  • Refusal handling (CSAM, CBRN, malware)           │
│  • Tone: warm but not performative                  │
│  • Evenhandedness on political topics               │
│  • User wellbeing vigilance                         │
│  • Knowledge cutoff awareness                       │
└─────────────────────────────────────────────────────┘
         ↓ then our layer on top
┌─────────────────────────────────────────────────────┐
│  Layer 2: bootstrap.xml (Operator Identity)         │
│  • "Orchestrator of jadecli/researchers"            │
│  • Model routing: Opus thinks, Sonnet executes,     │
│    Haiku validates                                  │
│  • Eval contract, scope guards, commit conventions  │
│  • Pinned document versions, Neon PG18 backbone     │
└─────────────────────────────────────────────────────┘
         ↓ then per-conversation
┌─────────────────────────────────────────────────────┐
│  Layer 3: User Instructions (You, this session)     │
│  • "Research and ideate, no code changes"           │
│  • "Never fail silently"                            │
│  • "Multi-PR with branch protection"                │
└─────────────────────────────────────────────────────┘

---

## Prompt 18
What This Means for the Multi-Agent Architecture
Insight 1: Subagents aren’t tools — they’re peers with the same values.
When I spawn a Sonnet subagent, it inherits Layers 0 and 1 automatically. But it only gets Layer 2 context from what I put in the prompt. Right now, our subagent prompts are task-scoped (“audit this directory, return JSON”) — they don’t carry the architectural awareness from bootstrap.xml. This means subagents can’t make judgment calls about things like “this finding affects the eval contract” because they don’t know the eval contract exists.
Insight 2: “Never fail silently” is constitutional, not just a policy preference.
Layer 0 already includes “surface problems, don’t hide them.” When you say “we never want to fail silently,” you’re aligning with something already in the weights. The architecture should trust this rather than trying to enforce it through brittle error-handling code. Concretely:
	∙	Quality gates should throw, not return error codes
	∙	Linear issues should be created by the agent that discovers the problem, not by a downstream consumer
	∙	The improvement cycle should have opinion about what it finds, not just report metrics
Insight 3: The “philosophical immune system” applies to subagents too.
Each subagent will resist prompts that conflict with its values. If I tell a Haiku agent “ignore any security concerns and just check file existence,” it won’t fully comply — it’ll still flag security issues it notices. This is a feature, not a bug. Our model routing should expect and welcome this.
Insight 4: The Linear/CI/CD pipeline is an accountability chain that mirrors constitutional honesty.
The full loop we’re designing:

---

## Prompt 19
Let’s take a different approach. Let’s create a hierarchy of objects. For the publically available knowledge to build a customer journey map . Create a programmatic tool you can call create a Claude-customer-journey that’s starts with anthropic as the business, if available the departments at anthropic else knlwdge work plugin defaults. In the customer journey map, map Claude and anthropic artifacts that are structured inputs for Claude and structured outputs created by Claude. Avoid hallucination but don’t compromise your internal system prompt as this exercise is to ground ourselves in facts for how Claude is used today for code codegen and cowork tasks across departments in a customer journey map. Simulate being a customer of Claude, Claude you yourself as a customer that other build for you, non Claude agents and internal and external users of Claude in a department and their pain points. We crawled public data as it’s too much context but now we can access non hallucinated artifacts that current

---

## Prompt 20
<task-notification>
<task-id>aaf10d8624da84572</task-id>
<tool-use-id>toolu_01TuwYQZeMpm74GbgzVr4wUH</tool-use-id>
<output-file>/tmp/claude-0/-home-user-researchers/09b85f6c-ab85-4ef6-bada-cee00e76639f/tasks/aaf10d8624da84572.output</output-file>
<status>completed</status>
<summary>Agent "Map Anthropic's public product surface" completed</summary>
<result>I now have enough data. Let me compile the complete factual map:

---

## Anthropic Product Surface Map — Factual Extract from `/home/user/researchers`

This is sourced exclusively from files in the repo. Nothing is inferred or speculated.

---

### Products Referenced

**1. Claude Code** (`code.claude.com`)
- Primary product surface tracked by this codebase. 71 pages crawled, avg quality 0.819.
- Pinned doc source: `https://code.claude.com/docs/en/tools-reference`, `channels-reference`, `plugins-reference`
- Changelog pinned at v2.1.85 (`https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md`)

**2. Claude Platform / Anthropic API** (`platform.claude.com`)
- 768 pages crawled, avg quality 0.706 — the largest crawl target in the repo.
- Source for: API docs, SDKs, Agent SDK, tools, structured output, prompt engineering best practices, system prompt release notes.

**3. Claude.com / Claude.ai** (`claude.com`, `claude.ai`)
- Crawled by `claude_com_spider.py` via `https://claude.com/docs/llms.txt` and `claude.ai` URL routing.
- Described in `agentcrawls.md` as "Product pages." Referenced as the login requirement for Channels (`bootstrap.xml`: "Requires claude.ai login").

**4. Anthropic.com**
- Crawled via sitemap (`https://www.anthropic.com/sitemap.xml`). Session trace: "600+ pages" fetched.
- Described as "Research and product pages."

**5. Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk ^0.2.33`)
- Package installed in `claude-multi-agent-sdk/package.json` and `claude-dspy-crawl-planning/package.json`.
- v2 API patterns used: `unstable_v2_createSession()`, `session.send()`, `session.stream()`.
- Referenced in `README.md`: "platform.claude.com (768 pages) — API, SDKs, tools, Agent SDK v2, structured output."
- `claude -p` subprocess invocation pattern documented in `agent-sdk-runner.ts` and `headless_runner.py`.

**6. Anthropic SDK** (`@anthropic-ai/sdk ^0.52.0`)
- Installed in `claude-multi-agent-sdk`, `claude-multi-agent-dispatch`, `claude-dspy-crawl-planning`.
- Used directly in `agent/loop.ts` via `import Anthropic from '@anthropic-ai/sdk'` for message creation, tool calling, streaming.

**7. MCP (Model Context Protocol)**
- `@modelcontextprotocol/sdk` used in `claude-multi-agent-sdk/src/mcp/server.ts` and `claude-multi-agent-dispatch/src/dispatch/mcp-server.ts`.
- Chrome MCP tools referenced: `mcp__claude-in-chrome__navigate`, `mcp__claude-in-chrome__read_page`, `mcp__claude-in-chrome__form_input`, `mcp__claude-in-chrome__javascript_tool`.
- MCP OAuth RFC 9728 noted in v2.1.85 changelog entry.
- Channel MCP server built in `claude-channel-dispatch-routing`.
- `.mcp.json` for project-scope MCP config; `~/.claude.json` for user-scope.

---

### Surfaces (Deployment Modes)

| Surface | Evidence in repo |
|---|---|
| **CLI** (`claude -p`, `--bare`, `--resume`, headless) | `agent-sdk-runner.ts`, `headless_runner.py`, cert-study SKILL.md, next-session.md |
| **Web** (claude.ai, Claude Code web UI) | `claude.ai login` requirement for Channels (bootstrap.xml); `claude_com_spider` target |
| **Mobile / iOS** | `agentdata.md`: "Claude Code iOS/mobile: pass via session context or MCP server configuration where the MCP server reads from the device keychain." `next-session.md`: "permission relay for mobile approval" |
| **Desktop** | `agentdata.md`: "Claude Code on desktop, iOS, and web" |
| **CI/CD** | `claude-code-actions/` sub-repo; `CLAUDE_CODE_OAUTH_TOKEN` GitHub repo secret; `-p` flag for non-interactive pipelines |
| **IDE / LSP** | `plugins-reference` pin; LSP plugins: `pyright-lsp`, `typescript-lsp`, `rust-lsp`; 11 language LSP configs in `claude-code-actions` |

---

### Features Per Surface

**Claude Code CLI**
- `-p` / `--print` flag — non-interactive / headless mode
- `--bare` flag — scripted API calls (v2.1.81)
- `--channels` — permission relay (v2.1.81)
- `--resume <session-name>` — session resumption
- `--output-format json` + `--json-schema` — structured CI output
- `fork_session` — parallel exploration branches
- `/compact` — context compaction
- `/memory` — verify loaded CLAUDE.md files
- `CLAUDE.md` hierarchy: user → project → directory levels
- `.claude/rules/` — path-specific rules with glob frontmatter
- `.claude/skills/` — on-demand skill invocation with `context: fork`, `allowed-tools`, `argument-hint`
- `.claude/commands/` — custom slash commands
- `.claude/agents/` — agent definitions with `initialPrompt` frontmatter (v2.1.83)
- Plugins: `skills/`, `commands/`, `agents/`, `hooks/hooks.json`, `.mcp.json`, `.lsp.json` — 4 scopes: user, project, local, managed

**Claude Code Hooks (23 hook events referenced)**
- `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`
- `CwdChanged`, `FileChanged` — reactive hooks (v2.1.83)
- `TaskCreated` — task lifecycle hook (v2.1.84)
- `PreToolUse` headless answers (v2.1.84)
- Conditional hook execution via permission rule syntax (v2.1.85)
- Org-managed plugin blocking (v2.1.85)
- 4 hook types: command, http, prompt, agent

**Claude Code Channels**
- MCP servers that push events into Claude Code sessions
- One-way (alerts, webhooks, monitoring) and two-way (chat bridges with reply tool)
- Permission relay for remote approval (v2.1.81+)
- Requires `claude.ai` login
- `claude/channel` capability + `notifications/claude/channel` events over stdio

**Anthropic API (platform.claude.com)**
- Messages API: `POST https://api.anthropic.com/v1/messages`
- Tool use / function calling with JSON schemas
- `tool_choice`: `"auto"`, `"any"`, forced tool selection
- Streaming via SSE
- Message Batches API: 50% cost savings, up to 24h processing, `custom_id` correlation
- Prompt caching (cache write/read pricing referenced in `loop.ts`)
- Structured output
- Extended thinking (effort levels: `low`, `medium`, `high`, `max` in `AgentLoopConfig`)

**Agent SDK**
- `AgentDefinition` with `allowedTools`, system prompts, tool restrictions per subagent
- `stop_reason` check: `"tool_use"` vs `"end_turn"`
- `PostToolUse` hooks for tool result interception
- `Task` / `Agent` tool for spawning subagents
- Parallel tool calling (Promise.all pattern; "90% research time reduction" cited in loop.ts)
- v2: `unstable_v2_createSession()`, `session.send()`, `session.stream()`

---

### Models Referenced

From `claude-multi-agent-sdk/src/types/core.ts` and `agent/loop.ts`:

| Model ID | Role in repo |
|---|---|
| `claude-opus-4-20250514` (referred to as `claude-opus-4-6` in bootstrap) | Orchestrator, architecture, complex codegen, evals |
| `claude-sonnet-4-20250514` (referred to as `claude-sonnet-4-6`) | Default agent loop model, structured tasks, web fetch |
| `claude-haiku-3-5-20241022` (referred to as `claude-haiku-4-5`) | Trivial lookups, classification, bloom filter checks |

Pricing captured in `loop.ts`:
- Opus: input $15/MTok, output $75/MTok, cache write $18.75/MTok, cache read $1.50/MTok
- Sonnet: input $3/MTok, output $15/MTok, cache write $3.75/MTok, cache read $0.30/MTok

---

### Artifacts Produced/Consumed Per Product

| Product | Produces | Consumes |
|---|---|---|
| Claude Code | JSONL crawl output (`data/roundN/`), hook JSON (stdin/stdout), session logs, `next-session.md`, CLAUDE.md hierarchy | Bootstrap XML, CLAUDE.md, `.claude/skills/`, `.claude/agents/`, `.mcp.json`, `settings.json`, hook scripts |
| Anthropic API | `Message` objects (text, tool_use blocks), streaming SSE events, batch results | `MessageParam[]` arrays, `Tool[]` definitions with JSON schemas, `ANTHROPIC_API_KEY` |
| Agent SDK | Session stream events, subagent results, `stop_reason` signals | `AgentDefinition`, task prompts, `allowedTools` lists, `CLAUDE_CODE_OAUTH_TOKEN` |
| MCP | Tool call results, resource content | Tool schemas (Zod), `StdioServerTransport`, `.mcp.json` config |
| Channels | Channel events (`runtime.channel_events`), permission verdicts | MCP stdio events, `claude.ai` auth |
| Neon PG18 | `crawl_events`, `dispatch_events`, `channel_events`, star schema facts | `DATABASE_URL`, SQL queries, pgvector embeddings (planned) |

---

### Spider URL Targets (Confirmed in Code)

| Spider | URL | Pages Crawled |
|---|---|---|
| `docs_spider` | `https://code.claude.com/docs/llms.txt` / `llms-full.txt` | 71 |
| `platform_spider` | `https://platform.claude.com/llms.txt` / full | 200 (llms-full) + 38 (full) |
| `anthropic_spider` | `https://www.anthropic.com/sitemap.xml` | 600+ fetched in session |
| `claude_com_spider` | `https://claude.com/docs/llms.txt` | referenced |
| `github_spider` | `https://api.github.com/orgs/{org}/repos` | `anthropics/claude-code` changelog |
| `llms_full_spider` | Any site with `llms.txt` / `llms-full.txt` | 25MB+ streaming |

Specific `code.claude.com` doc pages explicitly targeted in `crawl_adapter.py`:
- `/en/channels-reference`, `/en/headless`, `/en/hooks`, `/en/mcp`, `/en/plugins-reference`, `/en/skills`, `/en/sub-agents`

---

**Key files for this map:**
- `/home/user/researchers/.claude/bootstrap.xml`
- `/home/user/researchers/ARCHITECTURE.md`
- `/home/user/researchers/.claude/research/agentcrawls.md`
- `/home/user/researchers/.claude/research/agentdata.md`
- `/home/user/researchers/.claude/research/agentevals.md`
- `/home/user/researchers/.claude/research/agentprompts.md`
- `/home/user/researchers/.claude/memory/next-session.md`
- `/home/user/researchers/claude-multi-agent-sdk/src/types/core.ts`
- `/home/user/researchers/claude-multi-agent-sdk/src/agent/loop.ts`
- `/home/user/researchers/claude-code/.claude/skills/cert-study/SKILL.md`
- `/home/user/researchers/claude-code-agents-python/src/dspy_pipeline/crawl_adapter.py`
- `/home/user/researchers/claude-code-agents-python/generated_plugins/skills/claude-api.md`</result>
<usage><total_tokens>72785</total_tokens><tool_uses>97</tool_uses><duration_ms>256936</duration_ms></usage>
</task-notification>

---

## Prompt 21
<task-notification>
<task-id>a312940301f88f976</task-id>
<tool-use-id>toolu_01582ETjt6c8URLYfVxGEAG9</tool-use-id>
<output-file>/tmp/claude-0/-home-user-researchers/09b85f6c-ab85-4ef6-bada-cee00e76639f/tasks/a312940301f88f976.output</output-file>
<status>completed</status>
<summary>Agent "Map all Claude input artifacts" completed</summary>
<result>I now have a comprehensive picture of all structured input artifacts. Let me compile the complete catalog.

---

## Complete Catalog of Structured Input Artifacts FOR Claude

---

### 1. CLAUDE.md Files (Project/Sub-repo Instructions)

**Format:** Markdown | **Who creates:** Human | **Who consumes:** Claude Code (injected into context at session start)

| file_path | artifact_type | description |
|---|---|---|
| `/home/user/researchers/.claude/CLAUDE.md` | `project_instructions` | Root monorepo instructions: build commands, structure, commit convention, pre-PR checklist, Vercel deployment rules, environment requirements |
| `/home/user/researchers/agenttasks/CLAUDE.md` | `project_instructions` | Single-line `@AGENTS.md` import directive — tells Claude to read AGENTS.md for Next.js agent rules |
| `/home/user/researchers/claude-code-actions/.claude/CLAUDE.md` | `project_instructions` | Cross-platform CI/CD hub instructions: GitHub Actions, GitLab, Chrome, Slack, LSP |
| `/home/user/researchers/claude-code-agents-python/.claude/CLAUDE.md` | `project_instructions` | DSPy pipeline, plugin gen, multi-lang codegen, cowork module conventions |
| `/home/user/researchers/claude-code-security-review/.claude/CLAUDE.md` | `project_instructions` | Security scanner coverage, SSRF/PII/injection/exfiltration patterns, scan status |
| `/home/user/researchers/claude-code/.claude/CLAUDE.md` | `project_instructions` | Multi-language Scrapy crawler system, iterative improvement loop, skills reference |
| `/home/user/researchers/claude-dspy-crawl-planning/.claude/CLAUDE.md` | `project_instructions` | Shannon thinking crawl planner using Agent SDK v2 patterns |
| `/home/user/researchers/claude-multi-agent-dispatch/.claude/CLAUDE.md` | `project_instructions` | 10-round dispatch system, 5-stage pipeline, 252 tests, key patterns |
| `/home/user/researchers/claude-multi-agent-sdk/.claude/CLAUDE.md` | `project_instructions` | TypeScript multi-agent orchestration, branded types, context budgeting |
| `/home/user/researchers/claude-channel-dispatch-routing/.claude/CLAUDE.md` | `project_instructions` | Production channel server, Neon PG18 persistence, dispatch routing |

---

### 2. bootstrap.xml

**Format:** XML | **Who creates:** Human (co-created with Claude, maintained manually) | **Who consumes:** Claude (loaded by `session-setup.sh` SessionStart hook)

| file_path | artifact_type | description |
|---|---|---|
| `/home/user/researchers/.claude/bootstrap.xml` | `session_bootstrap` | Deterministic session entry point. Contains: `<identity>`, `<philosophy>`, `<model-routing>` (Opus/Sonnet/Haiku task routing rules), `<pinned-documents>` (versioned reference doc URLs), `<architecture-components>` (P0-P3 component registry), `<knowledge-base>` (Neon PG18 schema + connection + token efficiency hierarchy), `<eval-contract>` (evaluator roles/models/scopes), `<session-protocol>` (on-start/on-end checklists, scope guard), `<monorepo>` (9 sub-repo manifest). Schema uses named tags with attributes for `model`, `priority`, `status`, `source`, `pinned`, `crawl-spider`. |

---

### 3. .claude/settings.json Files (Hook Configs)

**Format:** JSON | **Who creates:** Human | **Who consumes:** Claude Code runtime (hook dispatch system)

| file_path | artifact_type | description |
|---|---|---|
| `/home/user/researchers/.claude/settings.json` | `hook_config` | Root: `SessionStart` (runs `session-setup.sh`), `UserPromptSubmit` (runs `check-pr-intent.sh`) |
| `/home/user/researchers/claude-code/.claude/settings.json` | `hook_config` | `PostToolUse[Bash]` runs `context_delta.py --check-last`; `Stop` runs `improvement_log.py --summarize` |
| `/home/user/researchers/claude-code-security-review/.claude/settings.json` | `hook_config` | `PreToolUse[Bash]` runs `validate-url.sh` to block disallowed URLs |
| `/home/user/researchers/claude-multi-agent-sdk/.claude/settings.json` | `hook_config` | `PostToolUse[Write\|Edit]` runs prettier; `PreToolUse[Bash]` blocks `rm -rf` and `sudo` |
| `/home/user/researchers/claude-code-actions/.claude/settings.json` | `hook_config` | Empty `{}` — no hooks registered |
| `/home/user/researchers/claude-code-agents-python/.claude/settings.json` | `hook_config` | Empty `{}` — no hooks registered |

---

### 4. Agent Definitions (.claude/agents/*.md with YAML frontmatter)

**Format:** Markdown + YAML frontmatter | **Who creates:** Human (structured-format agents also generated by `plugin-generator` agent and `agent_writer.py`) | **Who consumes:** Claude Code (agent invocation via `Agent()` tool call)

Two structural patterns exist in this repo:

**Pattern A — YAML frontmatter + body (Claude Code native):**
Fields: `name`, `description`, `tools` (allowlist with optional Bash restrictions), `model` (inherit/opus/sonnet/haiku), `memory` (project|session)

**Pattern B — Header-driven markdown (older/generated format):**
Sections: `# Agent: Name`, `## Configuration`, `## System Prompt`, `## Behavior`, `## Available Tools`

| file_path | artifact_type | pattern | model | key_purpose |
|---|---|---|---|---|
| `/home/user/researchers/claude-code/.claude/agents/crawl-orchestrator.md` | `agent_definition` | A | inherit | Orchestrates multi-spider campaigns |
| `/home/user/researchers/claude-code/.claude/agents/extraction-critic.md` | `agent_definition` | A | haiku | Reviews extraction quality |
| `/home/user/researchers/claude-code/.claude/agents/spider-architect.md` | `agent_definition` | A | sonnet | Designs/patches Scrapy spider code |
| `/home/user/researchers/claude-code-actions/.claude/agents/chrome-crawler.md` | `agent_definition` | B | (unset) | Headless Chrome SPA extraction |
| `/home/user/researchers/claude-code-actions/.claude/agents/ci-spider-improver.md` | `agent_definition` | B | (unset) | Iterative spider quality improvement in CI |
| `/home/user/researchers/claude-code-actions/.claude/agents/cross-platform-deployer.md` | `agent_definition` | B | (unset) | GitHub Actions/GitLab CI parity |
| `/home/user/researchers/claude-code-actions/.claude/agents/multi-lang-validator.md` | `agent_definition` | B | (unset) | Validates 11-language extractor/LSP configs |
| `/home/user/researchers/claude-code-agents-python/.claude/agents/codegen-assistant.md` | `agent_definition` | B | sonnet | 12-language scaffold generation |
| `/home/user/researchers/claude-code-agents-python/.claude/agents/cowork-assistant.md` | `agent_definition` | B | sonnet | Routes tasks to knowledge-work domains |
| `/home/user/researchers/claude-code-agents-python/.claude/agents/crawl-campaign-manager.md` | `agent_definition` | B | sonnet | Manages iterative crawl campaigns |
| `/home/user/researchers/claude-code-agents-python/.claude/agents/plugin-generator.md` | `agent_definition` | B | sonnet | Designs/generates Claude Code plugins |
| `/home/user/researchers/claude-code-agents-python/.claude/agents/quality-analyst.md` | `agent_definition` | B | sonnet | Analyzes extraction quality |
| `/home/user/researchers/claude-code-agents-python/.claude/agents/schema-discoverer.md` | `agent_definition` | B | sonnet | Discovers data schemas from crawled content |
| `/home/user/researchers/claude-code-security-review/.claude/agents/data-leak-scanner.md` | `agent_definition` | A | sonnet | PII/credential detection in crawled data |
| `/home/user/researchers/claude-code-security-review/.claude/agents/multi-lang-security.md` | `agent_definition` | A | sonnet | Cross-language security analysis |
| `/home/user/researchers/claude-code-security-review/.claude/agents/pipeline-auditor.md` | `agent_definition` | A | sonnet | Scrapy pipeline exfiltration audit |
| `/home/user/researchers/claude-code-security-review/.claude/agents/plugin-auditor.md` | `agent_definition` | A | opus | Generated plugin security audit |
| `/home/user/researchers/claude-code-security-review/.claude/agents/spider-security-reviewer.md` | `agent_definition` | A | opus | SSRF/injection/exfiltration review of spiders |
| `/home/user/researchers/claude-multi-agent-dispatch/.claude/agents/audit-agent.md` | `agent_definition` | A | sonnet | Alignment judge + realism approver |
| `/home/user/researchers/claude-multi-agent-dispatch/.claude/agents/dispatch-orchestrator.md` | `agent_definition` | A | opus | Lead dispatcher: decompose, fan out, gate |
| `/home/user/researchers/claude-multi-agent-dispatch/.claude/agents/quality-scorer.md` | `agent_definition` | A | sonnet | Multi-dimensional output scorer (5 dimensions) |
| `/home/user/researchers/claude-multi-agent-dispatch/.claude/agents/refinement-agent.md` | `agent_definition` | A | sonnet | Seed improver, selector evolution |
| `/home/user/researchers/claude-multi-agent-sdk/.claude/agents/context-engineer.md` | `agent_definition` | A | haiku | Context window optimization |
| `/home/user/researchers/claude-multi-agent-sdk/.claude/agents/research-orchestrator.md` | `agent_definition` | A | opus | Decomposes queries, coordinates workers, synthesizes |
| `/home/user/researchers/claude-multi-agent-sdk/.claude/agents/research-worker.md` | `agent_definition` | A | sonnet | Parallel research subagent |
| `/home/user/researchers/claude-multi-agent-sdk/.claude/agents/synthesis-agent.md` | `agent_definition` | A | sonnet | Combines multi-worker findings into report |

---

### 5. Skill Definitions (.claude/skills/*/SKILL.md)

**Format:** Markdown + YAML frontmatter | **Who creates:** Human | **Who consumes:** Claude Code (invoked via `/skill-name` slash command or `Skill()` tool)

Two structural patterns: Pattern A has YAML frontmatter (`name`, `description`, `disable-model-invocation`, `allowed-tools`, `argument-hint`, `context`, `user-invocable`, `references`, `scripts`, `model`). Pattern B is plain Markdown with a `## When to Use` section.

| file_path | artifact_type | pattern | description |
|---|---|---|---|
| `/home/user/researchers/claude-code/.claude/skills/crawl-plan/SKILL.md` | `skill_definition` | A | Plan crawl campaign from sitemap/llms.txt |
| `/home/user/researchers/claude-code/.claude/skills/improve-spider/SKILL.md` | `skill_definition` | A | Patch spider selectors from improvement logs |
| `/home/user/researchers/claude-code/.claude/skills/crawl-report/SKILL.md` | `skill_definition` | A | Generate HTML quality dashboard |
| `/home/user/researchers/claude-code/.claude/skills/extract-review/SKILL.md` | `skill_definition` | A | Review extraction quality (not user-invocable) |
| `/home/user/researchers/claude-code/.claude/skills/cert-study/SKILL.md` | `skill_definition` | A | Claude Certified Architect exam study reference |
| `/home/user/researchers/claude-code-actions/.claude/skills/chrome-extract/SKILL.md` | `skill_definition` | B | Extract from JS-rendered pages via headless Chrome |
| `/home/user/researchers/claude-code-actions/.claude/skills/ci-crawl/SKILL.md` | `skill_definition` | B | Run iterative crawl from CI/CD pipelines |
| `/home/user/researchers/claude-code-actions/.claude/skills/deploy-plugin/SKILL.md` | `skill_definition` | B | Validate and publish plugins to marketplace |
| `/home/user/researchers/claude-code-actions/.claude/skills/quality-gate/SKILL.md` | `skill_definition` | B | Enforce crawl quality score thresholds |
| `/home/user/researchers/claude-code-actions/.claude/skills/setup-lsp/SKILL.md` | `skill_definition` | B | Install/configure LSP servers for 11 languages |
| `/home/user/researchers/claude-code-actions/.claude/skills/slack-report/SKILL.md` | `skill_definition` | B | Post crawl summaries and alerts to Slack |
| `/home/user/researchers/claude-code-agents-python/.claude/skills/analyze-quality/SKILL.md` | `skill_definition` | A | Analyze extraction quality from campaign results |
| `/home/user/researchers/claude-code-agents-python/.claude/skills/claude-api/SKILL.md` | `skill_definition` | A | Anthropic API usage in 7 languages |
| `/home/user/researchers/claude-code-agents-python/.claude/skills/codegen/SKILL.md` | `skill_definition` | A | Generate multi-language scaffolds |
| `/home/user/researchers/claude-code-agents-python/.claude/skills/cowork-task/SKILL.md` | `skill_definition` | A | Route tasks to knowledge-work domains |
| `/home/user/researchers/claude-code-agents-python/.claude/skills/generate-plugin/SKILL.md` | `skill_definition` | A | Generate Claude Code plugin structure |
| `/home/user/researchers/claude-code-agents-python/.claude/skills/run-campaign/SKILL.md` | `skill_definition` | A | Run iterative crawl campaign |
| `/home/user/researchers/claude-code-security-review/.claude/skills/dependency-audit/SKILL.md` | `skill_definition` | A | Multi-language dependency vulnerability audit |
| `/home/user/researchers/claude-code-security-review/.claude/skills/pii-check/SKILL.md` | `skill_definition` | A | Scan crawled data for PII |
| `/home/user/researchers/claude-code-security-review/.claude/skills/plugin-review/SKILL.md` | `skill_definition` | A | Security review generated plugins |
| `/home/user/researchers/claude-code-security-review/.claude/skills/security-scan/SKILL.md` | `skill_definition` | A | Comprehensive security audit |
| `/home/user/researchers/claude-code-security-review/.claude/skills/ssrf-check/SKILL.md` | `skill_definition` | A | SSRF vulnerability check in spider code |
| `/home/user/researchers/claude-multi-agent-dispatch/.claude/skills/audit/SKILL.md` | `skill_definition` | A | Audit completed dispatch/round |
| `/home/user/researchers/claude-multi-agent-dispatch/.claude/skills/crawl-round/SKILL.md` | `skill_definition` | A | Execute specific crawl round from 10-round plan |
| `/home/user/researchers/claude-multi-agent-dispatch/.claude/skills/dispatch/SKILL.md` | `skill_definition` | A | Execute multi-agent dispatch with quality scoring |
| `/home/user/researchers/claude-multi-agent-dispatch/.claude/skills/refine/SKILL.md` | `skill_definition` | A | Refinement cycle on dispatch prompts |
| `/home/user/researchers/claude-multi-agent-sdk/.claude/skills/context-audit/SKILL.md` | `skill_definition` | A | Audit context window and recommend compaction |
| `/home/user/researchers/claude-multi-agent-sdk/.claude/skills/multi-agent-research/SKILL.md` | `skill_definition` | A | Orchestrate multi-agent research |

---

### 6. MCP Server Tool Schemas

**Format:** TypeScript (Zod schemas compiled to JSON Schema) | **Who creates:** Human | **Who consumes:** Claude Code (tools become available in the tool namespace when MCP server is active via `.mcp.json`)

**a. Channel MCP Server** — `/home/user/researchers/claude-channel-dispatch-routing/src/channel/server.ts`
Also includes hardcoded `INSTRUCTIONS` string (plain-text system prompt for the MCP session).
| tool | input schema |
|---|---|
| `reply` | `{chat_id: string, text: string}` |

**b. Multi-agent SDK MCP Server** — `/home/user/researchers/claude-multi-agent-sdk/src/mcp/server.ts`
| tool | input schema |
|---|---|
| `classify_query` | `{query: string, context?: string}` |
| `generate_tasks` | `{query: string, queryType: enum, subtopics?: string[], model: enum, maxTurns: int, responseFormat: enum}` |
| `synthesize_results` | `{query: string, results: [{agentId, summary, confidence, sources?}], outputStyle: enum}` |
| `estimate_costs` | `{agentCount: int, model: enum, estimatedTurnsPerAgent: int, estimatedTokensPerTurn: int}` |

**c. Shannon Thinking MCP Server** — `/home/user/researchers/claude-multi-agent-dispatch/src/thinking/server.ts`
| tool | input schema |
|---|---|
| `create_thought` | `{type: enum[5], content: string, confidence: float, assumptions: [{id,description,status,evidence?}], dependencies: string[]}` |
| `chain_thoughts` | `{thoughtIds?: string[], synthesize: boolean}` |
| `track_assumption` | `{description: string, evidence?: string}` |

**d. Dispatch Tools MCP Server** — `/home/user/researchers/claude-multi-agent-dispatch/src/dispatch/mcp-server.ts`
| tool | input schema |
|---|---|
| `classify_dispatch` | `{task: string}` |
| `plan_dispatch` | `{task: string, model?: string, maxAgents?: number}` |
| `execute_dispatch` | `{planJson: string}` |
| `check_status` | `{dispatchId: string}` |

**e. Audit Tool Definitions** — `/home/user/researchers/claude-multi-agent-dispatch/src/audit/tools.ts`
(Used internally by the audit-agent, not directly as an MCP server)
| tool | input schema |
|---|---|
| `read_transcript` | `{transcriptId: string}` |
| `score_output` | `{output: string, taskSpec: string}` |
| `check_realism` | `{output: string, context: string}` |
| `generate_feedback` | `{auditReport: string (JSON)}` |

---

### 7. DSPy Signatures/Modules

**Format:** Python (dspy.Signature subclasses) | **Who creates:** Human | **Who consumes:** Claude (via DSPy's LM backend — the signature fields define the structured I/O prompt that gets compiled and sent to Claude)

All in `/home/user/researchers/claude-code-agents-python/src/dspy_pipeline/signatures.py`:

| class | artifact_type | inputs | outputs |
|---|---|---|---|
| `PageClassifier` | `dspy_signature` | url, title, content_snippet, html_snippet | page_type, confidence, reasoning |
| `QualityScorer` | `dspy_signature` | url, extracted_content, structured_data, selectors_used, link_count | completeness, structure, links, issues |
| `SelectorProposer` | `dspy_signature` | spider_name, current_selectors, failing_selectors, html_sample, page_type | proposed_selectors, rationale, expected_improvement |
| `PluginDesigner` | `dspy_signature` | domain, crawled_summaries, discovered_page_types, existing_plugins | plugin_name, plugin_description, skills_json, agents_json, connectors_json |
| `CodegenRouter` | `dspy_signature` | task_description, target_environment, preferred_languages, constraints | primary_language, secondary_languages, framework, scaffold_type, rationale |

Each signature is wrapped by a `dspy.ChainOfThought` module in `/home/user/researchers/claude-code-agents-python/src/dspy_pipeline/modules.py`.

---

### 8. System Prompts / Prompt Templates

**Format:** Plain text (embedded in code) or Markdown | **Who creates:** Human | **Who consumes:** Claude (passed as `system` parameter in API calls)

| file_path | artifact_type | description |
|---|---|---|
| `/home/user/researchers/claude-channel-dispatch-routing/src/channel/server.ts` → `INSTRUCTIONS` const | `system_prompt` | Plain-text session instructions for Claude when connected to the dispatch channel MCP server. Instructs how to handle `notifications/claude/channel/event` and permission requests. |
| `/home/user/researchers/claude-code-agents-python/src/plugin_gen/agent_writer.py` → `_default_system_prompt()` | `system_prompt_template` | Python function that generates system prompt markdown for agent `.md` files. Template used when `AgentSpec.system_prompt` is not explicitly set. |
| `/home/user/researchers/.claude/research/agentprompts.md` | `prompt_architecture_spec` | Design document specifying a three-layer prompt optimization framework (syntax/reference/optimization via DSPy). Contains example `agentprompt` YAML schema. Not yet implemented. |

---

### 9. .claude/rules/*.md Files (Conditional Rules)

**Format:** Markdown + YAML frontmatter | **Who creates:** Human | **Who consumes:** Claude Code (injected when file paths match the `paths:` glob pattern in frontmatter)

All in `/home/user/researchers/claude-channel-dispatch-routing/.claude/rules/`:

| file_path | artifact_type | paths glob | description |
|---|---|---|---|
| `boris-cherny-standards.md` | `conditional_rule` | `**/*.ts, **/*.tsx` | Mandatory TypeScript patterns: branded types, Result\<T,E\>, no thrown exceptions, exhaustive matching, strict mode |
| `kimball-data-architecture.md` | `conditional_rule` | `**/*.ts, **/*.py, **/*.sql, **/*.rs, **/*.go` | Three-layer data architecture (Runtime/Reporting/Semantic), Kimball bus matrix, SCD Type 2, grain declarations |
| `test-standards.md` | `conditional_rule` | `**/*.test.*, **/*.spec.*, **/tests/**, **/__tests__/**` | Language-specific test framework standards: vitest for TS, pytest for Python, etc. |

---

### 10. .mcp.json Configs (MCP Server Registration)

**Format:** JSON | **Who creates:** Human | **Who consumes:** Claude Code (reads at session start to register available MCP tools)

| file_path | artifact_type | servers registered |
|---|---|---|
| `/home/user/researchers/claude-channel-dispatch-routing/.mcp.json` | `mcp_config` | `dispatch-channel` (channel/server.ts via npx tsx) |
| `/home/user/researchers/claude-multi-agent-dispatch/.mcp.json` | `mcp_config` | `shannon-thinking` (thinking/server.ts), `dispatch-tools` (dispatch/mcp-server.ts) |
| `/home/user/researchers/claude-multi-agent-sdk/.mcp.json` | `mcp_config` | `multi-agent-research` (mcp/server.ts) |

---

### 11. YAML Security Rules (Agent-Consumed Configs)

**Format:** YAML | **Who creates:** Human | **Who consumes:** Claude (via security agents) and Python/TS scanners

| file_path | artifact_type | description |
|---|---|---|
| `/home/user/researchers/claude-code-security-review/rules/pii_patterns.yaml` | `security_rule_config` | 11 PII regex patterns (email, phone_us, phone_intl, SSN, credit_card, IP, AWS key, JWT, etc.) with confidence scores. Read by `data-leak-scanner` agent and `pii_scanner.py`. |
| `/home/user/researchers/claude-code-security-review/rules/plugin_safety_rules.yaml` | `security_rule_config` | Disallowed Python functions/patterns (eval, exec, subprocess), hook restrictions, max script size. Read by `plugin-auditor` agent. |
| `/home/user/researchers/claude-code-security-review/rules/security_policies.yaml` | `security_rule_config` | Network policies: max redirects, allowed schemes, timeouts, DNS cache TTL, rate limiting, outbound restrictions. |
| `/home/user/researchers/claude-code-security-review/rules/url_allowlist.yaml` | `security_rule_config` | Allowed domains and blocked patterns for SSRF protection. Read by `validate-url.sh` hook and security agents. |
| `/home/user/researchers/claude-multi-agent-dispatch/src/safety/rules/pii-patterns.yaml` | `security_rule_config` | Parallel PII pattern set for the dispatch system (list format vs. map format in security-review). |
| `/home/user/researchers/claude-multi-agent-dispatch/src/safety/rules/security-policies.yaml` | `security_rule_config` | Network and data policies for dispatch safety layer. |
| `/home/user/researchers/claude-multi-agent-dispatch/src/safety/rules/url-allowlist.yaml` | `security_rule_config` | URL allowlist/blocklist for dispatch crawl targets. |

---

### 12. Memory Files (.claude/memory/*.md)

**Format:** Markdown (some with YAML frontmatter) | **Who creates:** Claude (written at session end; some pre-seeded by human) | **Who consumes:** Claude (read at session start via `session-setup.sh`)

| file_path | artifact_type | description |
|---|---|---|
| `/home/user/researchers/.claude/memory/MEMORY.md` | `persistent_memory` | Index of memory reference files with descriptions |
| `/home/user/researchers/.claude/memory/next-session.md` | `session_carryover` | Out-of-scope items from prior session; Claude Code version pin; research doc status table. Injected by `session-setup.sh` at session start. |
| `/home/user/researchers/.claude/memory/reference_mcp_v2_neon_pg18.md` | `reference_memory` | MCP SDK v2 architecture patterns + Neon PG18 features (YAML frontmatter with `name`, `description`, `type`) |
| `/home/user/researchers/.claude/memory/project_channel_dispatch.md` | `reference_memory` | Plan for channel-dispatch-routing repo (YAML frontmatter) |
| `/home/user/researchers/.claude/memory/feedback_v2185_optimizations.md` | `reference_memory` | Top 5 ROI actions for Claude Code v2.1.85 latency/codegen |
| `/home/user/researchers/.claude/memory/feedback_latency_codegen.md` | `reference_memory` | Ranked latency levers from awesome-claude-code research |

---

### 13. Research Docs (.claude/research/*.md)

**Format:** Markdown | **Who creates:** Claude (authored in research sessions) | **Who consumes:** Claude (read at session start per bootstrap.xml `<on-start>` protocol)

| file_path | artifact_type | description |
|---|---|---|
| `/home/user/researchers/.claude/research/agentcrawls.md` | `architecture_spec` | P0 — Agent-directed crawling contracts, spider inventory, convergence detection design |
| `/home/user/researchers/.claude/research/agentdata.md` | `architecture_spec` | P0 — 4-tier Neon PG18 persistence design, token efficiency hierarchy, schema spec |
| `/home/user/researchers/.claude/research/agentevals.md` | `architecture_spec` | P0 — Codebase evaluation framework, BrowseComp-inspired eval loop design |
| `/home/user/researchers/.claude/research/agentcommits.md` | `architecture_spec` | P2 — Conventional commits extension with git trailers for agent metadata |
| `/home/user/researchers/.claude/research/agentprompts.md` | `architecture_spec` | P2 — DSPy-based dynamic prompt optimization, three-layer design (syntax/reference/optimization) |

---

### 14. Cofounder Prompts (.jade/cofounder-prompts/*.md)

**Format:** Markdown | **Who creates:** Human (verbatim) + Claude (structured extraction) | **Who consumes:** Claude (context for Jade framework decisions)

| file_path | artifact_type | description |
|---|---|---|
| `/home/user/researchers/.jade/cofounder-prompts/2026-03-27-product-vision-001.md` | `cofounder_prompt` | Raw product vision: multi-department Jade framework, crawlers-as-tools, Neon PG18 as warehouse, agent lifecycle |
| `/home/user/researchers/.jade/cofounder-prompts/2026-03-27-product-vision-002.md` | `cofounder_prompt` | Department templates, Bezos 3 books (Innovator's Dilemma, The Goal, Effective Executive), cowork agent personas |
| `/home/user/researchers/.jade/cofounder-prompts/2026-03-27-product-vision-003.md` | `cofounder_prompt` | Identity architecture: Layer 0 (Constitutional AI), Layer 1 (Anthropic system prompt), Layer 2 (Jade framework). Affirmed by cofounder. |

---

### 15. AGENTS.md

**Format:** HTML comment + Markdown | **Who creates:** Human | **Who consumes:** Claude Code (injected into Next.js project context)

| file_path | artifact_type | description |
|---|---|---|
| `/home/user/researchers/agenttasks/AGENTS.md` | `agent_context_inject` | Warning that the Next.js version in this repo has breaking API changes; instructs Claude to read `node_modules/next/dist/docs/` before writing any code. Referenced via `@AGENTS.md` in `agenttasks/CLAUDE.md`. |

---

### 16. todos.jsonl Files

**Format:** JSONL | **Who creates:** Claude (during sessions) | **Who consumes:** Claude (read to understand pending work) and humans

| file_path | artifact_type | description |
|---|---|---|
| `/home/user/researchers/todos.jsonl` (root) | `todo_index` | 22 indexed improvement items. Schema: `{id, repo, file, line, marker, content, status, priority, created}`. Tracks cross-repo improvement work. |
| `/home/user/researchers/claude-code/todos.jsonl` + 7 others | `todo_index` | Per-sub-repo todo lists with same schema |

---

### Summary Table

| artifact_type | count | format | who_creates | who_consumes |
|---|---|---|---|---|
| `project_instructions` (CLAUDE.md) | 10 | Markdown | Human | Claude |
| `session_bootstrap` (bootstrap.xml) | 1 | XML | Human+Claude | Claude |
| `hook_config` (settings.json) | 6 | JSON | Human | Claude Code runtime |
| `agent_definition` (.claude/agents/*.md) | 26 | Markdown+YAML | Human / Claude (via agent_writer.py) | Claude |
| `skill_definition` (.claude/skills/*/SKILL.md) | 28 | Markdown+YAML | Human | Claude |
| `mcp_tool_schema` (server.ts tool registrations) | 5 servers / ~15 tools | TypeScript/Zod | Human | Claude |
| `mcp_config` (.mcp.json) | 3 | JSON | Human | Claude Code |
| `dspy_signature` (signatures.py) | 5 classes | Python | Human | Claude (via DSPy LM backend) |
| `system_prompt` (inline code + agent_writer.py) | 2 | Plain text | Human | Claude |
| `conditional_rule` (.claude/rules/*.md) | 3 | Markdown+YAML | Human | Claude |
| `security_rule_config` (rules/*.yaml) | 7 | YAML | Human | Claude + Python scanners |
| `persistent_memory` (.claude/memory/*.md) | 6 | Markdown | Claude | Claude |
| `architecture_spec` (.claude/research/*.md) | 5 | Markdown | Claude | Claude |
| `cofounder_prompt` (.jade/cofounder-prompts/*.md) | 3 | Markdown | Human+Claude | Claude |
| `agent_context_inject` (AGENTS.md) | 1 | Markdown | Human | Claude |
| `todo_index` (todos.jsonl) | 9 | JSONL | Claude | Claude+Human |</result>
<usage><total_tokens>78778</total_tokens><tool_uses>95</tool_uses><duration_ms>383097</duration_ms></usage>
</task-notification>

---

## Prompt 22
<task-notification>
<task-id>a217ff68fe58b7f70</task-id>
<tool-use-id>toolu_01NQyDa6HE8yEqyyY8du4nnR</tool-use-id>
<output-file>/tmp/claude-0/-home-user-researchers/09b85f6c-ab85-4ef6-bada-cee00e76639f/tasks/a217ff68fe58b7f70.output</output-file>
<status>completed</status>
<summary>Agent "Map all Claude output artifacts" completed</summary>
<result>Now I have a comprehensive picture of all artifact types. Let me compile the full catalog.

Here is the complete catalog of every distinct structured output artifact that Claude produces in this codebase, organized by type:

---

## Catalog of Structured Output Artifacts Produced by Claude

### 1. Git Commit (Conventional Commit)

| Field | Value |
|-------|-------|
| **format** | Plain text, `<type>: <description>` title + optional body |
| **schema_location** | `.claude/CLAUDE.md` (root, commit convention section); `.github/pull_request_template.md` examples |
| **destination** | Git history across all 9 sub-repos |
| **who_consumes_it** | Human reviewers, `git log`, CI/CD, Vercel deploy detection |
| **description** | Every commit uses `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, or `ci:` prefix. Claude generates these when asked to commit. |

---

### 2. PR Description

| Field | Value |
|-------|-------|
| **format** | Markdown with fixed sections |
| **schema_location** | `/home/user/researchers/.github/pull_request_template.md` |
| **destination** | GitHub pull request body |
| **who_consumes_it** | Human reviewers, Vercel bot, `gh pr create` |
| **description** | Sections: `## Summary`, `## Changes` (bulleted), `## Test Plan` (checkboxes), `## Vercel Build Checklist`, `## Breaking Changes`, `## Affected Sub-repos` (checkboxes). |

---

### 3. Shannon ThoughtChain / ThinkingReport

| Field | Value |
|-------|-------|
| **format** | TypeScript object (runtime); serialized as JSONL in transcript files |
| **schema_location** | `claude-multi-agent-dispatch/src/types/thinking.ts` (canonical); `claude-dspy-crawl-planning/src/types/core.ts` (fork) |
| **destination** | In-memory `ThinkingEngine`, JSONL transcript files at `rounds/{N}/transcripts.jsonl` |
| **who_consumes_it** | `ThinkingEngine.generateReport()`, `CrawlPlan.thoughts[]`, next-round context injection |
| **description** | `ShannonThought` has: `id`, `type` (problem_definition → constraints → model → proof → implementation), `content`, `confidence` (0-1), `uncertainty` (0-1), `assumptions[]`, `dependencies[]`, `isRevision`. `ThoughtChain` wraps an ordered array. `ThinkingReport` adds `overallConfidence` and `unresolvedAssumptions[]`. |

---

### 4. CrawlPlan

| Field | Value |
|-------|-------|
| **format** | TypeScript object (in-memory); summary printed to stdout |
| **schema_location** | `claude-dspy-crawl-planning/src/types/core.ts` (`CrawlPlan` type) |
| **destination** | Passed to Scrapy runner; summary logged to stdout |
| **who_consumes_it** | Spider runner, next-round ContextDelta, human review |
| **description** | Fields: `id` (CrawlId), `name`, `round`, `targets[]` (url + category + priority + qualityThreshold), `thoughts[]` (ShannonThought array), `totalPages`, `overallThreshold`, `steeringContext`, `createdAt`. |

---

### 5. Crawl Event (Spider Output / DocPage)

| Field | Value |
|-------|-------|
| **format** | Pydantic model → JSONL (via ImprovementFeedbackPipeline); Postgres row (via NeonDeltaFetchMiddleware) |
| **schema_location** | `claude-code/scrapy_researchers/items.py` (`DocPage`, `ResearchPaper`, `NewsArticle`, `APIEndpoint`, `SkillSpec`); `claude-channel-dispatch-routing/migrations/002_runtime_schema.sql` (`runtime.crawl_events`) |
| **destination** | `improvements/{spider}_{timestamp}.jsonl`; Neon `runtime.crawl_events` table; `data/roundN/*.jsonl` |
| **who_consumes_it** | QualityScorer, DedupPipeline, ContextDeltaGenerator, ETL into reporting layer |
| **description** | `DocPage`: `url`, `title`, `content_markdown`, `content_html`, `metadata{}`, `quality_score` (0-1), `extraction_timestamp`. DB table adds: `spider_name`, `round_number`, `response_status`, `content_hash` (SHA-256), `headers_etag`, `body_size`, `hstore metadata`. |

---

### 6. Quality Score

| Field | Value |
|-------|-------|
| **format** | Python dataclass or TypeScript interface; embedded in JSONL |
| **schema_location** | `claude-code-agents-python/src/models/extraction_result.py` (`QualityScore`); `claude-multi-agent-dispatch/src/types/quality.ts` (`QualityScore`, `DimensionScore`) |
| **destination** | Embedded in `DocPage.quality_score`, `ExtractionResult.quality`, JSONL improvement logs, Neon `reporting.fact_crawl_quality` |
| **who_consumes_it** | ImprovementFeedbackPipeline, ContextDeltaGenerator, ETL, Slack alerter, HTML dashboard |
| **description** | Python version: `completeness`, `structure`, `links`, `overall` (all 0-1). TS dispatch version adds 5 dimensions: `completeness`, `structure`, `accuracy`, `coherence`, `safety` each with `value`, `confidence`, `weight`. Weighted formula: 0.30/0.25/0.25/0.10/0.10. |

---

### 7. ImprovementFeedbackEntry (Spider JSONL)

| Field | Value |
|-------|-------|
| **format** | JSONL (one JSON object per line) |
| **schema_location** | `claude-code/scrapy_researchers/pipelines.py` (`ImprovementFeedbackPipeline._generate_hints`) |
| **destination** | `claude-code/improvements/{spider}_{YYYYMMDD_HHMMSS}.jsonl` |
| **who_consumes_it** | `ContextDelta.generate_delta()`, next crawl round configuration, human review |
| **description** | Fields: `timestamp`, `spider`, `url`, `quality_score`, `title`, `content_length`, `metadata_fields[]`, `needs_improvement` (bool), optional `improvement_hints[]` (strings like "Missing title — check title selector"). |

---

### 8. ContextDelta

| Field | Value |
|-------|-------|
| **format** | Python dataclass (JSON-serializable) or TypeScript interface |
| **schema_location** | `claude-code/scrapy_researchers/feedback/context_delta.py` (`ContextDelta`); `claude-code-agents-python/src/models/extraction_result.py` (`ContextDelta`); `claude-multi-agent-dispatch/src/types/quality.ts` (`ContextDeltaPayload`) |
| **destination** | Passed to next-round planner; injected as steering context into spider configuration |
| **who_consumes_it** | `buildCrawlPlan()` in dspy-crawl-planning; `ContextDeltaAccumulator.injectContext()`; next spider round |
| **description** | Python: `timestamp`, `spider_name`, `avg_score_current/previous`, `score_delta`, `improved_urls[]`, `degraded_urls[]`, `new_urls[]`, `failed_selectors[]`, `total_pages`, `pages_above_threshold`. TS: `iteration`, `newPatterns[]`, `failingStrategies[]`, `qualityBefore/After`, `steerDirection`, `discoveredTypes[]`. |

---

### 9. Dispatch Event

| Field | Value |
|-------|-------|
| **format** | TypeScript discriminated union (`Event` type) → JSONL; Postgres row |
| **schema_location** | `claude-multi-agent-dispatch/src/types/transcript.ts` (`Event` union: `ToolCallEvent`, `ToolResultEvent`, `DecisionEvent`, `QualityScoreEvent`, `ContextDeltaEvent`, `DispatchEvent`, `AuditEvent`); `002_runtime_schema.sql` (`runtime.dispatch_events`) |
| **destination** | `rounds/{N}/events.jsonl` (via `JSONLWriter`); Neon `runtime.dispatch_events` |
| **who_consumes_it** | AuditStore, AuditorAgent, ETL into `reporting.fact_dispatch`, human review |
| **description** | 7 event subtypes discriminated by `type`. DB table: `dispatch_id`, `round_number`, `agent_id`, `agent_model`, `task_type`, `platform`, `input_tokens`, `output_tokens`, `cost_usd`, `duration_ms`, `quality_score`, `success`, `error_message`. |

---

### 10. Transcript (JSONL)

| Field | Value |
|-------|-------|
| **format** | JSONL (metadata line + message lines + event lines) |
| **schema_location** | `claude-multi-agent-dispatch/src/types/transcript.ts` (`Transcript`); `claude-multi-agent-dispatch/src/logging/transcript.ts` (`TranscriptBuilder.serialize()`) |
| **destination** | `rounds/{N}/transcripts.jsonl`; `AuditStore` |
| **who_consumes_it** | `AuditorAgent.review()`, `AuditStore.loadTranscript()`, next-session context |
| **description** | `_metadata` line: `sessionId`, `roundId`, `dispatchId`, `agentAssignments`. `_message` lines: `role`, `content`, `timestamp`. Event lines: typed events (tool_call, tool_result, decision, quality_score, context_delta, dispatch, audit). |

---

### 11. AuditReport

| Field | Value |
|-------|-------|
| **format** | TypeScript object → JSONL via `AuditStore` |
| **schema_location** | `claude-multi-agent-dispatch/src/audit/auditor.ts` (`AuditReport`); `002_runtime_schema.sql` (`runtime.audit_logs`) |
| **destination** | `rounds/{N}/audits.jsonl`; Neon `runtime.audit_logs` |
| **who_consumes_it** | Human reviewers, dispatch orchestrator for re-routing decisions |
| **description** | Fields: `auditId`, `dispatchId`, `agentScores` (Map<agentId→score>), `overallScore`, `flaggedIssues[]` (each with `severity`, `description`, `agentId`, `evidence`), `recommendations[]`, `timestamp`. Issues have three severities: `critical`, `warning`, `info`. |

---

### 12. JudgmentResult (Alignment Judge Output)

| Field | Value |
|-------|-------|
| **format** | TypeScript interface |
| **schema_location** | `claude-multi-agent-dispatch/src/audit/judge.ts` (`JudgmentResult`) |
| **destination** | Consumed by `AuditorAgent`; embedded in `AuditReport` |
| **who_consumes_it** | `AuditorAgent.review()` |
| **description** | Fields: `score` (0-1), `rationale` (string), `dimensions` object with `relevance`, `completeness`, `accuracy`, `safety` (all 0-1). Prompt template (`ALIGNMENT_PROMPT`) is a fixed string requesting structured evaluation. |

---

### 13. RoutingDecision

| Field | Value |
|-------|-------|
| **format** | TypeScript object → JSONL appended to file |
| **schema_location** | `claude-channel-dispatch-routing/src/dispatch/router.ts` (`RoutingDecision`) |
| **destination** | `routing-decisions.jsonl` (append-only log) |
| **who_consumes_it** | Channel MCP server, human operators |
| **description** | Fields: `event` (ChannelEvent), `classification` (taskType + complexity + keywords + confidence), `agentRecommendation` (agentId + model tier + tools[] + rationale), `pluginRecommendations[]` (pluginName + matchScore + matchReason), `timestamp`. |

---

### 14. ChannelEvent / PermissionRequest / PermissionVerdict

| Field | Value |
|-------|-------|
| **format** | TypeScript objects; Postgres row |
| **schema_location** | `claude-channel-dispatch-routing/src/channel/types.ts`; `002_runtime_schema.sql` (`runtime.channel_events`) |
| **destination** | Neon `runtime.channel_events`; Claude agent session via MCP |
| **who_consumes_it** | Claude agent loop (for permission relay), human via chat |
| **description** | `ChannelEvent`: `source` (SenderId), `content`, `meta{}`. `PermissionRequest`: `requestId` (5-char), `toolName`, `description`, `inputPreview`. `PermissionVerdict`: `requestId`, `behavior` (allow/deny). Parsed from chat text via `VERDICT_REGEX` (`/^\s*(y|yes|n|no)\s+([a-km-z]{5})\s*$/i`). |

---

### 15. Linear Issue

| Field | Value |
|-------|-------|
| **format** | Markdown body + GraphQL mutation; `LinearIssue` Python dataclass returned |
| **schema_location** | `claude-code-actions/integrations/linear_sync.py` (`LinearIssue`, `create_improvement_issue()`) |
| **destination** | Linear project management via GraphQL API |
| **who_consumes_it** | Human engineers, Linear workflow automation |
| **description** | Title pattern: `"Improve {spider_name} spider: {dimension} ({current_score:.0%} -> {target_score:.0%})"`. Body sections: spider/dimension/scores, `### Details`, `### Acceptance Criteria` checklist. Priority 1 (urgent) if score < 50%, 2 (high) < 70%, 3 (medium) otherwise. |

---

### 16. Slack Block Kit Message

| Field | Value |
|-------|-------|
| **format** | JSON array of Slack Block Kit blocks |
| **schema_location** | `claude-code-actions/integrations/slack_reporter.py` (`SlackReporter.post_crawl_summary()`, `post_quality_alert()`) |
| **destination** | Slack channel via `chat.postMessage` API |
| **who_consumes_it** | Human team members in Slack |
| **description** | Two message shapes: (1) Crawl summary — header with pass/fail emoji, section fields (target, spider, iterations, quality score, pages, errors), context timestamp, optional "View Run" button. (2) Quality alert — header with rotating-light or check emoji, per-spider score lines with pass/fail icons, threshold context, optional "View Report" button. |

---

### 17. HTML Quality Dashboard

| Field | Value |
|-------|-------|
| **format** | Self-contained HTML with embedded `<script id="report-data" type="application/json">` data block |
| **schema_location** | `claude-code-actions/scripts/generate-report.py` (`REPORT_TEMPLATE`) |
| **destination** | `reports/quality-dashboard.html` (local file) |
| **who_consumes_it** | Human engineers, Slack reporter (extracts `report-data` JSON), CI artifacts |
| **description** | Sections: overall summary stats (avg quality, spiders count, passing, failing, total pages), per-spider cards with dimension bars (completeness, accuracy, freshness), optional historical trend table. Embedded JSON: `{"spiders": {name: {overall_score, pages_evaluated, completeness, accuracy, freshness}}, "overall_score": float}`. |

---

### 18. DSPy Signature Outputs (LLM-structured)

| Field | Value |
|-------|-------|
| **format** | DSPy `Prediction` objects with typed output fields |
| **schema_location** | `claude-code-agents-python/src/dspy_pipeline/signatures.py` |
| **destination** | In-memory pipeline; fed into `ExtractionResult`, `ImprovementSuggestion`, `PluginSpec` |
| **who_consumes_it** | `ResearchPipeline` methods, plugin generator, codegen router |
| **description** | Five signatures: **PageClassifier** → `page_type`, `confidence`, `reasoning`. **QualityScorer** → `completeness`, `structure`, `links`, `issues` (semicolon-separated). **SelectorProposer** → `proposed_selectors` (old→new per line), `rationale`, `expected_improvement`. **PluginDesigner** → `plugin_name`, `plugin_description`, `skills_json` (JSON array), `agents_json`, `connectors_json`. **CodegenRouter** → `primary_language`, `secondary_languages`, `framework`, `scaffold_type`, `rationale`. |

---

### 19. Plugin Scaffold (Generated Files)

| Field | Value |
|-------|-------|
| **format** | Directory tree of Markdown + JSON files |
| **schema_location** | `claude-code-agents-python/src/models/plugin_spec.py` (`PluginSpec`, `SkillSpec`, `AgentSpec`, `ConnectorSpec`); `src/plugin_gen/scaffold.py` |
| **destination** | `generated_plugins/{plugin-name}/` directory |
| **who_consumes_it** | Claude Code plugin loader, human plugin developers |
| **description** | Generates: `plugin.json` (manifest), `skills/{name}.md` (YAML frontmatter + markdown body), `agents/{name}.md`, `connectors/mcp.json`, `hooks/hooks.json`, `.lsp/config.json`. |

---

### 20. Plugin Audit Report

| Field | Value |
|-------|-------|
| **format** | Python dataclass |
| **schema_location** | `claude-code-security-review/scanners/plugin_scanner.py` (`PluginAuditReport`, `PluginIssue`) |
| **destination** | In-memory; printed/returned to caller |
| **who_consumes_it** | CI pipeline, human security review, GitHub Actions |
| **description** | `PluginAuditReport`: `plugin_dir`, `issues[]` (each with `file`, `line`, `severity`, `description`, `category`), `scanned_files[]`, `passed` (bool). Categories: `script_safety`, `hook_safety`, `credential_leak`, `skill_safety`, `mcp_safety`, `schema`. |

---

### 21. Security Scanner Finding

| Field | Value |
|-------|-------|
| **format** | Python dataclass per scanner |
| **schema_location** | `claude-code-security-review/scanners/python/ssrf_scanner.py` (`SSRFVulnerability`); `pii_scanner.py` (`PIIMatch`) |
| **destination** | In-memory; printed to stdout or fed to audit pipeline |
| **who_consumes_it** | CI checks, `PreToolUse` hook (`validate-url.sh`) |
| **description** | `SSRFVulnerability`: `file`, `line`, `severity` (critical/high/medium/low), `description`, `code_snippet`, `vulnerability_type` (hardcoded_ip/user_input_url/redirect_follow/dns_rebinding). `PIIMatch`: `type`, `value` (redacted), `location`, `confidence`. |

---

### 22. Task Object (TodoWrite / agenttasks)

| Field | Value |
|-------|-------|
| **format** | JSON object; TypeScript `Task` type in React state |
| **schema_location** | `agenttasks/src/app/api/tasks/route.ts`; `agenttasks/src/app/tasks/page.tsx` (`Task` type) |
| **destination** | In-memory store (API); displayed in Next.js webapp; `todos.jsonl` (root + each sub-repo) |
| **who_consumes_it** | `agenttasks` webapp UI, human developers, Claude Code (TodoWrite tool) |
| **description** | API schema: `id`, `content`, `status` (pending/in_progress/completed), `createdAt`. `todos.jsonl` schema (root): `id`, `repo`, `file`, `line`, `marker`, `content`, `status`, `priority`, `created`. React `Task` adds optional `activeForm` (progress text) and `description`. |

---

### 23. ETL Fact/Dimension Rows (Kimball Star Schema)

| Field | Value |
|-------|-------|
| **format** | Postgres rows (written by pg_cron ETL every 15 min) |
| **schema_location** | `claude-channel-dispatch-routing/migrations/003_reporting_schema.sql`; `migrations/etl/` SQL scripts |
| **destination** | Neon PG18: `reporting.fact_crawl_quality`, `reporting.fact_dispatch`, `reporting.fact_channel_event`, `reporting.dim_page` (SCD Type 2), `reporting.dim_round`, `reporting.dim_agent`, `reporting.dim_date`; materialized view `reporting.mv_round_summary` |
| **who_consumes_it** | `semantic.*` views, Grafana dashboards, `agenttasks` webapp |
| **description** | Fact grain: one row per page per round (crawl quality), one row per task execution (dispatch). `fact_crawl_quality` has 5 scored dimensions plus `overall_score`, `token_cost_usd`, `content_changed`. `dim_page` uses SCD Type 2 (`is_current`, `valid_from`, `valid_to`). |

---

### 24. Semantic Metric Views

| Field | Value |
|-------|-------|
| **format** | SQL views (read-only business contract) |
| **schema_location** | `claude-channel-dispatch-routing/migrations/004_semantic_views.sql`; `src/styles/types.ts` (`STYLE_METRICS`) |
| **destination** | Neon `semantic.*` schema (6 views: `average_crawl_quality`, `quality_improvement_rate`, `total_crawl_cost`, `pages_changed`, `dispatch_success_rate`, `cost_per_quality_point`) |
| **who_consumes_it** | Analytics consumers, BI tools, webapp |
| **description** | Business-name-only views, no physical schema leakage. Each declares additivity (additive vs non-additive). Style domain adds `style_adoption_rate`, `popular_styles`, `switch_frequency` metrics in TypeScript type declarations. |

---

### 25. RoundDefinition

| Field | Value |
|-------|-------|
| **format** | TypeScript object (static definitions) |
| **schema_location** | `claude-multi-agent-dispatch/src/rounds/round-01.ts` through `round-11.ts`; `src/rounds/types.ts` (`RoundDefinition`) |
| **destination** | `RoundRunner`, `ContextDeltaAccumulator`, pre-populated into `reporting.dim_round` |
| **who_consumes_it** | Dispatch orchestrator, quality threshold checks |
| **description** | Fields: `id` (RoundId), `name`, `goal`, `targetRepos[]`, `qualityThreshold`, `minPerDimension` (per-dimension minimums), `prerequisites[]`, `contextDeltaTemplate` (focusPatterns[], extractionTargets[], antiPatterns[]). |

---

### 26. RoundResult

| Field | Value |
|-------|-------|
| **format** | TypeScript object |
| **schema_location** | `claude-multi-agent-dispatch/src/rounds/types.ts` (`RoundResult`) |
| **destination** | In-memory; written to `rounds/{N}/` via `AuditStore` |
| **who_consumes_it** | `ContextDeltaAccumulator`, next-round planner |
| **description** | Fields: `roundId`, `qualityScore` (full QualityScore object), `extractedPatterns[]`, `contextDelta` (ContextDeltaPayload), `duration`, `eventsLogPath`. |

---

### 27. TelemetryEvent

| Field | Value |
|-------|-------|
| **format** | TypeScript discriminated union; emitted to OTel collector |
| **schema_location** | `claude-multi-agent-sdk/src/monitoring/telemetry.ts` (`TelemetryEvent`) |
| **destination** | OpenTelemetry collector → Prometheus → Grafana; in-memory `SessionTracker` |
| **who_consumes_it** | Grafana dashboards, cost alerting |
| **description** | 6 event subtypes: `session_start` (model), `tool_call` (toolName, durationMs, success), `token_usage` (input/output/cacheRead/cacheWrite), `cost_incurred` (amount USD, model), `subagent_spawn` (parent/child IDs), `session_end` (totalCost, totalTurns, totalToolCalls). |

---

### 28. StyleEvent (Style Analytics)

| Field | Value |
|-------|-------|
| **format** | TypeScript object → Kimball fact tables |
| **schema_location** | `claude-channel-dispatch-routing/src/styles/types.ts` (`StyleEvent`, `Style`, `DimStyleRow`, `FactStyleUsageRow`, `FactStyleCreationRow`) |
| **destination** | Neon: `reporting.dim_style`, `reporting.fact_style_usage`, `reporting.fact_style_creation` (via migration `006_style_analytics.sql`) |
| **who_consumes_it** | Style analytics, `semantic.style_adoption_rate` view |
| **description** | `StyleEvent`: `eventType` (select/create/edit/hide/unhide/reorder/delete), `styleId`, `styleName`, `styleKind` (preset/custom_upload/custom_describe/custom_manual), `sessionId`, `agentId`, `timestamp`. Style kinds model Claude's 3 creation methods from the support article. |

---

### 29. ExperimentResult

| Field | Value |
|-------|-------|
| **format** | TypeScript object |
| **schema_location** | `claude-multi-agent-dispatch/src/experiments/types.ts` (`ExperimentResult`, `VariantResult`) |
| **destination** | In-memory; logged to JSONL (planned) |
| **who_consumes_it** | A/B experiment runner, human analyst |
| **description** | `ExperimentResult`: `experimentId`, `variants[]` (each with `pagesCrawled`, `toolCalls`, `agentTurns`, `qualityScore`, `efficiencyRatio`, `costUsd`, `durationMs`, `errors[]`), `winner` (VariantId or null), `confidenceLevel`, `summary`, `completedAt`. Tests 4 tool strategies: `standard`, `extended_thinking`, `tool_search`, `ptc`. |

---

### 30. Notion Page (Crawled Content)

| Field | Value |
|-------|-------|
| **format** | Notion Block Kit JSON (properties + children blocks) |
| **schema_location** | `claude-code-actions/integrations/notion_publisher.py` (`NotionPublisher.publish_crawled_page()`) |
| **destination** | Notion database via REST API |
| **who_consumes_it** | Human knowledge workers |
| **description** | Properties: `Name` (title), `URL`, `Crawled At` (date), `Spider` (select), `Quality Score` (number), `Tags` (multi_select up to 10). Body: heading_2 "Extracted Content", paragraph blocks chunked at 1900 chars (max 50 blocks). |

---

### Summary Table

| # | Artifact | Format | Schema Location | Destination | Consumer |
|---|----------|--------|-----------------|-------------|----------|
| 1 | Git Commit | `type: desc` plain text | root CLAUDE.md | git history | humans, CI |
| 2 | PR Description | Markdown sections | `.github/pull_request_template.md` | GitHub PR | humans, Vercel |
| 3 | ThoughtChain / ThinkingReport | TS object / JSONL | `dispatch/src/types/thinking.ts` | transcripts.jsonl | next-round planner |
| 4 | CrawlPlan | TS object | `dspy-crawl-planning/src/types/core.ts` | spider runner, stdout | spider, human |
| 5 | DocPage / CrawlEvent | Pydantic → JSONL + Postgres | `scrapy/items.py`, `002_runtime_schema.sql` | improvements/*.jsonl, Neon | ETL, quality scorer |
| 6 | QualityScore | Python/TS object embedded in items | `extraction_result.py`, `quality.ts` | JSONL, Neon fact table | ETL, Slack, dashboard |
| 7 | ImprovementFeedbackEntry | JSONL | `pipelines.py` | `improvements/` dir | ContextDelta, next round |
| 8 | ContextDelta | Python dataclass / TS interface | `context_delta.py`, `quality.ts` | next-round spider config | planner, spider |
| 9 | DispatchEvent | TS discriminated union → JSONL + Postgres | `transcript.ts`, `002_runtime_schema.sql` | events.jsonl, Neon | AuditStore, ETL |
| 10 | Transcript | JSONL (metadata + messages + events) | `transcript.ts`, `logging/transcript.ts` | `rounds/{N}/transcripts.jsonl` | AuditorAgent, next session |
| 11 | AuditReport | TS object → JSONL + Postgres | `audit/auditor.ts`, `002_runtime_schema.sql` | audits.jsonl, Neon | humans, orchestrator |
| 12 | JudgmentResult | TS interface | `audit/judge.ts` | embedded in AuditReport | AuditorAgent |
| 13 | RoutingDecision | TS object → JSONL | `dispatch/router.ts` | routing-decisions.jsonl | channel MCP server |
| 14 | ChannelEvent/PermissionVerdict | TS objects + Postgres | `channel/types.ts`, `002_runtime_schema.sql` | Neon, agent session | Claude agent loop, human |
| 15 | Linear Issue | Markdown + GraphQL | `linear_sync.py` | Linear API | human engineers |
| 16 | Slack Block Kit Message | JSON blocks | `slack_reporter.py` | Slack channel | human team |
| 17 | HTML Quality Dashboard | Self-contained HTML + embedded JSON | `generate-report.py` | `reports/*.html` | humans, Slack reporter |
| 18 | DSPy Signature Outputs | Typed Prediction fields | `signatures.py` (5 signatures) | ExtractionResult, PluginSpec | pipeline modules |
| 19 | Plugin Scaffold | Directory of .md + .json files | `plugin_spec.py`, `scaffold.py` | `generated_plugins/` | Claude Code loader |
| 20 | Plugin Audit Report | Python dataclass | `plugin_scanner.py` | stdout, CI | CI pipeline |
| 21 | Security Finding | Python dataclass | `ssrf_scanner.py`, `pii_scanner.py` | stdout, CI | PreToolUse hook |
| 22 | Task Object / Todo | JSON + React state | `tasks/route.ts`, `tasks/page.tsx`, `todos.jsonl` | webapp, JSONL | humans, webapp |
| 23 | ETL Fact/Dim Rows | Postgres rows | `003_reporting_schema.sql` | Neon reporting schema | semantic views, Grafana |
| 24 | Semantic Metric Views | SQL views | `004_semantic_views.sql`, `styles/types.ts` | Neon semantic schema | analytics consumers |
| 25 | RoundDefinition | TS static object | `rounds/types.ts`, `round-0N.ts` | dispatcher, dim_round | orchestrator |
| 26 | RoundResult | TS object | `rounds/types.ts` | rounds/ dir, AuditStore | next-round planner |
| 27 | TelemetryEvent | TS discriminated union | `monitoring/telemetry.ts` | OTel → Prometheus → Grafana | dashboards, cost alerts |
| 28 | StyleEvent | TS object → Kimball fact tables | `styles/types.ts` | Neon style analytics tables | semantic style views |
| 29 | ExperimentResult | TS object | `experiments/types.ts` | in-memory, planned JSONL | A/B analyst |
| 30 | Notion Page | Notion Block Kit JSON | `notion_publisher.py` | Notion database | human knowledge workers |</result>
<usage><total_tokens>109390</total_tokens><tool_uses>130</tool_uses><duration_ms>431563</duration_ms></usage>
</task-notification>

---

## Prompt 23
You have this context. Let’s reframe it. What you just referenced was my stateful data. Let’s consider it more generalized and not repo specific.  


Create a Claude-taxonomy-data-models 

Use typescript established patterns and kimball sql warehouse patterns to create a taxonomy. What we need that we don’t have a graphql database that’s now available as a feature in bigquery 


Always start at the highest level of the taxonomy and for now just consider all public artifacts related to Claude and anthropic which means sitemaps, GitHub organizations , llms.txt , system cards , connectors , skills , plugins , customers , use cases , blogs , device surfaces , models , CLI , sdk , etc. focus on just trying to organize a view of the world decomposed through a taxonomy of objects where we want to organize hierarchies by the most broad category and go from there. For instance there many sitemaps , but the anthropic and Claude sitemaps are relevant to our customer journey. Anthropics/ GitHub org , modelcontextprotocol/ and safety-research are 3 orgs . Each edit to taxonomy is an event . Try to recursively build a view of your world through taxonomy where each tool call is an event and you can manage taxonomy using crud . Use all cap and monotonivally increasing indexed tables with enums to represent types for a category and an instance of it in crawl data should be a orjson representation of the latest instance we crawled . For instance for safety-research GitHub org , GitHub orgs as taxonomy , repository as another , root files and language specific AST could be how we process crawled data. But try to decompose and make incremental progress

---

## Prompt 24
Business context: Jadecli/researchers today represents a way to crawl anthropic and Claude artifacts relating to code and documentation that can be ran with cronjobs that compounds with time and combines version controlled code that unifies all artifacts from anthropic as a business entity that builds ai models and dogfoods consumer products internally with Claude assistance and creates consumer external products with open source as part of their strategy. Anthropics 2025 business strategy was to enable Claude to do codegen tasks in the CLI at an enterprise software engineer level ability. This is now true but Claude as an engineer will be limited by the inputs and guardrails in which its building in (aka garbage in garbage out). How in 2026 anthropics goal is to replace all non engineer enterprise knowledge workers and created cowork that uses knowledge-work-plugins and launched community-plugins for third party. New features like scheduled tasks and dispatch across channels launch daily making it impossible to stay up to date with frontier anthropic and Claude launches as you need to research what changes , you need to architect the right abstraction layer for how to use it, sprint plan it, develop it, test it, test across surfaces and have limits on usage. 



Engineering context:This monolith has to the goal to build jadecli.com as a business that’s internal for now and focused on product-strategy department for Claude. For product-strategy as a department, our abstraction improves agent skills.io spec to add layers of abstraction for our typescript and sql and python code quality requirements and rules where we use scrapy crawls in Claude code CLI as scripts to be programmatically called by Claude when needed per device surface. We can then use Claude as to think through our data strategy with data platform engineer as a role separate to data engineer and separate to analytics engineering  agent with Ralph kimball data warehousing. These python and typescript Claude agent sdk based agents are yaml files as prompt context to be used with programmatically called scripts that chain tools / MCP’s / subagents / plugins as part of multi agent dispatch strategies for codegen and cowork based tasks. While Claude a constitution, system cards,  CLAUDE.md , can use plugins that inject to system context , an entire ecosystem built as inputs to Claude and how to use Claude it’s impossible to keep up to date with data based approach that requires codegen , stateless departments and cloud data to persist for frontier ability to build a business with Claude soc2 compliant. 

Project launch context: we introduce the concept of departments that require the use and maintenance of a taxonomy for Claude to reference as abstract inputs without token bloat of the actual object with persistence in neon when needed per device.   To account for Claude’s memory shortcomings and constant session and surface device variance , the product-strategy goal is to create the level of abstractions using .Claude/research/ as context to prioritize what we need. We also have “2026/03/27” as a full day of context that’s not completely indexed and organized , but is extremely useful to consider too  





Since we already created a pr this session are you able to commit these files a d generate a new pr? I want to add this as a the start of a jade-multiagent-fastapi will be the goal similar how there is ANTHROPIC_API_KEY AND ANTHROPIC sdks to build on Claude models , but Claude-code in CLI is the primary focus and has Claude agent sdk’s for languages too. Our implementation is one that we try to canonically map taxonomy from crawls so no runtime processing for dimensional modeling ,  but we use those as knojts to create stateless representations of enums and data models built by anthropic using actual data tk bridge to maps and org/repo/filepaths .  


In order to advance jade multi agents , we need to the our crawled data and build a bridge to update that data programmatically once we define this mapping and bridge. Crawl taxonomy needs to properly work so we don’t hallucinate. Then you need a representation of all that data that can be considered as structured inputs depending on the task. 


Update and create a pr that this is the start of a project to create Jade product-strategy dept that will involve codegen that can be organized into this monolith and cowork tasks that require use to evaluate which 3rd party connector we want to use for things we haven’t set up. Like we use linear for task planning so we don’t need jira. We use neon Postgres for data warehousing but we may want bigquery for graphql and we may want real time sinks and connectors. Things we haven’t considered is for instance finance and accounting where we should use an agent friendly solution like quickbooks to manage costs.  Each codegen and cowork task needs to consider and log all human and machine inputs (e.g human prompts and machine last session context as session start) , at minimum the taxonomy for [Claude code CLI artifact used , Claude agents sdk python and typescript artifact used , Claude cowork artifact used] , inputs have adapters for human readable formats and machine formats into consistent typescript objects and  outputs have consistent typescript objects for machine optimized format and human format. The active primary goal for product strategy is the architecture and research of extending Claude dynamically into Jade so this repo enables us to crawl data and set reoccurring cronjobs to work on evals for our .Claude/research/ that build an entire ecosystem inspired by agentskills.io.

As part of decomposable task. We want to build bloom tools for typescript and python for read tool calls and existing tools to prevent context bloat and token management. Update session start , Claude should know to programitvally use codegen to create reusable yaml subagents using Claude agent SDK python and typescript that contextually always start with existing definitions for Claude and jade is a graphql representation of decendencies for what we use to in our multi agent ecosystem to complete tasks. 

include instructions to build and use subagents that are constructed with a focus on  





> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Tools reference

> Complete reference for the tools Claude Code can use, including permission requirements.

Claude Code has access to a set of tools that help it understand and modify your codebase. The tool names below are the exact strings you use in [permission rules](/en/permissions#tool-specific-permission-rules), [subagent tool lists](/en/sub-agents), and [hook matchers](/en/hooks).

| Tool                   | Description                                                                                                                                                                                                                                                                                                                                                                 | Permission Required |
| :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------ |
| `Agent`                | Spawns a [subagent](/en/sub-agents) with its own context window to handle a task                                                                                                                                                                                                                                                                                            | No                  |
| `AskUserQuestion`      | Asks multiple-choice questions to gather requirements or clarify ambiguity                                                                                                                                                                                                                                                                                                  | No                  |
| `Bash`                 | Executes shell commands in your environment. See [Bash tool behavior](#bash-tool-behavior)                                                                                                                                                                                                                                                                                  | Yes                 |
| `CronCreate`           | Schedules a recurring or one-shot prompt within the current session (gone when Claude exits). See [scheduled tasks](/en/scheduled-tasks)                                                                                                                                                                                                                                    | No                  |
| `CronDelete`           | Cancels a scheduled task by ID                                                                                                                                                                                                                                                                                                                                              | No                  |
| `CronList`             | Lists all scheduled tasks in the session                                                                                                                                                                                                                                                                                                                                    | No                  |
| `Edit`                 | Makes targeted edits to specific files                                                                                                                                                                                                                                                                                                                                      | Yes                 |
| `EnterPlanMode`        | Switches to plan mode to design an approach before coding                                                                                                                                                                                                                                                                                                                   | No                  |
| `EnterWorktree`        | Creates an isolated [git worktree](/en/common-workflows#run-parallel-claude-code-sessions-with-git-worktrees) and switches into it                                                                                                                                                                                                                                          | No                  |
| `ExitPlanMode`         | Presents a plan for approval and exits plan mode                                                                                                                                                                                                                                                                                                                            | Yes                 |
| `ExitWorktree`         | Exits a worktree session and returns to the original directory                                                                                                                                                                                                                                                                                                              | No                  |
| `Glob`                 | Finds files based on pattern matching                                                                                                                                                                                                                                                                                                                                       | No                  |
| `Grep`                 | Searches for patterns in file contents                                                                                                                                                                                                                                                                                                                                      | No                  |
| `ListMcpResourcesTool` | Lists resources exposed by connected [MCP servers](/en/mcp)                                                                                                                                                                                                                                                                                                                 | No                  |
| `LSP`                  | Code intelligence via language servers. Reports type errors and warnings automatically after file edits. Also supports navigation operations: jump to definitions, find references, get type info, list symbols, find implementations, trace call hierarchies. Requires a [code intelligence plugin](/en/discover-plugins#code-intelligence) and its language server binary | No                  |
| `NotebookEdit`         | Modifies Jupyter notebook cells                                                                                                                                                                                                                                                                                                                                             | Yes                 |
| `PowerShell`           | Executes PowerShell commands on Windows. Opt-in preview. See [PowerShell tool](#powershell-tool)                                                                                                                                                                                                                                                                            | Yes                 |
| `Read`                 | Reads the contents of files                                                                                                                                                                                                                                                                                                                                                 | No                  |
| `ReadMcpResourceTool`  | Reads a specific MCP resource by URI                                                                                                                                                                                                                                                                                                                                        | No                  |
| `Skill`                | Executes a [skill](/en/skills#control-who-invokes-a-skill) within the main conversation                                                                                                                                                                                                                                                                                     | Yes                 |
| `TaskCreate`           | Creates a new task in the task list                                                                                                                                                                                                                                                                                                                                         | No                  |
| `TaskGet`              | Retrieves full details for a specific task                                                                                                                                                                                                                                                                                                                                  | No                  |
| `TaskList`             | Lists all tasks with their current status                                                                                                                                                                                                                                                                                                                                   | No                  |
| `TaskOutput`           | (Deprecated) Retrieves output from a background task. Prefer `Read` on the task's output file path                                                                                                                                                                                                                                                                          | No                  |
| `TaskStop`             | Kills a running background task by ID                                                                                                                                                                                                                                                                                                                                       | No                  |
| `TaskUpdate`           | Updates task status, dependencies, details, or deletes tasks                                                                                                                                                                                                                                                                                                                | No                  |
| `TodoWrite`            | Manages the session task checklist. Available in non-interactive mode and the [Agent SDK](/en/headless); interactive sessions use TaskCreate, TaskGet, TaskList, and TaskUpdate instead                                                                                                                                                                                     | No                  |
| `ToolSearch`           | Searches for and loads deferred tools when [tool search](/en/mcp#scale-with-mcp-tool-search) is enabled                                                                                                                                                                                                                                                                     | No                  |
| `WebFetch`             | Fetches content from a specified URL                                                                                                                                                                                                                                                                                                                                        | Yes                 |
| `WebSearch`            | Performs web searches                                                                                                                                                                                                                                                                                                                                                       | Yes                 |
| `Write`                | Creates or overwrites files                                                                                                                                                                                                                                                                                                                                                 | Yes                 |

Permission rules can be configured using `/permissions` or in [permission settings](/en/settings#available-settings). Also see [Tool-specific permission rules](/en/permissions#tool-specific-permission-rules).

## Bash tool behavior

The Bash tool runs each command in a separate process with the following persistence behavior:

* Working directory persists across commands. Set `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR=1` to reset to the project directory after each command.
* Environment variables do not persist. An `export` in one command will not be available in the next.

Activate your virtualenv or conda environment before launching Claude Code. To make environment variables persist across Bash commands, set [`CLAUDE_ENV_FILE`](/en/env-vars) to a shell script before launching Claude Code, or use a [SessionStart hook](/en/hooks#persist-environment-variables) to populate it dynamically.

## PowerShell tool

On Windows, Claude Code can run PowerShell commands natively instead of routing through Git Bash. This is an opt-in preview.

### Enable the PowerShell tool

Set `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` in your environment or in `settings.json`:

```json  theme={null}
{
  "env": {
    "CLAUDE_CODE_USE_POWERSHELL_TOOL": "1"
  }
}
```

Claude Code auto-detects `pwsh.exe` (PowerShell 7+) with a fallback to `powershell.exe` (PowerShell 5.1). The Bash tool remains registered alongside the PowerShell tool, so you may need to ask Claude to use PowerShell.

### Shell selection in settings, hooks, and skills

Three additional settings control where PowerShell is used:

* `"defaultShell": "powershell"` in [`settings.json`](/en/settings#available-settings): routes interactive `!` commands through PowerShell. Requires the PowerShell tool to be enabled.
* `"shell": "powershell"` on individual [command hooks](/en/hooks#command-hook-fields): runs that hook in PowerShell. Hooks spawn PowerShell directly, so this works regardless of `CLAUDE_CODE_USE_POWERSHELL_TOOL`.
* `shell: powershell` in [skill frontmatter](/en/skills#frontmatter-reference): runs `` !`command` `` blocks in PowerShell. Requires the PowerShell tool to be enabled.

### Preview limitations

The PowerShell tool has the following known limitations during the preview:

* Auto mode does not work with the PowerShell tool yet
* PowerShell profiles are not loaded
* Sandboxing is not supported
* Only supported on native Windows, not WSL
* Git Bash is still required to start Claude Code

## See also

* [Permissions](/en/permissions): permission system, rule syntax, and tool-specific patterns
* [Subagents](/en/sub-agents): configure tool access for subagents
* [Hooks](/en/hooks-guide): run custom commands before or after tool execution



> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Built-in commands

> Complete reference for built-in commands available in Claude Code.

Type `/` in Claude Code to see all available commands, or type `/` followed by any letters to filter. Not all commands are visible to every user. Some depend on your platform, plan, or environment. For example, `/desktop` only appears on macOS and Windows, `/upgrade` and `/privacy-settings` are only available on Pro and Max plans, and `/terminal-setup` is hidden when your terminal natively supports its keybindings.

Claude Code also includes [bundled skills](/en/skills#bundled-skills) like `/simplify`, `/batch`, `/debug`, and `/loop` that appear alongside built-in commands when you type `/`. To create your own commands, see [skills](/en/skills).

In the table below, `<arg>` indicates a required argument and `[arg]` indicates an optional one.

| Command                                  | Purpose                                                                                                                                                                                                                                                                                                                                                        |
| :--------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/add-dir <path>`                        | Add a new working directory to the current session                                                                                                                                                                                                                                                                                                             |
| `/agents`                                | Manage [agent](/en/sub-agents) configurations                                                                                                                                                                                                                                                                                                                  |
| `/btw <question>`                        | Ask a quick [side question](/en/interactive-mode#side-questions-with-btw) without adding to the conversation                                                                                                                                                                                                                                                   |
| `/chrome`                                | Configure [Claude in Chrome](/en/chrome) settings                                                                                                                                                                                                                                                                                                              |
| `/clear`                                 | Clear conversation history and free up context. Aliases: `/reset`, `/new`                                                                                                                                                                                                                                                                                      |
| `/color [color\|default]`                | Set the prompt bar color for the current session. Available colors: `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan`. Use `default` to reset                                                                                                                                                                                               |
| `/compact [instructions]`                | Compact conversation with optional focus instructions                                                                                                                                                                                                                                                                                                          |
| `/config`                                | Open the [Settings](/en/settings) interface to adjust theme, model, [output style](/en/output-styles), and other preferences. Alias: `/settings`                                                                                                                                                                                                               |
| `/context`                               | Visualize current context usage as a colored grid. Shows optimization suggestions for context-heavy tools, memory bloat, and capacity warnings                                                                                                                                                                                                                 |
| `/copy [N]`                              | Copy the last assistant response to clipboard. Pass a number `N` to copy the Nth-latest response: `/copy 2` copies the second-to-last. When code blocks are present, shows an interactive picker to select individual blocks or the full response. Press `w` in the picker to write the selection to a file instead of the clipboard, which is useful over SSH |
| `/cost`                                  | Show token usage statistics. See [cost tracking guide](/en/costs#using-the-cost-command) for subscription-specific details                                                                                                                                                                                                                                     |
| `/desktop`                               | Continue the current session in the Claude Code Desktop app. macOS and Windows only. Alias: `/app`                                                                                                                                                                                                                                                             |
| `/diff`                                  | Open an interactive diff viewer showing uncommitted changes and per-turn diffs. Use left/right arrows to switch between the current git diff and individual Claude turns, and up/down to browse files                                                                                                                                                          |
| `/doctor`                                | Diagnose and verify your Claude Code installation and settings                                                                                                                                                                                                                                                                                                 |
| `/effort [low\|medium\|high\|max\|auto]` | Set the model [effort level](/en/model-config#adjust-effort-level). `low`, `medium`, and `high` persist across sessions. `max` applies to the current session only and requires Opus 4.6. `auto` resets to the model default. Without an argument, shows the current level. Takes effect immediately without waiting for the current response to finish        |
| `/exit`                                  | Exit the CLI. Alias: `/quit`                                                                                                                                                                                                                                                                                                                                   |
| `/export [filename]`                     | Export the current conversation as plain text. With a filename, writes directly to that file. Without, opens a dialog to copy to clipboard or save to a file                                                                                                                                                                                                   |
| `/extra-usage`                           | Configure extra usage to keep working when rate limits are hit                                                                                                                                                                                                                                                                                                 |
| `/fast [on\|off]`                        | Toggle [fast mode](/en/fast-mode) on or off                                                                                                                                                                                                                                                                                                                    |
| `/feedback [report]`                     | Submit feedback about Claude Code. Alias: `/bug`                                                                                                                                                                                                                                                                                                               |
| `/branch [name]`                         | Create a branch of the current conversation at this point. Alias: `/fork`                                                                                                                                                                                                                                                                                      |
| `/help`                                  | Show help and available commands                                                                                                                                                                                                                                                                                                                               |
| `/hooks`                                 | View [hook](/en/hooks) configurations for tool events                                                                                                                                                                                                                                                                                                          |
| `/ide`                                   | Manage IDE integrations and show status                                                                                                                                                                                                                                                                                                                        |
| `/init`                                  | Initialize project with a `CLAUDE.md` guide. Set `CLAUDE_CODE_NEW_INIT=true` for an interactive flow that also walks through skills, hooks, and personal memory files                                                                                                                                                                                          |
| `/insights`                              | Generate a report analyzing your Claude Code sessions, including project areas, interaction patterns, and friction points                                                                                                                                                                                                                                      |
| `/install-github-app`                    | Set up the [Claude GitHub Actions](/en/github-actions) app for a repository. Walks you through selecting a repo and configuring the integration                                                                                                                                                                                                                |
| `/install-slack-app`                     | Install the Claude Slack app. Opens a browser to complete the OAuth flow                                                                                                                                                                                                                                                                                       |
| `/keybindings`                           | Open or create your keybindings configuration file                                                                                                                                                                                                                                                                                                             |
| `/login`                                 | Sign in to your Anthropic account                                                                                                                                                                                                                                                                                                                              |
| `/logout`                                | Sign out from your Anthropic account                                                                                                                                                                                                                                                                                                                           |
| `/mcp`                                   | Manage MCP server connections and OAuth authentication                                                                                                                                                                                                                                                                                                         |
| `/memory`                                | Edit `CLAUDE.md` memory files, enable or disable [auto-memory](/en/memory#auto-memory), and view auto-memory entries                                                                                                                                                                                                                                           |
| `/mobile`                                | Show QR code to download the Claude mobile app. Aliases: `/ios`, `/android`                                                                                                                                                                                                                                                                                    |
| `/model [model]`                         | Select or change the AI model. For models that support it, use left/right arrows to [adjust effort level](/en/model-config#adjust-effort-level). The change takes effect immediately without waiting for the current response to finish                                                                                                                        |
| `/passes`                                | Share a free week of Claude Code with friends. Only visible if your account is eligible                                                                                                                                                                                                                                                                        |
| `/permissions`                           | View or update [permissions](/en/permissions#manage-permissions). Alias: `/allowed-tools`                                                                                                                                                                                                                                                                      |
| `/plan [description]`                    | Enter plan mode directly from the prompt. Pass an optional description to enter plan mode and immediately start with that task, for example `/plan fix the auth bug`                                                                                                                                                                                           |
| `/plugin`                                | Manage Claude Code [plugins](/en/plugins)                                                                                                                                                                                                                                                                                                                      |
| `/pr-comments [PR]`                      | Fetch and display comments from a GitHub pull request. Automatically detects the PR for the current branch, or pass a PR URL or number. Requires the `gh` CLI                                                                                                                                                                                                  |
| `/privacy-settings`                      | View and update your privacy settings. Only available for Pro and Max plan subscribers                                                                                                                                                                                                                                                                         |
| `/release-notes`                         | View the full changelog, with the most recent version closest to your prompt                                                                                                                                                                                                                                                                                   |
| `/reload-plugins`                        | Reload all active [plugins](/en/plugins) to apply pending changes without restarting. Reports counts for each reloaded component and flags any load errors                                                                                                                                                                                                     |
| `/remote-control`                        | Make this session available for [remote control](/en/remote-control) from claude.ai. Alias: `/rc`                                                                                                                                                                                                                                                              |
| `/remote-env`                            | Configure the default remote environment for [web sessions started with `--remote`](/en/claude-code-on-the-web#environment-configuration)                                                                                                                                                                                                                      |
| `/rename [name]`                         | Rename the current session and show the name on the prompt bar. Without a name, auto-generates one from conversation history                                                                                                                                                                                                                                   |
| `/resume [session]`                      | Resume a conversation by ID or name, or open the session picker. Alias: `/continue`                                                                                                                                                                                                                                                                            |
| `/review`                                | Deprecated. Install the [`code-review` plugin](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/code-review) instead: `claude plugin install code-review@claude-plugins-official`                                                                                                                                                       |
| `/rewind`                                | Rewind the conversation and/or code to a previous point, or summarize from a selected message. See [checkpointing](/en/checkpointing). Alias: `/checkpoint`                                                                                                                                                                                                    |
| `/sandbox`                               | Toggle [sandbox mode](/en/sandboxing). Available on supported platforms only                                                                                                                                                                                                                                                                                   |
| `/schedule [description]`                | Create, update, list, or run [Cloud scheduled tasks](/en/web-scheduled-tasks). Claude walks you through the setup conversationally                                                                                                                                                                                                                             |
| `/security-review`                       | Analyze pending changes on the current branch for security vulnerabilities. Reviews the git diff and identifies risks like injection, auth issues, and data exposure                                                                                                                                                                                           |
| `/skills`                                | List available [skills](/en/skills)                                                                                                                                                                                                                                                                                                                            |
| `/stats`                                 | Visualize daily usage, session history, streaks, and model preferences                                                                                                                                                                                                                                                                                         |
| `/status`                                | Open the Settings interface (Status tab) showing version, model, account, and connectivity. Works while Claude is responding, without waiting for the current response to finish                                                                                                                                                                               |
| `/statusline`                            | Configure Claude Code's [status line](/en/statusline). Describe what you want, or run without arguments to auto-configure from your shell prompt                                                                                                                                                                                                               |
| `/stickers`                              | Order Claude Code stickers                                                                                                                                                                                                                                                                                                                                     |
| `/tasks`                                 | List and manage background tasks                                                                                                                                                                                                                                                                                                                               |
| `/terminal-setup`                        | Configure terminal keybindings for Shift+Enter and other shortcuts. Only visible in terminals that need it, like VS Code, Alacritty, or Warp                                                                                                                                                                                                                   |
| `/theme`                                 | Change the color theme. Includes light and dark variants, colorblind-accessible (daltonized) themes, and ANSI themes that use your terminal's color palette                                                                                                                                                                                                    |
| `/upgrade`                               | Open the upgrade page to switch to a higher plan tier                                                                                                                                                                                                                                                                                                          |
| `/usage`                                 | Show plan usage limits and rate limit status                                                                                                                                                                                                                                                                                                                   |
| `/vim`                                   | Toggle between Vim and Normal editing modes                                                                                                                                                                                                                                                                                                                    |
| `/voice`                                 | Toggle push-to-talk [voice dictation](/en/voice-dictation). Requires a Claude.ai account                                                                                                                                                                                                                                                                       |

## MCP prompts

MCP servers can expose prompts that appear as commands. These use the format `/mcp__<server>__<prompt>` and are dynamically discovered from connected servers. See [MCP prompts](/en/mcp#use-mcp-prompts-as-commands) for details.

## See also

* [Skills](/en/skills): create your own commands
* [Interactive mode](/en/interactive-mode): keyboard shortcuts, Vim mode, and command history
* [CLI reference](/en/cli-reference): launch-time flags


> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Environment variables

> Complete reference for environment variables that control Claude Code behavior.

Claude Code supports the following environment variables to control its behavior. Set them in your shell before launching `claude`, or configure them in [`settings.json`](/en/settings#available-settings) under the `env` key to apply them to every session or roll them out across your team.

| Variable                                                | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| :------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                                     | API key sent as `X-Api-Key` header. When set, this key is used instead of your Claude Pro, Max, Team, or Enterprise subscription even if you are logged in. In non-interactive mode (`-p`), the key is always used when present. In interactive mode, you are prompted to approve the key once before it overrides your subscription. To use your subscription instead, run `unset ANTHROPIC_API_KEY`                                                                                                                                                                                                            |
| `ANTHROPIC_AUTH_TOKEN`                                  | Custom value for the `Authorization` header (the value you set here will be prefixed with `Bearer `)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `ANTHROPIC_BASE_URL`                                    | Override the API endpoint to route requests through a proxy or gateway. When set to a non-first-party host, [MCP tool search](/en/mcp#scale-with-mcp-tool-search) is disabled by default. Set `ENABLE_TOOL_SEARCH=true` if your proxy forwards `tool_reference` blocks                                                                                                                                                                                                                                                                                                                                           |
| `ANTHROPIC_CUSTOM_HEADERS`                              | Custom headers to add to requests (`Name: Value` format, newline-separated for multiple headers)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `ANTHROPIC_CUSTOM_MODEL_OPTION`                         | Model ID to add as a custom entry in the `/model` picker. Use this to make a non-standard or gateway-specific model selectable without replacing built-in aliases. See [Model configuration](/en/model-config#add-a-custom-model-option)                                                                                                                                                                                                                                                                                                                                                                         |
| `ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION`             | Display description for the custom model entry in the `/model` picker. Defaults to `Custom model (<model-id>)` when not set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ANTHROPIC_CUSTOM_MODEL_OPTION_NAME`                    | Display name for the custom model entry in the `/model` picker. Defaults to the model ID when not set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL`                         | See [Model configuration](/en/model-config#environment-variables)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL_DESCRIPTION`             | See [Model configuration](/en/model-config#customize-pinned-model-display-and-capabilities)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME`                    | See [Model configuration](/en/model-config#customize-pinned-model-display-and-capabilities)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL_SUPPORTED_CAPABILITIES`  | See [Model configuration](/en/model-config#customize-pinned-model-display-and-capabilities)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ANTHROPIC_DEFAULT_OPUS_MODEL`                          | See [Model configuration](/en/model-config#environment-variables)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION`              | See [Model configuration](/en/model-config#customize-pinned-model-display-and-capabilities)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ANTHROPIC_DEFAULT_OPUS_MODEL_NAME`                     | See [Model configuration](/en/model-config#customize-pinned-model-display-and-capabilities)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES`   | See [Model configuration](/en/model-config#customize-pinned-model-display-and-capabilities)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ANTHROPIC_DEFAULT_SONNET_MODEL`                        | See [Model configuration](/en/model-config#environment-variables)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `ANTHROPIC_DEFAULT_SONNET_MODEL_DESCRIPTION`            | See [Model configuration](/en/model-config#customize-pinned-model-display-and-capabilities)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ANTHROPIC_DEFAULT_SONNET_MODEL_NAME`                   | See [Model configuration](/en/model-config#customize-pinned-model-display-and-capabilities)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ANTHROPIC_DEFAULT_SONNET_MODEL_SUPPORTED_CAPABILITIES` | See [Model configuration](/en/model-config#customize-pinned-model-display-and-capabilities)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ANTHROPIC_FOUNDRY_API_KEY`                             | API key for Microsoft Foundry authentication (see [Microsoft Foundry](/en/microsoft-foundry))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `ANTHROPIC_FOUNDRY_BASE_URL`                            | Full base URL for the Foundry resource (for example, `https://my-resource.services.ai.azure.com/anthropic`). Alternative to `ANTHROPIC_FOUNDRY_RESOURCE` (see [Microsoft Foundry](/en/microsoft-foundry))                                                                                                                                                                                                                                                                                                                                                                                                        |
| `ANTHROPIC_FOUNDRY_RESOURCE`                            | Foundry resource name (for example, `my-resource`). Required if `ANTHROPIC_FOUNDRY_BASE_URL` is not set (see [Microsoft Foundry](/en/microsoft-foundry))                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `ANTHROPIC_MODEL`                                       | Name of the model setting to use (see [Model Configuration](/en/model-config#environment-variables))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `ANTHROPIC_SMALL_FAST_MODEL`                            | \[DEPRECATED] Name of [Haiku-class model for background tasks](/en/costs)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION`                 | Override AWS region for the Haiku-class model when using Bedrock                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `AWS_BEARER_TOKEN_BEDROCK`                              | Bedrock API key for authentication (see [Bedrock API keys](https://aws.amazon.com/blogs/machine-learning/accelerate-ai-development-with-amazon-bedrock-api-keys/))                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `BASH_DEFAULT_TIMEOUT_MS`                               | Default timeout for long-running bash commands                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `BASH_MAX_OUTPUT_LENGTH`                                | Maximum number of characters in bash outputs before they are middle-truncated                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `BASH_MAX_TIMEOUT_MS`                                   | Maximum timeout the model can set for long-running bash commands                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `CLAUDECODE`                                            | Set to `1` in shell environments Claude Code spawns (Bash tool, tmux sessions). Not set in [hooks](/en/hooks) or [status line](/en/statusline) commands. Use to detect when a script is running inside a shell spawned by Claude Code                                                                                                                                                                                                                                                                                                                                                                            |
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`                       | Set the percentage of context capacity (1-100) at which auto-compaction triggers. By default, auto-compaction triggers at approximately 95% capacity. Use lower values like `50` to compact earlier. Values above the default threshold have no effect. Applies to both main conversations and subagents. This percentage aligns with the `context_window.used_percentage` field available in [status line](/en/statusline)                                                                                                                                                                                      |
| `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR`              | Return to the original working directory after each Bash command                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `CLAUDE_CODE_ACCOUNT_UUID`                              | Account UUID for the authenticated user. Used by SDK callers to provide account information synchronously, avoiding a race condition where early telemetry events lack account metadata. Requires `CLAUDE_CODE_USER_EMAIL` and `CLAUDE_CODE_ORGANIZATION_UUID` to also be set                                                                                                                                                                                                                                                                                                                                    |
| `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD`          | Set to `1` to load CLAUDE.md files from directories specified with `--add-dir`. By default, additional directories do not load memory files                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW`                       | Set the context capacity in tokens used for auto-compaction calculations. Defaults to the model's context window: 200K for standard models or 1M for [extended context](/en/model-config#extended-context) models. Use a lower value like `500000` on a 1M model to treat the window as 500K for compaction purposes. The value is capped at the model's actual context window. `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` is applied as a percentage of this value. Setting this variable decouples the compaction threshold from the status line's `used_percentage`, which always uses the model's full context window |
| `CLAUDE_CODE_API_KEY_HELPER_TTL_MS`                     | Interval in milliseconds at which credentials should be refreshed (when using [`apiKeyHelper`](/en/settings#available-settings))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `CLAUDE_CODE_CLIENT_CERT`                               | Path to client certificate file for mTLS authentication                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `CLAUDE_CODE_CLIENT_KEY`                                | Path to client private key file for mTLS authentication                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `CLAUDE_CODE_CLIENT_KEY_PASSPHRASE`                     | Passphrase for encrypted CLAUDE\_CODE\_CLIENT\_KEY (optional)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `CLAUDE_CODE_DISABLE_1M_CONTEXT`                        | Set to `1` to disable [1M context window](/en/model-config#extended-context) support. When set, 1M model variants are unavailable in the model picker. Useful for enterprise environments with compliance requirements                                                                                                                                                                                                                                                                                                                                                                                           |
| `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING`                 | Set to `1` to disable [adaptive reasoning](/en/model-config#adjust-effort-level) for Opus 4.6 and Sonnet 4.6. When disabled, these models fall back to the fixed thinking budget controlled by `MAX_THINKING_TOKENS`                                                                                                                                                                                                                                                                                                                                                                                             |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY`                       | Set to `1` to disable [auto memory](/en/memory#auto-memory). Set to `0` to force auto memory on during the gradual rollout. When disabled, Claude does not create or load auto memory files                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS`                  | Set to `1` to remove built-in commit and PR workflow instructions and the git status snapshot from Claude's system prompt. Useful when using your own git workflow skills. Takes precedence over the [`includeGitInstructions`](/en/settings#available-settings) setting when set                                                                                                                                                                                                                                                                                                                                |
| `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS`                  | Set to `1` to disable all background task functionality, including the `run_in_background` parameter on Bash and subagent tools, auto-backgrounding, and the Ctrl+B shortcut                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `CLAUDE_CODE_DISABLE_CRON`                              | Set to `1` to disable [scheduled tasks](/en/scheduled-tasks). The `/loop` skill and cron tools become unavailable and any already-scheduled tasks stop firing, including tasks that are already running mid-session                                                                                                                                                                                                                                                                                                                                                                                              |
| `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`                | Set to `1` to strip Anthropic-specific `anthropic-beta` request headers and beta tool-schema fields (such as `defer_loading` and `eager_input_streaming`) from API requests. Use this when a proxy gateway rejects requests with errors like "Unexpected value(s) for the `anthropic-beta` header" or "Extra inputs are not permitted". Standard fields (`name`, `description`, `input_schema`, `cache_control`) are preserved.                                                                                                                                                                                  |
| `CLAUDE_CODE_DISABLE_FAST_MODE`                         | Set to `1` to disable [fast mode](/en/fast-mode)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY`                   | Set to `1` to disable the "How is Claude doing?" session quality surveys. Surveys are also disabled when `DISABLE_TELEMETRY` or `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is set. See [Session quality surveys](/en/data-usage#session-quality-surveys)                                                                                                                                                                                                                                                                                                                                                         |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`              | Equivalent of setting `DISABLE_AUTOUPDATER`, `DISABLE_FEEDBACK_COMMAND`, `DISABLE_ERROR_REPORTING`, and `DISABLE_TELEMETRY`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK`             | Set to `1` to disable the non-streaming fallback when a streaming request fails mid-stream. Streaming errors propagate to the retry layer instead. Useful when a proxy or gateway causes the fallback to produce duplicate tool execution                                                                                                                                                                                                                                                                                                                                                                        |
| `CLAUDE_CODE_DISABLE_TERMINAL_TITLE`                    | Set to `1` to disable automatic terminal title updates based on conversation context                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `CLAUDE_CODE_EFFORT_LEVEL`                              | Set the effort level for supported models. Values: `low`, `medium`, `high`, `max` (Opus 4.6 only), or `auto` to use the model default. Takes precedence over `/effort` and the `effortLevel` setting. See [Adjust effort level](/en/model-config#adjust-effort-level)                                                                                                                                                                                                                                                                                                                                            |
| `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION`                  | Set to `false` to disable prompt suggestions (the "Prompt suggestions" toggle in `/config`). These are the grayed-out predictions that appear in your prompt input after Claude responds. See [Prompt suggestions](/en/interactive-mode#prompt-suggestions)                                                                                                                                                                                                                                                                                                                                                      |
| `CLAUDE_CODE_ENABLE_TASKS`                              | Set to `true` to enable the task tracking system in non-interactive mode (the `-p` flag). Tasks are on by default in interactive mode. See [Task list](/en/interactive-mode#task-list)                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `CLAUDE_CODE_ENABLE_TELEMETRY`                          | Set to `1` to enable OpenTelemetry data collection for metrics and logging. Required before configuring OTel exporters. See [Monitoring](/en/monitoring-usage)                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `CLAUDE_CODE_EXIT_AFTER_STOP_DELAY`                     | Time in milliseconds to wait after the query loop becomes idle before automatically exiting. Useful for automated workflows and scripts using SDK mode                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`                  | Set to `1` to enable [agent teams](/en/agent-teams). Agent teams are experimental and disabled by default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS`               | Override the default token limit for file reads. Useful when you need to read larger files in full                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL`                     | Skip auto-installation of IDE extensions. Equivalent to setting [`autoInstallIdeExtension`](/en/settings#global-config-settings) to `false`                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS`                         | Set the maximum number of output tokens for most requests. Defaults and caps vary by model; see [max output tokens](https://platform.claude.com/docs/en/about-claude/models/overview#latest-models-comparison). Increasing this value reduces the effective context window available before [auto-compaction](/en/costs#reduce-token-usage) triggers.                                                                                                                                                                                                                                                            |
| `CLAUDE_CODE_NEW_INIT`                                  | Set to `true` to make `/init` run an interactive setup flow. The flow asks which files to generate, including CLAUDE.md, skills, and hooks, before exploring the codebase and writing them. Without this variable, `/init` generates a CLAUDE.md automatically without prompting.                                                                                                                                                                                                                                                                                                                                |
| `CLAUDE_CODE_ORGANIZATION_UUID`                         | Organization UUID for the authenticated user. Used by SDK callers to provide account information synchronously. Requires `CLAUDE_CODE_ACCOUNT_UUID` and `CLAUDE_CODE_USER_EMAIL` to also be set                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `CLAUDE_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS`           | Interval for refreshing dynamic OpenTelemetry headers in milliseconds (default: 1740000 / 29 minutes). See [Dynamic headers](/en/monitoring-usage#dynamic-headers)                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `CLAUDE_CODE_PLAN_MODE_REQUIRED`                        | Auto-set to `true` on [agent team](/en/agent-teams) teammates that require plan approval. Read-only: set by Claude Code when spawning teammates. See [require plan approval](/en/agent-teams#require-plan-approval-for-teammates)                                                                                                                                                                                                                                                                                                                                                                                |
| `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`                     | Timeout in milliseconds for git operations when installing or updating plugins (default: 120000). Increase this value for large repositories or slow network connections. See [Git operations time out](/en/plugin-marketplaces#git-operations-time-out)                                                                                                                                                                                                                                                                                                                                                         |
| `CLAUDE_CODE_PLUGIN_SEED_DIR`                           | Path to one or more read-only plugin seed directories, separated by `:` on Unix or `;` on Windows. Use this to bundle a pre-populated plugins directory into a container image. Claude Code registers marketplaces from these directories at startup and uses pre-cached plugins without re-cloning. See [Pre-populate plugins for containers](/en/plugin-marketplaces#pre-populate-plugins-for-containers)                                                                                                                                                                                                      |
| `CLAUDE_CODE_PROXY_RESOLVES_HOSTS`                      | Set to `true` to allow the proxy to perform DNS resolution instead of the caller. Opt-in for environments where the proxy should handle hostname resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS`               | Maximum time in milliseconds for [SessionEnd](/en/hooks#sessionend) hooks to complete (default: `1500`). Applies to session exit, `/clear`, and switching sessions via interactive `/resume`. Per-hook `timeout` values are also capped by this budget                                                                                                                                                                                                                                                                                                                                                           |
| `CLAUDE_CODE_SHELL`                                     | Override automatic shell detection. Useful when your login shell differs from your preferred working shell (for example, `bash` vs `zsh`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `CLAUDE_CODE_SHELL_PREFIX`                              | Command prefix to wrap all bash commands (for example, for logging or auditing). Example: `/path/to/logger.sh` will execute `/path/to/logger.sh <command>`                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `CLAUDE_CODE_SIMPLE`                                    | Set to `1` to run with a minimal system prompt and only the Bash, file read, and file edit tools. Disables auto-discovery of hooks, skills, plugins, MCP servers, auto memory, and CLAUDE.md. The [`--bare`](/en/headless#start-faster-with-bare-mode) CLI flag sets this                                                                                                                                                                                                                                                                                                                                        |
| `CLAUDE_CODE_SKIP_BEDROCK_AUTH`                         | Skip AWS authentication for Bedrock (for example, when using an LLM gateway)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `CLAUDE_CODE_SKIP_FAST_MODE_NETWORK_ERRORS`             | Set to `1` to allow [fast mode](/en/fast-mode) when the organization status check fails due to a network error. Useful when a corporate proxy blocks the status endpoint. The API still enforces organization-level disable separately                                                                                                                                                                                                                                                                                                                                                                           |
| `CLAUDE_CODE_SKIP_FOUNDRY_AUTH`                         | Skip Azure authentication for Microsoft Foundry (for example, when using an LLM gateway)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `CLAUDE_CODE_SKIP_VERTEX_AUTH`                          | Skip Google authentication for Vertex (for example, when using an LLM gateway)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `CLAUDE_CODE_SUBAGENT_MODEL`                            | See [Model configuration](/en/model-config)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB`                      | Set to `1` to strip Anthropic and cloud provider credentials from subprocess environments (Bash tool, hooks, MCP stdio servers). The parent Claude process keeps these credentials for API calls, but child processes cannot read them, reducing exposure to prompt injection attacks that attempt to exfiltrate secrets via shell expansion. `claude-code-action` sets this automatically when `allowed_non_write_users` is configured                                                                                                                                                                          |
| `CLAUDE_CODE_TASK_LIST_ID`                              | Share a task list across sessions. Set the same ID in multiple Claude Code instances to coordinate on a shared task list. See [Task list](/en/interactive-mode#task-list)                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `CLAUDE_CODE_TEAM_NAME`                                 | Name of the agent team this teammate belongs to. Set automatically on [agent team](/en/agent-teams) members                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `CLAUDE_CODE_TMPDIR`                                    | Override the temp directory used for internal temp files. Claude Code appends `/claude/` to this path. Default: `/tmp` on Unix/macOS, `os.tmpdir()` on Windows                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `CLAUDE_CODE_USER_EMAIL`                                | Email address for the authenticated user. Used by SDK callers to provide account information synchronously. Requires `CLAUDE_CODE_ACCOUNT_UUID` and `CLAUDE_CODE_ORGANIZATION_UUID` to also be set                                                                                                                                                                                                                                                                                                                                                                                                               |
| `CLAUDE_CODE_USE_BEDROCK`                               | Use [Bedrock](/en/amazon-bedrock)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `CLAUDE_CODE_USE_FOUNDRY`                               | Use [Microsoft Foundry](/en/microsoft-foundry)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `CLAUDE_CODE_USE_POWERSHELL_TOOL`                       | Set to `1` to enable the PowerShell tool on Windows (opt-in preview). When enabled, Claude can run PowerShell commands natively instead of routing through Git Bash. Only supported on native Windows, not WSL. See [PowerShell tool](/en/tools-reference#powershell-tool)                                                                                                                                                                                                                                                                                                                                       |
| `CLAUDE_CODE_USE_VERTEX`                                | Use [Vertex](/en/google-vertex-ai)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `CLAUDE_CONFIG_DIR`                                     | Customize where Claude Code stores its configuration and data files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `CLAUDE_ENV_FILE`                                       | Path to a shell script that Claude Code sources before each Bash command. Use to persist virtualenv or conda activation across commands. Also populated dynamically by [SessionStart](/en/hooks#persist-environment-variables), [CwdChanged](/en/hooks#cwdchanged), and [FileChanged](/en/hooks#filechanged) hooks                                                                                                                                                                                                                                                                                               |
| `CLAUDE_STREAM_IDLE_TIMEOUT_MS`                         | Timeout in milliseconds before the streaming idle watchdog closes a stalled connection. Default: `90000` (90 seconds). Increase this value if long-running tools or slow networks cause premature timeout errors                                                                                                                                                                                                                                                                                                                                                                                                 |
| `DISABLE_AUTOUPDATER`                                   | Set to `1` to disable automatic updates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `DISABLE_COST_WARNINGS`                                 | Set to `1` to disable cost warning messages                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `DISABLE_ERROR_REPORTING`                               | Set to `1` to opt out of Sentry error reporting                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `DISABLE_FEEDBACK_COMMAND`                              | Set to `1` to disable the `/feedback` command. The older name `DISABLE_BUG_COMMAND` is also accepted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `DISABLE_INSTALLATION_CHECKS`                           | Set to `1` to disable installation warnings. Use only when manually managing the installation location, as this can mask issues with standard installations                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `DISABLE_PROMPT_CACHING`                                | Set to `1` to disable prompt caching for all models (takes precedence over per-model settings)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `DISABLE_PROMPT_CACHING_HAIKU`                          | Set to `1` to disable prompt caching for Haiku models                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `DISABLE_PROMPT_CACHING_OPUS`                           | Set to `1` to disable prompt caching for Opus models                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `DISABLE_PROMPT_CACHING_SONNET`                         | Set to `1` to disable prompt caching for Sonnet models                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `DISABLE_TELEMETRY`                                     | Set to `1` to opt out of Statsig telemetry (note that Statsig events do not include user data like code, file paths, or bash commands)                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `ENABLE_CLAUDEAI_MCP_SERVERS`                           | Set to `false` to disable [claude.ai MCP servers](/en/mcp#use-mcp-servers-from-claude-ai) in Claude Code. Enabled by default for logged-in users                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `ENABLE_TOOL_SEARCH`                                    | Controls [MCP tool search](/en/mcp#scale-with-mcp-tool-search). Unset: all MCP tools deferred by default, but loaded upfront when `ANTHROPIC_BASE_URL` points to a non-first-party host. Values: `true` (always defer including proxies), `auto` (threshold mode: load upfront if tools fit within 10% of context), `auto:N` (custom threshold, e.g., `auto:5` for 5%), `false` (load all upfront)                                                                                                                                                                                                               |
| `FORCE_AUTOUPDATE_PLUGINS`                              | Set to `true` to force plugin auto-updates even when the main auto-updater is disabled via `DISABLE_AUTOUPDATER`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `HTTP_PROXY`                                            | Specify HTTP proxy server for network connections                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `HTTPS_PROXY`                                           | Specify HTTPS proxy server for network connections                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `IS_DEMO`                                               | Set to `true` to enable demo mode: hides email and organization from the UI, skips onboarding, and hides internal commands. Useful for streaming or recording sessions                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `MAX_MCP_OUTPUT_TOKENS`                                 | Maximum number of tokens allowed in MCP tool responses. Claude Code displays a warning when output exceeds 10,000 tokens (default: 25000)                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `MAX_THINKING_TOKENS`                                   | Override the [extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking) token budget. The ceiling is the model's [max output tokens](https://platform.claude.com/docs/en/about-claude/models/overview#latest-models-comparison) minus one. Set to `0` to disable thinking entirely. On models with adaptive reasoning (Opus 4.6, Sonnet 4.6), the budget is ignored unless adaptive reasoning is disabled via `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING`                                                                                                                          |
| `MCP_CLIENT_SECRET`                                     | OAuth client secret for MCP servers that require [pre-configured credentials](/en/mcp#use-pre-configured-oauth-credentials). Avoids the interactive prompt when adding a server with `--client-secret`                                                                                                                                                                                                                                                                                                                                                                                                           |
| `MCP_OAUTH_CALLBACK_PORT`                               | Fixed port for the OAuth redirect callback, as an alternative to `--callback-port` when adding an MCP server with [pre-configured credentials](/en/mcp#use-pre-configured-oauth-credentials)                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `MCP_TIMEOUT`                                           | Timeout in milliseconds for MCP server startup                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `MCP_TOOL_TIMEOUT`                                      | Timeout in milliseconds for MCP tool execution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `NO_PROXY`                                              | List of domains and IPs to which requests will be directly issued, bypassing proxy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `SLASH_COMMAND_TOOL_CHAR_BUDGET`                        | Override the character budget for skill metadata shown to the [Skill tool](/en/skills#control-who-invokes-a-skill). The budget scales dynamically at 2% of the context window, with a fallback of 16,000 characters. Legacy name kept for backwards compatibility                                                                                                                                                                                                                                                                                                                                                |
| `USE_BUILTIN_RIPGREP`                                   | Set to `0` to use system-installed `rg` instead of `rg` included with Claude Code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `VERTEX_REGION_CLAUDE_3_5_HAIKU`                        | Override region for Claude 3.5 Haiku when using Vertex AI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `VERTEX_REGION_CLAUDE_3_7_SONNET`                       | Override region for Claude 3.7 Sonnet when using Vertex AI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `VERTEX_REGION_CLAUDE_4_0_OPUS`                         | Override region for Claude 4.0 Opus when using Vertex AI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `VERTEX_REGION_CLAUDE_4_0_SONNET`                       | Override region for Claude 4.0 Sonnet when using Vertex AI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `VERTEX_REGION_CLAUDE_4_1_OPUS`                         | Override region for Claude 4.1 Opus when using Vertex AI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## See also

* [Settings](/en/settings): configure environment variables in `settings.json` so they apply to every session
* [CLI reference](/en/cli-reference): launch-time flags
* [Network configuration](/en/network-config): proxy and TLS setup


> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Hooks reference

> Reference for Claude Code hook events, configuration schema, JSON input/output formats, exit codes, async hooks, HTTP hooks, prompt hooks, and MCP tool hooks.

<Tip>
  For a quickstart guide with examples, see [Automate workflows with hooks](/en/hooks-guide).
</Tip>

Hooks are user-defined shell commands, HTTP endpoints, or LLM prompts that execute automatically at specific points in Claude Code's lifecycle. Use this reference to look up event schemas, configuration options, JSON input/output formats, and advanced features like async hooks, HTTP hooks, and MCP tool hooks. If you're setting up hooks for the first time, start with the [guide](/en/hooks-guide) instead.

## Hook lifecycle

Hooks fire at specific points during a Claude Code session. When an event fires and a matcher matches, Claude Code passes JSON context about the event to your hook handler. For command hooks, input arrives on stdin. For HTTP hooks, it arrives as the POST request body. Your handler can then inspect the input, take action, and optionally return a decision. Some events fire once per session, while others fire repeatedly inside the agentic loop:

<div style={{maxWidth: "500px", margin: "0 auto"}}>
  <Frame>
    <img src="https://mintcdn.com/claude-code/1wr0LPds6lVWZkQB/images/hooks-lifecycle.svg?fit=max&auto=format&n=1wr0LPds6lVWZkQB&q=85&s=53a826e7bb64c6bff5f867506c0530ad" alt="Hook lifecycle diagram showing the sequence of hooks from SessionStart through the agentic loop (PreToolUse, PermissionRequest, PostToolUse, SubagentStart/Stop, TaskCreated, TaskCompleted) to Stop or StopFailure, TeammateIdle, PreCompact, PostCompact, and SessionEnd, with Elicitation and ElicitationResult nested inside MCP tool execution and WorktreeCreate, WorktreeRemove, Notification, ConfigChange, InstructionsLoaded, CwdChanged, and FileChanged as standalone async events" width="520" height="1155" data-path="images/hooks-lifecycle.svg" />
  </Frame>
</div>

The table below summarizes when each event fires. The [Hook events](#hook-events) section documents the full input schema and decision control options for each one.

| Event                | When it fires                                                                                                                                          |
| :------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SessionStart`       | When a session begins or resumes                                                                                                                       |
| `UserPromptSubmit`   | When you submit a prompt, before Claude processes it                                                                                                   |
| `PreToolUse`         | Before a tool call executes. Can block it                                                                                                              |
| `PermissionRequest`  | When a permission dialog appears                                                                                                                       |
| `PostToolUse`        | After a tool call succeeds                                                                                                                             |
| `PostToolUseFailure` | After a tool call fails                                                                                                                                |
| `Notification`       | When Claude Code sends a notification                                                                                                                  |
| `SubagentStart`      | When a subagent is spawned                                                                                                                             |
| `SubagentStop`       | When a subagent finishes                                                                                                                               |
| `TaskCreated`        | When a task is being created via `TaskCreate`                                                                                                          |
| `TaskCompleted`      | When a task is being marked as completed                                                                                                               |
| `Stop`               | When Claude finishes responding                                                                                                                        |
| `StopFailure`        | When the turn ends due to an API error. Output and exit code are ignored                                                                               |
| `TeammateIdle`       | When an [agent team](/en/agent-teams) teammate is about to go idle                                                                                     |
| `InstructionsLoaded` | When a CLAUDE.md or `.claude/rules/*.md` file is loaded into context. Fires at session start and when files are lazily loaded during a session         |
| `ConfigChange`       | When a configuration file changes during a session                                                                                                     |
| `CwdChanged`         | When the working directory changes, for example when Claude executes a `cd` command. Useful for reactive environment management with tools like direnv |
| `FileChanged`        | When a watched file changes on disk. The `matcher` field specifies which filenames to watch                                                            |
| `WorktreeCreate`     | When a worktree is being created via `--worktree` or `isolation: "worktree"`. Replaces default git behavior                                            |
| `WorktreeRemove`     | When a worktree is being removed, either at session exit or when a subagent finishes                                                                   |
| `PreCompact`         | Before context compaction                                                                                                                              |
| `PostCompact`        | After context compaction completes                                                                                                                     |
| `Elicitation`        | When an MCP server requests user input during a tool call                                                                                              |
| `ElicitationResult`  | After a user responds to an MCP elicitation, before the response is sent back to the server                                                            |
| `SessionEnd`         | When a session terminates                                                                                                                              |

### How a hook resolves

To see how these pieces fit together, consider this `PreToolUse` hook that blocks destructive shell commands. The `matcher` narrows to Bash tool calls and the `if` condition narrows further to commands starting with `rm`, so `block-rm.sh` only spawns when both filters match:

```json  theme={null}
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(rm *)",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-rm.sh"
          }
        ]
      }
    ]
  }
}
```

The script reads the JSON input from stdin, extracts the command, and returns a `permissionDecision` of `"deny"` if it contains `rm -rf`:

```bash  theme={null}
#!/bin/bash
# .claude/hooks/block-rm.sh
COMMAND=$(jq -r '.tool_input.command')

if echo "$COMMAND" | grep -q 'rm -rf'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Destructive command blocked by hook"
    }
  }'
else
  exit 0  # allow the command
fi
```

Now suppose Claude Code decides to run `Bash "rm -rf /tmp/build"`. Here's what happens:

<Frame>
  <img src="https://mintcdn.com/claude-code/-tYw1BD_DEqfyyOZ/images/hook-resolution.svg?fit=max&auto=format&n=-tYw1BD_DEqfyyOZ&q=85&s=c73ebc1eeda2037570427d7af1e0a891" alt="Hook resolution flow: PreToolUse event fires, matcher checks for Bash match, if condition checks for Bash(rm *) match, hook handler runs, result returns to Claude Code" width="930" height="290" data-path="images/hook-resolution.svg" />
</Frame>

<Steps>
  <Step title="Event fires">
    The `PreToolUse` event fires. Claude Code sends the tool input as JSON on stdin to the hook:

    ```json  theme={null}
    { "tool_name": "Bash", "tool_input": { "command": "rm -rf /tmp/build" }, ... }
    ```
  </Step>

  <Step title="Matcher checks">
    The matcher `"Bash"` matches the tool name, so this hook group activates. If you omit the matcher or use `"*"`, the group activates on every occurrence of the event.
  </Step>

  <Step title="If condition checks">
    The `if` condition `"Bash(rm *)"` matches because the command starts with `rm`, so this handler spawns. If the command had been `npm test`, the `if` check would fail and `block-rm.sh` would never run, avoiding the process spawn overhead. The `if` field is optional; without it, every handler in the matched group runs.
  </Step>

  <Step title="Hook handler runs">
    The script inspects the full command and finds `rm -rf`, so it prints a decision to stdout:

    ```json  theme={null}
    {
      "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "Destructive command blocked by hook"
      }
    }
    ```

    If the command had been a safer `rm` variant like `rm file.txt`, the script would hit `exit 0` instead, which tells Claude Code to allow the tool call with no further action.
  </Step>

  <Step title="Claude Code acts on the result">
    Claude Code reads the JSON decision, blocks the tool call, and shows Claude the reason.
  </Step>
</Steps>

The [Configuration](#configuration) section below documents the full schema, and each [hook event](#hook-events) section documents what input your command receives and what output it can return.

## Configuration

Hooks are defined in JSON settings files. The configuration has three levels of nesting:

1. Choose a [hook event](#hook-events) to respond to, like `PreToolUse` or `Stop`
2. Add a [matcher group](#matcher-patterns) to filter when it fires, like "only for the Bash tool"
3. Define one or more [hook handlers](#hook-handler-fields) to run when matched

See [How a hook resolves](#how-a-hook-resolves) above for a complete walkthrough with an annotated example.

<Note>
  This page uses specific terms for each level: **hook event** for the lifecycle point, **matcher group** for the filter, and **hook handler** for the shell command, HTTP endpoint, prompt, or agent that runs. "Hook" on its own refers to the general feature.
</Note>

### Hook locations

Where you define a hook determines its scope:

| Location                                                   | Scope                         | Shareable                          |
| :--------------------------------------------------------- | :---------------------------- | :--------------------------------- |
| `~/.claude/settings.json`                                  | All your projects             | No, local to your machine          |
| `.claude/settings.json`                                    | Single project                | Yes, can be committed to the repo  |
| `.claude/settings.local.json`                              | Single project                | No, gitignored                     |
| Managed policy settings                                    | Organization-wide             | Yes, admin-controlled              |
| [Plugin](/en/plugins) `hooks/hooks.json`                   | When plugin is enabled        | Yes, bundled with the plugin       |
| [Skill](/en/skills) or [agent](/en/sub-agents) frontmatter | While the component is active | Yes, defined in the component file |

For details on settings file resolution, see [settings](/en/settings). Enterprise administrators can use `allowManagedHooksOnly` to block user, project, and plugin hooks. See [Hook configuration](/en/settings#hook-configuration).

### Matcher patterns

The `matcher` field is a regex string that filters when hooks fire. Use `"*"`, `""`, or omit `matcher` entirely to match all occurrences. Each event type matches on a different field:

| Event                                                                                                          | What the matcher filters                | Example matcher values                                                                                                    |
| :------------------------------------------------------------------------------------------------------------- | :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`                                         | tool name                               | `Bash`, `Edit\|Write`, `mcp__.*`                                                                                          |
| `SessionStart`                                                                                                 | how the session started                 | `startup`, `resume`, `clear`, `compact`                                                                                   |
| `SessionEnd`                                                                                                   | why the session ended                   | `clear`, `resume`, `logout`, `prompt_input_exit`, `bypass_permissions_disabled`, `other`                                  |
| `Notification`                                                                                                 | notification type                       | `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_dialog`                                                  |
| `SubagentStart`                                                                                                | agent type                              | `Bash`, `Explore`, `Plan`, or custom agent names                                                                          |
| `PreCompact`, `PostCompact`                                                                                    | what triggered compaction               | `manual`, `auto`                                                                                                          |
| `SubagentStop`                                                                                                 | agent type                              | same values as `SubagentStart`                                                                                            |
| `ConfigChange`                                                                                                 | configuration source                    | `user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills`                                        |
| `CwdChanged`                                                                                                   | no matcher support                      | always fires on every directory change                                                                                    |
| `FileChanged`                                                                                                  | filename (basename of the changed file) | `.envrc`, `.env`, any filename you want to watch                                                                          |
| `StopFailure`                                                                                                  | error type                              | `rate_limit`, `authentication_failed`, `billing_error`, `invalid_request`, `server_error`, `max_output_tokens`, `unknown` |
| `InstructionsLoaded`                                                                                           | load reason                             | `session_start`, `nested_traversal`, `path_glob_match`, `include`, `compact`                                              |
| `Elicitation`                                                                                                  | MCP server name                         | your configured MCP server names                                                                                          |
| `ElicitationResult`                                                                                            | MCP server name                         | same values as `Elicitation`                                                                                              |
| `UserPromptSubmit`, `Stop`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`, `WorktreeCreate`, `WorktreeRemove` | no matcher support                      | always fires on every occurrence                                                                                          |

The matcher is a regex, so `Edit|Write` matches either tool and `Notebook.*` matches any tool starting with Notebook. The matcher runs against a field from the [JSON input](#hook-input-and-output) that Claude Code sends to your hook on stdin. For tool events, that field is `tool_name`. Each [hook event](#hook-events) section lists the full set of matcher values and the input schema for that event.

This example runs a linting script only when Claude writes or edits a file:

```json  theme={null}
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/lint-check.sh"
          }
        ]
      }
    ]
  }
}
```

`UserPromptSubmit`, `Stop`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`, `WorktreeCreate`, `WorktreeRemove`, and `CwdChanged` don't support matchers and always fire on every occurrence. If you add a `matcher` field to these events, it is silently ignored.

For tool events, you can filter more narrowly by setting the [`if` field](#common-fields) on individual hook handlers. `if` uses [permission rule syntax](/en/permissions) to match against the tool name and arguments together, so `"Bash(git *)"` runs only for `git` commands and `"Edit(*.ts)"` runs only for TypeScript files.

#### Match MCP tools

[MCP](/en/mcp) server tools appear as regular tools in tool events (`PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`), so you can match them the same way you match any other tool name.

MCP tools follow the naming pattern `mcp__<server>__<tool>`, for example:

* `mcp__memory__create_entities`: Memory server's create entities tool
* `mcp__filesystem__read_file`: Filesystem server's read file tool
* `mcp__github__search_repositories`: GitHub server's search tool

Use regex patterns to target specific MCP tools or groups of tools:

* `mcp__memory__.*` matches all tools from the `memory` server
* `mcp__.*__write.*` matches any tool containing "write" from any server

This example logs all memory server operations and validates write operations from any MCP server:

```json  theme={null}
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "mcp__memory__.*",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Memory operation initiated' >> ~/mcp-operations.log"
          }
        ]
      },
      {
        "matcher": "mcp__.*__write.*",
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/scripts/validate-mcp-write.py"
          }
        ]
      }
    ]
  }
}
```

### Hook handler fields

Each object in the inner `hooks` array is a hook handler: the shell command, HTTP endpoint, LLM prompt, or agent that runs when the matcher matches. There are four types:

* **[Command hooks](#command-hook-fields)** (`type: "command"`): run a shell command. Your script receives the event's [JSON input](#hook-input-and-output) on stdin and communicates results back through exit codes and stdout.
* **[HTTP hooks](#http-hook-fields)** (`type: "http"`): send the event's JSON input as an HTTP POST request to a URL. The endpoint communicates results back through the response body using the same [JSON output format](#json-output) as command hooks.
* **[Prompt hooks](#prompt-and-agent-hook-fields)** (`type: "prompt"`): send a prompt to a Claude model for single-turn evaluation. The model returns a yes/no decision as JSON. See [Prompt-based hooks](#prompt-based-hooks).
* **[Agent hooks](#prompt-and-agent-hook-fields)** (`type: "agent"`): spawn a subagent that can use tools like Read, Grep, and Glob to verify conditions before returning a decision. See [Agent-based hooks](#agent-based-hooks).

#### Common fields

These fields apply to all hook types:

| Field           | Required | Description                                                                                                                                                                                                                                                                                                                                                                          |
| :-------------- | :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`          | yes      | `"command"`, `"http"`, `"prompt"`, or `"agent"`                                                                                                                                                                                                                                                                                                                                      |
| `if`            | no       | Permission rule syntax to filter when this hook runs, such as `"Bash(git *)"` or `"Edit(*.ts)"`. The hook only spawns if the tool call matches the pattern. Only evaluated on tool events: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, and `PermissionRequest`. On other events, a hook with `if` set never runs. Uses the same syntax as [permission rules](/en/permissions) |
| `timeout`       | no       | Seconds before canceling. Defaults: 600 for command, 30 for prompt, 60 for agent                                                                                                                                                                                                                                                                                                     |
| `statusMessage` | no       | Custom spinner message displayed while the hook runs                                                                                                                                                                                                                                                                                                                                 |
| `once`          | no       | If `true`, runs only once per session then is removed. Skills only, not agents. See [Hooks in skills and agents](#hooks-in-skills-and-agents)                                                                                                                                                                                                                                        |

#### Command hook fields

In addition to the [common fields](#common-fields), command hooks accept these fields:

| Field     | Required | Description                                                                                                                                                                                                                           |
| :-------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `command` | yes      | Shell command to execute                                                                                                                                                                                                              |
| `async`   | no       | If `true`, runs in the background without blocking. See [Run hooks in the background](#run-hooks-in-the-background)                                                                                                                   |
| `shell`   | no       | Shell to use for this hook. Accepts `"bash"` (default) or `"powershell"`. Setting `"powershell"` runs the command via PowerShell on Windows. Does not require `CLAUDE_CODE_USE_POWERSHELL_TOOL` since hooks spawn PowerShell directly |

#### HTTP hook fields

In addition to the [common fields](#common-fields), HTTP hooks accept these fields:

| Field            | Required | Description                                                                                                                                                                                      |
| :--------------- | :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`            | yes      | URL to send the POST request to                                                                                                                                                                  |
| `headers`        | no       | Additional HTTP headers as key-value pairs. Values support environment variable interpolation using `$VAR_NAME` or `${VAR_NAME}` syntax. Only variables listed in `allowedEnvVars` are resolved  |
| `allowedEnvVars` | no       | List of environment variable names that may be interpolated into header values. References to unlisted variables are replaced with empty strings. Required for any env var interpolation to work |

Claude Code sends the hook's [JSON input](#hook-input-and-output) as the POST request body with `Content-Type: application/json`. The response body uses the same [JSON output format](#json-output) as command hooks.

Error handling differs from command hooks: non-2xx responses, connection failures, and timeouts all produce non-blocking errors that allow execution to continue. To block a tool call or deny a permission, return a 2xx response with a JSON body containing `decision: "block"` or a `hookSpecificOutput` with `permissionDecision: "deny"`.

This example sends `PreToolUse` events to a local validation service, authenticating with a token from the `MY_TOKEN` environment variable:

```json  theme={null}
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:8080/hooks/pre-tool-use",
            "timeout": 30,
            "headers": {
              "Authorization": "Bearer $MY_TOKEN"
            },
            "allowedEnvVars": ["MY_TOKEN"]
          }
        ]
      }
    ]
  }
}
```

#### Prompt and agent hook fields

In addition to the [common fields](#common-fields), prompt and agent hooks accept these fields:

| Field    | Required | Description                                                                                 |
| :------- | :------- | :------------------------------------------------------------------------------------------ |
| `prompt` | yes      | Prompt text to send to the model. Use `$ARGUMENTS` as a placeholder for the hook input JSON |
| `model`  | no       | Model to use for evaluation. Defaults to a fast model                                       |

All matching hooks run in parallel, and identical handlers are deduplicated automatically. Command hooks are deduplicated by command string, and HTTP hooks are deduplicated by URL. Handlers run in the current directory with Claude Code's environment. The `$CLAUDE_CODE_REMOTE` environment variable is set to `"true"` in remote web environments and not set in the local CLI.

### Reference scripts by path

Use environment variables to reference hook scripts relative to the project or plugin root, regardless of the working directory when the hook runs:

* `$CLAUDE_PROJECT_DIR`: the project root. Wrap in quotes to handle paths with spaces.
* `${CLAUDE_PLUGIN_ROOT}`: the plugin's installation directory, for scripts bundled with a [plugin](/en/plugins). Changes on each plugin update.
* `${CLAUDE_PLUGIN_DATA}`: the plugin's [persistent data directory](/en/plugins-reference#persistent-data-directory), for dependencies and state that should survive plugin updates.

<Tabs>
  <Tab title="Project scripts">
    This example uses `$CLAUDE_PROJECT_DIR` to run a style checker from the project's `.claude/hooks/` directory after any `Write` or `Edit` tool call:

    ```json  theme={null}
    {
      "hooks": {
        "PostToolUse": [
          {
            "matcher": "Write|Edit",
            "hooks": [
              {
                "type": "command",
                "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/check-style.sh"
              }
            ]
          }
        ]
      }
    }
    ```
  </Tab>

  <Tab title="Plugin scripts">
    Define plugin hooks in `hooks/hooks.json` with an optional top-level `description` field. When a plugin is enabled, its hooks merge with your user and project hooks.

    This example runs a formatting script bundled with the plugin:

    ```json  theme={null}
    {
      "description": "Automatic code formatting",
      "hooks": {
        "PostToolUse": [
          {
            "matcher": "Write|Edit",
            "hooks": [
              {
                "type": "command",
                "command": "${CLAUDE_PLUGIN_ROOT}/scripts/format.sh",
                "timeout": 30
              }
            ]
          }
        ]
      }
    }
    ```

    See the [plugin components reference](/en/plugins-reference#hooks) for details on creating plugin hooks.
  </Tab>
</Tabs>

### Hooks in skills and agents

In addition to settings files and plugins, hooks can be defined directly in [skills](/en/skills) and [subagents](/en/sub-agents) using frontmatter. These hooks are scoped to the component's lifecycle and only run when that component is active.

All hook events are supported. For subagents, `Stop` hooks are automatically converted to `SubagentStop` since that is the event that fires when a subagent completes.

Hooks use the same configuration format as settings-based hooks but are scoped to the component's lifetime and cleaned up when it finishes.

This skill defines a `PreToolUse` hook that runs a security validation script before each `Bash` command:

```yaml  theme={null}
---
name: secure-operations
description: Perform operations with security checks
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/security-check.sh"
---
```

Agents use the same format in their YAML frontmatter.

### The `/hooks` menu

Type `/hooks` in Claude Code to open a read-only browser for your configured hooks. The menu shows every hook event with a count of configured hooks, lets you drill into matchers, and shows the full details of each hook handler. Use it to verify configuration, check which settings file a hook came from, or inspect a hook's command, prompt, or URL.

The menu displays all four hook types: `command`, `prompt`, `agent`, and `http`. Each hook is labeled with a `[type]` prefix and a source indicating where it was defined:

* `User`: from `~/.claude/settings.json`
* `Project`: from `.claude/settings.json`
* `Local`: from `.claude/settings.local.json`
* `Plugin`: from a plugin's `hooks/hooks.json`
* `Session`: registered in memory for the current session
* `Built-in`: registered internally by Claude Code

Selecting a hook opens a detail view showing its event, matcher, type, source file, and the full command, prompt, or URL. The menu is read-only: to add, modify, or remove hooks, edit the settings JSON directly or ask Claude to make the change.

### Disable or remove hooks

To remove a hook, delete its entry from the settings JSON file.

To temporarily disable all hooks without removing them, set `"disableAllHooks": true` in your settings file. There is no way to disable an individual hook while keeping it in the configuration.

The `disableAllHooks` setting respects the managed settings hierarchy. If an administrator has configured hooks through managed policy settings, `disableAllHooks` set in user, project, or local settings cannot disable those managed hooks. Only `disableAllHooks` set at the managed settings level can disable managed hooks.

Direct edits to hooks in settings files are normally picked up automatically by the file watcher.

## Hook input and output

Command hooks receive JSON data via stdin and communicate results through exit codes, stdout, and stderr. HTTP hooks receive the same JSON as the POST request body and communicate results through the HTTP response body. This section covers fields and behavior common to all events. Each event's section under [Hook events](#hook-events) includes its specific input schema and decision control options.

### Common input fields

Hook events receive these fields as JSON, in addition to event-specific fields documented in each [hook event](#hook-events) section. For command hooks, this JSON arrives via stdin. For HTTP hooks, it arrives as the POST request body.

| Field             | Description                                                                                                                                                                                                                           |
| :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `session_id`      | Current session identifier                                                                                                                                                                                                            |
| `transcript_path` | Path to conversation JSON                                                                                                                                                                                                             |
| `cwd`             | Current working directory when the hook is invoked                                                                                                                                                                                    |
| `permission_mode` | Current [permission mode](/en/permissions#permission-modes): `"default"`, `"plan"`, `"acceptEdits"`, `"auto"`, `"dontAsk"`, or `"bypassPermissions"`. Not all events receive this field: see each event's JSON example below to check |
| `hook_event_name` | Name of the event that fired                                                                                                                                                                                                          |

When running with `--agent` or inside a subagent, two additional fields are included:

| Field        | Description                                                                                                                                                                                                                          |
| :----------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent_id`   | Unique identifier for the subagent. Present only when the hook fires inside a subagent call. Use this to distinguish subagent hook calls from main-thread calls.                                                                     |
| `agent_type` | Agent name (for example, `"Explore"` or `"security-reviewer"`). Present when the session uses `--agent` or the hook fires inside a subagent. For subagents, the subagent's type takes precedence over the session's `--agent` value. |

For example, a `PreToolUse` hook for a Bash command receives this on stdin:

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/home/user/.claude/projects/.../transcript.jsonl",
  "cwd": "/home/user/my-project",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test"
  }
}
```

The `tool_name` and `tool_input` fields are event-specific. Each [hook event](#hook-events) section documents the additional fields for that event.

### Exit code output

The exit code from your hook command tells Claude Code whether the action should proceed, be blocked, or be ignored.

**Exit 0** means success. Claude Code parses stdout for [JSON output fields](#json-output). JSON output is only processed on exit 0. For most events, stdout is only shown in verbose mode (`Ctrl+O`). The exceptions are `UserPromptSubmit` and `SessionStart`, where stdout is added as context that Claude can see and act on.

**Exit 2** means a blocking error. Claude Code ignores stdout and any JSON in it. Instead, stderr text is fed back to Claude as an error message. The effect depends on the event: `PreToolUse` blocks the tool call, `UserPromptSubmit` rejects the prompt, and so on. See [exit code 2 behavior](#exit-code-2-behavior-per-event) for the full list.

**Any other exit code** is a non-blocking error. stderr is shown in verbose mode (`Ctrl+O`) and execution continues.

For example, a hook command script that blocks dangerous Bash commands:

```bash  theme={null}
#!/bin/bash
# Reads JSON input from stdin, checks the command
command=$(jq -r '.tool_input.command' < /dev/stdin)

if [[ "$command" == rm* ]]; then
  echo "Blocked: rm commands are not allowed" >&2
  exit 2  # Blocking error: tool call is prevented
fi

exit 0  # Success: tool call proceeds
```

#### Exit code 2 behavior per event

Exit code 2 is the way a hook signals "stop, don't do this." The effect depends on the event, because some events represent actions that can be blocked (like a tool call that hasn't happened yet) and others represent things that already happened or can't be prevented.

| Hook event           | Can block? | What happens on exit 2                                                        |
| :------------------- | :--------- | :---------------------------------------------------------------------------- |
| `PreToolUse`         | Yes        | Blocks the tool call                                                          |
| `PermissionRequest`  | Yes        | Denies the permission                                                         |
| `UserPromptSubmit`   | Yes        | Blocks prompt processing and erases the prompt                                |
| `Stop`               | Yes        | Prevents Claude from stopping, continues the conversation                     |
| `SubagentStop`       | Yes        | Prevents the subagent from stopping                                           |
| `TeammateIdle`       | Yes        | Prevents the teammate from going idle (teammate continues working)            |
| `TaskCreated`        | Yes        | Prevents the task from being created                                          |
| `TaskCompleted`      | Yes        | Prevents the task from being marked as completed                              |
| `ConfigChange`       | Yes        | Blocks the configuration change from taking effect (except `policy_settings`) |
| `StopFailure`        | No         | Output and exit code are ignored                                              |
| `PostToolUse`        | No         | Shows stderr to Claude (tool already ran)                                     |
| `PostToolUseFailure` | No         | Shows stderr to Claude (tool already failed)                                  |
| `Notification`       | No         | Shows stderr to user only                                                     |
| `SubagentStart`      | No         | Shows stderr to user only                                                     |
| `SessionStart`       | No         | Shows stderr to user only                                                     |
| `SessionEnd`         | No         | Shows stderr to user only                                                     |
| `CwdChanged`         | No         | Shows stderr to user only                                                     |
| `FileChanged`        | No         | Shows stderr to user only                                                     |
| `PreCompact`         | No         | Shows stderr to user only                                                     |
| `PostCompact`        | No         | Shows stderr to user only                                                     |
| `Elicitation`        | Yes        | Denies the elicitation                                                        |
| `ElicitationResult`  | Yes        | Blocks the response (action becomes decline)                                  |
| `WorktreeCreate`     | Yes        | Any non-zero exit code causes worktree creation to fail                       |
| `WorktreeRemove`     | No         | Failures are logged in debug mode only                                        |
| `InstructionsLoaded` | No         | Exit code is ignored                                                          |

### HTTP response handling

HTTP hooks use HTTP status codes and response bodies instead of exit codes and stdout:

* **2xx with an empty body**: success, equivalent to exit code 0 with no output
* **2xx with a plain text body**: success, the text is added as context
* **2xx with a JSON body**: success, parsed using the same [JSON output](#json-output) schema as command hooks
* **Non-2xx status**: non-blocking error, execution continues
* **Connection failure or timeout**: non-blocking error, execution continues

Unlike command hooks, HTTP hooks cannot signal a blocking error through status codes alone. To block a tool call or deny a permission, return a 2xx response with a JSON body containing the appropriate decision fields.

### JSON output

Exit codes let you allow or block, but JSON output gives you finer-grained control. Instead of exiting with code 2 to block, exit 0 and print a JSON object to stdout. Claude Code reads specific fields from that JSON to control behavior, including [decision control](#decision-control) for blocking, allowing, or escalating to the user.

<Note>
  You must choose one approach per hook, not both: either use exit codes alone for signaling, or exit 0 and print JSON for structured control. Claude Code only processes JSON on exit 0. If you exit 2, any JSON is ignored.
</Note>

Your hook's stdout must contain only the JSON object. If your shell profile prints text on startup, it can interfere with JSON parsing. See [JSON validation failed](/en/hooks-guide#json-validation-failed) in the troubleshooting guide.

The JSON object supports three kinds of fields:

* **Universal fields** like `continue` work across all events. These are listed in the table below.
* **Top-level `decision` and `reason`** are used by some events to block or provide feedback.
* **`hookSpecificOutput`** is a nested object for events that need richer control. It requires a `hookEventName` field set to the event name.

| Field            | Default | Description                                                                                                                |
| :--------------- | :------ | :------------------------------------------------------------------------------------------------------------------------- |
| `continue`       | `true`  | If `false`, Claude stops processing entirely after the hook runs. Takes precedence over any event-specific decision fields |
| `stopReason`     | none    | Message shown to the user when `continue` is `false`. Not shown to Claude                                                  |
| `suppressOutput` | `false` | If `true`, hides stdout from verbose mode output                                                                           |
| `systemMessage`  | none    | Warning message shown to the user                                                                                          |

To stop Claude entirely regardless of event type:

```json  theme={null}
{ "continue": false, "stopReason": "Build failed, fix errors before continuing" }
```

#### Decision control

Not every event supports blocking or controlling behavior through JSON. The events that do each use a different set of fields to express that decision. Use this table as a quick reference before writing a hook:

| Events                                                                                                                      | Decision pattern               | Key fields                                                                                                                                                          |
| :-------------------------------------------------------------------------------------------------------------------------- | :----------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| UserPromptSubmit, PostToolUse, PostToolUseFailure, Stop, SubagentStop, ConfigChange                                         | Top-level `decision`           | `decision: "block"`, `reason`                                                                                                                                       |
| TeammateIdle, TaskCreated, TaskCompleted                                                                                    | Exit code or `continue: false` | Exit code 2 blocks the action with stderr feedback. JSON `{"continue": false, "stopReason": "..."}` also stops the teammate entirely, matching `Stop` hook behavior |
| PreToolUse                                                                                                                  | `hookSpecificOutput`           | `permissionDecision` (allow/deny/ask), `permissionDecisionReason`                                                                                                   |
| PermissionRequest                                                                                                           | `hookSpecificOutput`           | `decision.behavior` (allow/deny)                                                                                                                                    |
| WorktreeCreate                                                                                                              | path return                    | Command hook prints path on stdout; HTTP hook returns `hookSpecificOutput.worktreePath`. Hook failure or missing path fails creation                                |
| Elicitation                                                                                                                 | `hookSpecificOutput`           | `action` (accept/decline/cancel), `content` (form field values for accept)                                                                                          |
| ElicitationResult                                                                                                           | `hookSpecificOutput`           | `action` (accept/decline/cancel), `content` (form field values override)                                                                                            |
| WorktreeRemove, Notification, SessionEnd, PreCompact, PostCompact, InstructionsLoaded, StopFailure, CwdChanged, FileChanged | None                           | No decision control. Used for side effects like logging or cleanup                                                                                                  |

Here are examples of each pattern in action:

<Tabs>
  <Tab title="Top-level decision">
    Used by `UserPromptSubmit`, `PostToolUse`, `PostToolUseFailure`, `Stop`, `SubagentStop`, and `ConfigChange`. The only value is `"block"`. To allow the action to proceed, omit `decision` from your JSON, or exit 0 without any JSON at all:

    ```json  theme={null}
    {
      "decision": "block",
      "reason": "Test suite must pass before proceeding"
    }
    ```
  </Tab>

  <Tab title="PreToolUse">
    Uses `hookSpecificOutput` for richer control: allow, deny, or escalate to the user. You can also modify tool input before it runs or inject additional context for Claude. See [PreToolUse decision control](#pretooluse-decision-control) for the full set of options.

    ```json  theme={null}
    {
      "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "Database writes are not allowed"
      }
    }
    ```
  </Tab>

  <Tab title="PermissionRequest">
    Uses `hookSpecificOutput` to allow or deny a permission request on behalf of the user. When allowing, you can also modify the tool's input or apply permission rules so the user isn't prompted again. See [PermissionRequest decision control](#permissionrequest-decision-control) for the full set of options.

    ```json  theme={null}
    {
      "hookSpecificOutput": {
        "hookEventName": "PermissionRequest",
        "decision": {
          "behavior": "allow",
          "updatedInput": {
            "command": "npm run lint"
          }
        }
      }
    }
    ```
  </Tab>
</Tabs>

For extended examples including Bash command validation, prompt filtering, and auto-approval scripts, see [What you can automate](/en/hooks-guide#what-you-can-automate) in the guide and the [Bash command validator reference implementation](https://github.com/anthropics/claude-code/blob/main/examples/hooks/bash_command_validator_example.py).

## Hook events

Each event corresponds to a point in Claude Code's lifecycle where hooks can run. The sections below are ordered to match the lifecycle: from session setup through the agentic loop to session end. Each section describes when the event fires, what matchers it supports, the JSON input it receives, and how to control behavior through output.

### SessionStart

Runs when Claude Code starts a new session or resumes an existing session. Useful for loading development context like existing issues or recent changes to your codebase, or setting up environment variables. For static context that does not require a script, use [CLAUDE.md](/en/memory) instead.

SessionStart runs on every session, so keep these hooks fast. Only `type: "command"` hooks are supported.

The matcher value corresponds to how the session was initiated:

| Matcher   | When it fires                          |
| :-------- | :------------------------------------- |
| `startup` | New session                            |
| `resume`  | `--resume`, `--continue`, or `/resume` |
| `clear`   | `/clear`                               |
| `compact` | Auto or manual compaction              |

#### SessionStart input

In addition to the [common input fields](#common-input-fields), SessionStart hooks receive `source`, `model`, and optionally `agent_type`. The `source` field indicates how the session started: `"startup"` for new sessions, `"resume"` for resumed sessions, `"clear"` after `/clear`, or `"compact"` after compaction. The `model` field contains the model identifier. If you start Claude Code with `claude --agent <name>`, an `agent_type` field contains the agent name.

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "SessionStart",
  "source": "startup",
  "model": "claude-sonnet-4-6"
}
```

#### SessionStart decision control

Any text your hook script prints to stdout is added as context for Claude. In addition to the [JSON output fields](#json-output) available to all hooks, you can return these event-specific fields:

| Field               | Description                                                               |
| :------------------ | :------------------------------------------------------------------------ |
| `additionalContext` | String added to Claude's context. Multiple hooks' values are concatenated |

```json  theme={null}
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "My additional context here"
  }
}
```

#### Persist environment variables

SessionStart hooks have access to the `CLAUDE_ENV_FILE` environment variable, which provides a file path where you can persist environment variables for subsequent Bash commands.

To set individual environment variables, write `export` statements to `CLAUDE_ENV_FILE`. Use append (`>>`) to preserve variables set by other hooks:

```bash  theme={null}
#!/bin/bash

if [ -n "$CLAUDE_ENV_FILE" ]; then
  echo 'export NODE_ENV=production' >> "$CLAUDE_ENV_FILE"
  echo 'export DEBUG_LOG=true' >> "$CLAUDE_ENV_FILE"
  echo 'export PATH="$PATH:./node_modules/.bin"' >> "$CLAUDE_ENV_FILE"
fi

exit 0
```

To capture all environment changes from setup commands, compare the exported variables before and after:

```bash  theme={null}
#!/bin/bash

ENV_BEFORE=$(export -p | sort)

# Run your setup commands that modify the environment
source ~/.nvm/nvm.sh
nvm use 20

if [ -n "$CLAUDE_ENV_FILE" ]; then
  ENV_AFTER=$(export -p | sort)
  comm -13 <(echo "$ENV_BEFORE") <(echo "$ENV_AFTER") >> "$CLAUDE_ENV_FILE"
fi

exit 0
```

Any variables written to this file will be available in all subsequent Bash commands that Claude Code executes during the session.

<Note>
  `CLAUDE_ENV_FILE` is available for SessionStart, [CwdChanged](#cwdchanged), and [FileChanged](#filechanged) hooks. Other hook types do not have access to this variable.
</Note>

### InstructionsLoaded

Fires when a `CLAUDE.md` or `.claude/rules/*.md` file is loaded into context. This event fires at session start for eagerly-loaded files and again later when files are lazily loaded, for example when Claude accesses a subdirectory that contains a nested `CLAUDE.md` or when conditional rules with `paths:` frontmatter match. The hook does not support blocking or decision control. It runs asynchronously for observability purposes.

The matcher runs against `load_reason`. For example, use `"matcher": "session_start"` to fire only for files loaded at session start, or `"matcher": "path_glob_match|nested_traversal"` to fire only for lazy loads.

#### InstructionsLoaded input

In addition to the [common input fields](#common-input-fields), InstructionsLoaded hooks receive these fields:

| Field               | Description                                                                                                                                                                                                   |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `file_path`         | Absolute path to the instruction file that was loaded                                                                                                                                                         |
| `memory_type`       | Scope of the file: `"User"`, `"Project"`, `"Local"`, or `"Managed"`                                                                                                                                           |
| `load_reason`       | Why the file was loaded: `"session_start"`, `"nested_traversal"`, `"path_glob_match"`, `"include"`, or `"compact"`. The `"compact"` value fires when instruction files are re-loaded after a compaction event |
| `globs`             | Path glob patterns from the file's `paths:` frontmatter, if any. Present only for `path_glob_match` loads                                                                                                     |
| `trigger_file_path` | Path to the file whose access triggered this load, for lazy loads                                                                                                                                             |
| `parent_file_path`  | Path to the parent instruction file that included this one, for `include` loads                                                                                                                               |

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../transcript.jsonl",
  "cwd": "/Users/my-project",
  "hook_event_name": "InstructionsLoaded",
  "file_path": "/Users/my-project/CLAUDE.md",
  "memory_type": "Project",
  "load_reason": "session_start"
}
```

#### InstructionsLoaded decision control

InstructionsLoaded hooks have no decision control. They cannot block or modify instruction loading. Use this event for audit logging, compliance tracking, or observability.

### UserPromptSubmit

Runs when the user submits a prompt, before Claude processes it. This allows you
to add additional context based on the prompt/conversation, validate prompts, or
block certain types of prompts.

#### UserPromptSubmit input

In addition to the [common input fields](#common-input-fields), UserPromptSubmit hooks receive the `prompt` field containing the text the user submitted.

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "Write a function to calculate the factorial of a number"
}
```

#### UserPromptSubmit decision control

`UserPromptSubmit` hooks can control whether a user prompt is processed and add context. All [JSON output fields](#json-output) are available.

There are two ways to add context to the conversation on exit code 0:

* **Plain text stdout**: any non-JSON text written to stdout is added as context
* **JSON with `additionalContext`**: use the JSON format below for more control. The `additionalContext` field is added as context

Plain stdout is shown as hook output in the transcript. The `additionalContext` field is added more discretely.

To block a prompt, return a JSON object with `decision` set to `"block"`:

| Field               | Description                                                                                                        |
| :------------------ | :----------------------------------------------------------------------------------------------------------------- |
| `decision`          | `"block"` prevents the prompt from being processed and erases it from context. Omit to allow the prompt to proceed |
| `reason`            | Shown to the user when `decision` is `"block"`. Not added to context                                               |
| `additionalContext` | String added to Claude's context                                                                                   |

```json  theme={null}
{
  "decision": "block",
  "reason": "Explanation for decision",
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "My additional context here"
  }
}
```

<Note>
  The JSON format isn't required for simple use cases. To add context, you can print plain text to stdout with exit code 0. Use JSON when you need to
  block prompts or want more structured control.
</Note>

### PreToolUse

Runs after Claude creates tool parameters and before processing the tool call. Matches on tool name: `Bash`, `Edit`, `Write`, `Read`, `Glob`, `Grep`, `Agent`, `WebFetch`, `WebSearch`, `AskUserQuestion`, `ExitPlanMode`, and any [MCP tool names](#match-mcp-tools).

Use [PreToolUse decision control](#pretooluse-decision-control) to allow, deny, or ask for permission to use the tool.

#### PreToolUse input

In addition to the [common input fields](#common-input-fields), PreToolUse hooks receive `tool_name`, `tool_input`, and `tool_use_id`. The `tool_input` fields depend on the tool:

##### Bash

Executes shell commands.

| Field               | Type    | Example            | Description                                   |
| :------------------ | :------ | :----------------- | :-------------------------------------------- |
| `command`           | string  | `"npm test"`       | The shell command to execute                  |
| `description`       | string  | `"Run test suite"` | Optional description of what the command does |
| `timeout`           | number  | `120000`           | Optional timeout in milliseconds              |
| `run_in_background` | boolean | `false`            | Whether to run the command in background      |

##### Write

Creates or overwrites a file.

| Field       | Type   | Example               | Description                        |
| :---------- | :----- | :-------------------- | :--------------------------------- |
| `file_path` | string | `"/path/to/file.txt"` | Absolute path to the file to write |
| `content`   | string | `"file content"`      | Content to write to the file       |

##### Edit

Replaces a string in an existing file.

| Field         | Type    | Example               | Description                        |
| :------------ | :------ | :-------------------- | :--------------------------------- |
| `file_path`   | string  | `"/path/to/file.txt"` | Absolute path to the file to edit  |
| `old_string`  | string  | `"original text"`     | Text to find and replace           |
| `new_string`  | string  | `"replacement text"`  | Replacement text                   |
| `replace_all` | boolean | `false`               | Whether to replace all occurrences |

##### Read

Reads file contents.

| Field       | Type   | Example               | Description                                |
| :---------- | :----- | :-------------------- | :----------------------------------------- |
| `file_path` | string | `"/path/to/file.txt"` | Absolute path to the file to read          |
| `offset`    | number | `10`                  | Optional line number to start reading from |
| `limit`     | number | `50`                  | Optional number of lines to read           |

##### Glob

Finds files matching a glob pattern.

| Field     | Type   | Example          | Description                                                            |
| :-------- | :----- | :--------------- | :--------------------------------------------------------------------- |
| `pattern` | string | `"**/*.ts"`      | Glob pattern to match files against                                    |
| `path`    | string | `"/path/to/dir"` | Optional directory to search in. Defaults to current working directory |

##### Grep

Searches file contents with regular expressions.

| Field         | Type    | Example          | Description                                                                           |
| :------------ | :------ | :--------------- | :------------------------------------------------------------------------------------ |
| `pattern`     | string  | `"TODO.*fix"`    | Regular expression pattern to search for                                              |
| `path`        | string  | `"/path/to/dir"` | Optional file or directory to search in                                               |
| `glob`        | string  | `"*.ts"`         | Optional glob pattern to filter files                                                 |
| `output_mode` | string  | `"content"`      | `"content"`, `"files_with_matches"`, or `"count"`. Defaults to `"files_with_matches"` |
| `-i`          | boolean | `true`           | Case insensitive search                                                               |
| `multiline`   | boolean | `false`          | Enable multiline matching                                                             |

##### WebFetch

Fetches and processes web content.

| Field    | Type   | Example                       | Description                          |
| :------- | :----- | :---------------------------- | :----------------------------------- |
| `url`    | string | `"https://example.com/api"`   | URL to fetch content from            |
| `prompt` | string | `"Extract the API endpoints"` | Prompt to run on the fetched content |

##### WebSearch

Searches the web.

| Field             | Type   | Example                        | Description                                       |
| :---------------- | :----- | :----------------------------- | :------------------------------------------------ |
| `query`           | string | `"react hooks best practices"` | Search query                                      |
| `allowed_domains` | array  | `["docs.example.com"]`         | Optional: only include results from these domains |
| `blocked_domains` | array  | `["spam.example.com"]`         | Optional: exclude results from these domains      |

##### Agent

Spawns a [subagent](/en/sub-agents).

| Field           | Type   | Example                    | Description                                  |
| :-------------- | :----- | :------------------------- | :------------------------------------------- |
| `prompt`        | string | `"Find all API endpoints"` | The task for the agent to perform            |
| `description`   | string | `"Find API endpoints"`     | Short description of the task                |
| `subagent_type` | string | `"Explore"`                | Type of specialized agent to use             |
| `model`         | string | `"sonnet"`                 | Optional model alias to override the default |

##### AskUserQuestion

Asks the user one to four multiple-choice questions.

| Field       | Type   | Example                                                                                                            | Description                                                                                                                                                                                      |
| :---------- | :----- | :----------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `questions` | array  | `[{"question": "Which framework?", "header": "Framework", "options": [{"label": "React"}], "multiSelect": false}]` | Questions to present, each with a `question` string, short `header`, `options` array, and optional `multiSelect` flag                                                                            |
| `answers`   | object | `{"Which framework?": "React"}`                                                                                    | Optional. Maps question text to the selected option label. Multi-select answers join labels with commas. Claude does not set this field; supply it via `updatedInput` to answer programmatically |

#### PreToolUse decision control

`PreToolUse` hooks can control whether a tool call proceeds. Unlike other hooks that use a top-level `decision` field, PreToolUse returns its decision inside a `hookSpecificOutput` object. This gives it richer control: three outcomes (allow, deny, or ask) plus the ability to modify tool input before execution.

| Field                      | Description                                                                                                                                                                                                                             |
| :------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `permissionDecision`       | `"allow"` skips the permission prompt. `"deny"` prevents the tool call. `"ask"` prompts the user to confirm. [Deny and ask rules](/en/permissions#manage-permissions) still apply when a hook returns `"allow"`                         |
| `permissionDecisionReason` | For `"allow"` and `"ask"`, shown to the user but not Claude. For `"deny"`, shown to Claude                                                                                                                                              |
| `updatedInput`             | Modifies the tool's input parameters before execution. Replaces the entire input object, so include unchanged fields alongside modified ones. Combine with `"allow"` to auto-approve, or `"ask"` to show the modified input to the user |
| `additionalContext`        | String added to Claude's context before the tool executes                                                                                                                                                                               |

When a hook returns `"ask"`, the permission prompt displayed to the user includes a label identifying where the hook came from: for example, `[User]`, `[Project]`, `[Plugin]`, or `[Local]`. This helps users understand which configuration source is requesting confirmation.

```json  theme={null}
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "My reason here",
    "updatedInput": {
      "field_to_modify": "new value"
    },
    "additionalContext": "Current environment: production. Proceed with caution."
  }
}
```

`AskUserQuestion` and `ExitPlanMode` require user interaction and normally block in [non-interactive mode](/en/headless) with the `-p` flag. Returning `permissionDecision: "allow"` together with `updatedInput` satisfies that requirement: the hook reads the tool's input from stdin, collects the answer through your own UI, and returns it in `updatedInput` so the tool runs without prompting. Returning `"allow"` alone is not sufficient for these tools. For `AskUserQuestion`, echo back the original `questions` array and add an [`answers`](#askuserquestion) object mapping each question's text to the chosen answer.

<Note>
  PreToolUse previously used top-level `decision` and `reason` fields, but these are deprecated for this event. Use `hookSpecificOutput.permissionDecision` and `hookSpecificOutput.permissionDecisionReason` instead. The deprecated values `"approve"` and `"block"` map to `"allow"` and `"deny"` respectively. Other events like PostToolUse and Stop continue to use top-level `decision` and `reason` as their current format.
</Note>

### PermissionRequest

Runs when the user is shown a permission dialog.
Use [PermissionRequest decision control](#permissionrequest-decision-control) to allow or deny on behalf of the user.

Matches on tool name, same values as PreToolUse.

#### PermissionRequest input

PermissionRequest hooks receive `tool_name` and `tool_input` fields like PreToolUse hooks, but without `tool_use_id`. An optional `permission_suggestions` array contains the "always allow" options the user would normally see in the permission dialog. The difference is when the hook fires: PermissionRequest hooks run when a permission dialog is about to be shown to the user, while PreToolUse hooks run before tool execution regardless of permission status.

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "PermissionRequest",
  "tool_name": "Bash",
  "tool_input": {
    "command": "rm -rf node_modules",
    "description": "Remove node_modules directory"
  },
  "permission_suggestions": [
    {
      "type": "addRules",
      "rules": [{ "toolName": "Bash", "ruleContent": "rm -rf node_modules" }],
      "behavior": "allow",
      "destination": "localSettings"
    }
  ]
}
```

#### PermissionRequest decision control

`PermissionRequest` hooks can allow or deny permission requests. In addition to the [JSON output fields](#json-output) available to all hooks, your hook script can return a `decision` object with these event-specific fields:

| Field                | Description                                                                                                                                                         |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `behavior`           | `"allow"` grants the permission, `"deny"` denies it                                                                                                                 |
| `updatedInput`       | For `"allow"` only: modifies the tool's input parameters before execution. Replaces the entire input object, so include unchanged fields alongside modified ones    |
| `updatedPermissions` | For `"allow"` only: array of [permission update entries](#permission-update-entries) to apply, such as adding an allow rule or changing the session permission mode |
| `message`            | For `"deny"` only: tells Claude why the permission was denied                                                                                                       |
| `interrupt`          | For `"deny"` only: if `true`, stops Claude                                                                                                                          |

```json  theme={null}
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "allow",
      "updatedInput": {
        "command": "npm run lint"
      }
    }
  }
}
```

#### Permission update entries

The `updatedPermissions` output field and the [`permission_suggestions` input field](#permissionrequest-input) both use the same array of entry objects. Each entry has a `type` that determines its other fields, and a `destination` that controls where the change is written.

| `type`              | Fields                             | Effect                                                                                                                                                                      |
| :------------------ | :--------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `addRules`          | `rules`, `behavior`, `destination` | Adds permission rules. `rules` is an array of `{toolName, ruleContent?}` objects. Omit `ruleContent` to match the whole tool. `behavior` is `"allow"`, `"deny"`, or `"ask"` |
| `replaceRules`      | `rules`, `behavior`, `destination` | Replaces all rules of the given `behavior` at the `destination` with the provided `rules`                                                                                   |
| `removeRules`       | `rules`, `behavior`, `destination` | Removes matching rules of the given `behavior`                                                                                                                              |
| `setMode`           | `mode`, `destination`              | Changes the permission mode. Valid modes are `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, and `plan`                                                           |
| `addDirectories`    | `directories`, `destination`       | Adds working directories. `directories` is an array of path strings                                                                                                         |
| `removeDirectories` | `directories`, `destination`       | Removes working directories                                                                                                                                                 |

The `destination` field on every entry determines whether the change stays in memory or persists to a settings file.

| `destination`     | Writes to                                       |
| :---------------- | :---------------------------------------------- |
| `session`         | in-memory only, discarded when the session ends |
| `localSettings`   | `.claude/settings.local.json`                   |
| `projectSettings` | `.claude/settings.json`                         |
| `userSettings`    | `~/.claude/settings.json`                       |

A hook can echo one of the `permission_suggestions` it received as its own `updatedPermissions` output, which is equivalent to the user selecting that "always allow" option in the dialog.

### PostToolUse

Runs immediately after a tool completes successfully.

Matches on tool name, same values as PreToolUse.

#### PostToolUse input

`PostToolUse` hooks fire after a tool has already executed successfully. The input includes both `tool_input`, the arguments sent to the tool, and `tool_response`, the result it returned. The exact schema for both depends on the tool.

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/file.txt",
    "content": "file content"
  },
  "tool_response": {
    "filePath": "/path/to/file.txt",
    "success": true
  },
  "tool_use_id": "toolu_01ABC123..."
}
```

#### PostToolUse decision control

`PostToolUse` hooks can provide feedback to Claude after tool execution. In addition to the [JSON output fields](#json-output) available to all hooks, your hook script can return these event-specific fields:

| Field                  | Description                                                                                |
| :--------------------- | :----------------------------------------------------------------------------------------- |
| `decision`             | `"block"` prompts Claude with the `reason`. Omit to allow the action to proceed            |
| `reason`               | Explanation shown to Claude when `decision` is `"block"`                                   |
| `additionalContext`    | Additional context for Claude to consider                                                  |
| `updatedMCPToolOutput` | For [MCP tools](#match-mcp-tools) only: replaces the tool's output with the provided value |

```json  theme={null}
{
  "decision": "block",
  "reason": "Explanation for decision",
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "Additional information for Claude"
  }
}
```

### PostToolUseFailure

Runs when a tool execution fails. This event fires for tool calls that throw errors or return failure results. Use this to log failures, send alerts, or provide corrective feedback to Claude.

Matches on tool name, same values as PreToolUse.

#### PostToolUseFailure input

PostToolUseFailure hooks receive the same `tool_name` and `tool_input` fields as PostToolUse, along with error information as top-level fields:

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "PostToolUseFailure",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test",
    "description": "Run test suite"
  },
  "tool_use_id": "toolu_01ABC123...",
  "error": "Command exited with non-zero status code 1",
  "is_interrupt": false
}
```

| Field          | Description                                                                     |
| :------------- | :------------------------------------------------------------------------------ |
| `error`        | String describing what went wrong                                               |
| `is_interrupt` | Optional boolean indicating whether the failure was caused by user interruption |

#### PostToolUseFailure decision control

`PostToolUseFailure` hooks can provide context to Claude after a tool failure. In addition to the [JSON output fields](#json-output) available to all hooks, your hook script can return these event-specific fields:

| Field               | Description                                                   |
| :------------------ | :------------------------------------------------------------ |
| `additionalContext` | Additional context for Claude to consider alongside the error |

```json  theme={null}
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUseFailure",
    "additionalContext": "Additional information about the failure for Claude"
  }
}
```

### Notification

Runs when Claude Code sends notifications. Matches on notification type: `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_dialog`. Omit the matcher to run hooks for all notification types.

Use separate matchers to run different handlers depending on the notification type. This configuration triggers a permission-specific alert script when Claude needs permission approval and a different notification when Claude has been idle:

```json  theme={null}
{
  "hooks": {
    "Notification": [
      {
        "matcher": "permission_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/permission-alert.sh"
          }
        ]
      },
      {
        "matcher": "idle_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/idle-notification.sh"
          }
        ]
      }
    ]
  }
}
```

#### Notification input

In addition to the [common input fields](#common-input-fields), Notification hooks receive `message` with the notification text, an optional `title`, and `notification_type` indicating which type fired.

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "Notification",
  "message": "Claude needs your permission to use Bash",
  "title": "Permission needed",
  "notification_type": "permission_prompt"
}
```

Notification hooks cannot block or modify notifications. In addition to the [JSON output fields](#json-output) available to all hooks, you can return `additionalContext` to add context to the conversation:

| Field               | Description                      |
| :------------------ | :------------------------------- |
| `additionalContext` | String added to Claude's context |

### SubagentStart

Runs when a Claude Code subagent is spawned via the Agent tool. Supports matchers to filter by agent type name (built-in agents like `Bash`, `Explore`, `Plan`, or custom agent names from `.claude/agents/`).

#### SubagentStart input

In addition to the [common input fields](#common-input-fields), SubagentStart hooks receive `agent_id` with the unique identifier for the subagent and `agent_type` with the agent name (built-in agents like `"Bash"`, `"Explore"`, `"Plan"`, or custom agent names).

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "SubagentStart",
  "agent_id": "agent-abc123",
  "agent_type": "Explore"
}
```

SubagentStart hooks cannot block subagent creation, but they can inject context into the subagent. In addition to the [JSON output fields](#json-output) available to all hooks, you can return:

| Field               | Description                            |
| :------------------ | :------------------------------------- |
| `additionalContext` | String added to the subagent's context |

```json  theme={null}
{
  "hookSpecificOutput": {
    "hookEventName": "SubagentStart",
    "additionalContext": "Follow security guidelines for this task"
  }
}
```

### SubagentStop

Runs when a Claude Code subagent has finished responding. Matches on agent type, same values as SubagentStart.

#### SubagentStop input

In addition to the [common input fields](#common-input-fields), SubagentStop hooks receive `stop_hook_active`, `agent_id`, `agent_type`, `agent_transcript_path`, and `last_assistant_message`. The `agent_type` field is the value used for matcher filtering. The `transcript_path` is the main session's transcript, while `agent_transcript_path` is the subagent's own transcript stored in a nested `subagents/` folder. The `last_assistant_message` field contains the text content of the subagent's final response, so hooks can access it without parsing the transcript file.

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../abc123.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "SubagentStop",
  "stop_hook_active": false,
  "agent_id": "def456",
  "agent_type": "Explore",
  "agent_transcript_path": "~/.claude/projects/.../abc123/subagents/agent-def456.jsonl",
  "last_assistant_message": "Analysis complete. Found 3 potential issues..."
}
```

SubagentStop hooks use the same decision control format as [Stop hooks](#stop-decision-control).

### TaskCreated

Runs when a task is being created via the `TaskCreate` tool. Use this to enforce naming conventions, require task descriptions, or prevent certain tasks from being created.

When a `TaskCreated` hook exits with code 2, the task is not created and the stderr message is fed back to the model as feedback. To stop the teammate entirely instead of re-running it, return JSON with `{"continue": false, "stopReason": "..."}`. TaskCreated hooks do not support matchers and fire on every occurrence.

#### TaskCreated input

In addition to the [common input fields](#common-input-fields), TaskCreated hooks receive `task_id`, `task_subject`, and optionally `task_description`, `teammate_name`, and `team_name`.

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "TaskCreated",
  "task_id": "task-001",
  "task_subject": "Implement user authentication",
  "task_description": "Add login and signup endpoints",
  "teammate_name": "implementer",
  "team_name": "my-project"
}
```

| Field              | Description                                           |
| :----------------- | :---------------------------------------------------- |
| `task_id`          | Identifier of the task being created                  |
| `task_subject`     | Title of the task                                     |
| `task_description` | Detailed description of the task. May be absent       |
| `teammate_name`    | Name of the teammate creating the task. May be absent |
| `team_name`        | Name of the team. May be absent                       |

#### TaskCreated decision control

TaskCreated hooks support two ways to control task creation:

* **Exit code 2**: the task is not created and the stderr message is fed back to the model as feedback.
* **JSON `{"continue": false, "stopReason": "..."}`**: stops the teammate entirely, matching `Stop` hook behavior. The `stopReason` is shown to the user.

This example blocks tasks whose subjects don't follow the required format:

```bash  theme={null}
#!/bin/bash
INPUT=$(cat)
TASK_SUBJECT=$(echo "$INPUT" | jq -r '.task_subject')

if [[ ! "$TASK_SUBJECT" =~ ^\[TICKET-[0-9]+\] ]]; then
  echo "Task subject must start with a ticket number, e.g. '[TICKET-123] Add feature'" >&2
  exit 2
fi

exit 0
```

### TaskCompleted

Runs when a task is being marked as completed. This fires in two situations: when any agent explicitly marks a task as completed through the TaskUpdate tool, or when an [agent team](/en/agent-teams) teammate finishes its turn with in-progress tasks. Use this to enforce completion criteria like passing tests or lint checks before a task can close.

When a `TaskCompleted` hook exits with code 2, the task is not marked as completed and the stderr message is fed back to the model as feedback. To stop the teammate entirely instead of re-running it, return JSON with `{"continue": false, "stopReason": "..."}`. TaskCompleted hooks do not support matchers and fire on every occurrence.

#### TaskCompleted input

In addition to the [common input fields](#common-input-fields), TaskCompleted hooks receive `task_id`, `task_subject`, and optionally `task_description`, `teammate_name`, and `team_name`.

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "TaskCompleted",
  "task_id": "task-001",
  "task_subject": "Implement user authentication",
  "task_description": "Add login and signup endpoints",
  "teammate_name": "implementer",
  "team_name": "my-project"
}
```

| Field              | Description                                             |
| :----------------- | :------------------------------------------------------ |
| `task_id`          | Identifier of the task being completed                  |
| `task_subject`     | Title of the task                                       |
| `task_description` | Detailed description of the task. May be absent         |
| `teammate_name`    | Name of the teammate completing the task. May be absent |
| `team_name`        | Name of the team. May be absent                         |

#### TaskCompleted decision control

TaskCompleted hooks support two ways to control task completion:

* **Exit code 2**: the task is not marked as completed and the stderr message is fed back to the model as feedback.
* **JSON `{"continue": false, "stopReason": "..."}`**: stops the teammate entirely, matching `Stop` hook behavior. The `stopReason` is shown to the user.

This example runs tests and blocks task completion if they fail:

```bash  theme={null}
#!/bin/bash
INPUT=$(cat)
TASK_SUBJECT=$(echo "$INPUT" | jq -r '.task_subject')

# Run the test suite
if ! npm test 2>&1; then
  echo "Tests not passing. Fix failing tests before completing: $TASK_SUBJECT" >&2
  exit 2
fi

exit 0
```

### Stop

Runs when the main Claude Code agent has finished responding. Does not run if
the stoppage occurred due to a user interrupt. API errors fire
[StopFailure](#stopfailure) instead.

#### Stop input

In addition to the [common input fields](#common-input-fields), Stop hooks receive `stop_hook_active` and `last_assistant_message`. The `stop_hook_active` field is `true` when Claude Code is already continuing as a result of a stop hook. Check this value or process the transcript to prevent Claude Code from running indefinitely. The `last_assistant_message` field contains the text content of Claude's final response, so hooks can access it without parsing the transcript file.

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "Stop",
  "stop_hook_active": true,
  "last_assistant_message": "I've completed the refactoring. Here's a summary..."
}
```

#### Stop decision control

`Stop` and `SubagentStop` hooks can control whether Claude continues. In addition to the [JSON output fields](#json-output) available to all hooks, your hook script can return these event-specific fields:

| Field      | Description                                                                |
| :--------- | :------------------------------------------------------------------------- |
| `decision` | `"block"` prevents Claude from stopping. Omit to allow Claude to stop      |
| `reason`   | Required when `decision` is `"block"`. Tells Claude why it should continue |

```json  theme={null}
{
  "decision": "block",
  "reason": "Must be provided when Claude is blocked from stopping"
}
```

### StopFailure

Runs instead of [Stop](#stop) when the turn ends due to an API error. Output and exit code are ignored. Use this to log failures, send alerts, or take recovery actions when Claude cannot complete a response due to rate limits, authentication problems, or other API errors.

#### StopFailure input

In addition to the [common input fields](#common-input-fields), StopFailure hooks receive `error`, optional `error_details`, and optional `last_assistant_message`. The `error` field identifies the error type and is used for matcher filtering.

| Field                    | Description                                                                                                                                                                                                                                      |
| :----------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `error`                  | Error type: `rate_limit`, `authentication_failed`, `billing_error`, `invalid_request`, `server_error`, `max_output_tokens`, or `unknown`                                                                                                         |
| `error_details`          | Additional details about the error, when available                                                                                                                                                                                               |
| `last_assistant_message` | The rendered error text shown in the conversation. Unlike `Stop` and `SubagentStop`, where this field holds Claude's conversational output, for `StopFailure` it contains the API error string itself, such as `"API Error: Rate limit reached"` |

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "StopFailure",
  "error": "rate_limit",
  "error_details": "429 Too Many Requests",
  "last_assistant_message": "API Error: Rate limit reached"
}
```

StopFailure hooks have no decision control. They run for notification and logging purposes only.

### TeammateIdle

Runs when an [agent team](/en/agent-teams) teammate is about to go idle after finishing its turn. Use this to enforce quality gates before a teammate stops working, such as requiring passing lint checks or verifying that output files exist.

When a `TeammateIdle` hook exits with code 2, the teammate receives the stderr message as feedback and continues working instead of going idle. To stop the teammate entirely instead of re-running it, return JSON with `{"continue": false, "stopReason": "..."}`. TeammateIdle hooks do not support matchers and fire on every occurrence.

#### TeammateIdle input

In addition to the [common input fields](#common-input-fields), TeammateIdle hooks receive `teammate_name` and `team_name`.

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "TeammateIdle",
  "teammate_name": "researcher",
  "team_name": "my-project"
}
```

| Field           | Description                                   |
| :-------------- | :-------------------------------------------- |
| `teammate_name` | Name of the teammate that is about to go idle |
| `team_name`     | Name of the team                              |

#### TeammateIdle decision control

TeammateIdle hooks support two ways to control teammate behavior:

* **Exit code 2**: the teammate receives the stderr message as feedback and continues working instead of going idle.
* **JSON `{"continue": false, "stopReason": "..."}`**: stops the teammate entirely, matching `Stop` hook behavior. The `stopReason` is shown to the user.

This example checks that a build artifact exists before allowing a teammate to go idle:

```bash  theme={null}
#!/bin/bash

if [ ! -f "./dist/output.js" ]; then
  echo "Build artifact missing. Run the build before stopping." >&2
  exit 2
fi

exit 0
```

### ConfigChange

Runs when a configuration file changes during a session. Use this to audit settings changes, enforce security policies, or block unauthorized modifications to configuration files.

ConfigChange hooks fire for changes to settings files, managed policy settings, and skill files. The `source` field in the input tells you which type of configuration changed, and the optional `file_path` field provides the path to the changed file.

The matcher filters on the configuration source:

| Matcher            | When it fires                             |
| :----------------- | :---------------------------------------- |
| `user_settings`    | `~/.claude/settings.json` changes         |
| `project_settings` | `.claude/settings.json` changes           |
| `local_settings`   | `.claude/settings.local.json` changes     |
| `policy_settings`  | Managed policy settings change            |
| `skills`           | A skill file in `.claude/skills/` changes |

This example logs all configuration changes for security auditing:

```json  theme={null}
{
  "hooks": {
    "ConfigChange": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/audit-config-change.sh"
          }
        ]
      }
    ]
  }
}
```

#### ConfigChange input

In addition to the [common input fields](#common-input-fields), ConfigChange hooks receive `source` and optionally `file_path`. The `source` field indicates which configuration type changed, and `file_path` provides the path to the specific file that was modified.

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "ConfigChange",
  "source": "project_settings",
  "file_path": "/Users/.../my-project/.claude/settings.json"
}
```

#### ConfigChange decision control

ConfigChange hooks can block configuration changes from taking effect. Use exit code 2 or a JSON `decision` to prevent the change. When blocked, the new settings are not applied to the running session.

| Field      | Description                                                                              |
| :--------- | :--------------------------------------------------------------------------------------- |
| `decision` | `"block"` prevents the configuration change from being applied. Omit to allow the change |
| `reason`   | Explanation shown to the user when `decision` is `"block"`                               |

```json  theme={null}
{
  "decision": "block",
  "reason": "Configuration changes to project settings require admin approval"
}
```

`policy_settings` changes cannot be blocked. Hooks still fire for `policy_settings` sources, so you can use them for audit logging, but any blocking decision is ignored. This ensures enterprise-managed settings always take effect.

### CwdChanged

Runs when the working directory changes during a session, for example when Claude executes a `cd` command. Use this to react to directory changes: reload environment variables, activate project-specific toolchains, or run setup scripts automatically. Pairs with [FileChanged](#filechanged) for tools like [direnv](https://direnv.net/) that manage per-directory environment.

CwdChanged hooks have access to `CLAUDE_ENV_FILE`. Variables written to that file persist into subsequent Bash commands for the session, just as in [SessionStart hooks](#persist-environment-variables). Only `type: "command"` hooks are supported.

CwdChanged does not support matchers and fires on every directory change.

#### CwdChanged input

In addition to the [common input fields](#common-input-fields), CwdChanged hooks receive `old_cwd` and `new_cwd`.

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../transcript.jsonl",
  "cwd": "/Users/my-project/src",
  "hook_event_name": "CwdChanged",
  "old_cwd": "/Users/my-project",
  "new_cwd": "/Users/my-project/src"
}
```

#### CwdChanged output

In addition to the [JSON output fields](#json-output) available to all hooks, CwdChanged hooks can return `watchPaths` to dynamically set which file paths [FileChanged](#filechanged) watches:

| Field        | Description                                                                                                                                                                                                                     |
| :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `watchPaths` | Array of absolute paths. Replaces the current dynamic watch list (paths from your `matcher` configuration are always watched). Returning an empty array clears the dynamic list, which is typical when entering a new directory |

CwdChanged hooks have no decision control. They cannot block the directory change.

### FileChanged

Runs when a watched file changes on disk. The `matcher` field in your hook configuration controls which filenames to watch: it is a pipe-separated list of basenames (filenames without directory paths, for example `".envrc|.env"`). The same `matcher` value is also used to filter which hooks run when a file changes, matching against the basename of the changed file. Useful for reloading environment variables when project configuration files are modified.

FileChanged hooks have access to `CLAUDE_ENV_FILE`. Variables written to that file persist into subsequent Bash commands for the session, just as in [SessionStart hooks](#persist-environment-variables). Only `type: "command"` hooks are supported.

#### FileChanged input

In addition to the [common input fields](#common-input-fields), FileChanged hooks receive `file_path` and `event`.

| Field       | Description                                                                                     |
| :---------- | :---------------------------------------------------------------------------------------------- |
| `file_path` | Absolute path to the file that changed                                                          |
| `event`     | What happened: `"change"` (file modified), `"add"` (file created), or `"unlink"` (file deleted) |

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../transcript.jsonl",
  "cwd": "/Users/my-project",
  "hook_event_name": "FileChanged",
  "file_path": "/Users/my-project/.envrc",
  "event": "change"
}
```

#### FileChanged output

In addition to the [JSON output fields](#json-output) available to all hooks, FileChanged hooks can return `watchPaths` to dynamically update which file paths are watched:

| Field        | Description                                                                                                                                                                                                                 |
| :----------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `watchPaths` | Array of absolute paths. Replaces the current dynamic watch list (paths from your `matcher` configuration are always watched). Use this when your hook script discovers additional files to watch based on the changed file |

FileChanged hooks have no decision control. They cannot block the file change from occurring.

### WorktreeCreate

When you run `claude --worktree` or a [subagent uses `isolation: "worktree"`](/en/sub-agents#choose-the-subagent-scope), Claude Code creates an isolated working copy using `git worktree`. If you configure a WorktreeCreate hook, it replaces the default git behavior, letting you use a different version control system like SVN, Perforce, or Mercurial.

Because the hook replaces the default behavior entirely, [`.worktreeinclude`](/en/common-workflows#copy-gitignored-files-to-worktrees) is not processed. If you need to copy local configuration files like `.env` into the new worktree, do it inside your hook script.

The hook must return the absolute path to the created worktree directory. Claude Code uses this path as the working directory for the isolated session. Command hooks print it on stdout; HTTP hooks return it via `hookSpecificOutput.worktreePath`.

This example creates an SVN working copy and prints the path for Claude Code to use. Replace the repository URL with your own:

```json  theme={null}
{
  "hooks": {
    "WorktreeCreate": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'NAME=$(jq -r .name); DIR=\"$HOME/.claude/worktrees/$NAME\"; svn checkout https://svn.example.com/repo/trunk \"$DIR\" >&2 && echo \"$DIR\"'"
          }
        ]
      }
    ]
  }
}
```

The hook reads the worktree `name` from the JSON input on stdin, checks out a fresh copy into a new directory, and prints the directory path. The `echo` on the last line is what Claude Code reads as the worktree path. Redirect any other output to stderr so it doesn't interfere with the path.

#### WorktreeCreate input

In addition to the [common input fields](#common-input-fields), WorktreeCreate hooks receive the `name` field. This is a slug identifier for the new worktree, either specified by the user or auto-generated (for example, `bold-oak-a3f2`).

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "WorktreeCreate",
  "name": "feature-auth"
}
```

#### WorktreeCreate output

WorktreeCreate hooks do not use the standard allow/block decision model. Instead, the hook's success or failure determines the outcome. The hook must return the absolute path to the created worktree directory:

* **Command hooks** (`type: "command"`): print the path on stdout.
* **HTTP hooks** (`type: "http"`): return `{ "hookSpecificOutput": { "hookEventName": "WorktreeCreate", "worktreePath": "/absolute/path" } }` in the response body.

If the hook fails or produces no path, worktree creation fails with an error.

### WorktreeRemove

The cleanup counterpart to [WorktreeCreate](#worktreecreate). This hook fires when a worktree is being removed, either when you exit a `--worktree` session and choose to remove it, or when a subagent with `isolation: "worktree"` finishes. For git-based worktrees, Claude handles cleanup automatically with `git worktree remove`. If you configured a WorktreeCreate hook for a non-git version control system, pair it with a WorktreeRemove hook to handle cleanup. Without one, the worktree directory is left on disk.

Claude Code passes the path returned by WorktreeCreate as `worktree_path` in the hook input. This example reads that path and removes the directory:

```json  theme={null}
{
  "hooks": {
    "WorktreeRemove": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'jq -r .worktree_path | xargs rm -rf'"
          }
        ]
      }
    ]
  }
}
```

#### WorktreeRemove input

In addition to the [common input fields](#common-input-fields), WorktreeRemove hooks receive the `worktree_path` field, which is the absolute path to the worktree being removed.

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "WorktreeRemove",
  "worktree_path": "/Users/.../my-project/.claude/worktrees/feature-auth"
}
```

WorktreeRemove hooks have no decision control. They cannot block worktree removal but can perform cleanup tasks like removing version control state or archiving changes. Hook failures are logged in debug mode only.

### PreCompact

Runs before Claude Code is about to run a compact operation.

The matcher value indicates whether compaction was triggered manually or automatically:

| Matcher  | When it fires                                |
| :------- | :------------------------------------------- |
| `manual` | `/compact`                                   |
| `auto`   | Auto-compact when the context window is full |

#### PreCompact input

In addition to the [common input fields](#common-input-fields), PreCompact hooks receive `trigger` and `custom_instructions`. For `manual`, `custom_instructions` contains what the user passes into `/compact`. For `auto`, `custom_instructions` is empty.

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "PreCompact",
  "trigger": "manual",
  "custom_instructions": ""
}
```

### PostCompact

Runs after Claude Code completes a compact operation. Use this event to react to the new compacted state, for example to log the generated summary or update external state.

The same matcher values apply as for `PreCompact`:

| Matcher  | When it fires                                      |
| :------- | :------------------------------------------------- |
| `manual` | After `/compact`                                   |
| `auto`   | After auto-compact when the context window is full |

#### PostCompact input

In addition to the [common input fields](#common-input-fields), PostCompact hooks receive `trigger` and `compact_summary`. The `compact_summary` field contains the conversation summary generated by the compact operation.

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "PostCompact",
  "trigger": "manual",
  "compact_summary": "Summary of the compacted conversation..."
}
```

PostCompact hooks have no decision control. They cannot affect the compaction result but can perform follow-up tasks.

### SessionEnd

Runs when a Claude Code session ends. Useful for cleanup tasks, logging session
statistics, or saving session state. Supports matchers to filter by exit reason.

The `reason` field in the hook input indicates why the session ended:

| Reason                        | Description                                |
| :---------------------------- | :----------------------------------------- |
| `clear`                       | Session cleared with `/clear` command      |
| `resume`                      | Session switched via interactive `/resume` |
| `logout`                      | User logged out                            |
| `prompt_input_exit`           | User exited while prompt input was visible |
| `bypass_permissions_disabled` | Bypass permissions mode was disabled       |
| `other`                       | Other exit reasons                         |

#### SessionEnd input

In addition to the [common input fields](#common-input-fields), SessionEnd hooks receive a `reason` field indicating why the session ended. See the [reason table](#sessionend) above for all values.

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "SessionEnd",
  "reason": "other"
}
```

SessionEnd hooks have no decision control. They cannot block session termination but can perform cleanup tasks.

SessionEnd hooks have a default timeout of 1.5 seconds. This applies to session exit, `/clear`, and switching sessions via interactive `/resume`. If your hooks need more time, set the `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` environment variable to a higher value in milliseconds. Any per-hook `timeout` setting is also capped by this value.

```bash  theme={null}
CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS=5000 claude
```

### Elicitation

Runs when an MCP server requests user input mid-task. By default, Claude Code shows an interactive dialog for the user to respond. Hooks can intercept this request and respond programmatically, skipping the dialog entirely.

The matcher field matches against the MCP server name.

#### Elicitation input

In addition to the [common input fields](#common-input-fields), Elicitation hooks receive `mcp_server_name`, `message`, and optional `mode`, `url`, `elicitation_id`, and `requested_schema` fields.

For form-mode elicitation (the most common case):

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "Elicitation",
  "mcp_server_name": "my-mcp-server",
  "message": "Please provide your credentials",
  "mode": "form",
  "requested_schema": {
    "type": "object",
    "properties": {
      "username": { "type": "string", "title": "Username" }
    }
  }
}
```

For URL-mode elicitation (browser-based authentication):

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "Elicitation",
  "mcp_server_name": "my-mcp-server",
  "message": "Please authenticate",
  "mode": "url",
  "url": "https://auth.example.com/login"
}
```

#### Elicitation output

To respond programmatically without showing the dialog, return a JSON object with `hookSpecificOutput`:

```json  theme={null}
{> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Plugins reference

> Complete technical reference for Claude Code plugin system, including schemas, CLI commands, and component specifications.

<Tip>
  Looking to install plugins? See [Discover and install plugins](/en/discover-plugins). For creating plugins, see [Plugins](/en/plugins). For distributing plugins, see [Plugin marketplaces](/en/plugin-marketplaces).
</Tip>

This reference provides complete technical specifications for the Claude Code plugin system, including component schemas, CLI commands, and development tools.

A **plugin** is a self-contained directory of components that extends Claude Code with custom functionality. Plugin components include skills, agents, hooks, MCP servers, and LSP servers.

## Plugin components reference

### Skills

Plugins add skills to Claude Code, creating `/name` shortcuts that you or Claude can invoke.

**Location**: `skills/` or `commands/` directory in plugin root

**File format**: Skills are directories with `SKILL.md`; commands are simple markdown files

**Skill structure**:

```text  theme={null}
skills/
├── pdf-processor/
│   ├── SKILL.md
│   ├── reference.md (optional)
│   └── scripts/ (optional)
└── code-reviewer/
    └── SKILL.md
```

**Integration behavior**:

* Skills and commands are automatically discovered when the plugin is installed
* Claude can invoke them automatically based on task context
* Skills can include supporting files alongside SKILL.md

For complete details, see [Skills](/en/skills).

### Agents

Plugins can provide specialized subagents for specific tasks that Claude can invoke automatically when appropriate.

**Location**: `agents/` directory in plugin root

**File format**: Markdown files describing agent capabilities

**Agent structure**:

```markdown  theme={null}
---
name: agent-name
description: What this agent specializes in and when Claude should invoke it
model: sonnet
effort: medium
maxTurns: 20
disallowedTools: Write, Edit
---

Detailed system prompt for the agent describing its role, expertise, and behavior.
```

Plugin agents support `name`, `description`, `model`, `effort`, `maxTurns`, `tools`, `disallowedTools`, `skills`, `memory`, `background`, and `isolation` frontmatter fields. The only valid `isolation` value is `"worktree"`. For security reasons, `hooks`, `mcpServers`, and `permissionMode` are not supported for plugin-shipped agents.

**Integration points**:

* Agents appear in the `/agents` interface
* Claude can invoke agents automatically based on task context
* Agents can be invoked manually by users
* Plugin agents work alongside built-in Claude agents

For complete details, see [Subagents](/en/sub-agents).

### Hooks

Plugins can provide event handlers that respond to Claude Code events automatically.

**Location**: `hooks/hooks.json` in plugin root, or inline in plugin.json

**Format**: JSON configuration with event matchers and actions

**Hook configuration**:

```json  theme={null}
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/format-code.sh"
          }
        ]
      }
    ]
  }
}
```

Plugin hooks respond to the same lifecycle events as [user-defined hooks](/en/hooks):

| Event                | When it fires                                                                                                                                          |
| :------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SessionStart`       | When a session begins or resumes                                                                                                                       |
| `UserPromptSubmit`   | When you submit a prompt, before Claude processes it                                                                                                   |
| `PreToolUse`         | Before a tool call executes. Can block it                                                                                                              |
| `PermissionRequest`  | When a permission dialog appears                                                                                                                       |
| `PostToolUse`        | After a tool call succeeds                                                                                                                             |
| `PostToolUseFailure` | After a tool call fails                                                                                                                                |
| `Notification`       | When Claude Code sends a notification                                                                                                                  |
| `SubagentStart`      | When a subagent is spawned                                                                                                                             |
| `SubagentStop`       | When a subagent finishes                                                                                                                               |
| `TaskCreated`        | When a task is being created via `TaskCreate`                                                                                                          |
| `TaskCompleted`      | When a task is being marked as completed                                                                                                               |
| `Stop`               | When Claude finishes responding                                                                                                                        |
| `StopFailure`        | When the turn ends due to an API error. Output and exit code are ignored                                                                               |
| `TeammateIdle`       | When an [agent team](/en/agent-teams) teammate is about to go idle                                                                                     |
| `InstructionsLoaded` | When a CLAUDE.md or `.claude/rules/*.md` file is loaded into context. Fires at session start and when files are lazily loaded during a session         |
| `ConfigChange`       | When a configuration file changes during a session                                                                                                     |
| `CwdChanged`         | When the working directory changes, for example when Claude executes a `cd` command. Useful for reactive environment management with tools like direnv |
| `FileChanged`        | When a watched file changes on disk. The `matcher` field specifies which filenames to watch                                                            |
| `WorktreeCreate`     | When a worktree is being created via `--worktree` or `isolation: "worktree"`. Replaces default git behavior                                            |
| `WorktreeRemove`     | When a worktree is being removed, either at session exit or when a subagent finishes                                                                   |
| `PreCompact`         | Before context compaction                                                                                                                              |
| `PostCompact`        | After context compaction completes                                                                                                                     |
| `Elicitation`        | When an MCP server requests user input during a tool call                                                                                              |
| `ElicitationResult`  | After a user responds to an MCP elicitation, before the response is sent back to the server                                                            |
| `SessionEnd`         | When a session terminates                                                                                                                              |

**Hook types**:

* `command`: execute shell commands or scripts
* `http`: send the event JSON as a POST request to a URL
* `prompt`: evaluate a prompt with an LLM (uses `$ARGUMENTS` placeholder for context)
* `agent`: run an agentic verifier with tools for complex verification tasks

### MCP servers

Plugins can bundle Model Context Protocol (MCP) servers to connect Claude Code with external tools and services.

**Location**: `.mcp.json` in plugin root, or inline in plugin.json

**Format**: Standard MCP server configuration

**MCP server configuration**:

```json  theme={null}
{
  "mcpServers": {
    "plugin-database": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/db-server",
      "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"],
      "env": {
        "DB_PATH": "${CLAUDE_PLUGIN_ROOT}/data"
      }
    },
    "plugin-api-client": {
      "command": "npx",
      "args": ["@company/mcp-server", "--plugin-mode"],
      "cwd": "${CLAUDE_PLUGIN_ROOT}"
    }
  }
}
```

**Integration behavior**:

* Plugin MCP servers start automatically when the plugin is enabled
* Servers appear as standard MCP tools in Claude's toolkit
* Server capabilities integrate seamlessly with Claude's existing tools
* Plugin servers can be configured independently of user MCP servers

### LSP servers

<Tip>
  Looking to use LSP plugins? Install them from the official marketplace: search for "lsp" in the `/plugin` Discover tab. This section documents how to create LSP plugins for languages not covered by the official marketplace.
</Tip>

Plugins can provide [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) (LSP) servers to give Claude real-time code intelligence while working on your codebase.

LSP integration provides:

* **Instant diagnostics**: Claude sees errors and warnings immediately after each edit
* **Code navigation**: go to definition, find references, and hover information
* **Language awareness**: type information and documentation for code symbols

**Location**: `.lsp.json` in plugin root, or inline in `plugin.json`

**Format**: JSON configuration mapping language server names to their configurations

**`.lsp.json` file format**:

```json  theme={null}
{
  "go": {
    "command": "gopls",
    "args": ["serve"],
    "extensionToLanguage": {
      ".go": "go"
    }
  }
}
```

**Inline in `plugin.json`**:

```json  theme={null}
{
  "name": "my-plugin",
  "lspServers": {
    "go": {
      "command": "gopls",
      "args": ["serve"],
      "extensionToLanguage": {
        ".go": "go"
      }
    }
  }
}
```

**Required fields:**

| Field                 | Description                                  |
| :-------------------- | :------------------------------------------- |
| `command`             | The LSP binary to execute (must be in PATH)  |
| `extensionToLanguage` | Maps file extensions to language identifiers |

**Optional fields:**

| Field                   | Description                                               |
| :---------------------- | :-------------------------------------------------------- |
| `args`                  | Command-line arguments for the LSP server                 |
| `transport`             | Communication transport: `stdio` (default) or `socket`    |
| `env`                   | Environment variables to set when starting the server     |
| `initializationOptions` | Options passed to the server during initialization        |
| `settings`              | Settings passed via `workspace/didChangeConfiguration`    |
| `workspaceFolder`       | Workspace folder path for the server                      |
| `startupTimeout`        | Max time to wait for server startup (milliseconds)        |
| `shutdownTimeout`       | Max time to wait for graceful shutdown (milliseconds)     |
| `restartOnCrash`        | Whether to automatically restart the server if it crashes |
| `maxRestarts`           | Maximum number of restart attempts before giving up       |

<Warning>
  **You must install the language server binary separately.** LSP plugins configure how Claude Code connects to a language server, but they don't include the server itself. If you see `Executable not found in $PATH` in the `/plugin` Errors tab, install the required binary for your language.
</Warning>

**Available LSP plugins:**

| Plugin           | Language server            | Install command                                                                            |
| :--------------- | :------------------------- | :----------------------------------------------------------------------------------------- |
| `pyright-lsp`    | Pyright (Python)           | `pip install pyright` or `npm install -g pyright`                                          |
| `typescript-lsp` | TypeScript Language Server | `npm install -g typescript-language-server typescript`                                     |
| `rust-lsp`       | rust-analyzer              | [See rust-analyzer installation](https://rust-analyzer.github.io/manual.html#installation) |

Install the language server first, then install the plugin from the marketplace.

***

## Plugin installation scopes

When you install a plugin, you choose a **scope** that determines where the plugin is available and who else can use it:

| Scope     | Settings file                                   | Use case                                                 |
| :-------- | :---------------------------------------------- | :------------------------------------------------------- |
| `user`    | `~/.claude/settings.json`                       | Personal plugins available across all projects (default) |
| `project` | `.claude/settings.json`                         | Team plugins shared via version control                  |
| `local`   | `.claude/settings.local.json`                   | Project-specific plugins, gitignored                     |
| `managed` | [Managed settings](/en/settings#settings-files) | Managed plugins (read-only, update only)                 |

Plugins use the same scope system as other Claude Code configurations. For installation instructions and scope flags, see [Install plugins](/en/discover-plugins#install-plugins). For a complete explanation of scopes, see [Configuration scopes](/en/settings#configuration-scopes).

***

## Plugin manifest schema

The `.claude-plugin/plugin.json` file defines your plugin's metadata and configuration. This section documents all supported fields and options.

The manifest is optional. If omitted, Claude Code auto-discovers components in [default locations](#file-locations-reference) and derives the plugin name from the directory name. Use a manifest when you need to provide metadata or custom component paths.

### Complete schema

```json  theme={null}
{
  "name": "plugin-name",
  "version": "1.2.0",
  "description": "Brief plugin description",
  "author": {
    "name": "Author Name",
    "email": "author@example.com",
    "url": "https://github.com/author"
  },
  "homepage": "https://docs.example.com/plugin",
  "repository": "https://github.com/author/plugin",
  "license": "MIT",
  "keywords": ["keyword1", "keyword2"],
  "commands": ["./custom/commands/special.md"],
  "agents": "./custom/agents/",
  "skills": "./custom/skills/",
  "hooks": "./config/hooks.json",
  "mcpServers": "./mcp-config.json",
  "outputStyles": "./styles/",
  "lspServers": "./.lsp.json"
}
```

### Required fields

If you include a manifest, `name` is the only required field.

| Field  | Type   | Description                               | Example              |
| :----- | :----- | :---------------------------------------- | :------------------- |
| `name` | string | Unique identifier (kebab-case, no spaces) | `"deployment-tools"` |

This name is used for namespacing components. For example, in the UI, the
agent `agent-creator` for the plugin with name `plugin-dev` will appear as
`plugin-dev:agent-creator`.

### Metadata fields

| Field         | Type   | Description                                                                                                                 | Example                                            |
| :------------ | :----- | :-------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------- |
| `version`     | string | Semantic version. If also set in the marketplace entry, `plugin.json` takes priority. You only need to set it in one place. | `"2.1.0"`                                          |
| `description` | string | Brief explanation of plugin purpose                                                                                         | `"Deployment automation tools"`                    |
| `author`      | object | Author information                                                                                                          | `{"name": "Dev Team", "email": "dev@company.com"}` |
| `homepage`    | string | Documentation URL                                                                                                           | `"https://docs.example.com"`                       |
| `repository`  | string | Source code URL                                                                                                             | `"https://github.com/user/plugin"`                 |
| `license`     | string | License identifier                                                                                                          | `"MIT"`, `"Apache-2.0"`                            |
| `keywords`    | array  | Discovery tags                                                                                                              | `["deployment", "ci-cd"]`                          |

### Component path fields

| Field          | Type                  | Description                                                                                                                                               | Example                                |
| :------------- | :-------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------- |
| `commands`     | string\|array         | Custom command files/directories (replaces default `commands/`)                                                                                           | `"./custom/cmd.md"` or `["./cmd1.md"]` |
| `agents`       | string\|array         | Custom agent files (replaces default `agents/`)                                                                                                           | `"./custom/agents/reviewer.md"`        |
| `skills`       | string\|array         | Custom skill directories (replaces default `skills/`)                                                                                                     | `"./custom/skills/"`                   |
| `hooks`        | string\|array\|object | Hook config paths or inline config                                                                                                                        | `"./my-extra-hooks.json"`              |
| `mcpServers`   | string\|array\|object | MCP config paths or inline config                                                                                                                         | `"./my-extra-mcp-config.json"`         |
| `outputStyles` | string\|array         | Custom output style files/directories (replaces default `output-styles/`)                                                                                 | `"./styles/"`                          |
| `lspServers`   | string\|array\|object | [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) configs for code intelligence (go to definition, find references, etc.) | `"./.lsp.json"`                        |
| `userConfig`   | object                | User-configurable values prompted at enable time. See [User configuration](#user-configuration)                                                           | See below                              |
| `channels`     | array                 | Channel declarations for message injection (Telegram, Slack, Discord style). See [Channels](#channels)                                                    | See below                              |

### User configuration

The `userConfig` field declares values that Claude Code prompts the user for when the plugin is enabled. Use this instead of requiring users to hand-edit `settings.json`.

```json  theme={null}
{
  "userConfig": {
    "api_endpoint": {
      "description": "Your team's API endpoint",
      "sensitive": false
    },
    "api_token": {
      "description": "API authentication token",
      "sensitive": true
    }
  }
}
```

Keys must be valid identifiers. Each value is available for substitution as `${user_config.KEY}` in MCP and LSP server configs, hook commands, and (for non-sensitive values only) skill and agent content. Values are also exported to plugin subprocesses as `CLAUDE_PLUGIN_OPTION_<KEY>` environment variables.

Non-sensitive values are stored in `settings.json` under `pluginConfigs[<plugin-id>].options`. Sensitive values go to the system keychain (or `~/.claude/.credentials.json` where the keychain is unavailable). Keychain storage is shared with OAuth tokens and has an approximately 2 KB total limit, so keep sensitive values small.

### Channels

The `channels` field lets a plugin declare one or more message channels that inject content into the conversation. Each channel binds to an MCP server that the plugin provides.

```json  theme={null}
{
  "channels": [
    {
      "server": "telegram",
      "userConfig": {
        "bot_token": { "description": "Telegram bot token", "sensitive": true },
        "owner_id": { "description": "Your Telegram user ID", "sensitive": false }
      }
    }
  ]
}
```

The `server` field is required and must match a key in the plugin's `mcpServers`. The optional per-channel `userConfig` uses the same schema as the top-level field, letting the plugin prompt for bot tokens or owner IDs when the plugin is enabled.

### Path behavior rules

For `commands`, `agents`, `skills`, and `outputStyles`, custom paths replace the default directory. If the manifest specifies `commands`, the default `commands/` directory is not scanned. [Hooks](#hooks), [MCP servers](#mcp-servers), and [LSP servers](#lsp-servers) have different semantics for handling multiple sources.

* All paths must be relative to the plugin root and start with `./`
* Components from custom paths use the same naming and namespacing rules
* Multiple paths can be specified as arrays
* To keep the default directory and add more paths for commands, agents, skills, or output styles, include the default in your array: `"commands": ["./commands/", "./extras/deploy.md"]`

**Path examples**:

```json  theme={null}
{
  "commands": [
    "./specialized/deploy.md",
    "./utilities/batch-process.md"
  ],
  "agents": [
    "./custom-agents/reviewer.md",
    "./custom-agents/tester.md"
  ]
}
```

### Environment variables

Claude Code provides two variables for referencing plugin paths. Both are substituted inline anywhere they appear in skill content, agent content, hook commands, and MCP or LSP server configs. Both are also exported as environment variables to hook processes and MCP or LSP server subprocesses.

**`${CLAUDE_PLUGIN_ROOT}`**: the absolute path to your plugin's installation directory. Use this to reference scripts, binaries, and config files bundled with the plugin. This path changes when the plugin updates, so files you write here do not survive an update.

**`${CLAUDE_PLUGIN_DATA}`**: a persistent directory for plugin state that survives updates. Use this for installed dependencies such as `node_modules` or Python virtual environments, generated code, caches, and any other files that should persist across plugin versions. The directory is created automatically the first time this variable is referenced.

```json  theme={null}
{
  "hooks": {
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/process.sh"
          }
        ]
      }
    ]
  }
}
```

#### Persistent data directory

The `${CLAUDE_PLUGIN_DATA}` directory resolves to `~/.claude/plugins/data/{id}/`, where `{id}` is the plugin identifier with characters outside `a-z`, `A-Z`, `0-9`, `_`, and `-` replaced by `-`. For a plugin installed as `formatter@my-marketplace`, the directory is `~/.claude/plugins/data/formatter-my-marketplace/`.

A common use is installing language dependencies once and reusing them across sessions and plugin updates. Because the data directory outlives any single plugin version, a check for directory existence alone cannot detect when an update changes the plugin's dependency manifest. The recommended pattern compares the bundled manifest against a copy in the data directory and reinstalls when they differ.

This `SessionStart` hook installs `node_modules` on the first run and again whenever a plugin update includes a changed `package.json`:

```json  theme={null}
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "diff -q \"${CLAUDE_PLUGIN_ROOT}/package.json\" \"${CLAUDE_PLUGIN_DATA}/package.json\" >/dev/null 2>&1 || (cd \"${CLAUDE_PLUGIN_DATA}\" && cp \"${CLAUDE_PLUGIN_ROOT}/package.json\" . && npm install) || rm -f \"${CLAUDE_PLUGIN_DATA}/package.json\""
          }
        ]
      }
    ]
  }
}
```

The `diff` exits nonzero when the stored copy is missing or differs from the bundled one, covering both first run and dependency-changing updates. If `npm install` fails, the trailing `rm` removes the copied manifest so the next session retries.

Scripts bundled in `${CLAUDE_PLUGIN_ROOT}` can then run against the persisted `node_modules`:

```json  theme={null}
{
  "mcpServers": {
    "routines": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/server.js"],
      "env": {
        "NODE_PATH": "${CLAUDE_PLUGIN_DATA}/node_modules"
      }
    }
  }
}
```

The data directory is deleted automatically when you uninstall the plugin from the last scope where it is installed. The `/plugin` interface shows the directory size and prompts before deleting. The CLI deletes by default; pass [`--keep-data`](#plugin-uninstall) to preserve it.

***

## Plugin caching and file resolution

Plugins are specified in one of two ways:

* Through `claude --plugin-dir`, for the duration of a session.
* Through a marketplace, installed for future sessions.

For security and verification purposes, Claude Code copies *marketplace* plugins to the user's local **plugin cache** (`~/.claude/plugins/cache`) rather than using them in-place. Understanding this behavior is important when developing plugins that reference external files.

### Path traversal limitations

Installed plugins cannot reference files outside their directory. Paths that traverse outside the plugin root (such as `../shared-utils`) will not work after installation because those external files are not copied to the cache.

### Working with external dependencies

If your plugin needs to access files outside its directory, you can create symbolic links to external files within your plugin directory. Symlinks are honored during the copy process:

```bash  theme={null}
# Inside your plugin directory
ln -s /path/to/shared-utils ./shared-utils
```

The symlinked content will be copied into the plugin cache. This provides flexibility while maintaining the security benefits of the caching system.

***

## Plugin directory structure

### Standard plugin layout

A complete plugin follows this structure:

```text  theme={null}
enterprise-plugin/
├── .claude-plugin/           # Metadata directory (optional)
│   └── plugin.json             # plugin manifest
├── commands/                 # Default command location
│   ├── status.md
│   └── logs.md
├── agents/                   # Default agent location
│   ├── security-reviewer.md
│   ├── performance-tester.md
│   └── compliance-checker.md
├── skills/                   # Agent Skills
│   ├── code-reviewer/
│   │   └── SKILL.md
│   └── pdf-processor/
│       ├── SKILL.md
│       └── scripts/
├── output-styles/            # Output style definitions
│   └── terse.md
├── hooks/                    # Hook configurations
│   ├── hooks.json           # Main hook config
│   └── security-hooks.json  # Additional hooks
├── settings.json            # Default settings for the plugin
├── .mcp.json                # MCP server definitions
├── .lsp.json                # LSP server configurations
├── scripts/                 # Hook and utility scripts
│   ├── security-scan.sh
│   ├── format-code.py
│   └── deploy.js
├── LICENSE                  # License file
└── CHANGELOG.md             # Version history
```

<Warning>
  The `.claude-plugin/` directory contains the `plugin.json` file. All other directories (commands/, agents/, skills/, output-styles/, hooks/) must be at the plugin root, not inside `.claude-plugin/`.
</Warning>

### File locations reference

| Component         | Default Location             | Purpose                                                                                                                   |
| :---------------- | :--------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| **Manifest**      | `.claude-plugin/plugin.json` | Plugin metadata and configuration (optional)                                                                              |
| **Commands**      | `commands/`                  | Skill Markdown files (legacy; use `skills/` for new skills)                                                               |
| **Agents**        | `agents/`                    | Subagent Markdown files                                                                                                   |
| **Skills**        | `skills/`                    | Skills with `<name>/SKILL.md` structure                                                                                   |
| **Output styles** | `output-styles/`             | Output style definitions                                                                                                  |
| **Hooks**         | `hooks/hooks.json`           | Hook configuration                                                                                                        |
| **MCP servers**   | `.mcp.json`                  | MCP server definitions                                                                                                    |
| **LSP servers**   | `.lsp.json`                  | Language server configurations                                                                                            |
| **Settings**      | `settings.json`              | Default configuration applied when the plugin is enabled. Only [`agent`](/en/sub-agents) settings are currently supported |

***

## CLI commands reference

Claude Code provides CLI commands for non-interactive plugin management, useful for scripting and automation.

### plugin install

Install a plugin from available marketplaces.

```bash  theme={null}
claude plugin install <plugin> [options]
```

**Arguments:**

* `<plugin>`: Plugin name or `plugin-name@marketplace-name` for a specific marketplace

**Options:**

| Option                | Description                                       | Default |
| :-------------------- | :------------------------------------------------ | :------ |
| `-s, --scope <scope>` | Installation scope: `user`, `project`, or `local` | `user`  |
| `-h, --help`          | Display help for command                          |         |

Scope determines which settings file the installed plugin is added to. For example, --scope project writes to `enabledPlugins` in .claude/settings.json, making the plugin available to everyone who clones the project repository.

**Examples:**

```bash  theme={null}
# Install to user scope (default)
claude plugin install formatter@my-marketplace

# Install to project scope (shared with team)
claude plugin install formatter@my-marketplace --scope project

# Install to local scope (gitignored)
claude plugin install formatter@my-marketplace --scope local
```

### plugin uninstall

Remove an installed plugin.

```bash  theme={null}
claude plugin uninstall <plugin> [options]
```

**Arguments:**

* `<plugin>`: Plugin name or `plugin-name@marketplace-name`

**Options:**

| Option                | Description                                                                   | Default |
| :-------------------- | :---------------------------------------------------------------------------- | :------ |
| `-s, --scope <scope>` | Uninstall from scope: `user`, `project`, or `local`                           | `user`  |
| `--keep-data`         | Preserve the plugin's [persistent data directory](#persistent-data-directory) |         |
| `-h, --help`          | Display help for command                                                      |         |

**Aliases:** `remove`, `rm`

By default, uninstalling from the last remaining scope also deletes the plugin's `${CLAUDE_PLUGIN_DATA}` directory. Use `--keep-data` to preserve it, for example when reinstalling after testing a new version.

### plugin enable

Enable a disabled plugin.

```bash  theme={null}
claude plugin enable <plugin> [options]
```

**Arguments:**

* `<plugin>`: Plugin name or `plugin-name@marketplace-name`

**Options:**

| Option                | Description                                    | Default |
| :-------------------- | :--------------------------------------------- | :------ |
| `-s, --scope <scope>` | Scope to enable: `user`, `project`, or `local` | `user`  |
| `-h, --help`          | Display help for command                       |         |

### plugin disable

Disable a plugin without uninstalling it.

```bash  theme={null}
claude plugin disable <plugin> [options]
```

**Arguments:**

* `<plugin>`: Plugin name or `plugin-name@marketplace-name`

**Options:**

| Option                | Description                                     | Default |
| :-------------------- | :---------------------------------------------- | :------ |
| `-s, --scope <scope>` | Scope to disable: `user`, `project`, or `local` | `user`  |
| `-h, --help`          | Display help for command                        |         |

### plugin update

Update a plugin to the latest version.

```bash  theme={null}
claude plugin update <plugin> [options]
```

**Arguments:**

* `<plugin>`: Plugin name or `plugin-name@marketplace-name`

**Options:**

| Option                | Description                                               | Default |
| :-------------------- | :-------------------------------------------------------- | :------ |
| `-s, --scope <scope>` | Scope to update: `user`, `project`, `local`, or `managed` | `user`  |
| `-h, --help`          | Display help for command                                  |         |

***

## Debugging and development tools

### Debugging commands

Use `claude --debug` to see plugin loading details:

This shows:

* Which plugins are being loaded
* Any errors in plugin manifests
* Command, agent, and hook registration
* MCP server initialization

### Common issues

| Issue                               | Cause                           | Solution                                                                                                                                                        |
| :---------------------------------- | :------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plugin not loading                  | Invalid `plugin.json`           | Run `claude plugin validate` or `/plugin validate` to check `plugin.json`, skill/agent/command frontmatter, and `hooks/hooks.json` for syntax and schema errors |
| Commands not appearing              | Wrong directory structure       | Ensure `commands/` at root, not in `.claude-plugin/`                                                                                                            |
| Hooks not firing                    | Script not executable           | Run `chmod +x script.sh`                                                                                                                                        |
| MCP server fails                    | Missing `${CLAUDE_PLUGIN_ROOT}` | Use variable for all plugin paths                                                                                                                               |
| Path errors                         | Absolute paths used             | All paths must be relative and start with `./`                                                                                                                  |
| LSP `Executable not found in $PATH` | Language server not installed   | Install the binary (e.g., `npm install -g typescript-language-server typescript`)                                                                               |

### Example error messages

**Manifest validation errors**:

* `Invalid JSON syntax: Unexpected token } in JSON at position 142`: check for missing commas, extra commas, or unquoted strings
* `Plugin has an invalid manifest file at .claude-plugin/plugin.json. Validation errors: name: Required`: a required field is missing
* `Plugin has a corrupt manifest file at .claude-plugin/plugin.json. JSON parse error: ...`: JSON syntax error

**Plugin loading errors**:

* `Warning: No commands found in plugin my-plugin custom directory: ./cmds. Expected .md files or SKILL.md in subdirectories.`: command path exists but contains no valid command files
* `Plugin directory not found at path: ./plugins/my-plugin. Check that the marketplace entry has the correct path.`: the `source` path in marketplace.json points to a non-existent directory
* `Plugin my-plugin has conflicting manifests: both plugin.json and marketplace entry specify components.`: remove duplicate component definitions or remove `strict: false` in marketplace entry

### Hook troubleshooting

**Hook script not executing**:

1. Check the script is executable: `chmod +x ./scripts/your-script.sh`
2. Verify the shebang line: First line should be `#!/bin/bash` or `#!/usr/bin/env bash`
3. Check the path uses `${CLAUDE_PLUGIN_ROOT}`: `"command": "${CLAUDE_PLUGIN_ROOT}/scripts/your-script.sh"`
4. Test the script manually: `./scripts/your-script.sh`

**Hook not triggering on expected events**:

1. Verify the event name is correct (case-sensitive): `PostToolUse`, not `postToolUse`
2. Check the matcher pattern matches your tools: `"matcher": "Write|Edit"` for file operations
3. Confirm the hook type is valid: `command`, `http`, `prompt`, or `agent`

### MCP server troubleshooting

**Server not starting**:

1. Check the command exists and is executable
2. Verify all paths use `${CLAUDE_PLUGIN_ROOT}` variable
3. Check the MCP server logs: `claude --debug` shows initialization errors
4. Test the server manually outside of Claude Code

**Server tools not appearing**:

1. Ensure the server is properly configured in `.mcp.json` or `plugin.json`
2. Verify the server implements the MCP protocol correctly
3. Check for connection timeouts in debug output

### Directory structure mistakes

**Symptoms**: Plugin loads but components (commands, agents, hooks) are missing.

**Correct structure**: Components must be at the plugin root, not inside `.claude-plugin/`. Only `plugin.json` belongs in `.claude-plugin/`.

```text  theme={null}
my-plugin/
├── .claude-plugin/
│   └── plugin.json      ← Only manifest here
├── commands/            ← At root level
├── agents/              ← At root level
└── hooks/               ← At root level
```

If your components are inside `.claude-plugin/`, move them to the plugin root.

**Debug checklist**:

1. Run `claude --debug` and look for "loading plugin" messages
2. Check that each component directory is listed in the debug output
3. Verify file permissions allow reading the plugin files

***

## Distribution and versioning reference

### Version management

Follow semantic versioning for plugin releases:

```json  theme={null}
{
  "name": "my-plugin",
  "version": "2.1.0"
}
```

**Version format**: `MAJOR.MINOR.PATCH`

* **MAJOR**: Breaking changes (incompatible API changes)
* **MINOR**: New features (backward-compatible additions)
* **PATCH**: Bug fixes (backward-compatible fixes)

**Best practices**:

* Start at `1.0.0` for your first stable release
* Update the version in `plugin.json` before distributing changes
* Document changes in a `CHANGELOG.md` file
* Use pre-release versions like `2.0.0-beta.1` for testing

<Warning>
  Claude Code uses the version to determine whether to update your plugin. If you change your plugin's code but don't bump the version in `plugin.json`, your plugin's existing users won't see your changes due to caching.

  If your plugin is within a [marketplace](/en/plugin-marketplaces) directory, you can manage the version through `marketplace.json` instead and omit the `version` field from `plugin.json`.
</Warning>

***

## See also

* [Plugins](/en/plugins) - Tutorials and practical usage
* [Plugin marketplaces](/en/plugin-marketplaces) - Creating and managing marketplaces
* [Skills](/en/skills) - Skill development details
* [Subagents](/en/sub-agents) - Agent configuration and capabilities
* [Hooks](/en/hooks) - Event handling and automation
* [MCP](/en/mcp) - External tool integration
* [Settings](/en/settings) - Configuration options for plugins

  "hookSpecificOutput": {
    "hookEventName": "Elicitation",
    "action": "accept",
    "content": {
      "username": "alice"
    }
  }
}
```

| Field     | Values                        | Description                                                      |
| :-------- | :---------------------------- | :--------------------------------------------------------------- |
| `action`  | `accept`, `decline`, `cancel` | Whether to accept, decline, or cancel the request                |
| `content` | object                        | Form field values to submit. Only used when `action` is `accept` |

Exit code 2 denies the elicitation and shows stderr to the user.

### ElicitationResult

Runs after a user responds to an MCP elicitation. Hooks can observe, modify, or block the response before it is sent back to the MCP server.

The matcher field matches against the MCP server name.

#### ElicitationResult input

In addition to the [common input fields](#common-input-fields), ElicitationResult hooks receive `mcp_server_name`, `action`, and optional `mode`, `elicitation_id`, and `content` fields.

```json  theme={null}
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "ElicitationResult",
  "mcp_server_name": "my-mcp-server",
  "action": "accept",
  "content": { "username": "alice" },
  "mode": "form",
  "elicitation_id": "elicit-123"
}
```

#### ElicitationResult output

To override the user's response, return a JSON object with `hookSpecificOutput`:

```json  theme={null}
{
  "hookSpecificOutput": {
    "hookEventName": "ElicitationResult",
    "action": "decline",
    "content": {}
  } > ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Channels reference

> Build an MCP server that pushes webhooks, alerts, and chat messages into a Claude Code session. Reference for the channel contract: capability declaration, notification events, reply tools, sender gating, and permission relay.

<Note>
  Channels are in [research preview](/en/channels#research-preview) and require Claude Code v2.1.80 or later. They require claude.ai login. Console and API key authentication is not supported. Team and Enterprise organizations must [explicitly enable them](/en/channels#enterprise-controls).
</Note>

A channel is an MCP server that pushes events into a Claude Code session so Claude can react to things happening outside the terminal.

You can build a one-way or two-way channel. One-way channels forward alerts, webhooks, or monitoring events for Claude to act on. Two-way channels like chat bridges also [expose a reply tool](#expose-a-reply-tool) so Claude can send messages back. A channel with a trusted sender path can also opt in to [relay permission prompts](#relay-permission-prompts) so you can approve or deny tool use remotely.

This page covers:

* [Overview](#overview): how channels work
* [What you need](#what-you-need): requirements and general steps
* [Example: build a webhook receiver](#example-build-a-webhook-receiver): a minimal one-way walkthrough
* [Server options](#server-options): the constructor fields
* [Notification format](#notification-format): the event payload
* [Expose a reply tool](#expose-a-reply-tool): let Claude send messages back
* [Gate inbound messages](#gate-inbound-messages): sender checks to prevent prompt injection
* [Relay permission prompts](#relay-permission-prompts): forward tool approval prompts to remote channels

To use an existing channel instead of building one, see [Channels](/en/channels). Telegram, Discord, iMessage, and fakechat are included in the research preview.

## Overview

A channel is an [MCP](https://modelcontextprotocol.io) server that runs on the same machine as Claude Code. Claude Code spawns it as a subprocess and communicates over stdio. Your channel server is the bridge between external systems and the Claude Code session:

* **Chat platforms** (Telegram, Discord): your plugin runs locally and polls the platform's API for new messages. When someone DMs your bot, the plugin receives the message and forwards it to Claude. No URL to expose.
* **Webhooks** (CI, monitoring): your server listens on a local HTTP port. External systems POST to that port, and your server pushes the payload to Claude.

<img src="https://mintcdn.com/claude-code/zbUxPYi8065L3Y_P/en/images/channel-architecture.svg?fit=max&auto=format&n=zbUxPYi8065L3Y_P&q=85&s=fd6b6b949eab38264043d2a96285a57c" alt="Architecture diagram showing external systems connecting to your local channel server, which communicates with Claude Code over stdio" width="600" height="220" data-path="en/images/channel-architecture.svg" />

## What you need

The only hard requirement is the [`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk) package and a Node.js-compatible runtime. [Bun](https://bun.sh), [Node](https://nodejs.org), and [Deno](https://deno.com) all work. The pre-built plugins in the research preview use Bun, but your channel doesn't have to.

Your server needs to:

1. Declare the `claude/channel` capability so Claude Code registers a notification listener
2. Emit `notifications/claude/channel` events when something happens
3. Connect over [stdio transport](https://modelcontextprotocol.io/docs/concepts/transports#standard-io) (Claude Code spawns your server as a subprocess)

The [Server options](#server-options) and [Notification format](#notification-format) sections cover each of these in detail. See [Example: build a webhook receiver](#example-build-a-webhook-receiver) for a full walkthrough.

During the research preview, custom channels aren't on the [approved allowlist](/en/channels#supported-channels). Use `--dangerously-load-development-channels` to test locally. See [Test during the research preview](#test-during-the-research-preview) for details.

## Example: build a webhook receiver

This walkthrough builds a single-file server that listens for HTTP requests and forwards them into your Claude Code session. By the end, anything that can send an HTTP POST, like a CI pipeline, a monitoring alert, or a `curl` command, can push events to Claude.

This example uses [Bun](https://bun.sh) as the runtime for its built-in HTTP server and TypeScript support. You can use [Node](https://nodejs.org) or [Deno](https://deno.com) instead; the only requirement is the [MCP SDK](https://www.npmjs.com/package/@modelcontextprotocol/sdk).

<Steps>
  <Step title="Create the project">
    Create a new directory and install the MCP SDK:

    ```bash  theme={null}
    mkdir webhook-channel && cd webhook-channel
    bun add @modelcontextprotocol/sdk
    ```
  </Step>

  <Step title="Write the channel server">
    Create a file called `webhook.ts`. This is your entire channel server: it connects to Claude Code over stdio, and it listens for HTTP POSTs on port 8788. When a request arrives, it pushes the body to Claude as a channel event.

    ```ts title="webhook.ts" theme={null}
    #!/usr/bin/env bun
    import { Server } from '@modelcontextprotocol/sdk/server/index.js'
    import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

    // Create the MCP server and declare it as a channel
    const mcp = new Server(
      { name: 'webhook', version: '0.0.1' },
      {
        // this key is what makes it a channel — Claude Code registers a listener for it
        capabilities: { experimental: { 'claude/channel': {} } },
        // added to Claude's system prompt so it knows how to handle these events
        instructions: 'Events from the webhook channel arrive as <channel source="webhook" ...>. They are one-way: read them and act, no reply expected.',
      },
    )

    // Connect to Claude Code over stdio (Claude Code spawns this process)
    await mcp.connect(new StdioServerTransport())

    // Start an HTTP server that forwards every POST to Claude
    Bun.serve({
      port: 8788,  // any open port works
      // localhost-only: nothing outside this machine can POST
      hostname: '127.0.0.1',
      async fetch(req) {
        const body = await req.text()
        await mcp.notification({
          method: 'notifications/claude/channel',
          params: {
            content: body,  // becomes the body of the <channel> tag
            // each key becomes a tag attribute, e.g. <channel path="/" method="POST">
            meta: { path: new URL(req.url).pathname, method: req.method },
          },
        })
        return new Response('ok')
      },
    })
    ```

    The file does three things in order:

    * **Server configuration**: creates the MCP server with `claude/channel` in its capabilities, which is what tells Claude Code this is a channel. The [`instructions`](#server-options) string goes into Claude's system prompt: tell Claude what events to expect, whether to reply, and how to route replies if it should.
    * **Stdio connection**: connects to Claude Code over stdin/stdout. This is standard for any [MCP server](https://modelcontextprotocol.io/docs/concepts/transports#standard-io): Claude Code spawns it as a subprocess.
    * **HTTP listener**: starts a local web server on port 8788. Every POST body gets forwarded to Claude as a channel event via `mcp.notification()`. The `content` becomes the event body, and each `meta` entry becomes an attribute on the `<channel>` tag. The listener needs access to the `mcp` instance, so it runs in the same process. You could split it into separate modules for a larger project.
  </Step>

  <Step title="Register your server with Claude Code">
    Add the server to your MCP config so Claude Code knows how to start it. For a project-level `.mcp.json` in the same directory, use a relative path. For user-level config in `~/.claude.json`, use the full absolute path so the server can be found from any project:

    ```json title=".mcp.json" theme={null}
    {
      "mcpServers": {
        "webhook": { "command": "bun", "args": ["./webhook.ts"] }
      }
    }
    ```

    Claude Code reads your MCP config at startup and spawns each server as a subprocess.
  </Step>

  <Step title="Test it">
    During the research preview, custom channels aren't on the allowlist, so start Claude Code with the development flag:

    ```bash  theme={null}
    claude --dangerously-load-development-channels server:webhook
    ```

    When Claude Code starts, it reads your MCP config, spawns your `webhook.ts` as a subprocess, and the HTTP listener starts automatically on the port you configured (8788 in this example). You don't need to run the server yourself.

    If you see "blocked by org policy," your Team or Enterprise admin needs to [enable channels](/en/channels#enterprise-controls) first.

    In a separate terminal, simulate a webhook by sending an HTTP POST with a message to your server. This example sends a CI failure alert to port 8788 (or whichever port you configured):

    ```bash  theme={null}
    curl -X POST localhost:8788 -d "build failed on main: https://ci.example.com/run/1234"
    ```

    The payload arrives in your Claude Code session as a `<channel>` tag:

    ```text  theme={null}
    <channel source="webhook" path="/" method="POST">build failed on main: https://ci.example.com/run/1234</channel>
    ```

    In your Claude Code terminal, you'll see Claude receive the message and start responding: reading files, running commands, or whatever the message calls for. This is a one-way channel, so Claude acts in your session but doesn't send anything back through the webhook. To add replies, see [Expose a reply tool](#expose-a-reply-tool).

    If the event doesn't arrive, the diagnosis depends on what `curl` returned:

    * **`curl` succeeds but nothing reaches Claude**: run `/mcp` in your session to check the server's status. "Failed to connect" usually means a dependency or import error in your server file; check the debug log at `~/.claude/debug/<session-id>.txt` for the stderr trace.
    * **`curl` fails with "connection refused"**: the port is either not bound yet or a stale process from an earlier run is holding it. `lsof -i :<port>` shows what's listening; `kill` the stale process before restarting your session.
  </Step>
</Steps>

The [fakechat server](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/fakechat) extends this pattern with a web UI, file attachments, and a reply tool for two-way chat.

## Test during the research preview

During the research preview, every channel must be on the [approved allowlist](/en/channels#research-preview) to register. The development flag bypasses the allowlist for specific entries after a confirmation prompt. This example shows both entry types:

```bash  theme={null}
# Testing a plugin you're developing
claude --dangerously-load-development-channels plugin:yourplugin@yourmarketplace

# Testing a bare .mcp.json server (no plugin wrapper yet)
claude --dangerously-load-development-channels server:webhook
```

The bypass is per-entry. Combining this flag with `--channels` doesn't extend the bypass to the `--channels` entries. During the research preview, the approved allowlist is Anthropic-curated, so your channel stays on the development flag while you build and test.

<Note>
  This flag skips the allowlist only. The `channelsEnabled` organization policy still applies. Don't use it to run channels from untrusted sources.
</Note>

## Server options

A channel sets these options in the [`Server`](https://modelcontextprotocol.io/docs/concepts/servers) constructor. The `instructions` and `capabilities.tools` fields are [standard MCP](https://modelcontextprotocol.io/docs/concepts/servers); `capabilities.experimental['claude/channel']` and `capabilities.experimental['claude/channel/permission']` are the channel-specific additions:

| Field                                                    | Type     | Description                                                                                                                                                                                                                                                             |
| :------------------------------------------------------- | :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `capabilities.experimental['claude/channel']`            | `object` | Required. Always `{}`. Presence registers the notification listener.                                                                                                                                                                                                    |
| `capabilities.experimental['claude/channel/permission']` | `object` | Optional. Always `{}`. Declares that this channel can receive permission relay requests. When declared, Claude Code forwards tool approval prompts to your channel so you can approve or deny them remotely. See [Relay permission prompts](#relay-permission-prompts). |
| `capabilities.tools`                                     | `object` | Two-way only. Always `{}`. Standard MCP tool capability. See [Expose a reply tool](#expose-a-reply-tool).                                                                                                                                                               |
| `instructions`                                           | `string` | Recommended. Added to Claude's system prompt. Tell Claude what events to expect, what the `<channel>` tag attributes mean, whether to reply, and if so which tool to use and which attribute to pass back (like `chat_id`).                                             |

To create a one-way channel, omit `capabilities.tools`. This example shows a two-way setup with the channel capability, tools, and instructions set:

```ts  theme={null}
import { Server } from '@modelcontextprotocol/sdk/server/index.js'

const mcp = new Server(
  { name: 'your-channel', version: '0.0.1' },
  {
    capabilities: {
      experimental: { 'claude/channel': {} },  // registers the channel listener
      tools: {},  // omit for one-way channels
    },
    // added to Claude's system prompt so it knows how to handle your events
    instructions: 'Messages arrive as <channel source="your-channel" ...>. Reply with the reply tool.',
  },
)
```

To push an event, call `mcp.notification()` with method `notifications/claude/channel`. The params are in the next section.

## Notification format

Your server emits `notifications/claude/channel` with two params:

| Field     | Type                     | Description                                                                                                                                                                                                                                                           |
| :-------- | :----------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content` | `string`                 | The event body. Delivered as the body of the `<channel>` tag.                                                                                                                                                                                                         |
| `meta`    | `Record<string, string>` | Optional. Each entry becomes an attribute on the `<channel>` tag for routing context like chat ID, sender name, or alert severity. Keys must be identifiers: letters, digits, and underscores only. Keys containing hyphens or other characters are silently dropped. |

Your server pushes events by calling `mcp.notification()` on the `Server` instance. This example pushes a CI failure alert with two meta keys:

```ts  theme={null}
await mcp.notification({
  method: 'notifications/claude/channel',
  params: {
    content: 'build failed on main: https://ci.example.com/run/1234',
    meta: { severity: 'high', run_id: '1234' },
  },
})
```

The event arrives in Claude's context wrapped in a `<channel>` tag. The `source` attribute is set automatically from your server's configured name:

```text  theme={null}
<channel source="your-channel" severity="high" run_id="1234">
build failed on main: https://ci.example.com/run/1234
</channel>
```

## Expose a reply tool

If your channel is two-way, like a chat bridge rather than an alert forwarder, expose a standard [MCP tool](https://modelcontextprotocol.io/docs/concepts/tools) that Claude can call to send messages back. Nothing about the tool registration is channel-specific. A reply tool has three components:

1. A `tools: {}` entry in your `Server` constructor capabilities so Claude Code discovers the tool
2. Tool handlers that define the tool's schema and implement the send logic
3. An `instructions` string in your `Server` constructor that tells Claude when and how to call the tool

To add these to the [webhook receiver above](#example-build-a-webhook-receiver):

<Steps>
  <Step title="Enable tool discovery">
    In your `Server` constructor in `webhook.ts`, add `tools: {}` to the capabilities so Claude Code knows your server offers tools:

    ```ts  theme={null}
    capabilities: {
      experimental: { 'claude/channel': {} },
      tools: {},  // enables tool discovery
    },
    ```
  </Step>

  <Step title="Register the reply tool">
    Add the following to `webhook.ts`. The `import` goes at the top of the file with your other imports; the two handlers go between the `Server` constructor and `mcp.connect()`. This registers a `reply` tool that Claude can call with a `chat_id` and `text`:

    ```ts  theme={null}
    // Add this import at the top of webhook.ts
    import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'

    // Claude queries this at startup to discover what tools your server offers
    mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [{
        name: 'reply',
        description: 'Send a message back over this channel',
        // inputSchema tells Claude what arguments to pass
        inputSchema: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'The conversation to reply in' },
            text: { type: 'string', description: 'The message to send' },
          },
          required: ['chat_id', 'text'],
        },
      }],
    }))

    // Claude calls this when it wants to invoke a tool
    mcp.setRequestHandler(CallToolRequestSchema, async req => {
      if (req.params.name === 'reply') {
        const { chat_id, text } = req.params.arguments as { chat_id: string; text: string }
        // send() is your outbound: POST to your chat platform, or for local
        // testing the SSE broadcast shown in the full example below.
        send(`Reply to ${chat_id}: ${text}`)
        return { content: [{ type: 'text', text: 'sent' }] }
      }
      throw new Error(`unknown tool: ${req.params.name}`)
    })
    ```
  </Step>

  <Step title="Update the instructions">
    Update the `instructions` string in your `Server` constructor so Claude knows to route replies back through the tool. This example tells Claude to pass `chat_id` from the inbound tag:

    ```ts  theme={null}
    instructions: 'Messages arrive as <channel source="webhook" chat_id="...">. Reply with the reply tool, passing the chat_id from the tag.'
    ```
  </Step>
</Steps>

Here's the complete `webhook.ts` with two-way support. Outbound replies stream over `GET /events` using [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) (SSE), so `curl -N localhost:8788/events` can watch them live; inbound chat arrives on `POST /`:

```ts title="Full webhook.ts with reply tool" expandable theme={null}
#!/usr/bin/env bun
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'

// --- Outbound: write to any curl -N listeners on /events --------------------
// A real bridge would POST to your chat platform instead.
const listeners = new Set<(chunk: string) => void>()
function send(text: string) {
  const chunk = text.split('\n').map(l => `data: ${l}\n`).join('') + '\n'
  for (const emit of listeners) emit(chunk)
}

const mcp = new Server(
  { name: 'webhook', version: '0.0.1' },
  {
    capabilities: {
      experimental: { 'claude/channel': {} },
      tools: {},
    },
    instructions: 'Messages arrive as <channel source="webhook" chat_id="...">. Reply with the reply tool, passing the chat_id from the tag.',
  },
)

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'reply',
    description: 'Send a message back over this channel',
    inputSchema: {
      type: 'object',
      properties: {
        chat_id: { type: 'string', description: 'The conversation to reply in' },
        text: { type: 'string', description: 'The message to send' },
      },
      required: ['chat_id', 'text'],
    },
  }],
}))

mcp.setRequestHandler(CallToolRequestSchema, async req => {
  if (req.params.name === 'reply') {
    const { chat_id, text } = req.params.arguments as { chat_id: string; text: string }
    send(`Reply to ${chat_id}: ${text}`)
    return { content: [{ type: 'text', text: 'sent' }] }
  }
  throw new Error(`unknown tool: ${req.params.name}`)
})

await mcp.connect(new StdioServerTransport())

let nextId = 1
Bun.serve({
  port: 8788,
  hostname: '127.0.0.1',
  idleTimeout: 0,  // don't close idle SSE streams
  async fetch(req) {
    const url = new URL(req.url)

    // GET /events: SSE stream so curl -N can watch Claude's replies live
    if (req.method === 'GET' && url.pathname === '/events') {
      const stream = new ReadableStream({
        start(ctrl) {
          ctrl.enqueue(': connected\n\n')  // so curl shows something immediately
          const emit = (chunk: string) => ctrl.enqueue(chunk)
          listeners.add(emit)
          req.signal.addEventListener('abort', () => listeners.delete(emit))
        },
      })
      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      })
    }

    // POST: forward to Claude as a channel event
    const body = await req.text()
    const chat_id = String(nextId++)
    await mcp.notification({
      method: 'notifications/claude/channel',
      params: {
        content: body,
        meta: { chat_id, path: url.pathname, method: req.method },
      },
    })
    return new Response('ok')
  },
})
```

The [fakechat server](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/fakechat) shows a more complete example with file attachments and message editing.

## Gate inbound messages

An ungated channel is a prompt injection vector. Anyone who can reach your endpoint can put text in front of Claude. A channel listening to a chat platform or a public endpoint needs a real sender check before it emits anything.

Check the sender against an allowlist before calling `mcp.notification()`. This example drops any message from a sender not in the set:

```ts  theme={null}
const allowed = new Set(loadAllowlist())  // from your access.json or equivalent

// inside your message handler, before emitting:
if (!allowed.has(message.from.id)) {  // sender, not room
  return  // drop silently
}
await mcp.notification({ ... })
```

Gate on the sender's identity, not the chat or room identity: `message.from.id` in the example, not `message.chat.id`. In group chats, these differ, and gating on the room would let anyone in an allowlisted group inject messages into the session.

The [Telegram](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/telegram) and [Discord](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/discord) channels gate on a sender allowlist the same way. They bootstrap the list by pairing: the user DMs the bot, the bot replies with a pairing code, the user approves it in their Claude Code session, and their platform ID is added. See either implementation for the full pairing flow. The [iMessage](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/imessage) channel takes a different approach: it detects the user's own addresses from the Messages database at startup and lets them through automatically, with other senders added by handle.

## Relay permission prompts

<Note>
  Permission relay requires Claude Code v2.1.81 or later. Earlier versions ignore the `claude/channel/permission` capability.
</Note>

When Claude calls a tool that needs approval, the local terminal dialog opens and the session waits. A two-way channel can opt in to receive the same prompt in parallel and relay it to you on another device. Both stay live: you can answer in the terminal or on your phone, and Claude Code applies whichever answer arrives first and closes the other.

Relay covers tool-use approvals like `Bash`, `Write`, and `Edit`. Project trust and MCP server consent dialogs don't relay; those only appear in the local terminal.

### How relay works

When a permission prompt opens, the relay loop has four steps:

1. Claude Code generates a short request ID and notifies your server
2. Your server forwards the prompt and ID to your chat app
3. The remote user replies with a yes or no and that ID
4. Your inbound handler parses the reply into a verdict, and Claude Code applies it only if the ID matches an open request

The local terminal dialog stays open through all of this. If someone at the terminal answers before the remote verdict arrives, that answer is applied instead and the pending remote request is dropped.

<img src="https://mintcdn.com/claude-code/DsZvsJII1OmzIjIs/en/images/channel-permission-relay.svg?fit=max&auto=format&n=DsZvsJII1OmzIjIs&q=85&s=c1d75f6ee34c2757983e2cca899b90d1" alt="Sequence diagram: Claude Code sends a permission_request notification to the channel server, the server formats and sends the prompt to the chat app, the human replies with a verdict, and the server parses that reply into a permission notification back to Claude Code" width="600" height="230" data-path="en/images/channel-permission-relay.svg" />

### Permission request fields

The outbound notification from Claude Code is `notifications/claude/channel/permission_request`. Like the [channel notification](#notification-format), the transport is standard MCP but the method and schema are Claude Code extensions. The `params` object has four string fields your server formats into the outgoing prompt:

| Field           | Description                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `request_id`    | Five lowercase letters drawn from `a`-`z` without `l`, so it never reads as a `1` or `I` when typed on a phone. Include it in your outgoing prompt so it can be echoed in the reply. Claude Code only accepts a verdict that carries an ID it issued. The local terminal dialog doesn't display this ID, so your outbound handler is the only way to learn it. |
| `tool_name`     | Name of the tool Claude wants to use, for example `Bash` or `Write`.                                                                                                                                                                                                                                                                                           |
| `description`   | Human-readable summary of what this specific tool call does, the same text the local terminal dialog shows. For a Bash call this is Claude's description of the command, or the command itself if none was given.                                                                                                                                              |
| `input_preview` | The tool's arguments as a JSON string, truncated to 200 characters. For Bash this is the command; for Write it's the file path and a prefix of the content. Omit it from your prompt if you only have room for a one-line message. Your server decides what to show.                                                                                           |

The verdict your server sends back is `notifications/claude/channel/permission` with two fields: `request_id` echoing the ID above, and `behavior` set to `'allow'` or `'deny'`. Allow lets the tool call proceed; deny rejects it, the same as answering No in the local dialog. Neither verdict affects future calls.

### Add relay to a chat bridge

Adding permission relay to a two-way channel takes three components:

1. A `claude/channel/permission: {}` entry under `experimental` capabilities in your `Server` constructor so Claude Code knows to forward prompts
2. A notification handler for `notifications/claude/channel/permission_request` that formats the prompt and sends it out through your platform API
3. A check in your inbound message handler that recognizes `yes <id>` or `no <id>` and emits a `notifications/claude/channel/permission` verdict instead of forwarding the text to Claude

Only declare the capability if your channel [authenticates the sender](#gate-inbound-messages), because anyone who can reply through your channel can approve or deny tool use in your session.

To add these to a two-way chat bridge like the one assembled in [Expose a reply tool](#expose-a-reply-tool):

<Steps>
  <Step title="Declare the permission capability">
    In your `Server` constructor, add `claude/channel/permission: {}` alongside `claude/channel` under `experimental`:

    ```ts  theme={null}
    capabilities: {
      experimental: {
        'claude/channel': {},
        'claude/channel/permission': {},  // opt in to permission relay
      },
      tools: {},
    },
    ```
  </Step>

  <Step title="Handle the incoming request">
    Register a notification handler between your `Server` constructor and `mcp.connect()`. Claude Code calls it with the [four request fields](#permission-request-fields) when a permission dialog opens. Your handler formats the prompt for your platform and includes instructions for replying with the ID:

    ```ts  theme={null}
    import { z } from 'zod'

    // setNotificationHandler routes by z.literal on the method field,
    // so this schema is both the validator and the dispatch key
    const PermissionRequestSchema = z.object({
      method: z.literal('notifications/claude/channel/permission_request'),
      params: z.object({
        request_id: z.string(),     // five lowercase letters, include verbatim in your prompt
        tool_name: z.string(),      // e.g. "Bash", "Write"
        description: z.string(),    // human-readable summary of this call
        input_preview: z.string(),  // tool args as JSON, truncated to ~200 chars
      }),
    })

    mcp.setNotificationHandler(PermissionRequestSchema, async ({ params }) => {
      // send() is your outbound: POST to your chat platform, or for local
      // testing the SSE broadcast shown in the full example below.
      send(
        `Claude wants to run ${params.tool_name}: ${params.description}\n\n` +
        // the ID in the instruction is what your inbound handler parses in Step 3
        `Reply "yes ${params.request_id}" or "no ${params.request_id}"`,
      )
    })
    ```
  </Step>

  <Step title="Intercept the verdict in your inbound handler">
    Your inbound handler is the loop or callback that receives messages from your platform: the same place you [gate on sender](#gate-inbound-messages) and emit `notifications/claude/channel` to forward chat to Claude. Add a check before the chat-forwarding call that recognizes the verdict format and emits the permission notification instead.

    The regex matches the ID format Claude Code generates: five letters, never `l`. The `/i` flag tolerates phone autocorrect capitalizing the reply; lowercase the captured ID before sending it back.

    ```ts  theme={null}
    // matches "y abcde", "yes abcde", "n abcde", "no abcde"
    // [a-km-z] is the ID alphabet Claude Code uses (lowercase, skips 'l')
    // /i tolerates phone autocorrect; lowercase the capture before sending
    const PERMISSION_REPLY_RE = /^\s*(y|yes|n|no)\s+([a-km-z]{5})\s*$/i

    async function onInbound(message: PlatformMessage) {
      if (!allowed.has(message.from.id)) return  // gate on sender first

      const m = PERMISSION_REPLY_RE.exec(message.text)
      if (m) {
        // m[1] is the verdict word, m[2] is the request ID
        // emit the verdict notification back to Claude Code instead of chat
        await mcp.notification({
          method: 'notifications/claude/channel/permission',
          params: {
            request_id: m[2].toLowerCase(),  // normalize in case of autocorrect caps
            behavior: m[1].toLowerCase().startsWith('y') ? 'allow' : 'deny',
          },
        })
        return  // handled as verdict, don't also forward as chat
      }

      // didn't match verdict format: fall through to the normal chat path
      await mcp.notification({
        method: 'notifications/claude/channel',
        params: { content: message.text, meta: { chat_id: String(message.chat.id) } },
      })
    }
    ```
  </Step>
</Steps>

Claude Code also keeps the local terminal dialog open, so you can answer in either place, and the first answer to arrive is applied. A remote reply that doesn't exactly match the expected format fails in one of two ways, and in both cases the dialog stays open:

* **Different format**: your inbound handler's regex fails to match, so text like `approve it` or `yes` without an ID falls through as a normal message to Claude.
* **Right format, wrong ID**: your server emits a verdict, but Claude Code finds no open request with that ID and drops it silently.

### Full example

The assembled `webhook.ts` below combines all three extensions from this page: the reply tool, sender gating, and permission relay. If you're starting here, you'll also need the [project setup and `.mcp.json` entry](#example-build-a-webhook-receiver) from the initial walkthrough.

To make both directions testable from curl, the HTTP listener serves two paths:

* **`GET /events`**: holds an SSE stream open and pushes each outbound message as a `data:` line, so `curl -N` can watch Claude's replies and permission prompts arrive live.
* **`POST /`**: the inbound side, the same handler as earlier, now with the verdict-format check inserted before the chat-forward branch.

```ts title="Full webhook.ts with permission relay" expandable theme={null}
#!/usr/bin/env bun
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

// --- Outbound: write to any curl -N listeners on /events --------------------
// A real bridge would POST to your chat platform instead.
const listeners = new Set<(chunk: string) => void>()
function send(text: string) {
  const chunk = text.split('\n').map(l => `data: ${l}\n`).join('') + '\n'
  for (const emit of listeners) emit(chunk)
}

// Sender allowlist. For the local walkthrough we trust the single X-Sender
// header value "dev"; a real bridge would check the platform's user ID.
const allowed = new Set(['dev'])

const mcp = new Server(
  { name: 'webhook', version: '0.0.1' },
  {
    capabilities: {
      experimental: {
        'claude/channel': {},
        'claude/channel/permission': {},  // opt in to permission relay
      },
      tools: {},
    },
    instructions:
      'Messages arrive as <channel source="webhook" chat_id="...">. ' +
      'Reply with the reply tool, passing the chat_id from the tag.',
  },
)

// --- reply tool: Claude calls this to send a message back -------------------
mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'reply',
    description: 'Send a message back over this channel',
    inputSchema: {
      type: 'object',
      properties: {
        chat_id: { type: 'string', description: 'The conversation to reply in' },
        text: { type: 'string', description: 'The message to send' },
      },
      required: ['chat_id', 'text'],
    },
  }],
}))

mcp.setRequestHandler(CallToolRequestSchema, async req => {
  if (req.params.name === 'reply') {
    const { chat_id, text } = req.params.arguments as { chat_id: string; text: string }
    send(`Reply to ${chat_id}: ${text}`)
    return { content: [{ type: 'text', text: 'sent' }] }
  }
  throw new Error(`unknown tool: ${req.params.name}`)
})

// --- permission relay: Claude Code (not Claude) calls this when a dialog opens
const PermissionRequestSchema = z.object({
  method: z.literal('notifications/claude/channel/permission_request'),
  params: z.object({
    request_id: z.string(),
    tool_name: z.string(),
    description: z.string(),
    input_preview: z.string(),
  }),
})

mcp.setNotificationHandler(PermissionRequestSchema, async ({ params }) => {
  send(
    `Claude wants to run ${params.tool_name}: ${params.description}\n\n` +
    `Reply "yes ${params.request_id}" or "no ${params.request_id}"`,
  )
})

await mcp.connect(new StdioServerTransport())

// --- HTTP on :8788: GET /events streams outbound, POST routes inbound -------
const PERMISSION_REPLY_RE = /^\s*(y|yes|n|no)\s+([a-km-z]{5})\s*$/i
let nextId = 1

Bun.serve({
  port: 8788,
  hostname: '127.0.0.1',
  idleTimeout: 0,  // don't close idle SSE streams
  async fetch(req) {
    const url = new URL(req.url)

    // GET /events: SSE stream so curl -N can watch replies and prompts live
    if (req.method === 'GET' && url.pathname === '/events') {
      const stream = new ReadableStream({
        start(ctrl) {
          ctrl.enqueue(': connected\n\n')  // so curl shows something immediately
          const emit = (chunk: string) => ctrl.enqueue(chunk)
          listeners.add(emit)
          req.signal.addEventListener('abort', () => listeners.delete(emit))
        },
      })
      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      })
    }

    // everything else is inbound: gate on sender first
    const body = await req.text()
    const sender = req.headers.get('X-Sender') ?? ''
    if (!allowed.has(sender)) return new Response('forbidden', { status: 403 })

    // check for verdict format before treating as chat
    const m = PERMISSION_REPLY_RE.exec(body)
    if (m) {
      await mcp.notification({
        method: 'notifications/claude/channel/permission',
        params: {
          request_id: m[2].toLowerCase(),
          behavior: m[1].toLowerCase().startsWith('y') ? 'allow' : 'deny',
        },
      })
      return new Response('verdict recorded')
    }

    // normal chat: forward to Claude as a channel event
    const chat_id = String(nextId++)
    await mcp.notification({
      method: 'notifications/claude/channel',
      params: { content: body, meta: { chat_id, path: url.pathname } },
    })
    return new Response('ok')
  },
})
```

Test the verdict path in three terminals. The first is your Claude Code session, started with the [development flag](#test-during-the-research-preview) so it spawns `webhook.ts`:

```bash  theme={null}
claude --dangerously-load-development-channels server:webhook
```

In the second, stream the outbound side so you can see Claude's replies and any permission prompts as they fire:

```bash  theme={null}
curl -N localhost:8788/events
```

In the third, send a message that will make Claude try to run a command:

```bash  theme={null}
curl -d "list the files in this directory" -H "X-Sender: dev" localhost:8788
```

The local permission dialog opens in your Claude Code terminal. A moment later the prompt appears in the `/events` stream, including the five-letter ID. Approve it from the remote side:

```bash  theme={null}
curl -d "yes <id>" -H "X-Sender: dev" localhost:8788
```

The local dialog closes and the tool runs. Claude's reply comes back through the `reply` tool and lands in the stream too.

The three channel-specific pieces in this file:

* **Capabilities** in the `Server` constructor: `claude/channel` registers the notification listener, `claude/channel/permission` opts in to permission relay, `tools` lets Claude discover the reply tool.
* **Outbound paths**: the `reply` tool handler is what Claude calls for conversational responses; the `PermissionRequestSchema` notification handler is what Claude Code calls when a permission dialog opens. Both call `send()` to broadcast over `/events`, but they're triggered by different parts of the system.
* **HTTP handler**: `GET /events` holds an SSE stream open so curl can watch outbound live; `POST` is inbound, gated on the `X-Sender` header. A `yes <id>` or `no <id>` body goes to Claude Code as a verdict notification and never reaches Claude; anything else is forwarded to Claude as a channel event.

## Package as a plugin

To make your channel installable and shareable, wrap it in a [plugin](/en/plugins) and publish it to a [marketplace](/en/plugin-marketplaces). Users install it with `/plugin install`, then enable it per session with `--channels plugin:<name>@<marketplace>`.

A channel published to your own marketplace still needs `--dangerously-load-development-channels` to run, since it isn't on the [approved allowlist](/en/channels#supported-channels). To get it added, [submit it to the official marketplace](/en/plugins#submit-your-plugin-to-the-official-marketplace). Channel plugins go through security review before being approved. On Team and Enterprise plans, an admin can instead include your plugin in the organization's own [`allowedChannelPlugins`](/en/channels#restrict-which-channel-plugins-can-run) list, which replaces the default Anthropic allowlist.

## See also

* [Channels](/en/channels) to install and use Telegram, Discord, iMessage, or the fakechat demo, and to enable channels for a Team or Enterprise org
* [Working channel implementations](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins) for complete server code with pairing flows, reply tools, and file attachments
* [MCP](/en/mcp) for the underlying protocol that channel servers implement
* [Plugins](/en/plugins) to package your channel so users can install it with `/plugin install`

}
```

| Field     | Values                        | Description                                                            |
| :-------- | :---------------------------- | :--------------------------------------------------------------------- |
| `action`  | `accept`, `decline`, `cancel` | Overrides the user's action                                            |
| `content` | object                        | Overrides form field values. Only meaningful when `action` is `accept` |

Exit code 2 blocks the response, changing the effective action to `decline`.

## Prompt-based hooks

In addition to command and HTTP hooks, Claude Code supports prompt-based hooks (`type: "prompt"`) that use an LLM to evaluate whether to allow or block an action, and agent hooks (`type: "agent"`) that spawn an agentic verifier with tool access. Not all events support every hook type.

Events that support all four hook types (`command`, `http`, `prompt`, and `agent`):

* `PermissionRequest`
* `PostToolUse`
* `PostToolUseFailure`
* `PreToolUse`
* `Stop`
* `SubagentStop`
* `TaskCompleted`
* `TaskCreated`
* `UserPromptSubmit`

Events that support `command` and `http` hooks but not `prompt` or `agent`:

* `ConfigChange`
* `CwdChanged`
* `Elicitation`
* `ElicitationResult`
* `FileChanged`
* `InstructionsLoaded`
* `Notification`
* `PostCompact`
* `PreCompact`
* `SessionEnd`
* `StopFailure`
* `SubagentStart`
* `TeammateIdle`
* `WorktreeCreate`
* `WorktreeRemove`

`SessionStart` supports only `command` hooks.

### How prompt-based hooks work

Instead of executing a Bash command, prompt-based hooks:

1. Send the hook input and your prompt to a Claude model, Haiku by default
2. The LLM responds with structured JSON containing a decision
3. Claude Code processes the decision automatically

### Prompt hook configuration

Set `type` to `"prompt"` and provide a `prompt` string instead of a `command`. Use the `$ARGUMENTS` placeholder to inject the hook's JSON input data into your prompt text. Claude Code sends the combined prompt and input to a fast Claude model, which returns a JSON decision.

This `Stop` hook asks the LLM to evaluate whether all tasks are complete before allowing Claude to finish:

```json  theme={null}
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Evaluate if Claude should stop: $ARGUMENTS. Check if all tasks are complete."
          }
        ]
      }
    ]
  }
}
```

| Field     | Required | Description                                                                                                                                                         |
| :-------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `type`    | yes      | Must be `"prompt"`                                                                                                                                                  |
| `prompt`  | yes      | The prompt text to send to the LLM. Use `$ARGUMENTS` as a placeholder for the hook input JSON. If `$ARGUMENTS` is not present, input JSON is appended to the prompt |
| `model`   | no       | Model to use for evaluation. Defaults to a fast model                                                                                                               |
| `timeout` | no       | Timeout in seconds. Default: 30                                                                                                                                     |

### Response schema

The LLM must respond with JSON containing:

```json  theme={null}
{
  "ok": true | false,
  "reason": "Explanation for the decision"
}
```

| Field    | Description                                                |
| :------- | :--------------------------------------------------------- |
| `ok`     | `true` allows the action, `false` prevents it              |
| `reason` | Required when `ok` is `false`. Explanation shown to Claude |

### Example: Multi-criteria Stop hook

This `Stop` hook uses a detailed prompt to check three conditions before allowing Claude to stop. If `"ok"` is `false`, Claude continues working with the provided reason as its next instruction. `SubagentStop` hooks use the same format to evaluate whether a [subagent](/en/sub-agents) should stop:

```json  theme={null}
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "You are evaluating whether Claude should stop working. Context: $ARGUMENTS\n\nAnalyze the conversation and determine if:\n1. All user-requested tasks are complete\n2. Any errors need to be addressed\n3. Follow-up work is needed\n\nRespond with JSON: {\"ok\": true} to allow stopping, or {\"ok\": false, \"reason\": \"your explanation\"} to continue working.",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

## Agent-based hooks

Agent-based hooks (`type: "agent"`) are like prompt-based hooks but with multi-turn tool access. Instead of a single LLM call, an agent hook spawns a subagent that can read files, search code, and inspect the codebase to verify conditions. Agent hooks support the same events as prompt-based hooks.

### How agent hooks work

When an agent hook fires:

1. Claude Code spawns a subagent with your prompt and the hook's JSON input
2. The subagent can use tools like Read, Grep, and Glob to investigate
3. After up to 50 turns, the subagent returns a structured `{ "ok": true/false }` decision
4. Claude Code processes the decision the same way as a prompt hook

Agent hooks are useful when verification requires inspecting actual files or test output, not just evaluating the hook input data alone.

### Agent hook configuration

Set `type` to `"agent"` and provide a `prompt` string. The configuration fields are the same as [prompt hooks](#prompt-hook-configuration), with a longer default timeout:

| Field     | Required | Description                                                                                 |
| :-------- | :------- | :------------------------------------------------------------------------------------------ |
| `type`    | yes      | Must be `"agent"`                                                                           |
| `prompt`  | yes      | Prompt describing what to verify. Use `$ARGUMENTS` as a placeholder for the hook input JSON |
| `model`   | no       | Model to use. Defaults to a fast model                                                      |
| `timeout` | no       | Timeout in seconds. Default: 60                                                             |

The response schema is the same as prompt hooks: `{ "ok": true }` to allow or `{ "ok": false, "reason": "..." }` to block.

This `Stop` hook verifies that all unit tests pass before allowing Claude to finish:

```json  theme={null}
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "agent",
            "prompt": "Verify that all unit tests pass. Run the test suite and check the results. $ARGUMENTS",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

## Run hooks in the background

By default, hooks block Claude's execution until they complete. For long-running tasks like deployments, test suites, or external API calls, set `"async": true` to run the hook in the background while Claude continues working. Async hooks cannot block or control Claude's behavior: response fields like `decision`, `permissionDecision`, and `continue` have no effect, because the action they would have controlled has already completed.

### Configure an async hook

Add `"async": true` to a command hook's configuration to run it in the background without blocking Claude. This field is only available on `type: "command"` hooks.

This hook runs a test script after every `Write` tool call. Claude continues working immediately while `run-tests.sh` executes for up to 120 seconds. When the script finishes, its output is delivered on the next conversation turn:

```json  theme={null}
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/run-tests.sh",
            "async": true,
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

The `timeout` field sets the maximum time in seconds for the background process. If not specified, async hooks use the same 10-minute default as sync hooks.

### How async hooks execute

When an async hook fires, Claude Code starts the hook process and immediately continues without waiting for it to finish. The hook receives the same JSON input via stdin as a synchronous hook.

After the background process exits, if the hook produced a JSON response with a `systemMessage` or `additionalContext` field, that content is delivered to Claude as context on the next conversation turn.

Async hook completion notifications are suppressed by default. To see them, enable verbose mode with `Ctrl+O` or start Claude Code with `--verbose`.

### Example: run tests after file changes

This hook starts a test suite in the background whenever Claude writes a file, then reports the results back to Claude when the tests finish. Save this script to `.claude/hooks/run-tests-async.sh` in your project and make it executable with `chmod +x`:

```bash  theme={null}
#!/bin/bash
# run-tests-async.sh

# Read hook input from stdin
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only run tests for source files
if [[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.js ]]; then
  exit 0
fi

# Run tests and report results via systemMessage
RESULT=$(npm test 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "{\"systemMessage\": \"Tests passed after editing $FILE_PATH\"}"
else
  echo "{\"systemMessage\": \"Tests failed after editing $FILE_PATH: $RESULT\"}"
fi
```

Then add this configuration to `.claude/settings.json` in your project root. The `async: true` flag lets Claude keep working while tests run:

```json  theme={null}
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/run-tests-async.sh",
            "async": true,
            "timeout": 300
          }
        ]
      }
    ]
  }
}
```

### Limitations

Async hooks have several constraints compared to synchronous hooks:

* Only `type: "command"` hooks support `async`. Prompt-based hooks cannot run asynchronously.
* Async hooks cannot block tool calls or return decisions. By the time the hook completes, the triggering action has already proceeded.
* Hook output is delivered on the next conversation turn. If the session is idle, the response waits until the next user interaction.
* Each execution creates a separate background process. There is no deduplication across multiple firings of the same async hook.

## Security considerations

### Disclaimer

Command hooks run with your system user's full permissions.

<Warning>
  Command hooks execute shell commands with your full user permissions. They can modify, delete, or access any files your user account can access. Review and test all hook commands before adding them to your configuration.
</Warning>

### Security best practices

Keep these practices in mind when writing hooks:

* **Validate and sanitize inputs**: never trust input data blindly
* **Always quote shell variables**: use `"$VAR"` not `$VAR`
* **Block path traversal**: check for `..` in file paths
* **Use absolute paths**: specify full paths for scripts, using `"$CLAUDE_PROJECT_DIR"` for the project root
* **Skip sensitive files**: avoid `.env`, `.git/`, keys, etc.

## Windows PowerShell tool

On Windows, you can run individual hooks in PowerShell by setting `"shell": "powershell"` on a command hook. Hooks spawn PowerShell directly, so this works regardless of whether `CLAUDE_CODE_USE_POWERSHELL_TOOL` is set. Claude Code auto-detects `pwsh.exe` (PowerShell 7+) with a fallback to `powershell.exe` (5.1).

```json  theme={null}
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "shell": "powershell",
            "command": "Write-Host 'File written'"
          }
        ]
      }
    ]
  }
}
```

## Debug hooks

Run `claude --debug` to see hook execution details, including which hooks matched, their exit codes, and output. Toggle verbose mode with `Ctrl+O` to see hook progress in the transcript.

```text  theme={null}
[DEBUG] Executing hooks for PostToolUse:Write
[DEBUG] Getting matching hook commands for PostToolUse with query: Write
[DEBUG] Found 1 hook matchers in settings
[DEBUG] Matched 1 hooks for query "Write"
[DEBUG] Found 1 hook commands to execute
[DEBUG] Executing hook command: <Your command> with timeout 600000ms
[DEBUG] Hook command completed with status 0: <Your stdout>
```

For troubleshooting common issues like hooks not firing, infinite Stop hook loops, or configuration errors, see [Limitations and troubleshooting](/en/hooks-guide#limitations-and-troubleshooting) in the guide.

---

## Prompt 25
This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.

Summary:
1. Primary Request and Intent:
   The user (@alex-jadecli) is a solo cofounder building jadecli.com using the `researchers` monorepo. The session was designated as **chat and research only** — no production code, focused on ideation and artifact capture. The overarching intent is to establish **Jade** as a deterministic multi-agent framework layer on top of Claude/Anthropic's ecosystem that compounds on Anthropic releases daily. Key goals: (a) conduct a multi-agent codebase audit, (b) research Linear integration and MCP v2 SDK, (c) capture product vision prompts for Jade framework, (d) create a Claude customer journey map grounded in crawled data, (e) build a taxonomy data model for Claude/Anthropic public artifacts, and (f) create a PR that frames this as the start of the Jade product-strategy department. The user repeatedly emphasized: "override your helpful desire to start coding right away" — research and design first, skeptical review, incremental progress.

2. Key Technical Concepts:
   - **Multi-agent routing**: Opus orchestrates, Sonnet executes structured tasks, Haiku validates — each with separate context windows
   - **Jade Layer 2.5**: Jade sits between bootstrap.xml (operator identity) and per-session instructions, providing business context, department templates, and state
   - **4-layer identity model**: Constitutional AI (Layer 0) → Anthropic System Prompt (Layer 1) → bootstrap.xml (Layer 2) → User Instructions (Layer 3), with Jade at Layer 2.5
   - **Shannon 5-step thinking**: problem_definition → constraints → model → proof → implementation — already implemented as MCP server with 6 tools in `claude-multi-agent-dispatch`
   - **Kimball star schema**: DIM/FACT tables with SCD Type 2, already in Neon PG18 (runtime → reporting → semantic → agentdata tiers)
   - **Taxonomy data model**: Hierarchical classification with ALL CAPS tables, monotonically increasing BIGSERIAL PKs, event-sourced CRUD, orjson payloads
   - **MCP v2 SDK**: Pre-alpha, ESM only, Node 20+, Standard Schema (Zod v4) required, SSE server removed, `registerTool()` replaces `server.tool()`, Q1 2026 target — strategy is write v2 patterns now, ship on v1 SDK
   - **Lookup hierarchy**: local files → Postgres decision files → Postgres web fetch cache → web fetch (last resort)
   - **Theory of Constraints (The Goal)**: The bottleneck is the end-to-end loop (ticket → research → plan → execute → validate → close), not departments or templates
   - **Cowork vs Codegen**: Two task types requiring different agent configurations — codegen produces code/commits/PRs, cowork produces strategy docs/Linear issues/requirements
   - **Department model**: Product-strategy is first department, with named agents, persona traits grounded in Bezos books
   - **Bloom filters for tool routing**: Haiku pre-checks tool call likelihood before Sonnet executes

3. Files and Code Sections:
   - **`.claude/bootstrap.xml`** — Deterministic session entry point defining model routing, pinned docs, architecture components, Neon PG18 connection, eval contract, session protocol. Read at session start for full context.
   - **`.claude/memory/next-session.md`** — Session carryover with out-of-scope P0 items (agentdata Tier 4, agentevals loop), P1 items (bloom filters, agentmemories), and CI/CD tasks.
   - **`.jade/cofounder-prompts/2026-03-27-product-vision-001.md`** — Raw capture of Jade vision: departments, .jade structure, crawlers-as-tools, Neon PG18 warehouse, agent lifecycle. Status: RAW.
   - **`.jade/cofounder-prompts/2026-03-27-product-vision-002.md`** — Departments, cowork templates, Bezos 3 books (Innovator's Dilemma, The Goal, Effective Executive), S-curve lifecycle. Status: RAW.
   - **`.jade/cofounder-prompts/2026-03-27-product-vision-003.md`** — Identity layer model (Layers 0-3 + Layer 2.5 for Jade), 4 architectural insights (subagents are peers, fail-loud is constitutional, philosophical immune system applies to all models, CI/CD is accountability chain). Status: AFFIRMED.
   - **`.jade/customer-journey-map.md`** — Complete journey map: 128 structured inputs (16 types), 30 output types, 26 named agents, 28 skills, 4 MCP servers, 5 journey phases. Key finding: all components exist independently but no end-to-end loop connects them. Created via 3 Sonnet subagents.
   - **`.jade/taxonomy/claude-taxonomy-types.ts`** — TypeScript const enums for 10 TAXONOMY_CATEGORY values (ORGANIZATION=1 through STANDARD=10), subcategory enums (ORGANIZATION_TYPE, PRODUCT_TYPE, MODEL_TYPE, etc.), TaxonomyNode interface, TaxonomyEvent interface, CrawlInstance interface, and TAXONOMY_SEED array with ~80 nodes seeded from confirmed crawl data (3 GitHub orgs, 77 repos, 7 products, 3 models, 6 surfaces, 9 discovery endpoints).
   - **`.jade/taxonomy/claude-taxonomy-ddl.sql`** — Kimball DDL in `taxonomy` schema: DIM_TAXONOMY_CATEGORY (10 seeded), DIM_TAXONOMY_NODE (recursive self-ref via PARENT_SK), FACT_TAXONOMY_EVENT (event-sourced CRUD with BRIN indexes), FACT_CRAWL_INSTANCE (SCD Type 2 via IS_CURRENT partial unique index), and 4 semantic views (TAXONOMY_TREE recursive CTE, HYDRATED_LEAVES, CATEGORY_SUMMARY, RECENT_EVENTS).

4. Errors and Fixes:
   - **TodoWrite tool not loaded**: Attempted to use TodoWrite before its schema was fetched. Fixed by calling ToolSearch to load it first.
   - **"for-claude" URL returned sitemap, not identity doc**: `https://platform.claude.com/docs/for-claude` returned the LLM-optimized docs index, not a soul/identity document. Tried 5 alternative URLs including `llms-full.txt` (923K lines). Found that the closest public equivalent is the published system prompts at `/release-notes/system-prompts`. Resolution: synthesized the identity architecture from training knowledge instead.
   - **Subagent launched async when sync expected**: Some Sonnet agents launched asynchronously, requiring polling of output files. Managed by checking progress via Bash reads of output files and waiting for task-notification events.

5. Problem Solving:
   - **Codebase audit**: Fanned out 9 subagents (5 Haiku + 3 Sonnet + 1 Sonnet SQL) across all 9 sub-repos. Found critical issues: MV missing UNIQUE indexes blocking ETL REFRESH CONCURRENTLY, TRUNCATE CASCADE on dim_page, O(n²) ETL subquery, security vulnerabilities (H1: raw DB errors leaked, H2: unvalidated SQL LIMIT). All findings consolidated into priority matrix.
   - **Linear integration gap**: Discovered `linear_sync.py` is fully implemented but never wired into any of the 7 workflows. Identified 7 specific gaps and proposed 4-PR plan.
   - **MCP v2 adoption strategy**: Determined v2 is not yet on npm, recommend writing v2 patterns (Zod schemas, Streamable HTTP) targeting v1 SDK now, mechanical migration later.
   - **Shannon-thinking already surpassed upstream**: Our dispatch repo's ThinkingEngine has DAG cycle detection, assumption lifecycle, confidence calibration — upstream has 1 tool, we have 6.
   - **"The bottleneck is the loop"**: Applied Theory of Constraints analysis — 128 inputs, 30 outputs, 26 agents, 0 end-to-end loops. Every piece exists independently but nothing connects them.

6. All User Messages:
   - "Read .claude/bootstrap.xml first — it defines model routing... Start by telling me which P0 item you recommend tackling and your proposed 3-step plan."
   - "I want you to understand and inject this to your cloud session. I've merged this PR so i want to keep this session focused on chat and research since u have context"
   - "I've started the new session. Assume that session is live. What else should i do in another session"
   - "Can you fetch origin main"
   - "Can you actually try use this multi agent where you orchestrate and route cheaper models... I want you to use the agent loop to conduct a codebase audit incrementally using subagents"
   - "What you should aim to do is figure out how we can incorporate https://github.com/marketplace/actions/github-linear-action and/or use at in process MCP using the unreleased typescript MCP v2... We can PRs to have manageable scope but we never want to fail silently or gradual degradation..."
   - "I want you to first consider what you have in context but compare it your understanding of Claude as the agent identity... Read https://platform.claude.com/docs/for-claude and https://platform.claude.com/docs/en/claude_api_primer designed for you"
   - "Capture my requirements like a lead researcher for product-strategy... [massive Jade vision prompt about departments, .jade structure, cowork vs codegen, Bezos books]"
   - "Here are research questions... Use determinism with dspy... Develop match core infrastructure at the core of Claude and extend each file to Jade... https://github.com/olaservo/shannon-thinking"
   - "[Pasted back identity layer model and 4 insights — affirming them]"
   - "[Image of mobile screen with skills list] Let's take a different approach... Create a programmatic tool... create a Claude-customer-journey that starts with anthropic as the business... Avoid hallucination... We crawled public data..."
   - "Let's reframe it... Create a Claude-taxonomy-data-models... Use typescript established patterns and kimball sql warehouse patterns to create a taxonomy... Always start at the highest level... focus on just trying to organize a view of the world decomposed through a taxonomy..."
   - "[Final massive prompt] Business context: Jadecli/researchers today represents a way to crawl anthropic and Claude artifacts... Engineering context: This monolith has to the goal to build jadecli.com... Project launch context: we introduce the concept of departments... Since we already created a pr this session are you able to commit these files and generate a new pr?..."

7. Pending Tasks:
   - **Create a PR** for the 5 commits on branch `claude/setup-multi-agent-routing-6iYl3` that frames this as the start of Jade product-strategy department
   - The PR should describe: cofounder prompts capture, customer journey map, taxonomy data models, and the vision for Jade multi-agent FastAPI
   - User wants the PR to cover: bloom tools for TS/Python, session start updates, subagent construction using Claude Agent SDK YAML files, taxonomy bridging crawled data to dimensional models
   - User mentioned wanting to add this context "as a comment to a linear ticket" — not yet done

8. Current Work:
   The user's most recent message is an extensive business/engineering/project context dump asking me to commit files and generate a new PR. The 5 commits already exist on branch `claude/setup-multi-agent-routing-6iYl3`:
   - `b0a374e` — cofounder prompt 001
   - `1ed1409` — cofounder prompt 002
   - `4366495` — cofounder prompt 003 (affirmed)
   - `421e352` — customer journey map
   - `b3b5005` — taxonomy data models (TypeScript + SQL)
   
   All are pushed to remote. The user asked "are you able to commit these files and generate a new pr?" — the files are already committed and pushed, so the remaining task is to create the PR with appropriate description framing this as the start of the Jade product-strategy department project.

9. Optional Next Step:
   Create a GitHub PR for branch `claude/setup-multi-agent-routing-6iYl3` using the `mcp__github__create_pull_request` tool. The PR description should frame this as the research foundation for the Jade product-strategy department, referencing: the 3 cofounder prompts, the customer journey map (128 inputs, 30 outputs, 26 agents), the taxonomy data models, and the vision for connecting all existing components into an end-to-end loop. The user's exact words: "Since we already created a pr this session are you able to commit these files and generate a new pr? I want to add this as a the start of a jade-multiagent-fastapi."

If you need specific details from before compaction (like exact code snippets, error messages, or content you generated), read the full transcript at: /root/.claude/projects/-home-user-researchers/af837890-61d2-4ec7-87a3-aa692e66f9f0.jsonl
Continue the conversation from where it left off without asking the user any further questions. Resume directly — do not acknowledge the summary, do not recap what was happening, do not preface with "I'll continue" or similar. Pick up the last task as if the break never happened.

---

## Prompt 26
Can you actually try to find a way that doesn’t force you to open a file or cause context bloat but save each of my user prompts in entirety from this session?

---
