# Agentcommits: Extending Conventional Commits for Agent Workflows

> Research note from Claude Code sessions: 2026-03-27, 2026-03-28
> Status: P1 — Crawl findings integrated, implementation in progress
> Related: agentskills.io, agenttasks specification, conventional commits
> Crawl targets: stainless-api/*, googleapis/release-please, conventional-commits/*

## Summary

Agentcommits is a backward-compatible extension to conventional commits that adds
structured agent metadata via native git trailers. It fills the "commit layer" gap
in the dual human/agent format pipeline.

**Updated 2026-03-28**: Crawl research across 4 GitHub org/repo sets confirms the
extension is viable. The conventional commits spec explicitly supports custom footer
tokens, release-please has clean extension points, and stainless-api demonstrates
the production pattern of conventional commits + Release Please in SDK generation.

## The Gap Conventional Commits Leave

Conventional commits (`feat:`, `fix:`, `chore:`) were designed for human changelog
generation and semver automation. They answer: *"What changed and should the version bump?"*

They don't answer questions agents care about:
- **What tool/capability was used?** (code generation, web search, file editing)
- **What was the confidence level?** (deterministic refactor vs. heuristic fix)
- **What context was consumed?** (which files were read, what MCP tools invoked)
- **Is this human-authored, agent-authored, or collaborative?**

This metadata matters increasingly as codebases become mixed-authorship. GitHub
already surfaces "co-authored-by" in commits — agentcommits formalizes the agent side.

## Alignment With Existing Stack

| Layer | Human Format | Agent Format | Status |
|-------|-------------|-------------|--------|
| **Tasks** | agenttasks.io webapp | agenttasks specification (JSON) | Covered |
| **Skills** | agentskills.io docs | agentskills specification | Covered (Anthropic-owned) |
| **Commits** | conventional commits | agentcommits trailers | **This doc — implementing** |
| **Web Content** | HTML pages | llms.txt, AGENTS.md, markdown mirrors | Planned |

## Crawl Research Findings

### 1. Conventional Commits Spec (conventionalcommits.org)

**Footer/Trailer support is first-class in v1.0.0:**
- Format: `<token><separator><value>` where separator is `:<space>` or `<space>#`
- Tokens use hyphens instead of spaces (e.g., `Acked-by`, `Closes`)
- Multi-line values supported via continuation lines
- Spec explicitly inspired by git trailer convention
- `BREAKING CHANGE` / `BREAKING-CHANGE` are the only special-cased tokens

**Extension mechanisms:**
- "Types other than `fix` and `feat` MAY be used in your commit messages"
- Communities encouraged to "come up with their own types"
- No formal grammar (BNF/ABNF) — prose-based with RFC 2119 keywords
- Recommendation: use SemVer to version custom extensions

**Key insight**: Agent metadata trailers (`Agent-Id: claude-opus-4-6`) are fully
spec-compliant. No spec modification needed.

### 2. Conventional Commits Parser (@conventional-commits/parser v0.4.1)

**Architecture:**
- JavaScript recursive descent parser to unist-compliant AST
- Two exports: `parser(text)` to AST, `toConventionalChangelogFormat(ast)` to changelog
- Footer parsing extracts Token/Separator/Value with multi-line continuation support

**Extensibility: LOW-MEDIUM**
- Not plugin-based — designed as focused reference implementation
- Downstream consumers use unist tree traversal (`unist-util-visit`)
- Known issue #41: "Grammar cannot read git trailers" — community wants better support
- Known issue #47: Grammar doesn't enforce whitespace after `:` in footers

**Implication for agentcommits**: Parser handles agent trailers as generic Footer nodes.
Custom validation layer needed for agent-specific trailer semantics. The unist AST is
composable — downstream tools can enrich trailer nodes without parser changes.

### 3. Release-Please (googleapis/release-please)

**How it works with conventional commits:**
- `fix:` to patch bump, `feat:` to minor bump, `!` suffix or `BREAKING CHANGE:` footer to major
- 26+ language strategies (Node, Python, Java, Go, Rust, Ruby, PHP, etc.)
- 8 plugins for workspace coordination (cargo-workspace, node-workspace, maven-workspace)
- Monorepo support via `.release-please-manifest.json` + `release-please-config.json`

**Extension points for agentcommits:**
1. **Custom VersioningStrategy** — agent-specific version bumping rules
2. **Custom ChangelogNotes** — format agent attribution in changelogs
3. **Custom Plugin** — process agent metadata trailers, group commits by agent
4. **PR template tokens** — could add `${agent-id}`, `${agent-metadata}`
5. **Configuration** — `agent-metadata-fields` in release-please-config.json

**Already parses footers**: Uses `@conventional-commits/parser` which handles
`BREAKING CHANGE:` and `RELEASE AS:` footers. Adding `Agent-Id:`, `Agent-Model:`
follows the same pattern.

### 4. Stainless-API (Production Pattern)

**Commit conventions:**
- Strict conventional commits: `feat:`, `fix:`, `chore:`, `docs:` with scopes
- Enforced via CONTRIBUTING.md: "The commit message should follow conventional commits"
- Monorepo scopes: `feat(hono):`, `fix(prisma):` for package-specific changes

**Release automation:**
- Release Please with `node-workspace` plugin for 10-package monorepo
- Automated changelogs from conventional commits
- `pnpm publish-git` after Release PR merge
- SDK generation via `upload-openapi-spec-action` (file-change driven, not commit-driven)

**Agent/AI tooling:**
- `mcp-evals-harness`: Three-tier Braintrust tagging, LLM-as-judge scoring
- `mcp-front`: Auth proxy for Claude/AI models to access internal APIs
- `rerereric`: Fuzzy git rerere for merge conflict automation
- CLAUDE.md files present in repos (Claude-specific configuration)

**Key insight**: Stainless doesn't use custom commit types — strictly adheres to spec.
Agent metadata should live in trailers, not custom types, to maintain Release Please
compatibility. This validates the agentcommits approach.

## Proposed Format (Updated)

Backward-compatible with conventional commits. Any valid conventional commit is
a valid agentcommit. Agent metadata lives in git trailers (a native git concept):

```
feat(styles): add style management module with Kimball analytics

Implements dimensional modeling for style artifact tracking with
SCD Type 2 slowly-changing dimensions and BRIN indexes.

Agent-Id: claude-opus-4-6
Agent-Tools: Read, Write, Edit, Grep, Glob
Agent-Context-Files: 6 read, 4 created, 1 modified
Agent-Confidence: high
Agent-Authorship: agent-primary, human-directed
Agent-Task-Ref: agenttasks://style-artifacts
Agent-Skill-Ref: agentskills://typescript-strict, agentskills://dimensional-modeling
Agent-Session: claude-code/session_abc123
Agent-Cost-USD: 0.042
Agent-Input-Tokens: 15230
Agent-Output-Tokens: 4891
```

### Trailer Field Definitions

| Trailer | Required | Type | Description |
|---------|----------|------|-------------|
| `Agent-Id` | Yes | string | Model identifier (e.g., `claude-opus-4-6`) |
| `Agent-Tools` | No | csv | Tools used in this commit's changes |
| `Agent-Context-Files` | No | string | Summary of files read/created/modified |
| `Agent-Confidence` | No | enum | `high`, `medium`, `low` — determinism of change |
| `Agent-Authorship` | Yes | enum | `agent-only`, `agent-primary`, `collaborative`, `human-primary` |
| `Agent-Task-Ref` | No | uri | Link to agenttasks task definition |
| `Agent-Skill-Ref` | No | csv-uri | Skills used from agentskills registry |
| `Agent-Session` | No | string | Session identifier for traceability |
| `Agent-Cost-USD` | No | float | Total API cost for this commit's work |
| `Agent-Input-Tokens` | No | int | Input tokens consumed |
| `Agent-Output-Tokens` | No | int | Output tokens generated |

### Bloom Filter Index for Trailer Routing

Agent trailers create a routing problem: which commits need agent-aware processing?
A bloom filter over commit trailer prefixes (`Agent-*`) enables O(1) pre-check before
parsing. This pairs with the existing bloom filter pattern in the dispatch system:

```python
# Bloom filter check before expensive parsing
if bloom_filter.might_contain(f"Agent-Id:{commit_hash}"):
    trailers = parse_agent_trailers(commit_message)
    route_to_agent_pipeline(trailers)
else:
    route_to_standard_pipeline(commit_message)
```

## Why Extension, Not Fork

1. **Tooling compatibility** — commitlint, semantic-release, changelogen, and every
   CI tool that parses conventional commits continues to work. Agent metadata lives
   in trailers, which these tools ignore gracefully.

2. **Adoption path** — Developers already know conventional commits. Asking them to
   learn a new format is a non-starter. Asking them to *optionally append structured
   trailers* is trivial.

3. **Progressive enhancement** — Human-only repos don't need agent trailers.
   Agent-heavy repos get richer metadata. Mixed repos benefit most. This mirrors
   the dual-format webapp vision exactly.

## End-to-End Traceability With agenttasks

```
agenttask (input) -> agentskill (capability) -> agentcommit (output)
    |                                              |
task board (human)                          changelog (human)
task API (agent)                            audit log (agent)
                                            eval dataset (agentevals)
```

This gives end-to-end traceability from task intent to code change, in both
human-readable and machine-parseable formats.

## Integration With Crawl Infrastructure

### Crawl Campaign: agentcommits-ecosystem

The crawl targets for agentcommits research are defined in
`claude-code-agents-python/src/dspy_pipeline/campaigns/agentcommits_campaign.py`.

Spiders: github_spider (org: stainless-api, conventional-commits)
Targets: release-please, parser, conventionalcommits.org, stainless-api/*

### DSPy Classification Pipeline

The commit classification pipeline uses DSPy signatures paired with bloom filters:

1. **CommitClassifier** — Classifies commit as agent-authored, human-authored, or mixed
2. **TrailerExtractor** — Extracts and validates agent trailers from commit messages
3. **QualityScorer** — Scores trailer completeness and consistency
4. **ConventionChecker** — Validates conventional commit format compliance

Pipeline defined in `claude-code-agents-python/src/dspy_pipeline/agentcommits/`.

## Eval Integration (agentevals)

Agentcommits generates natural eval datasets:

| Eval Dimension | Source | Metric |
|----------------|--------|--------|
| Trailer completeness | Agent-Id + Agent-Authorship presence | % commits with required trailers |
| Convention compliance | Conventional commit format validation | % parseable by @conventional-commits/parser |
| Cost tracking accuracy | Agent-Cost-USD vs actual API billing | Mean absolute error |
| Confidence calibration | Agent-Confidence vs eval pass rate | Brier score |
| Authorship attribution | Agent-Authorship vs git blame analysis | Cohen's kappa |

These feed into `reporting.fact_eval_finding` in the Neon warehouse.

## Implementation Phases

**Phase 1 (this PR): Infrastructure + Research**
- [x] Crawl stainless-api, release-please, conventional-commits repos
- [x] Document spec compatibility (trailers are spec-compliant)
- [x] Document Release Please extension points
- [x] Create crawl campaign definition
- [x] Create DSPy classification signatures
- [x] Create bloom filter for trailer routing
- [x] Create YAML agent definitions
- [x] Add todo items for subtask decomposition

**Phase 2: Start using trailers informally**
- [ ] Add `Agent-Id` and `Agent-Authorship` trailers to this repo's commits
- [ ] Create commitlint plugin that validates agent trailers
- [ ] Measure trailer adoption rate via semantic layer query

**Phase 3: Formalize trailer schema**
- [ ] Publish trailer field spec as part of agenttasks specification
- [ ] Create Release Please plugin for agent-aware changelogs
- [ ] Build eval dataset from trailer metadata
- [ ] Connect to agentevals fact tables

**Phase 4: Community (if Phase 2-3 prove valuable)**
- [ ] Publish as companion spec to conventional commits
- [ ] Submit PR to @conventional-commits/parser for agent trailer support
- [ ] Position as "conventional commits + agent metadata trailers"

## Risk Assessment

Near-zero risk. The approach is:
1. **Spec-compliant** — trailers are valid conventional commit footers
2. **Tool-compatible** — commitlint, semantic-release, Release Please all ignore unknown footers
3. **Reversible** — stop appending trailers at any time with zero migration cost
4. **Progressive** — human-only repos unaffected, mixed repos benefit most

Worst case: stop appending trailers. Best case: a complete dual-format pipeline
from task to deployment with full agent traceability.
