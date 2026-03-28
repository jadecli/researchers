#!/usr/bin/env bash
# .claude/hooks/capture-prompt.sh — UserPromptSubmit hook
# Captures user prompts to local JSONL buffer for agentstreams.
# Buffer flushes to Neon via flush-streams.sh (called at Stop).
# Non-blocking (always exits 0). Never fails the session.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
BUFFER_DIR="$ROOT/.claude/memory/streams"
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
BUFFER_FILE="$BUFFER_DIR/buffer.jsonl"
MANIFEST_FILE="$BUFFER_DIR/${BRANCH//\//_}.json"

# Ensure buffer directory exists
mkdir -p "$BUFFER_DIR"

# Read the user prompt from stdin (Claude hook protocol)
INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.user_prompt // .prompt // ""' 2>/dev/null || echo "")

# Skip empty prompts
if [ -z "$PROMPT" ] || [ "$PROMPT" = "null" ]; then
    exit 0
fi

# Compute metadata
CHAR_COUNT=${#PROMPT}
WORD_COUNT=$(echo "$PROMPT" | wc -w | tr -d ' ')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
SESSION_ID="${CLAUDE_SESSION_ID:-$(cat "$BUFFER_DIR/.session_id" 2>/dev/null || echo "unknown")}"

# Detect intent signals from prompt content
INTENT_SIGNALS="[]"
SIGNALS=()
echo "$PROMPT" | grep -qiE '(create|open|make|submit).*(pr|pull.?request)' && SIGNALS+=("pr")
echo "$PROMPT" | grep -qiE '(commit|push|merge)' && SIGNALS+=("commit")
echo "$PROMPT" | grep -qiE '(fix|bug|error|broken)' && SIGNALS+=("fix")
echo "$PROMPT" | grep -qiE '(refactor|clean|simplify)' && SIGNALS+=("refactor")
echo "$PROMPT" | grep -qiE '(test|spec|assert)' && SIGNALS+=("test")
echo "$PROMPT" | grep -qiE '(research|explore|investigate|understand)' && SIGNALS+=("research")
echo "$PROMPT" | grep -qiE '(build|create|add|implement|write)' && SIGNALS+=("codegen")
echo "$PROMPT" | grep -qiE '(review|audit|check|validate)' && SIGNALS+=("review")
if [ ${#SIGNALS[@]} -gt 0 ]; then
    INTENT_SIGNALS=$(printf '%s\n' "${SIGNALS[@]}" | jq -R . | jq -s .)
fi

# Detect file mentions (paths with extensions)
MENTIONS_FILES=$(echo "$PROMPT" | grep -oE '[a-zA-Z0-9_./-]+\.[a-zA-Z]{1,5}' | head -20 | jq -R . | jq -s . 2>/dev/null || echo "[]")

# Detect URL mentions
MENTIONS_URLS=$(echo "$PROMPT" | grep -oE 'https?://[^ ]+' | head -10 | jq -R . | jq -s . 2>/dev/null || echo "[]")

# Get current sequence number from manifest
SEQ=0
if [ -f "$MANIFEST_FILE" ]; then
    SEQ=$(jq -r '.event_counts.prompt // 0' "$MANIFEST_FILE" 2>/dev/null || echo "0")
fi
SEQ=$((SEQ + 1))

# Estimate token count (~4 chars per token)
TOKEN_COUNT=$(( (CHAR_COUNT + 3) / 4 ))

# Build the stream event (matches streams.events envelope)
EVENT=$(jq -n \
    --arg event_type "prompt" \
    --arg session_id "$SESSION_ID" \
    --argjson sequence_number "$SEQ" \
    --arg git_branch "$BRANCH" \
    --arg git_sha "$GIT_SHA" \
    --arg agent_id "orchestrator" \
    --arg user_id "${GITHUB_USER:-$(git config user.name 2>/dev/null || echo "unknown")}" \
    --arg surface "${CLAUDE_SURFACE:-cli}" \
    --argjson token_count "$TOKEN_COUNT" \
    --arg created_at "$TIMESTAMP" \
    --arg prompt_text "$PROMPT" \
    --argjson char_count "$CHAR_COUNT" \
    --argjson word_count "$WORD_COUNT" \
    --argjson intent_signals "$INTENT_SIGNALS" \
    --argjson mentions_files "$MENTIONS_FILES" \
    --argjson mentions_urls "$MENTIONS_URLS" \
    --argjson prompt_index "$SEQ" \
    '{
        event_type: $event_type,
        session_id: $session_id,
        sequence_number: $sequence_number,
        git_branch: $git_branch,
        git_sha: $git_sha,
        agent_id: $agent_id,
        user_id: $user_id,
        surface: $surface,
        token_count: $token_count,
        created_at: $created_at,
        payload: {
            prompt_text: $prompt_text,
            prompt_index: $prompt_index,
            char_count: $char_count,
            word_count: $word_count,
            intent_signals: $intent_signals,
            mentions_files: $mentions_files,
            mentions_urls: $mentions_urls
        }
    }')

# Append to local JSONL buffer
echo "$EVENT" >> "$BUFFER_FILE"

# Update branch manifest
if [ -f "$MANIFEST_FILE" ]; then
    MANIFEST=$(jq \
        --argjson seq "$SEQ" \
        --arg ts "$TIMESTAMP" \
        '.event_counts.prompt = $seq | .last_flushed_at = $ts | .neon_synced = false' \
        "$MANIFEST_FILE")
else
    MANIFEST=$(jq -n \
        --arg branch "$BRANCH" \
        --arg session_id "$SESSION_ID" \
        --argjson seq "$SEQ" \
        --arg ts "$TIMESTAMP" \
        '{
            branch: $branch,
            session_id: $session_id,
            last_event_id: 0,
            event_counts: { prompt: $seq, commit: 0, session: 0 },
            last_flushed_at: $ts,
            neon_synced: false
        }')
fi
echo "$MANIFEST" > "$MANIFEST_FILE"

# Never block session
exit 0
