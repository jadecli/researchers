#!/usr/bin/env bash
# .claude/hooks/validate-commit.sh — PreToolUse hook for git commit validation
# Intercepts Bash tool calls containing 'git commit' to validate:
# 1. Conventional commit format (type: description)
# 2. No secrets in commit message
# 3. Agentcommits trailer format (if present)
#
# Reads JSON from stdin: {"tool_name": "Bash", "tool_input": {"command": "..."}}
# Exit 0 = allow, Exit 2 = block with message

set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# Only intercept Bash calls that look like git commits
if [ "$TOOL_NAME" != "Bash" ]; then
  exit 0
fi

if ! echo "$COMMAND" | grep -q 'git commit'; then
  exit 0
fi

# ── Extract commit message ─────────────────────────────────────
# Try to extract -m "message" or HEREDOC message
COMMIT_MSG=""
if echo "$COMMAND" | grep -qE '\-m\s+"'; then
  COMMIT_MSG=$(echo "$COMMAND" | sed -n 's/.*-m\s*"\([^"]*\)".*/\1/p' | head -1)
elif echo "$COMMAND" | grep -qE '\-m\s+'"'"''; then
  COMMIT_MSG=$(echo "$COMMAND" | sed -n "s/.*-m\s*'\([^']*\)'.*/\1/p" | head -1)
elif echo "$COMMAND" | grep -q 'HEREDOC\|EOF'; then
  # HEREDOC-style: extract first non-empty line after cat <<
  COMMIT_MSG=$(echo "$COMMAND" | sed -n '/cat <<.*EOF/,/EOF/p' | grep -v 'EOF\|cat <<' | head -1 | sed 's/^[[:space:]]*//')
fi

if [ -z "$COMMIT_MSG" ]; then
  # Can't parse message — allow through (don't block on parsing failure)
  exit 0
fi

# ── Validate conventional commit format ────────────────────────
# First line must match: type(optional-scope)!: description
FIRST_LINE=$(echo "$COMMIT_MSG" | head -1)
if ! echo "$FIRST_LINE" | grep -qE '^(feat|fix|chore|docs|style|refactor|perf|test|ci|build|revert)(\([^)]+\))?!?:\s+.+'; then
  echo "COMMIT VALIDATION FAILED"
  echo ""
  echo "First line does not follow conventional commits format:"
  echo "  Got: $FIRST_LINE"
  echo "  Expected: type(scope): description"
  echo "  Valid types: feat, fix, chore, docs, style, refactor, perf, test, ci, build, revert"
  echo ""
  echo "Fix the commit message and try again."
  exit 2
fi

# ── Check for secrets in message ───────────────────────────────
if echo "$COMMIT_MSG" | grep -qiE '(password|secret|api.?key|token)\s*[:=]\s*\S{8,}'; then
  echo "COMMIT VALIDATION FAILED"
  echo ""
  echo "Commit message may contain a secret or credential."
  echo "Remove sensitive values before committing."
  exit 2
fi

# ── Validate agent trailers (if present) ───────────────────────
if echo "$COMMIT_MSG" | grep -q 'Agent-Id:'; then
  # Check required Agent-Authorship trailer
  if ! echo "$COMMIT_MSG" | grep -q 'Agent-Authorship:'; then
    echo "COMMIT VALIDATION WARNING"
    echo ""
    echo "Agent-Id trailer found but Agent-Authorship is missing."
    echo "Required agentcommits trailers: Agent-Id, Agent-Authorship"
    echo "Proceeding anyway (warning only)."
    # Don't block — just warn for now (Phase 1)
  fi

  # Validate Agent-Authorship value if present
  AUTHORSHIP=$(echo "$COMMIT_MSG" | grep 'Agent-Authorship:' | sed 's/Agent-Authorship:\s*//' | tr -d '[:space:]' | cut -d',' -f1)
  if [ -n "$AUTHORSHIP" ]; then
    case "$AUTHORSHIP" in
      agent-only|agent-primary|collaborative|human-primary)
        ;; # Valid
      *)
        echo "COMMIT VALIDATION WARNING"
        echo "Invalid Agent-Authorship value: $AUTHORSHIP"
        echo "Valid values: agent-only, agent-primary, collaborative, human-primary"
        ;;
    esac
  fi
fi

# All checks passed
exit 0
