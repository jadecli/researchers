// src/hooks/profiles.ts — Hook profile configurations for agent coordination
//
// Claude Code hooks fire at lifecycle points and can block, modify,
// or inject context. Four types: command (shell), http (webhook),
// prompt (single-turn LLM eval), agent (multi-turn subagent verifier).

// ── Hook Configuration Types ────────────────────────────────────
export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'Stop'
  | 'TaskCompleted'
  | 'UserPromptSubmit'
  | 'SessionStart';

export type HookType =
  | { readonly type: 'command'; readonly command: string; readonly timeout?: number }
  | { readonly type: 'http'; readonly url: string; readonly method: 'POST'; readonly headers?: Record<string, string> }
  | { readonly type: 'prompt'; readonly prompt: string; readonly model?: string }
  | { readonly type: 'agent'; readonly agentPrompt: string; readonly tools: ReadonlyArray<string> };

export type HookRule = {
  readonly matcher: string;
  readonly hooks: ReadonlyArray<HookType>;
};

export type HookProfile = Partial<Record<HookEvent, ReadonlyArray<HookRule>>>;

// ── Research Agent Hook Profile ─────────────────────────────────
export const researchAgentHooks: HookProfile = {
  // Auto-format files after write/edit
  PostToolUse: [
    {
      matcher: 'Write|Edit',
      hooks: [
        {
          type: 'command',
          command:
            'npx prettier --write "$CLAUDE_TOOL_INPUT_FILE_PATH" 2>/dev/null || true',
        },
      ],
    },
  ],
  // Block dangerous commands
  PreToolUse: [
    {
      matcher: 'Bash',
      hooks: [
        {
          type: 'command',
          command: `INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
if echo "$COMMAND" | grep -qE 'rm -rf|sudo|curl.*\\|.*sh|wget.*\\|.*sh'; then
  echo "Blocked dangerous command" >&2
  exit 2
fi
exit 0`,
        },
      ],
    },
  ],
  // Log subagent completions for coordination tracking
  SubagentStop: [
    {
      matcher: '.*',
      hooks: [
        {
          type: 'command',
          command:
            'INPUT=$(cat); AGENT=$(echo "$INPUT" | jq -r ".agent_type // \"unknown\""); echo "[$(date -Iseconds)] Subagent $AGENT completed" >> /tmp/agent-coordination.log',
        },
      ],
    },
  ],
  // Snapshot state before compaction
  Stop: [
    {
      matcher: '.*',
      hooks: [
        {
          type: 'command',
          command: `INPUT=$(cat)
IS_STOP=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$IS_STOP" = "false" ]; then
  echo '{"decision":"block","reason":"Verify all research tasks completed before stopping"}'
fi
exit 0`,
        },
      ],
    },
  ],
};

// ── Security-Focused Hook Profile ───────────────────────────────
export const securityHooks: HookProfile = {
  PreToolUse: [
    {
      matcher: 'Bash',
      hooks: [
        {
          type: 'command',
          command: `INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
# Block access to internal networks
if echo "$COMMAND" | grep -qE '(127\\.|10\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.|192\\.168\\.|localhost|0\\.0\\.0\\.0)'; then
  echo "Blocked: Cannot access internal/private addresses" >&2
  exit 2
fi
# Block credential exfiltration
if echo "$COMMAND" | grep -qE '(\\$AWS_|\\$ANTHROPIC_|\\$API_KEY|/\\.env|/\\.ssh)'; then
  echo "Blocked: Cannot access credentials" >&2
  exit 2
fi
exit 0`,
        },
      ],
    },
    {
      matcher: 'WebFetch|WebSearch',
      hooks: [
        {
          type: 'command',
          command: `INPUT=$(cat)
URL=$(echo "$INPUT" | jq -r '.tool_input.url // empty')
if echo "$URL" | grep -qE '(localhost|127\\.|10\\.|192\\.168\\.)'; then
  echo "Blocked: Cannot fetch internal URLs" >&2
  exit 2
fi
exit 0`,
        },
      ],
    },
  ],
};

// ── CI/CD Hook Profile ──────────────────────────────────────────
export const ciHooks: HookProfile = {
  PostToolUse: [
    {
      matcher: 'Write|Edit',
      hooks: [
        {
          type: 'command',
          command: 'npx prettier --check "$CLAUDE_TOOL_INPUT_FILE_PATH" 2>/dev/null || echo "Format check failed" >&2',
        },
      ],
    },
  ],
  Stop: [
    {
      matcher: '.*',
      hooks: [
        {
          type: 'command',
          command: `INPUT=$(cat)
LAST_MSG=$(echo "$INPUT" | jq -r '.last_assistant_message // ""')
# Ensure structured output was produced
if ! echo "$LAST_MSG" | grep -q '"findings"'; then
  echo '{"decision":"block","reason":"CI review must produce structured findings JSON"}'
fi
exit 0`,
        },
      ],
    },
  ],
};

// ── Settings.json Generator ─────────────────────────────────────
export function generateSettingsJson(profile: HookProfile): string {
  return JSON.stringify({ hooks: profile }, null, 2);
}

// ── Merge Profiles ──────────────────────────────────────────────
export function mergeProfiles(...profiles: ReadonlyArray<HookProfile>): HookProfile {
  const merged: Record<string, HookRule[]> = {};

  for (const profile of profiles) {
    for (const [event, rules] of Object.entries(profile)) {
      if (!merged[event]) merged[event] = [];
      merged[event].push(...(rules as HookRule[]));
    }
  }

  return merged as HookProfile;
}
