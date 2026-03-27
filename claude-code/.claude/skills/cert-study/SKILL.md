---
name: cert-study
description: Claude Certified Architect – Foundations exam study guide reference. Covers all 5 domains, 25 task statements, 6 scenarios, 12 sample questions, and 4 preparation exercises.
disable-model-invocation: true
argument-hint: [domain-number|scenario|questions|exercises|all]
---

# Claude Certified Architect – Foundations Study Reference

Source: Anthropic's official exam guide (Confidential NTK)

## Exam Overview

- **Format**: Multiple choice (1 correct + 3 distractors), scenario-based
- **Scoring**: 100–1000 scale, **720 minimum to pass**
- **Scenarios**: 4 of 6 presented per exam, picked at random
- **Target**: Solution architects with 6+ months hands-on Claude experience

## Content Domains & Weights

| Domain | Weight | Focus |
|--------|--------|-------|
| **1. Agentic Architecture & Orchestration** | 27% | Agent loops, multi-agent, subagents, hooks, workflows, sessions |
| **2. Tool Design & MCP Integration** | 18% | Tool descriptions, MCP servers, error responses, built-in tools |
| **3. Claude Code Configuration & Workflows** | 20% | CLAUDE.md, skills, rules, plan mode, CI/CD, iterative refinement |
| **4. Prompt Engineering & Structured Output** | 20% | Explicit criteria, few-shot, tool_use + JSON schemas, batch API, multi-pass review |
| **5. Context Management & Reliability** | 15% | Context preservation, escalation, error propagation, codebase exploration, provenance |

---

## Domain 1: Agentic Architecture & Orchestration (27%)

### 1.1 Design agentic loops for autonomous task execution
- **Agentic loop lifecycle**: send request → inspect `stop_reason` (`"tool_use"` vs `"end_turn"`) → execute tools → return results → next iteration
- **Tool results appended** to conversation history so model reasons about next action
- **Model-driven** (Claude chooses tools dynamically) vs **pre-configured** decision trees
- **Anti-patterns**: parsing natural language for loop termination, arbitrary iteration caps as primary stopping mechanism, checking assistant text for completion indicators

### 1.2 Orchestrate multi-agent systems (coordinator-subagent)
- **Hub-and-spoke**: coordinator manages all inter-subagent communication, error handling, routing
- **Subagents have isolated context** — they do NOT inherit coordinator's conversation history
- Coordinator handles: task decomposition, delegation, result aggregation, deciding which subagents to invoke
- **Risk**: overly narrow task decomposition → incomplete coverage (e.g., "creative industries" decomposed only into visual arts subtasks)
- **Iterative refinement loops**: coordinator evaluates synthesis → re-delegates with targeted queries → re-invokes synthesis until coverage sufficient

### 1.3 Configure subagent invocation, context passing, spawning
- `Task` tool (now `Agent`) spawns subagents; `allowedTools` must include `"Task"`
- **Context must be explicitly provided** in the subagent's prompt — no automatic inheritance
- `AgentDefinition`: descriptions, system prompts, tool restrictions per subagent type
- `fork_session` for divergent exploration from a shared baseline
- **Pass complete findings** from prior agents directly in prompts (not just references)
- **Structured data formats** to separate content from metadata (source URLs, page numbers) for attribution
- **Spawn parallel subagents** by emitting multiple `Task` tool calls in a single coordinator response

### 1.4 Multi-step workflows with enforcement and handoff
- **Programmatic enforcement** (hooks, prerequisite gates) vs **prompt-based guidance** for workflow ordering
- When deterministic compliance is required (e.g., identity verification before financial operations), **prompt instructions alone have a non-zero failure rate** → use hooks
- **Structured handoff protocols**: customer ID, root cause, refund amount, recommended action when escalating to humans

### 1.5 Agent SDK hooks for tool call interception and data normalization
- `PostToolUse` hooks intercept tool results for transformation before the model processes them
- Hooks enforce compliance rules (e.g., blocking refunds above a threshold)
- **Hooks = deterministic guarantees** vs prompt instructions = probabilistic compliance
- Normalize heterogeneous data formats (Unix timestamps, ISO 8601, numeric status codes)

### 1.6 Task decomposition strategies
- **Fixed sequential pipelines** (prompt chaining) for predictable workflows vs **dynamic adaptive decomposition** for open-ended investigation
- Split large code reviews into **per-file local passes + cross-file integration pass**
- Adaptive investigation plans that generate subtasks based on intermediate discoveries

### 1.7 Session state, resumption, and forking
- `--resume <session-name>` to continue named sessions
- `fork_session` for parallel exploration branches
- **New session + structured summary** is often more reliable than resuming with stale tool results
- When resuming: inform agent about specific file changes for targeted re-analysis

---

## Domain 2: Tool Design & MCP Integration (18%)

### 2.1 Effective tool interfaces
- **Tool descriptions are the primary mechanism** LLMs use for tool selection
- Include: input formats, example queries, edge cases, boundary explanations
- **Ambiguous/overlapping descriptions cause misrouting** (e.g., `analyze_content` vs `analyze_document`)
- Fix: rename tools, expand descriptions, split generic tools into purpose-specific ones

### 2.2 Structured error responses for MCP tools
- MCP `isError` flag for communicating failures
- **Error categories**: transient (timeouts), validation (invalid input), business (policy violations), permission
- **Uniform "Operation failed" responses prevent informed recovery decisions**
- Return: `errorCategory`, `isRetryable` boolean, human-readable descriptions
- Distinguish **access failures** (needing retry) from **valid empty results** (successful query, no matches)

### 2.3 Tool distribution and tool_choice
- **Too many tools (18 vs 4-5) degrades selection reliability**
- Agents with out-of-role tools tend to misuse them
- `tool_choice`: `"auto"` (may return text), `"any"` (must call a tool), forced `{"type": "tool", "name": "..."}`
- **Scoped tool access**: give agents only role-relevant tools

### 2.4 MCP servers in Claude Code and agent workflows
- **Project scope**: `.mcp.json` (shared team tooling) vs **user scope**: `~/.claude.json` (personal/experimental)
- Environment variable expansion (`${GITHUB_TOKEN}`) for credential management
- MCP resources as content catalogs (issue summaries, documentation hierarchies)
- Prefer community MCP servers for standard integrations; custom for team-specific workflows

### 2.5 Built-in tools (Read, Write, Edit, Bash, Grep, Glob)
- **Grep**: content search (function names, error messages, imports)
- **Glob**: file path pattern matching (`**/*.test.tsx`)
- **Read/Write**: full file operations; **Edit**: targeted modifications using unique text matching
- Edit fails on non-unique matches → fall back to Read + Write
- Build understanding incrementally: Grep to find entry points → Read to trace flows

---

## Domain 3: Claude Code Configuration & Workflows (20%)

### 3.1 CLAUDE.md hierarchy
- **User-level** (`~/.claude/CLAUDE.md`) → **project-level** (`.claude/CLAUDE.md` or root) → **directory-level** (subdirectory CLAUDE.md)
- User settings are personal, not shared via version control
- `@import` for referencing external files; `.claude/rules/` for topic-specific rule files
- `/memory` command to verify which files are loaded

### 3.2 Custom slash commands and skills
- **Project**: `.claude/commands/` (shared via VCS) vs **user**: `~/.claude/commands/` (personal)
- Skills in `.claude/skills/` with `SKILL.md` + frontmatter: `context: fork`, `allowed-tools`, `argument-hint`
- `context: fork` isolates verbose output from main conversation
- Skills vs CLAUDE.md: skills = on-demand invocation for task-specific workflows; CLAUDE.md = always-loaded universal standards

### 3.3 Path-specific rules
- `.claude/rules/` files with YAML frontmatter `paths` field (glob patterns)
- Rules load **only when editing matching files** — reduces irrelevant context
- Glob patterns (`**/*.test.tsx`) apply conventions regardless of directory location
- Better than subdirectory CLAUDE.md when conventions must span multiple directories

### 3.4 Plan mode vs direct execution
- **Plan mode**: complex tasks, large-scale changes, multiple valid approaches, architectural decisions
- **Direct execution**: simple, well-scoped, single-file changes
- Explore subagent isolates verbose discovery output, preserving main context
- Combine: plan mode for investigation → direct execution for implementation

### 3.5 Iterative refinement
- **Concrete I/O examples** > prose descriptions when transformations are inconsistent
- **Test-driven iteration**: write tests first, share failures to guide improvement
- **Interview pattern**: Claude asks design questions before implementing in unfamiliar domains
- Multiple interacting issues → single detailed message; independent issues → sequential iteration

### 3.6 CI/CD integration
- **`-p` / `--print` flag** for non-interactive mode in automated pipelines
- `--output-format json` + `--json-schema` for structured CI output
- CLAUDE.md provides project context (testing standards, review criteria) to CI-invoked Claude
- **Session context isolation**: don't use same session for generation and review — independent review catches more issues
- Include prior review findings when re-running after new commits

---

## Domain 4: Prompt Engineering & Structured Output (20%)

### 4.1 Explicit criteria for precision
- Explicit criteria ("flag comments only when claimed behavior contradicts actual code behavior") > vague instructions ("be conservative")
- **High false positive rates in one category undermine confidence in ALL categories**
- Define explicit severity criteria with concrete code examples per level

### 4.2 Few-shot prompting
- Most effective for **consistent formatting when detailed instructions fail**
- Show **reasoning** for ambiguous cases (why one action was chosen over alternatives)
- Demonstrate correct handling of varied document structures
- Reduce hallucination in extraction tasks

### 4.3 Structured output via tool_use + JSON schemas
- `tool_use` with JSON schemas = **most reliable** for guaranteed schema-compliant output
- `tool_choice: "auto"` (may return text), `"any"` (must call a tool), forced tool selection
- **Strict schemas eliminate syntax errors but not semantic errors** (values in wrong fields)
- Design: required vs optional fields, enum with `"other"` + detail field, nullable fields for absent info
- Format normalization rules in prompts alongside strict schemas

### 4.4 Validation, retry, and feedback loops
- **Retry-with-error-feedback**: append specific validation errors on retry to guide correction
- Retries are **ineffective when information is simply absent** from the source document
- Track `detected_pattern` to enable systematic false positive analysis
- Self-correction: extract "calculated_total" alongside "stated_total" to flag discrepancies

### 4.5 Batch processing strategies
- **Message Batches API**: 50% cost savings, up to 24-hour processing, no latency SLA
- Appropriate for: overnight reports, weekly audits, nightly test gen
- **NOT for**: blocking pre-merge checks
- No multi-turn tool calling within batch requests
- `custom_id` for correlating request/response pairs
- Handle failures: resubmit only failed documents by `custom_id`

### 4.6 Multi-instance and multi-pass review
- **Self-review limitations**: model retains reasoning context → less likely to question its own decisions
- **Independent review instances** (no prior context) catch more subtle issues
- **Multi-pass**: per-file local analysis + cross-file integration passes to avoid attention dilution

---

## Domain 5: Context Management & Reliability (15%)

### 5.1 Preserve critical information across long interactions
- **Progressive summarization risks**: condensing numerical values, dates, percentages into vague summaries
- **Lost in the middle effect**: models reliably process beginning and end but may omit middle sections
- Extract transactional facts into a persistent "case facts" block included in each prompt
- Place key findings summaries at the **beginning** of aggregated inputs

### 5.2 Escalation and ambiguity resolution
- Escalate on: customer requests for human, policy exceptions/gaps, inability to make meaningful progress
- **Sentiment-based escalation and self-reported confidence scores are unreliable** proxies
- Multiple customer matches → **ask for additional identifiers** rather than heuristic selection
- Honor explicit customer requests for human agents immediately

### 5.3 Error propagation across multi-agent systems
- Structured error context: failure type, attempted query, partial results, alternative approaches
- Distinguish **access failures** (retry) from **valid empty results** (no matches)
- **Anti-patterns**: silently suppressing errors (empty results as success), terminating entire workflow on single failure
- Subagents: implement local recovery for transient failures, propagate only unresolvable errors with context

### 5.4 Context in large codebase exploration
- Context degradation in extended sessions: inconsistent answers, "typical patterns" instead of specific findings
- **Scratchpad files** for persisting key findings across context boundaries
- Subagent delegation for isolating verbose exploration
- Structured state persistence for crash recovery (agent exports state → coordinator loads manifest on resume)
- `/compact` to reduce context during extended exploration

### 5.5 Human review workflows and confidence calibration
- Aggregate accuracy (97%) may mask poor performance on specific document types or fields
- **Stratified random sampling** of high-confidence extractions for ongoing error detection
- Field-level confidence scores calibrated using labeled validation sets
- Route low-confidence extractions to human review

### 5.6 Information provenance in multi-source synthesis
- Source attribution is lost during summarization → require **structured claim-source mappings**
- Conflicting statistics: annotate conflicts with source attribution, don't arbitrarily select one
- Require publication/collection dates in structured outputs for correct temporal interpretation
- Render content types appropriately (financial → tables, news → prose, technical → structured lists)

---

## 6 Exam Scenarios

| # | Scenario | Primary Domains |
|---|----------|-----------------|
| 1 | **Customer Support Resolution Agent** — Agent SDK, MCP tools (get_customer, lookup_order, process_refund, escalate_to_human), 80%+ first-contact resolution | D1, D2, D5 |
| 2 | **Code Generation with Claude Code** — Custom slash commands, CLAUDE.md, plan mode vs direct execution | D3, D5 |
| 3 | **Multi-Agent Research System** — Coordinator + search/analysis/synthesis subagents, cited reports | D1, D2, D5 |
| 4 | **Developer Productivity Tools** — Agent SDK, built-in tools (Read/Write/Bash/Grep/Glob), MCP servers | D2, D3, D1 |
| 5 | **Claude Code for CI/CD** — Automated code review, test generation, PR feedback, minimize false positives | D3, D4 |
| 6 | **Structured Data Extraction** — JSON schemas, validation, edge cases, downstream integration | D4, D5 |

---

## 12 Sample Question Answers (Quick Reference)

| Q# | Scenario | Answer | Key Principle |
|----|----------|--------|---------------|
| 1 | Customer Support | **A** | Programmatic prerequisite gates > prompt instructions for critical business logic |
| 2 | Customer Support | **B** | Expand tool descriptions with input formats, examples, and boundaries |
| 3 | Customer Support | **A** | Explicit escalation criteria with few-shot examples > sentiment analysis or confidence scores |
| 4 | Code Gen | **A** | Project-scoped commands in `.claude/commands/` for team-wide availability via VCS |
| 5 | Code Gen | **A** | Plan mode for large-scale restructuring with architectural decisions |
| 6 | Code Gen | **A** | `.claude/rules/` with glob patterns for path-based convention application |
| 7 | Multi-Agent | **B** | Too-narrow coordinator task decomposition → incomplete coverage (root cause is what was assigned) |
| 8 | Multi-Agent | **A** | Structured error context (failure type, partial results, alternatives) for intelligent recovery |
| 9 | Multi-Agent | **A** | Scoped `verify_fact` tool for common case (85%), coordinator routing for complex (15%) |
| 10 | CI/CD | **A** | `-p` flag for non-interactive Claude Code in CI pipelines |
| 11 | CI/CD | **A** | Batch API for overnight reports (latency-tolerant); real-time API for blocking pre-merge checks |
| 12 | CI/CD | **A** | Per-file local passes + cross-file integration pass to avoid attention dilution |

---

## 4 Preparation Exercises

### Exercise 1: Multi-Tool Agent with Escalation Logic
Build agentic loop with `stop_reason` handling, structured MCP error responses (`errorCategory`, `isRetryable`), programmatic hooks for business rules, multi-concern decomposition.
→ **Reinforces**: D1, D2, D5

### Exercise 2: Configure Claude Code for Team Development
CLAUDE.md hierarchy, `.claude/rules/` with glob patterns, skills with `context: fork` + `allowed-tools`, MCP servers in `.mcp.json` with env var expansion, plan mode vs direct execution.
→ **Reinforces**: D3, D2

### Exercise 3: Structured Data Extraction Pipeline
JSON schema with required/optional/nullable/enum fields, `tool_use` with `tool_choice`, validation-retry loops, few-shot examples for varied formats, batch processing with `custom_id`, human review routing with confidence scores.
→ **Reinforces**: D4, D5

### Exercise 4: Multi-Agent Research Pipeline
Coordinator with `allowedTools` including `"Task"`, parallel subagent execution, structured output with claim-source mappings, error propagation with structured context, conflicting source handling.
→ **Reinforces**: D1, D2, D5

---

## Key Technologies (Appendix)

| Technology | Key Concepts |
|------------|-------------|
| **Claude Agent SDK** | `AgentDefinition`, `stop_reason`, `PostToolUse` hooks, `Task` tool, `allowedTools` |
| **MCP** | `isError` flag, `.mcp.json`, env var expansion, resources as catalogs |
| **Claude Code** | CLAUDE.md hierarchy, `.claude/rules/`, `.claude/commands/`, `.claude/skills/`, plan mode, `-p` flag, `--output-format json`, `--json-schema`, `/compact`, `--resume`, `fork_session`, Explore subagent |
| **Claude API** | `tool_use`, `tool_choice` (`auto`/`any`/forced), `stop_reason`, `max_tokens`, system prompts |
| **Message Batches API** | 50% cost savings, 24h window, `custom_id`, no multi-turn tool calling |
| **JSON Schema** | Required vs optional, nullable, enums with `"other"`, strict mode |
| **Pydantic** | Schema validation, semantic validation errors, validation-retry loops |

## Out of Scope
Fine-tuning, billing, specific language implementations (beyond tool/schema config), MCP server hosting/networking, model internals, Constitutional AI/RLHF, embeddings/vector DBs, computer use, vision, streaming implementation, rate limiting, OAuth protocol details, cloud provider configs, prompt caching implementation, token counting algorithms.
