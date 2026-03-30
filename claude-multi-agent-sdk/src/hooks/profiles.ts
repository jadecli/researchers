// src/hooks/profiles.ts — Hook profile configurations for agent coordination
//
// Claude Code hooks fire at lifecycle points and can block, modify,
// or inject context. Four types: command (shell), http (webhook),
// prompt (single-turn LLM eval), agent (multi-turn subagent verifier).
//
// Reference: https://code.claude.com/docs/en/hooks
// All 25 hook events documented at the URL above.

// ── Official Tool Names (31 tools from docs) ──────────────────
// Used by bloom filter routing to validate tool dispatch targets.
export const CLAUDE_CODE_TOOLS = [
  'Agent', 'AskUserQuestion', 'Bash', 'CronCreate', 'CronDelete', 'CronList',
  'Edit', 'EnterPlanMode', 'EnterWorktree', 'ExitPlanMode', 'ExitWorktree',
  'Glob', 'Grep', 'ListMcpResourcesTool', 'LSP', 'NotebookEdit', 'PowerShell',
  'Read', 'ReadMcpResourceTool', 'Skill', 'TaskCreate', 'TaskGet', 'TaskList',
  'TaskOutput', 'TaskStop', 'TaskUpdate', 'TodoWrite', 'ToolSearch',
  'WebFetch', 'WebSearch', 'Write',
] as const;

export type ClaudeCodeToolName = (typeof CLAUDE_CODE_TOOLS)[number];

// Events that do NOT support matchers (matcher is silently ignored)
export const EVENTS_WITHOUT_MATCHER: readonly HookEvent[] = [
  'UserPromptSubmit', 'Stop', 'TeammateIdle', 'TaskCreated',
  'TaskCompleted', 'WorktreeCreate', 'WorktreeRemove', 'CwdChanged',
] as const;

// ── Hook Configuration Types ────────────────────────────────────

/** All 25 Claude Code hook events (from official docs) */
export type HookEvent =
  // Session lifecycle
  | 'SessionStart'
  | 'SessionEnd'
  // User interaction
  | 'UserPromptSubmit'
  // Tool lifecycle
  | 'PreToolUse'
  | 'PermissionRequest'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  // Subagent lifecycle
  | 'SubagentStart'
  | 'SubagentStop'
  // Task lifecycle
  | 'TaskCreated'
  | 'TaskCompleted'
  // Stop lifecycle
  | 'Stop'
  | 'StopFailure'
  // Team coordination
  | 'TeammateIdle'
  // Notification
  | 'Notification'
  // Instructions
  | 'InstructionsLoaded'
  // Config
  | 'ConfigChange'
  // File system
  | 'CwdChanged'
  | 'FileChanged'
  // Worktree
  | 'WorktreeCreate'
  | 'WorktreeRemove'
  // Context compaction
  | 'PreCompact'
  | 'PostCompact'
  // MCP elicitation
  | 'Elicitation'
  | 'ElicitationResult';

/**
 * Hook types matching official Claude Code docs.
 * - command: shell script, receives JSON on stdin, exit 0/2
 * - http: POST webhook, receives JSON body, returns JSON
 * - prompt: single-turn LLM eval, $ARGUMENTS replaced with input JSON
 * - agent: multi-turn subagent verifier with tool access
 */
export type HookType =
  | {
      readonly type: 'command';
      readonly command: string;
      readonly timeout?: number;     // default 600s
      readonly async?: boolean;       // fire-and-forget
      readonly shell?: 'bash' | 'powershell';
    }
  | {
      readonly type: 'http';
      readonly url: string;
      readonly headers?: Record<string, string>;
      readonly allowedEnvVars?: readonly string[];
      readonly timeout?: number;     // default 30s
    }
  | {
      readonly type: 'prompt';
      readonly prompt: string;        // $ARGUMENTS replaced with input JSON
      readonly model?: string;
      readonly timeout?: number;     // default 30s
    }
  | {
      readonly type: 'agent';
      readonly prompt: string;        // $ARGUMENTS replaced with input JSON
      readonly model?: string;
      readonly timeout?: number;     // default 60s
    };

export type HookRule = {
  /** Regex filter at the group level. What it matches depends on the event:
   *  - PreToolUse/PostToolUse/PostToolUseFailure/PermissionRequest: tool name
   *  - SessionStart: "startup"|"resume"|"clear"|"compact"
   *  - SessionEnd: "clear"|"resume"|"logout"|"prompt_input_exit"|"other"
   *  - SubagentStart/SubagentStop: agent type name
   *  - FileChanged: filename (basename)
   *  - StopFailure: error type
   *  - Notification/ConfigChange/InstructionsLoaded/PreCompact/PostCompact: source type
   *  - Elicitation/ElicitationResult: MCP server name
   *  Omit or "" to match all. Ignored on events without matcher support. */
  readonly matcher?: string;
  readonly hooks: ReadonlyArray<HookType & {
    /** Permission rule syntax filter on individual hooks. Only evaluated on tool events
     *  (PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest).
     *  On other events, a hook with `if` set never runs.
     *  Examples: "Bash(git commit*)", "Edit(*.ts)", "Bash(rm *)" */
    readonly if?: string;
    readonly statusMessage?: string;
    /** If true, runs only once per session then is removed. Skills only. */
    readonly once?: boolean;
  }>;
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
  // Block stop if research tasks not complete (Stop has no matcher — always fires)
  Stop: [
    {
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
  // Enforce structured findings output (Stop has no matcher — always fires)
  Stop: [
    {
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
