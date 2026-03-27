#!/usr/bin/env bash
# Pre-tool-use hook: validates that Bash commands do not target internal/private IPs.
# Reads JSON from stdin (the tool input), extracts the command field,
# and blocks requests to private/internal network ranges.
# Exit 2 = block the tool call, Exit 0 = allow.

set -euo pipefail

# Read JSON from stdin
INPUT=$(cat)

# Extract the command field from the JSON input
COMMAND=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    # Navigate to the command in tool_input
    tool_input = data.get('tool_input', data)
    if isinstance(tool_input, str):
        import json as j
        tool_input = j.loads(tool_input)
    print(tool_input.get('command', ''))
except Exception:
    print('')
" 2>/dev/null || echo "")

if [ -z "$COMMAND" ]; then
    exit 0
fi

# Define private/internal IP patterns
PRIVATE_PATTERNS=(
    '127\.[0-9]+\.[0-9]+\.[0-9]+'
    '10\.[0-9]+\.[0-9]+\.[0-9]+'
    '172\.(1[6-9]|2[0-9]|3[01])\.[0-9]+\.[0-9]+'
    '192\.168\.[0-9]+\.[0-9]+'
    'localhost'
    '0\.0\.0\.0'
    '\[::1\]'
)

# Check for curl, wget, fetch, or other HTTP-related commands targeting private IPs
for pattern in "${PRIVATE_PATTERNS[@]}"; do
    if echo "$COMMAND" | grep -qiE "(curl|wget|fetch|http|https|nc|ncat|telnet|ssh|ftp).*${pattern}"; then
        echo "BLOCKED: Command attempts to access internal/private network address matching pattern: ${pattern}" >&2
        exit 2
    fi
    # Also check if a URL contains the private IP
    if echo "$COMMAND" | grep -qiE "(https?://)${pattern}"; then
        echo "BLOCKED: URL targets internal/private network address matching pattern: ${pattern}" >&2
        exit 2
    fi
done

# Check for common DNS rebinding / internal hostnames
INTERNAL_HOSTNAMES=(
    '\.internal\.'
    '\.local$'
    '\.local[^a-zA-Z]'
    '\.corp\.'
    '\.intranet\.'
    '\.private\.'
)

for pattern in "${INTERNAL_HOSTNAMES[@]}"; do
    if echo "$COMMAND" | grep -qiE "(curl|wget|fetch|https?://).*${pattern}"; then
        echo "BLOCKED: Command targets internal hostname matching pattern: ${pattern}" >&2
        exit 2
    fi
done

# Allow the command
exit 0
