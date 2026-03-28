---
source: https://code.claude.com/docs/en/changelog
fetched: 2026-03-28
description: Claude Code changelog — release notes by version (2.1.86 down to 0.2.21)
---

# Claude Code Changelog

> Release notes for Claude Code, including new features, improvements, and bug fixes by version.

This page is generated from the [CHANGELOG.md on GitHub](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md).

Run `claude --version` to check your installed version.

## 2.1.86 (March 27, 2026)

* Added `X-Claude-Code-Session-Id` header to API requests so proxies can aggregate requests by session without parsing the body
* Added `.jj` and `.sl` to VCS directory exclusion lists so Grep and file autocomplete don't descend into Jujutsu or Sapling metadata
* Fixed `--resume` failing with "tool_use ids were found without tool_result blocks" on sessions created before v2.1.85
* Fixed Write/Edit/Read failing on files outside the project root (e.g., `~/.claude/CLAUDE.md`) when conditional skills or rules are configured
* Fixed unnecessary config disk writes on every skill invocation that could cause performance issues and config corruption on Windows
* Fixed potential out-of-memory crash when using `/feedback` on very long sessions with large transcript files
* Fixed `--bare` mode dropping MCP tools in interactive sessions and silently discarding messages enqueued mid-turn
* Fixed the `c` shortcut copying only ~20 characters of the OAuth login URL instead of the full URL
* Fixed masked input (e.g., OAuth code paste) leaking the start of the token when wrapping across multiple lines on narrow terminals
* Fixed official marketplace plugin scripts failing with "Permission denied" on macOS/Linux since v2.1.83
* Fixed statusline showing another session's model when running multiple Claude Code instances and using `/model` in one of them
* Fixed scroll not following new messages after wheel scroll or click-to-select at the bottom of a long conversation
* Fixed `/plugin` uninstall dialog: pressing `n` now correctly uninstalls the plugin while preserving its data directory
* Fixed a regression where pressing Enter after clicking could leave the transcript blank until the response arrived
* Fixed `ultrathink` hint lingering after deleting the keyword
* Fixed memory growth in long sessions from markdown/highlight render caches retaining full content strings
* Reduced startup event-loop stalls when many claude.ai MCP connectors are configured (macOS keychain cache extended from 5s to 30s)
* Reduced token overhead when mentioning files with `@` — raw string content no longer JSON-escaped
* Improved prompt cache hit rate for Bedrock, Vertex, and Foundry users by removing dynamic content from tool descriptions
* Memory filenames in the "Saved N memories" notice now highlight on hover and open on click
* Skill descriptions in the `/skills` listing are now capped at 250 characters to reduce context usage
* Changed `/skills` menu to sort alphabetically for easier scanning
* Auto mode now shows "unavailable for your plan" when disabled by plan restrictions (was "temporarily unavailable")
* [VSCode] Fixed extension incorrectly showing "Not responding" during long-running operations
* [VSCode] Fixed extension defaulting Max plan users to Sonnet after the OAuth token refreshes (8 hours after login)
* Read tool now uses compact line-number format and deduplicates unchanged re-reads, reducing token usage

## 2.1.85 (March 26, 2026)

* Added `CLAUDE_CODE_MCP_SERVER_NAME` and `CLAUDE_CODE_MCP_SERVER_URL` environment variables to MCP `headersHelper` scripts, allowing one helper to serve multiple servers
* Added conditional `if` field for hooks using permission rule syntax (e.g., `Bash(git *)`) to filter when they run, reducing process spawning overhead
* Added timestamp markers in transcripts when scheduled tasks (`/loop`, `CronCreate`) fire
* Added trailing space after `[Image #N]` placeholder when pasting images
* Deep link queries (`claude-cli://open?q=…`) now support up to 5,000 characters, with a "scroll to review" warning for long pre-filled prompts
* MCP OAuth now follows RFC 9728 Protected Resource Metadata discovery to find the authorization server
* Plugins blocked by organization policy (`managed-settings.json`) can no longer be installed or enabled, and are hidden from marketplace views
* PreToolUse hooks can now satisfy `AskUserQuestion` by returning `updatedInput` alongside `permissionDecision: "allow"`, enabling headless integrations that collect answers via their own UI
* `tool_parameters` in OpenTelemetry tool_result events are now gated behind `OTEL_LOG_TOOL_DETAILS=1`
* Fixed `/compact` failing with "context exceeded" when the conversation has grown too large for the compact request itself to fit
* Fixed `/plugin enable` and `/plugin disable` failing when a plugin's install location differs from where it's declared in settings
* Fixed `--worktree` exiting with an error in non-git repositories before the `WorktreeCreate` hook could run
* Fixed `deniedMcpServers` setting not blocking claude.ai MCP servers
* Fixed `switch_display` in the computer-use tool returning "not available in this session" on multi-monitor setups
* Fixed crash when `OTEL_LOGS_EXPORTER`, `OTEL_METRICS_EXPORTER`, or `OTEL_TRACES_EXPORTER` is set to `none`
* Fixed diff syntax highlighting not working in non-native builds
* Fixed MCP step-up authorization failing when a refresh token exists — servers requesting elevated scopes via `403 insufficient_scope` now correctly trigger the re-authorization flow
* Fixed memory leak in remote sessions when a streaming response is interrupted
* Fixed persistent ECONNRESET errors during edge connection churn by using a fresh TCP connection on retry
* Fixed prompts getting stuck in the queue after running certain slash commands, with up-arrow unable to retrieve them
* Fixed Python Agent SDK: `type:'sdk'` MCP servers passed via `--mcp-config` are no longer dropped during startup
* Fixed raw key sequences appearing in the prompt when running over SSH or in the VS Code integrated terminal
* Fixed Remote Control session status staying stuck on "Requires Action" after a permission is resolved
* Fixed shift+enter and meta+enter being intercepted by typeahead suggestions instead of inserting newlines
* Fixed stale content bleeding through when scrolling up during streaming
* Fixed terminal left in enhanced keyboard mode after exit in Ghostty, Kitty, WezTerm, and other terminals supporting the Kitty keyboard protocol — Ctrl+C and Ctrl+D now work correctly after quitting
* Improved @-mention file autocomplete performance on large repositories
* Improved PowerShell dangerous command detection
* Improved scroll performance with large transcripts by replacing WASM yoga-layout with a pure TypeScript implementation
* Reduced UI stutter when compaction triggers on large sessions

## 2.1.84 (March 26, 2026)

* Added PowerShell tool for Windows as an opt-in preview. Learn more at [https://code.claude.com/docs/en/tools-reference#powershell-tool](https://code.claude.com/docs/en/tools-reference#powershell-tool)
* Added `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU}_MODEL_SUPPORTS` env vars to override effort/thinking capability detection for pinned default models for 3p (Bedrock, Vertex, Foundry), and `_MODEL_NAME`/`_DESCRIPTION` to customize the `/model` picker label
* Added `CLAUDE_STREAM_IDLE_TIMEOUT_MS` env var to configure the streaming idle watchdog threshold (default 90s)
* Added `TaskCreated` hook that fires when a task is created via `TaskCreate`
* Added `WorktreeCreate` hook support for `type: "http"` — return the created worktree path via `hookSpecificOutput.worktreePath` in the response JSON
* Added `allowedChannelPlugins` managed setting for team/enterprise admins to define a channel plugin allowlist
* Added `x-client-request-id` header to API requests for debugging timeouts
* Added idle-return prompt that nudges users returning after 75+ minutes to `/clear`, reducing unnecessary token re-caching on stale sessions
* Deep links (`claude-cli://`) now open in your preferred terminal instead of whichever terminal happens to be first in the detection list
* Rules and skills `paths:` frontmatter now accepts a YAML list of globs
* MCP tool descriptions and server instructions are now capped at 2KB to prevent OpenAPI-generated servers from bloating context
* MCP servers configured both locally and via claude.ai connectors are now deduplicated — the local config wins
* Background bash tasks that appear stuck on an interactive prompt now surface a notification after ~45 seconds
* Token counts ≥1M now display as "1.5m" instead of "1512.6k"
* Global system-prompt caching now works when `ToolSearch` is enabled, including for users with MCP tools configured
* Fixed voice push-to-talk: holding the voice key no longer leaks characters into the text input, and transcripts now insert at the correct position
* Fixed up/down arrow keys being unresponsive when a footer item is focused
* Fixed `Ctrl+U` (kill-to-line-start) being a no-op at line boundaries in multiline input, so repeated `Ctrl+U` now clears across lines
* Fixed null-unbinding a default chord binding (e.g. `"ctrl+x ctrl+k": null`) still entering chord-wait mode instead of freeing the prefix key
* Fixed mouse events inserting literal "mouse" text into transcript search input
* Fixed workflow subagents failing with API 400 when the outer session uses `--json-schema` and the subagent also specifies a schema
* Fixed missing background color behind certain emoji in user message bubbles on some terminals
* Fixed the "allow Claude to edit its own settings for this session" permission option not sticking for users with `Edit(.claude)` allow rules
* Fixed a hang when generating attachment snippets for large edited files
* Fixed MCP tool/resource cache leak on server reconnect
* Fixed a startup performance issue where partial clone repositories (Scalar/GVFS) triggered mass blob downloads
* Fixed native terminal cursor not tracking the text input caret, so IME composition (CJK input) now renders inline and screen readers can follow the input position
* Fixed spurious "Not logged in" errors on macOS caused by transient keychain read failures
* Fixed cold-start race where core tools could be deferred without their bypass active, causing Edit/Write to fail with InputValidationError on typed parameters
* Improved detection for dangerous removals of Windows drive roots (`C:\`, `C:\Windows`, etc.)
* Improved interactive startup by ~30ms by running `setup()` in parallel with slash command and agent loading
* Improved startup for `claude "prompt"` with MCP servers — the REPL now renders immediately instead of blocking until all servers connect
* Improved Remote Control to show a specific reason when blocked instead of a generic "not yet enabled" message
* Improved p90 prompt cache rate
* Reduced scroll-to-top resets in long sessions by making the message window immune to compaction and grouping changes
* Reduced terminal flickering when animated tool progress scrolls above the viewport
* Changed issue/PR references to only become clickable links when written as `owner/repo#123` — bare `#123` is no longer auto-linked
* Slash commands unavailable for the current auth setup (`/voice`, `/mobile`, `/chrome`, `/upgrade`, etc.) are now hidden instead of shown
* [VSCode] Added rate limit warning banner with usage percentage and reset time
* Stats screenshot (Ctrl+S in /stats) now works in all builds and is 16× faster

## 2.1.83 (March 25, 2026)

* Added `managed-settings.d/` drop-in directory alongside `managed-settings.json`, letting separate teams deploy independent policy fragments that merge alphabetically
* Added `CwdChanged` and `FileChanged` hook events for reactive environment management (e.g., direnv)
* Added `sandbox.failIfUnavailable` setting to exit with an error when sandbox is enabled but cannot start, instead of running unsandboxed
* Added `disableDeepLinkRegistration` setting to prevent `claude-cli://` protocol handler registration
* Added `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` to strip Anthropic and cloud provider credentials from subprocess environments (Bash tool, hooks, MCP stdio servers)
* Added transcript search — press `/` in transcript mode (`Ctrl+O`) to search, `n`/`N` to step through matches
* Added `Ctrl+X Ctrl+E` as an alias for opening the external editor (readline-native binding; `Ctrl+G` still works)
* Pasted images now insert an `[Image #N]` chip at the cursor so you can reference them positionally in your prompt
* Agents can now declare `initialPrompt` in frontmatter to auto-submit a first turn
* `chat:killAgents` and `chat:fastMode` are now rebindable via `~/.claude/keybindings.json`
* Fixed mouse tracking escape sequences leaking to shell prompt after exit
* Fixed Claude Code hanging on exit on macOS
* Fixed screen flashing blank after being idle for a few seconds
* Fixed a hang when diffing very large files with few common lines — diffs now time out after 5 seconds and fall back gracefully
* Fixed a 1–8 second UI freeze on startup when voice input was enabled, caused by eagerly loading the native audio module
* Fixed a startup regression where Claude Code would wait ~3s for claude.ai MCP config fetch before proceeding
* Fixed `--mcp-config` CLI flag bypassing `allowedMcpServers`/`deniedMcpServers` managed policy enforcement
* Fixed claude.ai MCP connectors (Slack, Gmail, etc.) not being available in single-turn `--print` mode
* Fixed `caffeinate` process not properly terminating when Claude Code exits, preventing Mac from sleeping
* Fixed bash mode not activating when tab-accepting `!`-prefixed command suggestions
* Fixed stale slash command selection showing wrong highlighted command after navigating suggestions
* Fixed `/config` menu showing both the search cursor and list selection at the same time
* Fixed background subagents becoming invisible after context compaction, which could cause duplicate agents to be spawned
* Fixed background agent tasks staying stuck in "running" state when git or API calls hang during cleanup
* Fixed `--channels` showing "Channels are not currently available" on first launch after upgrade
* Fixed uninstalled plugin hooks continuing to fire until the next session
* Fixed queued commands flickering during streaming responses
* Fixed slash commands being sent to the model as text when submitted while a message is processing
* Fixed scrollback jumping when collapsed read/search groups finish after scrolling offscreen
* Fixed scrollback jumping to top when the model starts or stops thinking
* Fixed SDK session history loss on resume caused by hook progress/attachment messages forking the parentUuid chain
* Fixed copy-on-select not firing when you release the mouse outside the terminal window
* Fixed ghost characters appearing in height-constrained lists when items overflow
* Fixed `Ctrl+B` interfering with readline backward-char at an idle prompt — it now only fires when a foreground task can be backgrounded
* Fixed tool result files never being cleaned up, ignoring the `cleanupPeriodDays` setting
* Fixed space key being swallowed for up to 3 seconds after releasing voice hold-to-talk
* Fixed ALSA library errors corrupting the terminal UI when using voice mode on Linux without audio hardware (Docker, headless, WSL1)
* Fixed voice mode SoX detection on Termux/Android where spawning `which` is kernel-restricted
* Fixed Remote Control sessions showing as Idle in the web session list while actively running
* Fixed footer navigation selecting an invisible Remote Control pill in config-driven mode
* Fixed memory leak in remote sessions where tool use IDs accumulate indefinitely
* Improved Bedrock SDK cold-start latency by overlapping profile fetch with other boot work
* Improved `--resume` memory usage and startup latency on large sessions
* Improved plugin startup — commands, skills, and agents now load from disk cache without re-fetching
* Improved Remote Control session titles: AI-generated titles now appear within seconds of the first message
* Improved `WebFetch` to identify as `Claude-User` so site operators can recognize and allowlist Claude Code traffic via `robots.txt`
* Reduced `WebFetch` peak memory usage for large pages
* Reduced scrollback resets in long sessions from once per turn to once per ~50 messages
* Faster `claude -p` startup with unauthenticated HTTP/SSE MCP servers (~600ms saved)
* Bash ghost-text suggestions now include just-submitted commands immediately
* Increased non-streaming fallback token cap (21k → 64k) and timeout (120s → 300s local) so fallback requests are less likely to be truncated
* Interrupting a prompt before any response now automatically restores your input so you can edit and resubmit
* `/status` now works while Claude is responding, instead of being queued until the turn finishes
* Plugin MCP servers that duplicate an org-managed connector are now suppressed instead of running a second connection
* Linux: respect `XDG_DATA_HOME` when registering the `claude-cli://` protocol handler
* Changed "stop all background agents" keybinding from `Ctrl+F` to `Ctrl+X Ctrl+K` to stop shadowing readline forward-char
* Deprecated `TaskOutput` tool in favor of using `Read` on the background task's output file path
* Added `CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK` env var to disable the non-streaming fallback when streaming fails
* Plugin options (`manifest.userConfig`) now available externally — plugins can prompt for configuration at enable time, with `sensitive: true` values stored in keychain (macOS) or protected credentials file (other platforms)
* Claude can now reference the on-disk path of clipboard-pasted images for file operations
* `Ctrl+L` now clears the screen and forces a full redraw — use this to recover when Cmd+K leaves the UI partially blank. Use `Ctrl+U` or double-Esc to clear prompt input.
* `--bare -p` (SDK pattern) is ~14% faster to the API request
* Memory: `MEMORY.md` index now truncates at 25KB as well as 200 lines
* Disabled `AskUserQuestion` and plan-mode tools when `--channels` is active
* Fixed API 400 error when a pasted image was queued during a failing tool call
* Fixed MCP tool calls hanging indefinitely when an SSE connection drops mid-call and exhausts its reconnection attempts
* Fixed Remote Control session titles showing raw XML when a background agent completed before the first user message
* Fixed remote sessions forgetting conversation history after a container restart due to progress-message gaps in the resumed transcript chain
* Fixed remote sessions requiring re-login on transient auth errors instead of retrying automatically
* Fixed `rg ... | wc -l` and similar piped commands hanging and returning `0` in sandbox mode on Linux
* Fixed voice input hold-to-talk not activating when a CJK IME inserts a full-width space
* Fixed `--worktree` hanging silently when the worktree name contained a forward slash
* [VSCode] Spinner now turns red with "Not responding" when the backend hasn't responded for 60 seconds
* [VSCode] Fixed session history not loading correctly when reopening a session via URL or after restart
* [VSCode] Added Esc-twice (or `/rewind`) to open a keyboard-navigable rewind picker
* [VSCode] Fixed "Fork conversation from here" and rewind actions failing silently after the session cache goes stale

## 2.1.81 (March 20, 2026)

* Added `--bare` flag for scripted `-p` calls — skips hooks, LSP, plugin sync, and skill directory walks; requires `ANTHROPIC_API_KEY` or an `apiKeyHelper` via `--settings` (OAuth and keychain auth disabled); auto-memory fully disabled
* Added `--channels` permission relay — channel servers that declare the permission capability can forward tool approval prompts to your phone
* Fixed multiple concurrent Claude Code sessions requiring repeated re-authentication when one session refreshes its OAuth token
* Fixed voice mode silently swallowing retry failures and showing a misleading "check your network" message instead of the actual error
* Fixed voice mode audio not recovering when the server silently drops the WebSocket connection
* Fixed `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` not suppressing the structured-outputs beta header, causing 400 errors on proxy gateways forwarding to Vertex/Bedrock
* Fixed `--channels` bypass for Team/Enterprise orgs with no other managed settings configured
* Fixed a crash on Node.js 18
* Fixed unnecessary permission prompts for Bash commands containing dashes in strings
* Fixed plugin hooks blocking prompt submission when the plugin directory is deleted mid-session
* Fixed a race condition where background agent task output could hang indefinitely when the task completed between polling intervals
* Resuming a session that was in a worktree now switches back to that worktree
* Fixed `/btw` not including pasted text when used during an active response
* Fixed a race where fast Cmd+Tab followed by paste could beat the clipboard copy under tmux
* Fixed terminal tab title not updating with an auto-generated session description
* Fixed invisible hook attachments inflating the message count in transcript mode
* Fixed Remote Control sessions showing a generic title instead of deriving from the first prompt
* Fixed `/rename` not syncing the title for Remote Control sessions
* Fixed Remote Control `/exit` not reliably archiving the session
* Improved MCP read/search tool calls to collapse into a single "Queried `{server}`" line (expand with Ctrl+O)
* Improved `!` bash mode discoverability — Claude now suggests it when you need to run an interactive command
* Improved plugin freshness — ref-tracked plugins now re-clone on every load to pick up upstream changes
* Improved Remote Control session titles to refresh after your third message
* Updated MCP OAuth to support Client ID Metadata Document (CIMD / SEP-991) for servers without Dynamic Client Registration
* Changed plan mode to hide the "clear context" option by default (restore with `"showClearContextOnPlanAccept": true`)
* Disabled line-by-line response streaming on Windows (including WSL in Windows Terminal) due to rendering issues
* [VSCode] Fixed Windows PATH inheritance for Bash tool when using Git Bash (regression in v2.1.78)

## 2.1.80 (March 19, 2026)

* Added `rate_limits` field to statusline scripts for displaying Claude.ai rate limit usage (5-hour and 7-day windows with `used_percentage` and `resets_at`)
* Added `source: 'settings'` plugin marketplace source — declare plugin entries inline in settings.json
* Added CLI tool usage detection to plugin tips, in addition to file pattern matching
* Added `effort` frontmatter support for skills and slash commands to override the model effort level when invoked
* Added `--channels` (research preview) — allow MCP servers to push messages into your session
* Fixed `--resume` dropping parallel tool results — sessions with parallel tool calls now restore all tool_use/tool_result pairs instead of showing `[Tool result missing]` placeholders
* Fixed voice mode WebSocket failures caused by Cloudflare bot detection on non-browser TLS fingerprints
* Fixed 400 errors when using fine-grained tool streaming through API proxies, Bedrock, or Vertex
* Fixed `/remote-control` appearing for gateway and third-party provider deployments where it cannot function
* Fixed `/sandbox` tab switching not responding to Tab or arrow keys
* Improved responsiveness of `@` file autocomplete in large git repositories
* Improved `/effort` to show what auto currently resolves to, matching the status bar indicator
* Improved `/permissions` — Tab and arrow keys now switch tabs from within a list
* Improved background tasks panel — left arrow now closes from the list view
* Simplified plugin install tips to use a single `/plugin install` command instead of a two-step flow
* Reduced memory usage on startup in large repositories (~80 MB saved on 250k-file repos)
* Fixed managed settings (`enabledPlugins`, `permissions.defaultMode`, policy-set env vars) not being applied at startup when `remote-settings.json` was cached from a prior session

## 2.1.79 (March 18, 2026)

* Added `--console` flag to `claude auth login` for Anthropic Console (API billing) authentication
* Added "Show turn duration" toggle to the `/config` menu
* Fixed `claude -p` hanging when spawned as a subprocess without explicit stdin (e.g. Python `subprocess.run`)
* Fixed Ctrl+C not working in `-p` (print) mode
* Fixed `/btw` returning the main agent's output instead of answering the side question when triggered during streaming
* Fixed voice mode not activating correctly on startup when `voiceEnabled: true` is set
* Fixed left/right arrow tab navigation in `/permissions`
* Fixed `CLAUDE_CODE_DISABLE_TERMINAL_TITLE` not preventing terminal title from being set on startup
* Fixed custom status line showing nothing when workspace trust is blocking it
* Fixed enterprise users being unable to retry on rate limit (429) errors
* Fixed `SessionEnd` hooks not firing when using interactive `/resume` to switch sessions
* Improved startup memory usage by ~18MB across all scenarios
* Improved non-streaming API fallback with a 2-minute per-attempt timeout, preventing sessions from hanging indefinitely
* `CLAUDE_CODE_PLUGIN_SEED_DIR` now supports multiple seed directories separated by the platform path delimiter (`:` on Unix, `;` on Windows)
* [VSCode] Added `/remote-control` — bridge your session to claude.ai/code to continue from a browser or phone
* [VSCode] Session tabs now get AI-generated titles based on your first message
* [VSCode] Fixed the thinking pill showing "Thinking" instead of "Thought for Ns" after a response completes
* [VSCode] Fixed missing session diff button when opening sessions from the left sidebar

## 2.1.78 (March 17, 2026)

* Added `StopFailure` hook event that fires when the turn ends due to an API error (rate limit, auth failure, etc.)
* Added `${CLAUDE_PLUGIN_DATA}` variable for plugin persistent state that survives plugin updates; `/plugin uninstall` prompts before deleting it
* Added `effort`, `maxTurns`, and `disallowedTools` frontmatter support for plugin-shipped agents
* Terminal notifications (iTerm2/Kitty/Ghostty popups, progress bar) now reach the outer terminal when running inside tmux with `set -g allow-passthrough on`
* Response text now streams line-by-line as it's generated
* Fixed `git log HEAD` failing with "ambiguous argument" inside sandboxed Bash on Linux, and stub files polluting `git status` in the working directory
* Fixed `cc log` and `--resume` silently truncating conversation history on large sessions (>5 MB) that used subagents
* Fixed infinite loop when API errors triggered stop hooks that re-fed blocking errors to the model
* Fixed `deny: ["mcp__servername"]` permission rules not removing MCP server tools before sending to the model, allowing it to see and attempt blocked tools
* Fixed `sandbox.filesystem.allowWrite` not working with absolute paths (previously required `//` prefix)
* Fixed `/sandbox` Dependencies tab showing Linux prerequisites on macOS instead of macOS-specific info
* **Security:** Fixed silent sandbox disable when `sandbox.enabled: true` is set but dependencies are missing — now shows a visible startup warning
* Fixed `.git`, `.claude`, and other protected directories being writable without a prompt in `bypassPermissions` mode
* Fixed ctrl+u in normal mode scrolling instead of readline kill-line (ctrl+u/ctrl+d half-page scroll moved to transcript mode only)
* Fixed voice mode modifier-combo push-to-talk keybindings (e.g. ctrl+k) requiring a hold instead of activating immediately
* Fixed voice mode not working on WSL2 with WSLg (Windows 11); WSL1/Win10 users now get a clear error
* Fixed `--worktree` flag not loading skills and hooks from the worktree directory
* Fixed `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` and `includeGitInstructions` setting not suppressing the git status section in the system prompt
* Fixed Bash tool not finding Homebrew and other PATH-dependent binaries when VS Code is launched from Dock/Spotlight
* Fixed washed-out Claude orange color in VS Code/Cursor/code-server terminals that don't advertise truecolor support
* Added `ANTHROPIC_CUSTOM_MODEL_OPTION` env var to add a custom entry to the `/model` picker, with optional `_NAME` and `_DESCRIPTION` suffixed vars for display
* Fixed `ANTHROPIC_BETAS` environment variable being silently ignored when using Haiku models
* Fixed queued prompts being concatenated without a newline separator
* Improved memory usage and startup time when resuming large sessions
* [VSCode] Fixed a brief flash of the login screen when opening the sidebar while already authenticated
* [VSCode] Fixed "API Error: Rate limit reached" when selecting Opus — model dropdown no longer offers 1M context variant to subscribers whose plan tier is unknown

## 2.1.77 (March 17, 2026)

* Increased default maximum output token limits for Claude Opus 4.6 to 64k tokens, and the upper bound for Opus 4.6 and Sonnet 4.6 models to 128k tokens
* Added `allowRead` sandbox filesystem setting to re-allow read access within `denyRead` regions
* `/copy` now accepts an optional index: `/copy N` copies the Nth-latest assistant response
* Fixed "Always Allow" on compound bash commands (e.g. `cd src && npm test`) saving a single rule for the full string instead of per-subcommand, leading to dead rules and repeated permission prompts
* Fixed auto-updater starting overlapping binary downloads when the slash-command overlay repeatedly opened and closed, accumulating tens of gigabytes of memory
* Fixed `--resume` silently truncating recent conversation history due to a race between memory-extraction writes and the main transcript
* Fixed PreToolUse hooks returning `"allow"` bypassing `deny` permission rules, including enterprise managed settings
* Fixed Write tool silently converting line endings when overwriting CRLF files or creating files in CRLF directories
* Fixed memory growth in long-running sessions from progress messages surviving compaction
* Fixed cost and token usage not being tracked when the API falls back to non-streaming mode
* Fixed `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` not stripping beta tool-schema fields, causing proxy gateways to reject requests
* Fixed Bash tool reporting errors for successful commands when the system temp directory path contains spaces
* Fixed paste being lost when typing immediately after pasting
* Fixed Ctrl+D in `/feedback` text input deleting forward instead of the second press exiting the session
* Fixed API error when dragging a 0-byte image file into the prompt
* Fixed Claude Desktop sessions incorrectly using the terminal CLI's configured API key instead of OAuth
* Fixed `git-subdir` plugins at different subdirectories of the same monorepo commit colliding in the plugin cache
* Fixed ordered list numbers not rendering in terminal UI
* Fixed a race condition where stale-worktree cleanup could delete an agent worktree just resumed from a previous crash
* Fixed input deadlock when opening `/mcp` or similar dialogs while the agent is running
* Fixed Backspace and Delete keys not working in vim NORMAL mode
* Fixed status line not updating when vim mode is toggled on or off
* Fixed hyperlinks opening twice on Cmd+click in VS Code, Cursor, and other xterm.js-based terminals
* Fixed background colors rendering as terminal-default inside tmux with default configuration
* Fixed iTerm2 session crash when selecting text inside tmux over SSH
* Fixed clipboard copy silently failing in tmux sessions; copy toast now indicates whether to paste with `⌘V` or tmux `prefix+]`
* Fixed `←`/`→` accidentally switching tabs in settings, permissions, and sandbox dialogs while navigating lists
* Fixed IDE integration not auto-connecting when Claude Code is launched inside tmux or screen
* Fixed CJK characters visually bleeding into adjacent UI elements when clipped at the right edge
* Fixed teammate panes not closing when the leader exits
* Fixed iTerm2 auto mode not detecting iTerm2 for native split-pane teammates
* Faster startup on macOS (~60ms) by reading keychain credentials in parallel with module loading
* Faster `--resume` on fork-heavy and very large sessions — up to 45% faster loading and ~100-150MB less peak memory
* Improved Esc to abort in-flight non-streaming API requests
* Improved `claude plugin validate` to check skill, agent, and command frontmatter plus `hooks/hooks.json`, catching YAML parse errors and schema violations
* Background bash tasks are now killed if output exceeds 5GB, preventing runaway processes from filling disk
* Sessions are now auto-named from plan content when you accept a plan
* Improved headless mode plugin installation to compose correctly with `CLAUDE_CODE_PLUGIN_SEED_DIR`
* Show a notice when `apiKeyHelper` takes longer than 10s, preventing it from blocking the main loop
* The Agent tool no longer accepts a `resume` parameter — use `SendMessage({to: agentId})` to continue a previously spawned agent
* `SendMessage` now auto-resumes stopped agents in the background instead of returning an error
* Renamed `/fork` to `/branch` (`/fork` still works as an alias)
* [VSCode] Improved plan preview tab titles to use the plan's heading instead of "Claude's Plan"
* [VSCode] When option+click doesn't trigger native selection on macOS, the footer now points to the `macOptionClickForcesSelection` setting

## 2.1.76 (March 14, 2026)

* Added MCP elicitation support — MCP servers can now request structured input mid-task via an interactive dialog (form fields or browser URL)
* Added new `Elicitation` and `ElicitationResult` hooks to intercept and override responses before they're sent back
* Added `-n` / `--name <name>` CLI flag to set a display name for the session at startup
* Added `worktree.sparsePaths` setting for `claude --worktree` in large monorepos to check out only the directories you need via git sparse-checkout
* Added `PostCompact` hook that fires after compaction completes
* Added `/effort` slash command to set model effort level
* Added session quality survey — enterprise admins can configure the sample rate via the `feedbackSurveyRate` setting
* Fixed deferred tools (loaded via `ToolSearch`) losing their input schemas after conversation compaction, causing array and number parameters to be rejected with type errors
* Fixed slash commands showing "Unknown skill"
* Fixed plan mode asking for re-approval after the plan was already accepted
* Fixed voice mode swallowing keypresses while a permission dialog or plan editor was open
* Fixed `/voice` not working on Windows when installed via npm
* Fixed spurious "Context limit reached" when invoking a skill with `model:` frontmatter on a 1M-context session
* Fixed "adaptive thinking is not supported on this model" error when using non-standard model strings
* Fixed `Bash(cmd:*)` permission rules not matching when a quoted argument contains `#`
* Fixed "don't ask again" in the Bash permission dialog showing the full raw command for pipes and compound commands
* Fixed auto-compaction retrying indefinitely after consecutive failures — a circuit breaker now stops after 3 attempts
* Fixed MCP reconnect spinner persisting after successful reconnection
* Fixed LSP plugins not registering servers when the LSP Manager initialized before marketplaces were reconciled
* Fixed clipboard copying in tmux over SSH — now attempts both direct terminal write and tmux clipboard integration
* Fixed `/export` showing only the filename instead of the full file path in the success message
* Fixed transcript not auto-scrolling to new messages after selecting text
* Fixed Escape key not working to exit the login method selection screen
* Fixed several Remote Control issues: sessions silently dying when the server reaps an idle environment, rapid messages being queued one-at-a-time instead of batched, and stale work items causing redelivery after JWT refresh
* Fixed bridge sessions failing to recover after extended WebSocket disconnects
* Fixed slash commands not found when typing the exact name of a soft-hidden command
* Improved `--worktree` startup performance by reading git refs directly and skipping redundant `git fetch` when the remote branch is already available locally
* Improved background agent behavior — killing a background agent now preserves its partial results in the conversation context
* Improved model fallback notifications — now always visible instead of hidden behind verbose mode, with human-friendly model names
* Improved blockquote readability on dark terminal themes — text is now italic with a left bar instead of dim
* Improved stale worktree cleanup — worktrees left behind after an interrupted parallel run are now automatically cleaned up
* Improved Remote Control session titles — now derived from your first prompt instead of showing "Interactive session"
* Improved `/voice` to show your dictation language on enable and warn when your `language` setting isn't supported for voice input
* Updated `--plugin-dir` to only accept one path to support subcommands — use repeated `--plugin-dir` for multiple directories
* [VSCode] Fixed gitignore patterns containing commas silently excluding entire filetypes from the @-mention file picker

## 2.1.75 (March 13, 2026)

* Added 1M context window for Opus 4.6 by default for Max, Team, and Enterprise plans (previously required extra usage)
* Added `/color` command for all users to set a prompt-bar color for your session
* Added session name display on the prompt bar when using `/rename`
* Added last-modified timestamps to memory files, helping Claude reason about which memories are fresh vs. stale
* Added hook source display (settings/plugin/skill) in permission prompts when a hook requires confirmation
* Fixed voice mode not activating correctly on fresh installs without toggling `/voice` twice
* Fixed the Claude Code header not updating the displayed model name after switching models with `/model` or Option+P
* Fixed session crash when an attachment message computation returns undefined values
* Fixed Bash tool mangling `!` in piped commands (e.g., `jq 'select(.x != .y)'` now works correctly)
* Fixed managed-disabled plugins showing up in the `/plugin` Installed tab — plugins force-disabled by your organization are now hidden
* Fixed token estimation over-counting for thinking and `tool_use` blocks, preventing premature context compaction
* Fixed corrupted marketplace config path handling
* Fixed `/resume` losing session names after resuming a forked or continued session
* Fixed Esc not closing the `/status` dialog after visiting the Config tab
* Fixed input handling when accepting or rejecting a plan
* Fixed footer hint in agent teams showing "↓ to expand" instead of the correct "shift + ↓ to expand"
* Improved startup performance on macOS non-MDM machines by skipping unnecessary subprocess spawns
* Suppressed async hook completion messages by default (visible with `--verbose` or transcript mode)
* Breaking change: Removed deprecated Windows managed settings fallback at `C:\ProgramData\ClaudeCode\managed-settings.json` — use `C:\Program Files\ClaudeCode\managed-settings.json`

## 2.1.74 (March 12, 2026)

* Added actionable suggestions to `/context` command — identifies context-heavy tools, memory bloat, and capacity warnings with specific optimization tips
* Added `autoMemoryDirectory` setting to configure a custom directory for auto-memory storage
* Fixed memory leak where streaming API response buffers were not released when the generator was terminated early, causing unbounded RSS growth on the Node.js/npm code path
* Fixed managed policy `ask` rules being bypassed by user `allow` rules or skill `allowed-tools`
* Fixed full model IDs (e.g., `claude-opus-4-5`) being silently ignored in agent frontmatter `model:` field and `--agents` JSON config — agents now accept the same model values as `--model`
* Fixed MCP OAuth authentication hanging when the callback port is already in use
* Fixed MCP OAuth refresh never prompting for re-auth after the refresh token expires, for OAuth servers that return errors with HTTP 200 (e.g. Slack)
* Fixed voice mode silently failing on the macOS native binary for users whose terminal had never been granted microphone permission — the binary now includes the `audio-input` entitlement so macOS prompts correctly
* Fixed `SessionEnd` hooks being killed after 1.5 s on exit regardless of `hook.timeout` — now configurable via `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS`
* Fixed `/plugin install` failing inside the REPL for marketplace plugins with local sources
* Fixed marketplace update not syncing git submodules — plugin sources in submodules no longer break after update
* Fixed unknown slash commands with arguments silently dropping input — now shows your input as a warning
* Fixed Hebrew, Arabic, and other RTL text not rendering correctly in Windows Terminal, conhost, and VS Code integrated terminal
* Fixed LSP servers not working on Windows due to malformed file URIs
* Changed `--plugin-dir` so local dev copies now override installed marketplace plugins with the same name (unless that plugin is force-enabled by managed settings)
* [VSCode] Fixed delete button not working for Untitled sessions
* [VSCode] Improved scroll wheel responsiveness in the integrated terminal with terminal-aware acceleration

## 2.1.73 (March 11, 2026)

* Added `modelOverrides` setting to map model picker entries to custom provider model IDs (e.g. Bedrock inference profile ARNs)
* Added actionable guidance when OAuth login or connectivity checks fail due to SSL certificate errors (corporate proxies, `NODE_EXTRA_CA_CERTS`)
* Fixed freezes and 100% CPU loops triggered by permission prompts for complex bash commands
* Fixed a deadlock that could freeze Claude Code when many skill files changed at once (e.g. during `git pull` in a repo with a large `.claude/skills/` directory)
* Fixed Bash tool output being lost when running multiple Claude Code sessions in the same project directory
* Fixed subagents with `model: opus`/`sonnet`/`haiku` being silently downgraded to older model versions on Bedrock, Vertex, and Microsoft Foundry
* Fixed background bash processes spawned by subagents not being cleaned up when the agent exits
* Fixed `/resume` showing the current session in the picker
* Fixed `/ide` crashing with `onInstall is not defined` when auto-installing the extension
* Fixed `/loop` not being available on Bedrock/Vertex/Foundry and when telemetry was disabled
* Fixed SessionStart hooks firing twice when resuming a session via `--resume` or `--continue`
* Fixed JSON-output hooks injecting no-op system-reminder messages into the model's context on every turn
* Fixed voice mode session corruption when a slow connection overlaps a new recording
* Fixed Linux sandbox failing to start with "ripgrep (rg) not found" on native builds
* Fixed Linux native modules not loading on Amazon Linux 2 and other glibc 2.26 systems
* Fixed "media_type: Field required" API error when receiving images via Remote Control
* Fixed `/heapdump` failing on Windows with `EEXIST` error when the Desktop folder already exists
* Improved Up arrow after interrupting Claude — now restores the interrupted prompt and rewinds the conversation in one step
* Improved IDE detection speed at startup
* Improved clipboard image pasting performance on macOS
* Improved `/effort` to work while Claude is responding, matching `/model` behavior
* Improved voice mode to automatically retry transient connection failures during rapid push-to-talk re-press
* Improved the Remote Control spawn mode selection prompt with better context
* Changed default Opus model on Bedrock, Vertex, and Microsoft Foundry to Opus 4.6 (was Opus 4.1)
* Deprecated `/output-style` command — use `/config` instead. Output style is now fixed at session start for better prompt caching
* VSCode: Fixed HTTP 400 errors for users behind proxies or on Bedrock/Vertex with Claude 4.5 models

## 2.1.72 (March 10, 2026)

* Fixed tool search to activate even with `ANTHROPIC_BASE_URL` as long as `ENABLE_TOOL_SEARCH` is set
* Added `w` key in `/copy` to write the focused selection directly to a file, bypassing the clipboard (useful over SSH)
* Added optional description argument to `/plan` (e.g., `/plan fix the auth bug`) that enters plan mode and immediately starts
* Added `ExitWorktree` tool to leave an `EnterWorktree` session
* Added `CLAUDE_CODE_DISABLE_CRON` environment variable to immediately stop scheduled cron jobs mid-session
* Added `lsof`, `pgrep`, `tput`, `ss`, `fd`, and `fdfind` to the bash auto-approval allowlist, reducing permission prompts for common read-only operations
* Restored the `model` parameter on the Agent tool for per-invocation model overrides
* Simplified effort levels to low/medium/high (removed max) with new symbols (○ ◐ ●) and a brief notification instead of a persistent icon. Use `/effort auto` to reset to default
* Improved `/config` — Escape now cancels changes, Enter saves and closes, Space toggles settings
* Improved up-arrow history to show current session's messages first when running multiple concurrent sessions
* Improved voice input transcription accuracy for repo names and common dev terms (regex, OAuth, JSON)
* Improved bash command parsing by switching to a native module — faster initialization and no memory leak
* Reduced bundle size by ~510 KB
* Changed CLAUDE.md HTML comments (`<!-- ... -->`) to be hidden from Claude when auto-injected. Comments remain visible when read with the Read tool
* Fixed slow exits when background tasks or hooks were slow to respond
* Fixed agent task progress stuck on "Initializing…"
* Fixed skill hooks firing twice per event when a hooks-enabled skill is invoked by the model
* Fixed several voice mode issues: occasional input lag, false "No speech detected" errors after releasing push-to-talk, and stale transcripts re-filling the prompt after submission
* Fixed `--continue` not resuming from the most recent point after `--compact`
* Fixed bash security parsing edge cases
* Added support for marketplace git URLs without `.git` suffix (Azure DevOps, AWS CodeCommit)
* Improved marketplace clone failure messages to show diagnostic info even when git produces no stderr
* Fixed several plugin issues: installation failing on Windows with `EEXIST` error in OneDrive folders, marketplace blocking user-scope installs when a project-scope install exists, `CLAUDE_CODE_PLUGIN_CACHE_DIR` creating literal `~` directories, and `plugin.json` with marketplace-only fields failing to load
* Fixed feedback survey appearing too frequently in long sessions
* Fixed `--effort` CLI flag being reset by unrelated settings writes on startup
* Fixed backgrounded Ctrl+B queries losing their transcript or corrupting the new conversation after `/clear`
* Fixed `/clear` killing background agent/bash tasks — only foreground tasks are now cleared
* Fixed worktree isolation issues: Task tool resume not restoring cwd, and background task notifications missing `worktreePath` and `worktreeBranch`
* Fixed `/model` not displaying results when run while Claude is working
* Fixed digit keys selecting menu options instead of typing in plan mode permission prompt's text input
* Fixed sandbox permission issues: certain file write operations incorrectly allowed without prompting, and output redirections to allowlisted directories (like `/tmp/claude/`) prompting unnecessarily
* Improved CPU utilization in long sessions
* Fixed prompt cache invalidation in SDK `query()` calls, reducing input token costs up to 12x
* Fixed Escape key becoming unresponsive after cancelling a query
* Fixed double Ctrl+C not exiting when background agents or tasks are running
* Fixed team agents to inherit the leader's model
* Fixed "Always Allow" saving permission rules that never match again
* Fixed several hooks issues: `transcript_path` pointing to the wrong directory for resumed/forked sessions, agent `prompt` being silently deleted from settings.json on every settings write, PostToolUse block reason displaying twice, async hooks not receiving stdin with bash `read -r`, and validation error message showing an example that fails validation
* Fixed session crashes in Desktop/SDK when Read returned files containing U+2028/U+2029 characters
* Fixed terminal title being cleared on exit even when `CLAUDE_CODE_DISABLE_TERMINAL_TITLE` was set
* Fixed several permission rule matching issues: wildcard rules not matching commands with heredocs, embedded newlines, or no arguments; `sandbox.excludedCommands` failing with env var prefixes; "always allow" suggesting overly broad prefixes for nested CLI tools; and deny rules not applying to all command forms
* Fixed oversized and truncated images from Bash data-URL output
* Fixed a crash when resuming sessions that contained Bedrock API errors
* Fixed intermittent "expected boolean, received string" validation errors on Edit, Bash, and Grep tool inputs
* Fixed multi-line session titles when forking from a conversation whose first message contained newlines
* Fixed queued messages not showing attached images, and images being lost when pressing ↑ to edit a queued message
* Fixed parallel tool calls where a failed Read/WebFetch/Glob would cancel its siblings — only Bash errors now cascade
* VSCode: Fixed scroll speed in integrated terminals not matching native terminals
* VSCode: Fixed Shift+Enter submitting input instead of inserting a newline for users with older keybindings
* VSCode: Added effort level indicator on the input border
* VSCode: Added `vscode://anthropic.claude-code/open` URI handler to open a new Claude Code tab programmatically, with optional `prompt` and `session` query parameters

## 2.1.71 (March 7, 2026)

* Added `/loop` command to run a prompt or slash command on a recurring interval (e.g. `/loop 5m check the deploy`)
* Added cron scheduling tools for recurring prompts within a session
* Added `voice:pushToTalk` keybinding to make the voice activation key rebindable in `keybindings.json` (default: space) — modifier+letter combos like `meta+k` have zero typing interference
* Added `fmt`, `comm`, `cmp`, `numfmt`, `expr`, `test`, `printf`, `getconf`, `seq`, `tsort`, and `pr` to the bash auto-approval allowlist
* Fixed stdin freeze in long-running sessions where keystrokes stop being processed but the process stays alive
* Fixed a 5–8 second startup freeze for users with voice mode enabled, caused by CoreAudio initialization blocking the main thread after system wake
* Fixed startup UI freeze when many claude.ai proxy connectors refresh an expired OAuth token simultaneously
* Fixed forked conversations (`/fork`) sharing the same plan file, which caused plan edits in one fork to overwrite the other
* Fixed the Read tool putting oversized images into context when image processing failed, breaking subsequent turns in long image-heavy sessions
* Fixed false-positive permission prompts for compound bash commands containing heredoc commit messages
* Fixed plugin installations being lost when running multiple Claude Code instances
* Fixed claude.ai connectors failing to reconnect after OAuth token refresh
* Fixed claude.ai MCP connector startup notifications appearing for every org-configured connector instead of only previously connected ones
* Fixed background agent completion notifications missing the output file path, which made it difficult for parent agents to recover agent results after context compaction
* Fixed duplicate output in Bash tool error messages when commands exit with non-zero status
* Fixed Chrome extension auto-detection getting permanently stuck on "not installed" after running on a machine without local Chrome
* Fixed `/plugin marketplace update` failing with merge conflicts when the marketplace is pinned to a branch/tag ref
* Fixed `/plugin marketplace add owner/repo@ref` incorrectly parsing `@` — previously only `#` worked as a ref separator, causing undiagnosable errors with `strictKnownMarketplaces`
* Fixed duplicate entries in `/permissions` Workspace tab when the same directory is added with and without a trailing slash
* Fixed `--print` hanging forever when team agents are configured — the exit loop no longer waits on long-lived `in_process_teammate` tasks
* Fixed "❯ Tool loaded." appearing in the REPL after every `ToolSearch` call
* Fixed prompting for `cd <cwd> && git ...` on Windows when the model uses a mingw-style path
* Improved startup time by deferring native image processor loading to first use
* Improved bridge session reconnection to complete within seconds after laptop wake from sleep, instead of waiting up to 10 minutes
* Improved `/plugin uninstall` to disable project-scoped plugins in `.claude/settings.local.json` instead of modifying `.claude/settings.json`, so changes don't affect teammates
* Improved plugin-provided MCP server deduplication — servers that duplicate a manually-configured server (same command/URL) are now skipped, preventing duplicate connections and tool sets. Suppressions are shown in the `/plugin` menu.
* Updated `/debug` to toggle debug logging on mid-session, since debug logs are no longer written by default
* Removed startup notification noise for unauthenticated org-registered claude.ai connectors

## 2.1.70 (March 6, 2026)

* Fixed API 400 errors when using `ANTHROPIC_BASE_URL` with a third-party gateway — tool search now correctly detects proxy endpoints and disables `tool_reference` blocks
* Fixed `API Error: 400 This model does not support the effort parameter` when using custom Bedrock inference profiles or other model identifiers not matching standard Claude naming patterns
* Fixed empty model responses immediately after `ToolSearch` — the server renders tool schemas with system-prompt-style tags at the prompt tail, which could confuse models into stopping early
* Fixed prompt-cache bust when an MCP server with `instructions` connects after the first turn
* Fixed Enter inserting a newline instead of submitting when typing over a slow SSH connection
* Fixed clipboard corrupting non-ASCII text (CJK, emoji) on Windows/WSL by using PowerShell `Set-Clipboard`
* Fixed extra VS Code windows opening at startup on Windows when running from the VS Code integrated terminal
* Fixed voice mode failing on Windows native binary with "native audio module could not be loaded"
* Fixed push-to-talk not activating on session start when `voiceEnabled: true` was set in settings
* Fixed markdown links containing `#NNN` references incorrectly pointing to the current repository instead of the linked URL
* Fixed repeated "Model updated to Opus 4.6" notification when a project's `.claude/settings.json` has a legacy Opus model string pinned
* Fixed plugins showing as inaccurately installed in `/plugin`
* Fixed plugins showing "not found in marketplace" errors on fresh startup by auto-refreshing after marketplace installation
* Fixed `/security-review` command failing with `unknown option merge-base` on older git versions
* Fixed `/color` command having no way to reset back to the default color — `/color default`, `/color gray`, `/color reset`, and `/color none` now restore the default
* Fixed a performance regression in the `AskUserQuestion` preview dialog that re-ran markdown rendering on every keystroke in the notes input
* Fixed feature flags read during early startup never refreshing their disk cache, causing stale values to persist across sessions
* Fixed `permissions.defaultMode` settings values other than `acceptEdits` or `plan` being applied in Claude Code Remote environments — they are now ignored
* Fixed skill listing being re-injected on every `--resume` (~600 tokens saved per resume)
* Fixed teleport marker not rendering in VS Code teleported sessions
* Improved error message when microphone captures silence to distinguish from "no speech detected"
* Improved compaction to preserve images in the summarizer request, allowing prompt cache reuse for faster and cheaper compaction
* Improved `/rename` to work while Claude is processing, instead of being silently queued
* Reduced prompt input re-renders during turns by ~74%
* Reduced startup memory by ~426KB for users without custom CA certificates
* Reduced Remote Control `/poll` rate to once per 10 minutes while connected (was 1–2s), cutting server load ~300×. Reconnection is unaffected — transport loss immediately wakes fast polling.
* [VSCode] Added spark icon in VS Code activity bar that lists all Claude Code sessions, with sessions opening as full editors
* [VSCode] Added full markdown document view for plans in VS Code, with support for adding comments to provide feedback
* [VSCode] Added native MCP server management dialog — use `/mcp` in the chat panel to enable/disable servers, reconnect, and manage OAuth authentication without switching to the terminal

## 2.1.69 (March 5, 2026)

* Added the `/claude-api` skill for building applications with the Claude API and Anthropic SDK
* Added Ctrl+U on an empty bash prompt (`!`) to exit bash mode, matching `escape` and `backspace`
* Added numeric keypad support for selecting options in Claude's interview questions (previously only the number row above QWERTY worked)
* Added optional name argument to `/remote-control` and `claude remote-control` (`/remote-control My Project` or `--name "My Project"`) to set a custom session title visible in claude.ai/code
* Added Voice STT support for 10 new languages (20 total) — Russian, Polish, Turkish, Dutch, Ukrainian, Greek, Czech, Danish, Swedish, Norwegian
* Added effort level display (e.g., "with low effort") to the logo and spinner, making it easier to see which effort setting is active
* Added agent name display in terminal title when using `claude --agent`
* Added `sandbox.enableWeakerNetworkIsolation` setting (macOS only) to allow Go programs like `gh`, `gcloud`, and `terraform` to verify TLS certificates when using a custom MITM proxy with `httpProxyPort`
* Added `includeGitInstructions` setting (and `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` env var) to remove built-in commit and PR workflow instructions from Claude's system prompt
* Added `/reload-plugins` command to activate pending plugin changes without restarting
* Added a one-time startup prompt suggesting Claude Code Desktop on macOS and Windows (max 3 showings, dismissible)
* Added `${CLAUDE_SKILL_DIR}` variable for skills to reference their own directory in SKILL.md content
* Added `InstructionsLoaded` hook event that fires when CLAUDE.md or `.claude/rules/*.md` files are loaded into context
* Added `agent_id` (for subagents) and `agent_type` (for subagents and `--agent`) to hook events
* Added `worktree` field to status line hook commands with name, path, branch, and original repo directory when running in a `--worktree` session
* Added `pluginTrustMessage` in managed settings to append organization-specific context to the plugin trust warning shown before installation
* Added policy limit fetching (e.g., remote control restrictions) for Team plan OAuth users, not just Enterprise
* Added `pathPattern` to `strictKnownMarketplaces` for regex-matching file/directory marketplace sources alongside `hostPattern` restrictions
* Added plugin source type `git-subdir` to point to a subdirectory within a git repo
* Fixed a security issue where nested skill discovery could load skills from gitignored directories like `node_modules`
* Fixed trust dialog silently enabling all `.mcp.json` servers on first run. You'll now see the per-server approval dialog as expected
* Fixed `claude remote-control` crashing immediately on npm installs with "bad option: --sdk-url" (anthropics/claude-code#28334)
* Fixed `--model claude-opus-4-0` and `--model claude-opus-4-1` resolving to deprecated Opus versions instead of current
* Fixed macOS keychain corruption when using multiple OAuth MCP servers. Large OAuth metadata blobs could overflow the `security -i` stdin buffer, silently leaving stale credentials behind and causing repeated `/login` prompts.
* Fixed `.credentials.json` losing `subscriptionType` (showing "Claude API" instead of "Claude Pro"/"Claude Max") when the profile endpoint transiently fails during token refresh (anthropics/claude-code#30185)
* Fixed ghost dotfiles (`.bashrc`, `HEAD`, etc.) appearing as untracked files in the working directory after sandboxed Bash commands on Linux
* Fixed Shift+Enter printing `[27;2;13~` instead of inserting a newline in Ghostty over SSH
* Fixed stash (Ctrl+S) being cleared when submitting a message while Claude is working
* Fixed ctrl+o (transcript toggle) freezing for many seconds in long sessions with lots of file edits
* Fixed plan mode feedback input not supporting multi-line text entry (backslash+Enter and Shift+Enter now insert newlines)
* Fixed cursor not moving down into blank lines at the top of the input box
* Fixed `/stats` crash when transcript files contain entries with missing or malformed timestamps
* Fixed a brief hang after a streaming error on long sessions (the transcript was being fully rewritten to drop one line; it is now truncated in place)
* Fixed `--setting-sources user` not blocking dynamically discovered project skills
* Fixed duplicate CLAUDE.md, slash commands, agents, and rules when running from a worktree nested inside its main repo (e.g. `claude -w`)
* Fixed plugin Stop/SessionEnd/etc hooks not firing after any `/plugin` operation
* Fixed plugin hooks being silently dropped when two plugins use the same `${CLAUDE_PLUGIN_ROOT}/...` command template
* Fixed memory leak in long-running SDK/CCR sessions where conversation messages were retained unnecessarily
* Fixed API 400 errors in forked agents (autocompact, summarization) when resuming sessions that were interrupted mid-tool-batch
* Fixed "unexpected tool_use_id found in tool_result blocks" error when resuming conversations that start with an orphaned tool result
* Fixed teammates accidentally spawning nested teammates via the Agent tool's `name` parameter
* Fixed `CLAUDE_CODE_MAX_OUTPUT_TOKENS` being ignored during conversation compaction
* Fixed `/compact` summary rendering as a user bubble in SDK consumers (Claude Code Remote web UI, VSCode extension)
* Fixed voice space bar getting stuck after a failed voice activation (module loading race, cold GrowthBook)
* Fixed worktree file copy on Windows
* Fixed global `.claude` folder detection on Windows
* Fixed symlink bypass where writing new files through a symlinked parent directory could escape the working directory in `acceptEdits` mode
* Fixed sandbox prompting users to approve non-allowed domains when `allowManagedDomainsOnly` is enabled in managed settings — non-allowed domains are now blocked automatically with no bypass
* Fixed interactive tools (e.g., `AskUserQuestion`) being silently auto-allowed when listed in a skill's allowed-tools, bypassing the permission prompt and running with empty answers
* Fixed multi-GB memory spike when committing with large untracked binary files in the working tree
* Fixed Escape not interrupting a running turn when the input box has draft text. Use Up arrow to pull queued messages back for editing, or Ctrl+U to clear the input line.
* Fixed Android app crash when running local slash commands (`/voice`, `/cost`) in Remote Control sessions
* Fixed a memory leak where old message array versions accumulated in React Compiler `memoCache` over long sessions
* Fixed a memory leak where REPL render scopes accumulated over long sessions (~35MB over 1000 turns)
* Fixed memory retention in in-process teammates where the parent's full conversation history was pinned for the teammate's lifetime, preventing GC after `/clear` or auto-compact
* Fixed a memory leak in interactive mode where hook events could accumulate unboundedly during long sessions
* Fixed hang when `--mcp-config` points to a corrupted file
* Fixed slow startup when many skills/plugins are installed
* Fixed `cd <outside-dir> && <cmd>` permission prompt to surface the chained command instead of only showing "Yes, allow reading from `<dir>`/"
* Fixed conditional `.claude/rules/*.md` files (with `paths:` frontmatter) and nested CLAUDE.md files not loading in print mode (`claude -p`)
* Fixed `/clear` not fully clearing all session caches, reducing memory retention in long sessions
* Fixed terminal flicker caused by animated elements at the scrollback boundary
* Fixed UI frame drops on macOS when using MCP servers with OAuth (regression from 2.1.x)
* Fixed occasional frame stalls during typing caused by synchronous debug log flushes
* Fixed `TeammateIdle` and `TaskCompleted` hooks to support `{"continue": false, "stopReason": "..."}` to stop the teammate, matching `Stop` hook behavior
* Fixed `WorktreeCreate` and `WorktreeRemove` plugin hooks being silently ignored
* Fixed skill descriptions with colons (e.g., "Triggers include: X, Y, Z") failing to load from SKILL.md frontmatter
* Fixed project skills without a `description:` frontmatter field not appearing in Claude's available skills list
* Fixed `/context` showing identical token counts for all MCP tools from a server
* Fixed literal `nul` file creation on Windows when the model uses CMD-style `2>nul` redirection in Git Bash
* Fixed extra blank lines appearing below each tool call in the expanded subagent transcript view (Ctrl+O)
* Fixed Tab/arrow keys not cycling Settings tabs when `/config` search box is focused but empty
* Fixed service key OAuth sessions (CCR containers) spamming `[ERROR]` logs with 403s from profile-scoped endpoints
* Fixed inconsistent color for "Remote Control active" status indicator
* Fixed Voice waveform cursor covering the first suffix letter when dictating mid-input
* Fixed Voice input showing all 5 spaces during warmup instead of capping at ~2 (aligning with the "keep holding…" hint)
* Improved spinner performance by isolating the 50ms animation loop from the surrounding shell, reducing render and CPU overhead during turns
* Improved UI rendering performance in native binaries with React Compiler
* Improved `--worktree` startup by eliminating a git subprocess on the startup path
* Improved macOS startup by eliminating redundant settings-file reloads when managed settings resolve
* Improved macOS startup for Claude.ai enterprise/team users by skipping an unnecessary keychain lookup
* Improved MCP `-p` startup by pipelining claude.ai config fetch with local connections and using a concurrency pool instead of sequential batching
* Improved voice startup by removing imperceptible warmup pulse animations that were causing re-render stutter
* Improved MCP binary content handling: tools returning PDFs, Office documents, or audio now save decoded bytes to disk with the correct file extension instead of dumping raw base64 into the conversation context. WebFetch also saves binary responses alongside its summary.
* Improved memory usage in long sessions by stabilizing `onSubmit` across message updates
* Improved LSP tool rendering and memory context building to no longer read entire files
* Improved session upload and memory sync to avoid reading large files into memory before size/binary checks
* Improved file operation performance by avoiding reading file contents for existence checks (6 sites)
* Improved documentation to clarify that `--append-system-prompt-file` and `--system-prompt-file` work in interactive mode (the docs previously said print mode only)
* Reduced baseline memory by ~16MB by deferring Yoga WASM preloading
* Reduced memory footprint for SDK and CCR sessions using stream-json output
* Reduced memory usage when resuming large sessions (including compacted history)
* Reduced token usage on multi-agent tasks with more concise subagent final reports
* Changed Sonnet 4.5 users on Pro/Max/Team Premium to be automatically migrated to Sonnet 4.6
* Changed the `/resume` picker to show your most recent prompt instead of the first one. This also resolves some titles appearing as `(session)`.
* Changed claude.ai MCP connector failures to show a notification instead of silently disappearing from the tool list
* Changed example command suggestions to be generated deterministically instead of calling Haiku
* Changed resuming after compaction to no longer produce a preamble recap before continuing
* [SDK] Changed task creation to no longer require the `activeForm` field — the spinner falls back to the task subject
* [VSCode] Added compaction display as a collapsible "Compacted chat" card with the summary inside
* [VSCode] The permission mode picker now respects `permissions.disableBypassPermissionsMode` from your effective Claude Code settings (including managed/policy settings) — when set to `disable`, bypass permissions mode is hidden from the picker
* [VSCode] Fixed RTL text (Arabic, Hebrew, Persian) rendering reversed in the chat panel (regression in v2.1.63)

## 2.1.68 (March 4, 2026)

* Opus 4.6 now defaults to medium effort for Max and Team subscribers. Medium effort works well for most tasks — it's the sweet spot between speed and thoroughness. You can change this anytime with `/model`
* Re-introduced the "ultrathink" keyword to enable high effort for the next turn
* Removed Opus 4 and 4.1 from Claude Code on the first-party API — users with these models pinned are automatically moved to Opus 4.6

## 2.1.66 (March 4, 2026)

* Reduced spurious error logging

## 2.1.63 (February 28, 2026)

* Added `/simplify` and `/batch` bundled slash commands
* Fixed local slash command output like /cost appearing as user-sent messages instead of system messages in the UI
* Project configs & auto memory now shared across git worktrees of the same repository
* Added `ENABLE_CLAUDEAI_MCP_SERVERS=false` env var to opt out from making claude.ai MCP servers available
* Improved `/model` command to show the currently active model in the slash command menu
* Added HTTP hooks, which can POST JSON to a URL and receive JSON instead of running a shell command
* Fixed listener leak in bridge polling loop
* Fixed listener leak in MCP OAuth flow cleanup
* Added manual URL paste fallback during MCP OAuth authentication. If the automatic localhost redirect doesn't work, you can paste the callback URL to complete authentication.
* Fixed memory leak when navigating hooks configuration menu
* Fixed listener leak in interactive permission handler during auto-approvals
* Fixed file count cache ignoring glob ignore patterns
* Fixed memory leak in bash command prefix cache
* Fixed MCP tool/resource cache leak on server reconnect
* Fixed IDE host IP detection cache incorrectly sharing results across ports
* Fixed WebSocket listener leak on transport reconnect
* Fixed memory leak in git root detection cache that could cause unbounded growth in long-running sessions
* Fixed memory leak in JSON parsing cache that grew unbounded over long sessions
* VSCode: Fixed remote sessions not appearing in conversation history
* Fixed a race condition in the REPL bridge where new messages could arrive at the server interleaved with historical messages during the initial connection flush, causing message ordering issues.
* Fixed memory leak where long-running teammates retained all messages in AppState even after conversation compaction
* Fixed a memory leak where MCP server fetch caches were not cleared on disconnect, causing growing memory usage with servers that reconnect frequently
* Improved memory usage in long sessions with subagents by stripping heavy progress message payloads during context compaction
* Added "Always copy full response" option to the `/copy` picker. When selected, future `/copy` commands will skip the code block picker and copy the full response directly.
* VSCode: Added session rename and remove actions to the sessions list
* Fixed `/clear` not resetting cached skills, which could cause stale skill content to persist in the new conversation

## 2.1.62 (February 27, 2026)

* Fixed prompt suggestion cache regression that reduced cache hit rates

## 2.1.61 (February 26, 2026)

* Fixed concurrent writes corrupting config file on Windows

## 2.1.59 (February 26, 2026)

* Claude automatically saves useful context to auto-memory. Manage with /memory
* Added `/copy` command to show an interactive picker when code blocks are present, allowing selection of individual code blocks or the full response.
* Improved "always allow" prefix suggestions for compound bash commands (e.g. `cd /tmp && git fetch && git push`) to compute smarter per-subcommand prefixes instead of treating the whole command as one
* Improved ordering of short task lists
* Improved memory usage in multi-agent sessions by releasing completed subagent task state
* Fixed MCP OAuth token refresh race condition when running multiple Claude Code instances simultaneously
* Fixed shell commands not showing a clear error message when the working directory has been deleted
* Fixed config file corruption that could wipe authentication when multiple Claude Code instances ran simultaneously

## 2.1.58 (February 25, 2026)

* Expand Remote Control to more users

## 2.1.56 (February 25, 2026)

* VS Code: Fixed another cause of "command 'claude-vscode.editor.openLast' not found" crashes

## 2.1.55 (February 25, 2026)

* Fixed BashTool failing on Windows with EINVAL error

## 2.1.53 (February 25, 2026)

* Fixed a UI flicker where user input would briefly disappear after submission before the message rendered
* Fixed bulk agent kill (ctrl+f) to send a single aggregate notification instead of one per agent, and to properly clear the command queue
* Fixed graceful shutdown sometimes leaving stale sessions when using Remote Control by parallelizing teardown network calls
* Fixed `--worktree` sometimes being ignored on first launch
* Fixed a panic ("switch on corrupted value") on Windows
* Fixed a crash that could occur when spawning many processes on Windows
* Fixed a crash in the WebAssembly interpreter on Linux x64 & Windows x64
* Fixed a crash that sometimes occurred after 2 minutes on Windows ARM64

## 2.1.52 (February 24, 2026)

* VS Code: Fixed extension crash on Windows ("command 'claude-vscode.editor.openLast' not found")

## 2.1.51 (February 24, 2026)

* Added `claude remote-control` subcommand for external builds, enabling local environment serving for all users.
* Updated plugin marketplace default git timeout from 30s to 120s and added `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` to configure.
* Added support for custom npm registries and specific version pinning when installing plugins from npm sources
* BashTool now skips login shell (`-l` flag) by default when a shell snapshot is available, improving command execution performance. Previously this required setting `CLAUDE_BASH_NO_LOGIN=true`.
* Fixed a security issue where `statusLine` and `fileSuggestion` hook commands could execute without workspace trust acceptance in interactive mode.
* Tool results larger than 50K characters are now persisted to disk (previously 100K). This reduces context window usage and improves conversation longevity.
* Fixed a bug where duplicate `control_response` messages (e.g. from WebSocket reconnects) could cause API 400 errors by pushing duplicate assistant messages into the conversation.
* Added `CLAUDE_CODE_ACCOUNT_UUID`, `CLAUDE_CODE_USER_EMAIL`, and `CLAUDE_CODE_ORGANIZATION_UUID` environment variables for SDK callers to provide account info synchronously, eliminating a race condition where early telemetry events lacked account metadata.
* Fixed slash command autocomplete crashing when a plugin's SKILL.md description is a YAML array or other non-string type
* The `/model` picker now shows human-readable labels (e.g., "Sonnet 4.5") instead of raw model IDs for pinned model versions, with an upgrade hint when a newer version is available.
* Managed settings can now be set via macOS plist or Windows Registry. Learn more at [https://code.claude.com/docs/en/settings#settings-files](https://code.claude.com/docs/en/settings#settings-files)

## 2.1.50 (February 20, 2026)

* Added support for `startupTimeout` configuration for LSP servers
* Added `WorktreeCreate` and `WorktreeRemove` hook events, enabling custom VCS setup and teardown when agent worktree isolation creates or removes worktrees.
* Fixed a bug where resumed sessions could be invisible when the working directory involved symlinks, because the session storage path was resolved at different times during startup. Also fixed session data loss on SSH disconnect by flushing session data before hooks and analytics in the graceful shutdown sequence.
* Linux: Fixed native modules not loading on systems with glibc older than 2.30 (e.g., RHEL 8)
* Fixed memory leak in agent teams where completed teammate tasks were never garbage collected from session state
* Fixed `CLAUDE_CODE_SIMPLE` to fully strip down skills, session memory, custom agents, and CLAUDE.md token counting
* Fixed `/mcp reconnect` freezing the CLI when given a server name that doesn't exist
* Fixed memory leak where completed task state objects were never removed from AppState
* Added support for `isolation: worktree` in agent definitions, allowing agents to declaratively run in isolated git worktrees.
* `CLAUDE_CODE_SIMPLE` mode now also disables MCP tools, attachments, hooks, and CLAUDE.md file loading for a fully minimal experience.
* Fixed bug where MCP tools were not discovered when tool search is enabled and a prompt is passed in as a launch argument
* Improved memory usage during long sessions by clearing internal caches after compaction
* Added `claude agents` CLI command to list all configured agents
* Improved memory usage during long sessions by clearing large tool results after they have been processed
* Fixed a memory leak where LSP diagnostic data was never cleaned up after delivery, causing unbounded memory growth in long sessions
* Fixed a memory leak where completed task output was not freed from memory, reducing memory usage in long sessions with many tasks
* Improved startup performance for headless mode (`-p` flag) by deferring Yoga WASM and UI component imports
* Fixed prompt suggestion cache regression that reduced cache hit rates
* Fixed unbounded memory growth in long sessions by capping file history snapshots
* Added `CLAUDE_CODE_DISABLE_1M_CONTEXT` environment variable to disable 1M context window support
* Opus 4.6 (fast mode) now includes the full 1M context window
* VSCode: Added `/extra-usage` command support in VS Code sessions
* Fixed memory leak where TaskOutput retained recent lines after cleanup
* Fixed memory leak in CircularBuffer where cleared items were retained in the backing array
* Fixed memory leak in shell command execution where ChildProcess and AbortController references were retained after cleanup

## 2.1.49 (February 19, 2026)

* Improved MCP OAuth authentication with step-up auth support and discovery caching, reducing redundant network requests during server connections
* Added `--worktree` (`-w`) flag to start Claude in an isolated git worktree
* Subagents support `isolation: "worktree"` for working in a temporary git worktree
* Added Ctrl+F keybinding to kill background agents (two-press confirmation)
* Agent definitions support `background: true` to always run as a background task
* Plugins can ship `settings.json` for default configuration
* Fixed file-not-found errors to suggest corrected paths when the model drops the repo folder
* Fixed Ctrl+C and ESC being silently ignored when background agents are running and the main thread is idle. Pressing twice within 3 seconds now kills all background agents.
* Fixed prompt suggestion cache regression that reduced cache hit rates.
* Fixed `plugin enable` and `plugin disable` to auto-detect the correct scope when `--scope` is not specified, instead of always defaulting to user scope
* Simple mode (`CLAUDE_CODE_SIMPLE`) now includes the file edit tool in addition to the Bash tool, allowing direct file editing in simple mode.
* Permission suggestions are now populated when safety checks trigger an ask response, enabling SDK consumers to display permission options
* Sonnet 4.5 with 1M context is being removed from the Max plan in favor of our frontier Sonnet 4.6 model, which now has 1M context. Please switch in /model.
* Fixed verbose mode not updating thinking block display when toggled via `/config` — memo comparators now correctly detect verbose changes
* Fixed unbounded WASM memory growth during long sessions by periodically resetting the tree-sitter parser
* Fixed potential rendering issues caused by stale yoga layout references
* Improved performance in non-interactive mode (`-p`) by skipping unnecessary API calls during startup
* Improved performance by caching authentication failures for HTTP and SSE MCP servers, avoiding repeated connection attempts to servers requiring auth
* Fixed unbounded memory growth during long-running sessions caused by Yoga WASM linear memory never shrinking
* SDK model info now includes `supportsEffort`, `supportedEffortLevels`, and `supportsAdaptiveThinking` fields so consumers can discover model capabilities.
* Added `ConfigChange` hook event that fires when configuration files change during a session, enabling enterprise security auditing and optional blocking of settings changes.
* Improved startup performance by caching MCP auth failures to avoid redundant connection attempts
* Improved startup performance by reducing HTTP calls for analytics token counting
* Improved startup performance by batching MCP tool token counting into a single API call
* Fixed `disableAllHooks` setting to respect managed settings hierarchy — non-managed settings can no longer disable managed hooks set by policy (#26637)
* Fixed `--resume` session picker showing raw XML tags for sessions that start with commands like `/clear`. Now correctly falls through to the session ID fallback.
* Improved permission prompts for path safety and working directory blocks to show the reason for the restriction instead of a bare prompt with no context

## 2.1.47 (February 18, 2026)

* Fixed FileWriteTool line counting to preserve intentional trailing blank lines instead of stripping them with `trimEnd()`.
* Fixed Windows terminal rendering bugs caused by `os.EOL` (`\r\n`) in display code — line counts now show correct values instead of always showing 1 on Windows.
* Improved VS Code plan preview: auto-updates as Claude iterates, enables commenting only when the plan is ready for review, and keeps the preview open when rejecting so Claude can revise.
* Fixed a bug where bold and colored text in markdown output could shift to the wrong characters on Windows due to `\r\n` line endings.
* Fixed compaction failing when conversation contains many PDF documents by stripping document blocks alongside images before sending to the compaction API (anthropics/claude-code#26188)
* Improved memory usage in long-running sessions by releasing API stream buffers, agent context, and skill state after use
* Improved startup performance by deferring SessionStart hook execution, reducing time-to-interactive by ~500ms.
* Fixed an issue where bash tool output was silently discarded on Windows when using MSYS2 or Cygwin shells.
* Improved performance of `@` file mentions - file suggestions now appear faster by pre-warming the index on startup and using session-based caching with background refresh.
* Improved memory usage by trimming agent task message history after tasks complete
* Improved memory usage during long agent sessions by eliminating O(n²) message accumulation in progress updates
* Fixed the bash permission classifier to validate that returned match descriptions correspond to actual input rules, preventing hallucinated descriptions from incorrectly granting permissions
* Fixed user-defined agents only loading one file on NFS/FUSE filesystems that report zero inodes (anthropics/claude-code#26044)
* Fixed plugin agent skills silently failing to load when referenced by bare name instead of fully-qualified plugin name (anthropics/claude-code#25834)
* Search patterns in collapsed tool results are now displayed in quotes for clarity
* Windows: Fixed CWD tracking temp files never being cleaned up, causing them to accumulate indefinitely (anthropics/claude-code#17600)
* Use `ctrl+f` to kill all background agents instead of double-pressing ESC. Background agents now continue running when you press ESC to cancel the main thread, giving you more control over agent lifecycle.
* Fixed API 400 errors ("thinking blocks cannot be modified") that occurred in sessions with concurrent agents, caused by interleaved streaming content blocks preventing proper message merging.
* Simplified teammate navigation to use only Shift+Down (with wrapping) instead of both Shift+Up and Shift+Down.
* Fixed an issue where a single file write/edit error would abort all other parallel file write/edit operations. Independent file mutations now complete even when a sibling fails.
* Added `last_assistant_message` field to Stop and SubagentStop hook inputs, providing the final assistant response text so hooks can access it without parsing transcript files.
* Fixed custom session titles set via `/rename` being lost after resuming a conversation (anthropics/claude-code#23610)
* Fixed collapsed read/search hint text overflowing on narrow terminals by truncating from the start.
* Fixed an issue where bash commands with backslash-newline continuation lines (e.g., long commands split across multiple lines with `\`) would produce spurious empty arguments, potentially breaking command execution.
* Fixed built-in slash commands (`/help`, `/model`, `/compact`, etc.) being hidden from the autocomplete dropdown when many user skills are installed (anthropics/claude-code#22020)
* Fixed MCP servers not appearing in the MCP Management Dialog after deferred loading
* Fixed session name persisting in status bar after `/clear` command (anthropics/claude-code#26082)
* Fixed crash when a skill's `name` or `description` in SKILL.md frontmatter is a bare number (e.g., `name: 3000`) — the value is now properly coerced to a string (anthropics/claude-code#25837)
* Fixed /resume silently dropping sessions when the first message exceeds 16KB or uses array-format content (anthropics/claude-code#25721)
* Added `chat:newline` keybinding action for configurable multi-line input (anthropics/claude-code#26075)
* Added `added_dirs` to the statusline JSON `workspace` section, exposing directories added via `/add-dir` to external scripts (anthropics/claude-code#26096)
* Fixed `claude doctor` misclassifying mise and asdf-managed installations as native installs (anthropics/claude-code#26033)
* Fixed zsh heredoc failing with "read-only file system" error in sandboxed commands (anthropics/claude-code#25990)
* Fixed agent progress indicator showing inflated tool use count (anthropics/claude-code#26023)
* Fixed image pasting not working on WSL2 systems where Windows copies images as BMP format (anthropics/claude-code#25935)
* Fixed background agent results returning raw transcript data instead of the agent's final answer (anthropics/claude-code#26012)
* Fixed Warp terminal incorrectly prompting for Shift+Enter setup when it supports it natively (anthropics/claude-code#25957)
* Fixed CJK wide characters causing misaligned timestamps and layout elements in the TUI (anthropics/claude-code#26084)
* Fixed custom agent `model` field in `.claude/agents/*.md` being ignored when spawning team teammates (anthropics/claude-code#26064)
* Fixed plan mode being lost after context compaction, causing the model to switch from planning to implementation mode (anthropics/claude-code#26061)
* Fixed `alwaysThinkingEnabled: true` in settings.json not enabling thinking mode on Bedrock and Vertex providers (anthropics/claude-code#26074)
* Fixed `tool_decision` OTel telemetry event not being emitted in headless/SDK mode (anthropics/claude-code#26059)
* Fixed session name being lost after context compaction — renamed sessions now preserve their custom title through compaction (anthropics/claude-code#26121)
* Increased initial session count in resume picker from 10 to 50 for faster session discovery (anthropics/claude-code#26123)
* Windows: fixed worktree session matching when drive letter casing differs (anthropics/claude-code#26123)
* Fixed `/resume <session-id>` failing to find sessions whose first message exceeds 16KB (anthropics/claude-code#25920)
* Fixed "Always allow" on multiline bash commands creating invalid permission patterns that corrupt settings (anthropics/claude-code#25909)
* Fixed React crash (error #31) when a skill's `argument-hint` in SKILL.md frontmatter uses YAML sequence syntax (e.g., `[topic: foo | bar]`) — the value is now properly coerced to a string (anthropics/claude-code#25826)
* Fixed crash when using `/fork` on sessions that used web search — null entries in search results from transcript deserialization are now handled gracefully (anthropics/claude-code#25811)
* Fixed read-only git commands triggering FSEvents file watcher loops on macOS by adding --no-optional-locks flag (anthropics/claude-code#25750)
* Fixed custom agents and skills not being discovered when running from a git worktree — project-level `.claude/agents/` and `.claude/skills/` from the main repository are now included (anthropics/claude-code#25816)
* Fixed non-interactive subcommands like `claude doctor` and `claude plugin validate` being blocked inside nested Claude sessions (anthropics/claude-code#25803)
* Windows: Fixed the same CLAUDE.md file being loaded twice when drive letter casing differs between paths (anthropics/claude-code#25756)
* Fixed inline code spans in markdown being incorrectly parsed as bash commands (anthropics/claude-code#25792)
* Fixed teammate spinners not respecting custom spinnerVerbs from settings (anthropics/claude-code#25748)
* Fixed shell commands permanently failing after a command deletes its own working directory (anthropics/claude-code#26136)
* Fixed hooks (PreToolUse, PostToolUse) silently failing to execute on Windows by using Git Bash instead of cmd.exe (anthropics/claude-code#25981)
* Fixed LSP `findReferences` and other location-based operations returning results from gitignored files (e.g., `node_modules/`, `venv/`) (anthropics/claude-code#26051)
* Moved config backup files from home directory root to `~/.claude/backups/` to reduce home directory clutter (anthropics/claude-code#26130)
* Fixed sessions with large first prompts (>16KB) disappearing from the /resume list (anthropics/claude-code#26140)
* Fixed shell functions with double-underscore prefixes (e.g., `__git_ps1`) not being preserved across shell sessions (anthropics/claude-code#25824)
* Fixed spinner showing "0 tokens" counter before any tokens have been received (anthropics/claude-code#26105)
* VSCode: Fixed conversation messages appearing dimmed while the AskUserQuestion dialog is open (anthropics/claude-code#26078)
* Fixed background tasks failing in git worktrees due to remote URL resolution reading from worktree-specific gitdir instead of the main repository config (anthropics/claude-code#26065)
* Fixed Right Alt key leaving visible `[25~` escape sequence residue in the input field on Windows/Git Bash terminals (anthropics/claude-code#25943)
* The `/rename` command now updates the terminal tab title by default (anthropics/claude-code#25789)
* Fixed Edit tool silently corrupting Unicode curly quotes (\u201c\u201d \u2018\u2019) by replacing them with straight quotes when making edits (anthropics/claude-code#26141)
* Fixed OSC 8 hyperlinks only being clickable on the first line when link text wraps across multiple terminal lines.

## 2.1.46 (February 18, 2026)

* Fixed orphaned CC processes after terminal disconnect on macOS
* Added support for using claude.ai MCP connectors in Claude Code

## 2.1.45 (February 17, 2026)

* Added support for Claude Sonnet 4.6
* Added support for reading `enabledPlugins` and `extraKnownMarketplaces` from `--add-dir` directories
* Added `spinnerTipsOverride` setting to customize spinner tips — configure `tips` with an array of custom tip strings, and optionally set `excludeDefault: true` to show only your custom tips instead of the built-in ones
* Added `SDKRateLimitInfo` and `SDKRateLimitEvent` types to the SDK, enabling consumers to receive rate limit status updates including utilization, reset times, and overage information
* Fixed Agent Teams teammates failing on Bedrock, Vertex, and Foundry by propagating API provider environment variables to tmux-spawned processes (anthropics/claude-code#23561)
* Fixed sandbox "operation not permitted" errors when writing temporary files on macOS by using the correct per-user temp directory (anthropics/claude-code#21654)
* Fixed Task tool (backgrounded agents) crashing with a `ReferenceError` on completion (anthropics/claude-code#22087)
* Fixed autocomplete suggestions not being accepted on Enter when images are pasted in the input
* Fixed skills invoked by subagents incorrectly appearing in main session context after compaction
* Fixed excessive `.claude.json.backup` files accumulating on every startup
* Fixed plugin-provided commands, agents, and hooks not being available immediately after installation without requiring a restart
* Improved startup performance by removing eager loading of session history for stats caching
* Improved memory usage for shell commands that produce large output — RSS no longer grows unboundedly with command output size
* Improved collapsed read/search groups to show the current file or search pattern being processed beneath the summary line while active
* [VSCode] Improved permission destination choice (project/user/session) to persist across sessions

## 2.1.44 (February 16, 2026)

* Fixed ENAMETOOLONG errors for deeply-nested directory paths
* Fixed auth refresh errors

## 2.1.43 (February 16, 2026)

* Fixed AWS auth refresh hanging indefinitely by adding a 3-minute timeout
* Fixed spurious warnings for non-agent markdown files in `.claude/agents/` directory
* Fixed structured-outputs beta header being sent unconditionally on Vertex/Bedrock

## 2.1.42 (February 13, 2026)

* Improved startup performance by deferring Zod schema construction
* Improved prompt cache hit rates by moving date out of system prompt
* Added one-time Opus 4.6 effort callout for eligible users
* Fixed /resume showing interrupt messages as session titles
* Fixed image dimension limit errors to suggest /compact

## 2.1.41 (February 13, 2026)

* Added guard against launching Claude Code inside another Claude Code session
* Fixed Agent Teams using wrong model identifier for Bedrock, Vertex, and Foundry customers
* Fixed a crash when MCP tools return image content during streaming
* Fixed /resume session previews showing raw XML tags instead of readable command names
* Improved model error messages for Bedrock/Vertex/Foundry users with fallback suggestions
* Fixed plugin browse showing misleading "Space to Toggle" hint for already-installed plugins
* Fixed hook blocking errors (exit code 2) not showing stderr to the user
* Added `speed` attribute to OTel events and trace spans for fast mode visibility
* Added `claude auth login`, `claude auth status`, and `claude auth logout` CLI subcommands
* Added Windows ARM64 (win32-arm64) native binary support
* Improved `/rename` to auto-generate session name from conversation context when called without arguments
* Improved narrow terminal layout for prompt footer
* Fixed file resolution failing for @-mentions with anchor fragments (e.g., `@README.md#installation`)
* Fixed FileReadTool blocking the process on FIFOs, `/dev/stdin`, and large files
* Fixed background task notifications not being delivered in streaming Agent SDK mode
* Fixed cursor jumping to end on each keystroke in classifier rule input
* Fixed markdown link display text being dropped for raw URL
* Fixed auto-compact failure error notifications being shown to users
* Fixed permission wait time being included in subagent elapsed time display
* Fixed proactive ticks firing while in plan mode
* Fixed clear stale permission rules when settings change on disk
* Fixed hook blocking errors showing stderr content in UI

## 2.1.39 (February 10, 2026)

* Improved terminal rendering performance
* Fixed fatal errors being swallowed instead of displayed
* Fixed process hanging after session close
* Fixed character loss at terminal screen boundary
* Fixed blank lines in verbose transcript view

## 2.1.38 (February 10, 2026)

* Fixed VS Code terminal scroll-to-top regression introduced in 2.1.37
* Fixed Tab key queueing slash commands when a plan is being reviewed

---

**Check your installed version:** Run `claude --version`

**See all documentation:** Visit https://code.claude.com/docs/llms.txt