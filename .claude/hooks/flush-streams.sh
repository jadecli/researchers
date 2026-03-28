#!/usr/bin/env bash
# .claude/hooks/flush-streams.sh — Flush local JSONL buffer to Neon
# Called manually or from a Stop hook. Reads buffer.jsonl, batch-inserts
# into streams.events via psql, then truncates buffer on success.
# Non-blocking. Requires DATABASE_URL env var for Neon connection.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
BUFFER_DIR="$ROOT/.claude/memory/streams"
BUFFER_FILE="$BUFFER_DIR/buffer.jsonl"
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
MANIFEST_FILE="$BUFFER_DIR/${BRANCH//\//_}.json"

# Check prerequisites
if [ ! -f "$BUFFER_FILE" ] || [ ! -s "$BUFFER_FILE" ]; then
    echo "flush-streams: buffer empty, nothing to flush"
    exit 0
fi

if [ -z "${DATABASE_URL:-}" ]; then
    EVENT_COUNT=$(wc -l < "$BUFFER_FILE" | tr -d ' ')
    echo "flush-streams: DATABASE_URL not set, $EVENT_COUNT events buffered locally"
    echo "  Buffer: $BUFFER_FILE"
    echo "  Set DATABASE_URL to enable Neon sync"
    exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
    echo "flush-streams: psql not found, buffer retained"
    exit 0
fi

# Count events before flush
EVENT_COUNT=$(wc -l < "$BUFFER_FILE" | tr -d ' ')
echo "flush-streams: flushing $EVENT_COUNT events to Neon..."

# Build batch INSERT from JSONL
# Each line is a full event JSON — extract envelope fields + payload
FAILED=0
while IFS= read -r line; do
    # Extract fields from JSON envelope
    EVENT_TYPE=$(echo "$line" | jq -r '.event_type')
    SESSION_ID=$(echo "$line" | jq -r '.session_id')
    SEQ=$(echo "$line" | jq -r '.sequence_number')
    GIT_BRANCH=$(echo "$line" | jq -r '.git_branch')
    GIT_SHA=$(echo "$line" | jq -r '.git_sha')
    AGENT_MODEL=$(echo "$line" | jq -r '.agent_model // "opus"')
    AGENT_ID=$(echo "$line" | jq -r '.agent_id')
    USER_ID=$(echo "$line" | jq -r '.user_id')
    SURFACE=$(echo "$line" | jq -r '.surface')
    PAYLOAD=$(echo "$line" | jq -c '.payload')
    TOKEN_COUNT=$(echo "$line" | jq -r '.token_count // 0')

    # Insert into Neon (parameterized via psql variables)
    psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 <<SQL 2>/dev/null || FAILED=$((FAILED + 1))
INSERT INTO streams.events (
    event_type, session_id, sequence_number, git_branch, git_sha,
    agent_model, agent_id, user_id, surface, payload, token_count
) VALUES (
    '${EVENT_TYPE}', '${SESSION_ID}', ${SEQ}, '${GIT_BRANCH}', '${GIT_SHA}',
    '${AGENT_MODEL}', '${AGENT_ID}', '${USER_ID}', '${SURFACE}',
    '${PAYLOAD}'::jsonb, ${TOKEN_COUNT}
);
SQL
done < "$BUFFER_FILE"

SUCCEEDED=$((EVENT_COUNT - FAILED))
echo "flush-streams: $SUCCEEDED/$EVENT_COUNT events flushed to Neon ($FAILED failed)"

# On full success, truncate buffer and update manifest
if [ "$FAILED" -eq 0 ]; then
    > "$BUFFER_FILE"
    if [ -f "$MANIFEST_FILE" ] && command -v jq >/dev/null 2>&1; then
        jq '.neon_synced = true | .last_flushed_at = (now | todate)' \
            "$MANIFEST_FILE" > "$MANIFEST_FILE.tmp" && mv "$MANIFEST_FILE.tmp" "$MANIFEST_FILE"
    fi
    echo "flush-streams: buffer cleared, manifest updated"
else
    echo "flush-streams: $FAILED events retained in buffer for retry"
fi

exit 0
