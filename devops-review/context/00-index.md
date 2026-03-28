# DevOps Review Context — Entry Point & Index

All reference documentation for the DevOps review engine architecture.
These files provide context for both Claude Code and Claude Cowork surfaces.

## Source URLs → Context Files

| Source URL | Context File | Category |
|-----------|-------------|----------|
| https://code.claude.com/docs/en/overview | `01-claude-code-overview.md` | Claude Code |
| https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md | `02-claude-code-changelog.md` | Claude Code |
| https://github.com/anthropics/claude-agent-sdk-python/blob/main/CHANGELOG.md | `03-agent-sdk-python-changelog.md` | Agent SDK |
| https://github.com/anthropics/claude-quickstarts/blob/main/CLAUDE.md | `04-claude-quickstarts.md` | Quickstarts |
| https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md | `05-agent-sdk-typescript-changelog.md` | Agent SDK |
| https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview | `06-agent-sdk-typescript-v2.md` | Agent SDK |
| https://platform.claude.com/docs/en/agent-sdk/typescript | `07-agent-sdk-typescript-v1.md` | Agent SDK |
| https://platform.claude.com/docs/en/agent-sdk/python | `08-agent-sdk-python-reference.md` | Agent SDK |
| https://github.com/anthropics/claude-code-security-review | `09-security-review-action.md` | GitHub Actions |
| https://github.com/anthropics/claude-code-action | `10-claude-code-action.md` | GitHub Actions |
| https://github.com/modelcontextprotocol/modelcontextprotocol/releases | `11-mcp-spec-releases.md` | MCP |
| https://github.com/modelcontextprotocol/typescript-sdk | `12-mcp-typescript-sdk.md` | MCP |
| https://github.com/modelcontextprotocol/python-sdk | `13-mcp-python-sdk.md` | MCP |

## How These Map to the DevOps Engine

### Claude Code Agent Surface
- `01` → Overview of Claude Code capabilities, surfaces, and CLI
- `02` → Changelog for version compatibility
- `07` → TypeScript V1 SDK: `query()`, `Options`, `AgentDefinition`, hooks, MCP servers
- `06` → TypeScript V2 SDK: `createSession()`, `send()`, `stream()` patterns
- `05` → TypeScript SDK changelog for breaking changes

### Claude Cowork Skill Surface
- `01` → Cowork is described as a simplified Code surface (same engine)
- `06` → V2 session patterns align with Cowork's scheduled tasks
- `09` → Security review skill can complement DevOps review

### Shared Engine
- `08`, `03` → Python SDK for potential Python-based orchestration
- `10` → `claude-code-action@v1` used in improvement-cycle.yml and pr-spider-review.yml
- `11`, `12`, `13` → MCP spec and SDKs for connector architecture

### Architecture Decisions
- `04` → Quickstarts CLAUDE.md: coding conventions (snake_case, PascalCase, strict types)
- `09` → Security review patterns (diff-aware scanning, PR comments, false positive filtering)
- `10` → Solutions patterns (PR review, issue triage, documentation sync, security reviews)
