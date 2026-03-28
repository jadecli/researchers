# Claude Customer Journey Map
# Grounded in jadecli/researchers codebase artifacts — zero hallucination
# Generated: 2026-03-28
# Session: claude/setup-multi-agent-routing-6iYl3
# Method: 3 Sonnet subagents (inputs, outputs, product surface) + Opus synthesis

## Anthropic Product Surface (confirmed in codebase)

### Products
| Product | Evidence | Scale |
|---------|----------|-------|
| Claude Code | code.claude.com, 3 pinned docs, changelog v2.1.85 | 71 pages crawled |
| Claude Platform/API | platform.claude.com, SDK docs | 768 pages crawled |
| Claude.ai | claude_com_spider, auth requirement for channels | referenced |
| Anthropic.com | anthropic_spider, sitemap | 600+ pages |
| Claude Agent SDK | @anthropic-ai/claude-agent-sdk ^0.2.33 | installed in 2 repos |
| Anthropic SDK | @anthropic-ai/sdk ^0.52.0 | installed in 3 repos |
| MCP | @modelcontextprotocol/sdk, 3 MCP servers built | installed in 4 repos |

### Surfaces
| Surface | Capabilities | Credentials | Evidence |
|---------|-------------|-------------|----------|
| CLI | Full tools, -p headless, --bare, --resume | claude.ai OAuth + API key | agent-sdk-runner.ts |
| Web | claude.ai, Claude Code web | claude.ai login | channel auth requirement |
| Mobile/iOS | Permission relay, approval flows | claude.ai login | agentdata.md, v2.1.81 |
| Desktop | Full Claude Code | claude.ai OAuth | agentdata.md |
| CI/CD | -p flag, headless, structured output | CLAUDE_CODE_OAUTH_TOKEN | 7 workflows |
| IDE/LSP | pyright, typescript, rust plugins | inherited from CLI | plugins-reference pin |

### Pricing (from loop.ts)
| Model | Input | Output | Cache Write | Cache Read |
|-------|-------|--------|-------------|------------|
| Opus 4.6 | $15/MTok | $75/MTok | $18.75/MTok | $1.50/MTok |
| Sonnet 4.6 | $3/MTok | $15/MTok | $3.75/MTok | $0.30/MTok |

---

## Customer Journey Phases

### Phase 1: DISCOVER
Customer encounters Claude via crawled sources.
- anthropic.com (600+ pages) → Research, safety, product pages
- claude.ai → Direct product access
- platform.claude.com (768 pages) → Developer docs
- code.claude.com (71 pages) → Claude Code docs
- GitHub anthropics/* → Open source, MCP spec

Artifacts IN: llms.txt, llms-full.txt (25MB+), robots.txt, sitemaps
Pain points: 768 pages overwhelming, no personalized entry, llms-full.txt too large for context

### Phase 2: EVALUATE
Customer picks a surface based on use case and credentials.
Pain points: No state across surfaces, credentials differ, tool availability varies,
Claude functionality changes depending on device surface and credentials.

### Phase 3: ADOPT
Customer creates structured inputs to configure Claude for their domain.
See "Structured Inputs" section below.
Pain points: No memory across sessions, no deterministic behavior,
no business context, manual state management via flat files.

### Phase 4: OPERATE
Daily usage across codegen and cowork tasks.
See "Department Map" section below.

### Phase 5: COMPOUND
The loop that connects all pieces.
Linear ticket → lookup (local→PG→cache→web) → Shannon thinking →
execute (codegen OR cowork) → validate (evals) → persist (Neon) →
close ticket → memory → DSPy recompile → REPEAT
Status: Every piece exists independently. Nothing connects them.

---

## Structured Inputs FOR Claude (16 types, 128 files)

| Type | Count | Format | Creator | Consumer |
|------|-------|--------|---------|----------|
| CLAUDE.md (project instructions) | 10 | Markdown | Human | Claude |
| bootstrap.xml (session entry) | 1 | XML | Human+Claude | Claude |
| settings.json (hooks) | 6 | JSON | Human | Claude Code |
| Agent definitions | 26 | MD+YAML frontmatter | Human/Claude | Claude |
| Skill definitions | 28 | MD+YAML frontmatter | Human | Claude |
| MCP tool schemas | 15 tools / 5 servers | TypeScript/Zod | Human | Claude |
| MCP configs | 3 | JSON | Human | Claude Code |
| DSPy signatures | 5 classes | Python | Human | Claude via DSPy |
| System prompts | 2 | Plain text | Human | Claude |
| Conditional rules | 3 | MD+YAML | Human | Claude |
| Security rule configs | 7 | YAML | Human+scanners | Claude+scanners |
| Memory files | 6 | Markdown | Claude | Claude |
| Research docs | 5 | Markdown | Claude | Claude |
| Cofounder prompts | 3 | Markdown | Human+Claude | Claude |
| AGENTS.md | 1 | Markdown | Human | Claude |
| todos.jsonl | 9 | JSONL | Claude | Claude+Human |

### Agent Definition Patterns (migration needed)
- Pattern A (Claude Code native): YAML frontmatter — 18 agents
- Pattern B (older/generated): Header-driven markdown — 8 agents
- Pattern B should converge to Pattern A

### Agents by Sub-repo
| Sub-repo | Count | Models |
|----------|-------|--------|
| claude-code | 3 | inherit, haiku, sonnet |
| claude-code-actions | 4 | unset (Pattern B) |
| claude-code-agents-python | 6 | sonnet (Pattern B) |
| claude-code-security-review | 5 | sonnet, opus |
| claude-multi-agent-dispatch | 4 | sonnet, opus |
| claude-multi-agent-sdk | 4 | haiku, sonnet, opus |

### MCP Servers (4 built, 0 for Linear)
| Server | Location | Tools |
|--------|----------|-------|
| dispatch-channel | channel-dispatch-routing | reply |
| multi-agent-research | multi-agent-sdk | classify_query, generate_tasks, synthesize_results, estimate_costs |
| shannon-thinking | multi-agent-dispatch | create_thought, chain_thoughts, track_assumption, challenge_assumption, compute_confidence, get_report |
| dispatch-tools | multi-agent-dispatch | classify_dispatch, plan_dispatch, execute_dispatch, check_status |

---

## Structured Outputs BY Claude (30 types)

| # | Artifact | Format | Destination | Consumer |
|---|---------|--------|-------------|----------|
| 1 | Git Commit | Conventional commit text | Git | Humans, CI |
| 2 | PR Description | Markdown sections | GitHub | Humans, Vercel |
| 3 | ThoughtChain | TS/JSONL | transcripts.jsonl | Next-round planner |
| 4 | CrawlPlan | TS object | Spider runner | Scrapy |
| 5 | DocPage/CrawlEvent | Pydantic→JSONL+Postgres | Neon runtime | ETL, scorer |
| 6 | QualityScore | Python/TS (5 dims) | JSONL, Neon facts | ETL, Slack |
| 7 | ImprovementFeedback | JSONL | improvements/ dir | ContextDelta |
| 8 | ContextDelta | Python/TS dataclass | Next-round config | Planner |
| 9 | DispatchEvent | TS union (7 subtypes) | JSONL+Neon | AuditStore |
| 10 | Transcript | JSONL (meta+msgs+events) | rounds/ dir | AuditorAgent |
| 11 | AuditReport | TS→JSONL+Postgres | Neon audit_logs | Humans |
| 12 | JudgmentResult | TS interface | AuditReport | AuditorAgent |
| 13 | RoutingDecision | TS→JSONL | routing log | Channel MCP |
| 14 | ChannelEvent | TS+Postgres | Neon channel_events | Agent loop |
| 15 | Linear Issue | GraphQL mutation | Linear API | Engineers |
| 16 | Slack Message | Block Kit JSON | Slack channel | Team |
| 17 | HTML Dashboard | Self-contained HTML | reports/ dir | Humans |
| 18 | DSPy Outputs | Typed Predictions (5) | Pipeline | Plugin/codegen |
| 19 | Plugin Scaffold | Dir of .md+.json | generated_plugins/ | Claude Code |
| 20 | Plugin Audit | Python dataclass | stdout, CI | CI pipeline |
| 21 | Security Finding | Python dataclass | stdout, CI | PreToolUse |
| 22 | Task/Todo | JSON+React state | Webapp, JSONL | Humans, Claude |
| 23 | ETL Fact/Dim Rows | Postgres rows | Neon reporting | Semantic views |
| 24 | Semantic Views | SQL views | Neon semantic | Analytics |
| 25 | RoundDefinition | TS static object | Dispatcher | Orchestrator |
| 26 | RoundResult | TS object | AuditStore | Next-round |
| 27 | TelemetryEvent | TS union (6 subtypes) | OTel→Grafana | Dashboards |
| 28 | StyleEvent | TS→Kimball facts | Neon style tables | Style analytics |
| 29 | ExperimentResult | TS object | In-memory | A/B analyst |
| 30 | Notion Page | Block Kit JSON | Notion API | Knowledge workers |

---

## Department Map (grounded in existing agents)

### Engineering (most mature)
Codegen agents: spider-architect, codegen-assistant, research-worker
Cowork agents: context-engineer, research-orchestrator, synthesis-agent
Skills: codegen, run-campaign, improve-spider, multi-agent-research
Outputs: Code, commits, PRs, transcripts, round results, experiments

### Data (infrastructure exists)
Codegen agents: crawl-orchestrator, crawl-campaign-manager
Cowork agents: quality-analyst, schema-discoverer, extraction-critic
Skills: crawl-plan, crawl-report, analyze-quality, extract-review
Outputs: CrawlEvents, QualityScores, ContextDeltas, ETL facts, semantic views

### Security/Alignment (scanners exist)
Codegen agents: spider-security-reviewer, data-leak-scanner
Cowork agents: pipeline-auditor, plugin-auditor, multi-lang-security
Skills: security-scan, ssrf-check, pii-check, plugin-review, dependency-audit
Outputs: SecurityFindings, PluginAuditReports, SSRFVulnerabilities, PIIMatches

### Product (gap — Jade's first department)
Codegen agents: (none dedicated)
Cowork agents: cowork-assistant (exists), dispatch-orchestrator
Skills: cowork-task (exists)
Outputs: Linear issues (via linear_sync.py — unwired), cofounder prompts
MISSING: strategy templates, requirements capture, competitive analysis, monthly review

---

## The Constraint (per Theory of Constraints)

128 structured inputs. 30 structured output types. 26 named agents. 28 skills.
4 MCP servers. 7 Neon schemas. 8 spiders. 5 research docs.

All disconnected.

The bottleneck is not components. It is the LOOP:
  ticket → research → plan → execute → validate → persist → close → learn

Every piece exists. Nothing connects them end-to-end.
Jade's job is to be the loop.
