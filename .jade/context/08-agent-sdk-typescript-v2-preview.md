---
source: https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview
fetched: 2026-03-28
description: Claude Agent SDK TypeScript v2 preview — createSession/send/stream patterns for multi-turn conversations
---

# Claude Agent SDK TypeScript V2 Preview

The V2 API introduces session-based patterns for managing multi-turn conversations with Claude Code agents. These APIs are currently unstable and may change before the final v2 release.

## Unstable API Prefix

All V2 APIs are prefixed with `unstable_v2_` to indicate their preview status:

- `unstable_v2_prompt`
- `unstable_v2_createSession`
- `unstable_v2_resumeSession`

## unstable_v2_prompt

A simplified prompt function for one-shot queries:

```typescript
import { unstable_v2_prompt } from "@anthropic-ai/claude-agent-sdk";

const result = await unstable_v2_prompt("Explain this codebase", {
  workingDirectory: "/path/to/project",
  model: "claude-sonnet-4-20250514",
});

console.log(result.text);
```

## unstable_v2_createSession

Create a persistent session for multi-turn conversations:

```typescript
import { unstable_v2_createSession } from "@anthropic-ai/claude-agent-sdk";

const session = await unstable_v2_createSession({
  workingDirectory: "/path/to/project",
  model: "claude-sonnet-4-20250514",
  systemPrompt: "You are a helpful coding assistant.",
  tools: ["Read", "Write", "Edit", "Bash"],
  mcpServers: {
    github: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
    },
  },
});
```

## unstable_v2_resumeSession

Resume an existing session by ID:

```typescript
import { unstable_v2_resumeSession } from "@anthropic-ai/claude-agent-sdk";

const session = await unstable_v2_resumeSession(sessionId, {
  workingDirectory: "/path/to/project",
});
```

## SDKSession Interface

The session object provides methods for interacting with the agent:

```typescript
interface SDKSession {
  id: string;

  // Send a message and wait for the complete response
  send(message: string): Promise<SDKResponse>;

  // Stream a message response
  stream(message: string): AsyncIterable<SDKStreamEvent>;

  // Fork the session to create a branch point
  fork(): Promise<SDKSession>;

  // Get session metadata
  getMetadata(): Promise<SDKSessionMetadata>;

  // Clean up session resources
  cleanup(): Promise<void>;
}
```

### send()

Send a message and receive the complete response:

```typescript
const response = await session.send("Add error handling to the auth module");

console.log(response.text);
console.log(response.toolUses); // Tools that were invoked
console.log(response.contextUsage); // Token usage statistics
```

### stream()

Stream a response for real-time updates:

```typescript
for await (const event of session.stream("Refactor the database layer")) {
  switch (event.type) {
    case "text":
      process.stdout.write(event.text);
      break;
    case "toolUse":
      console.log(`Using tool: ${event.tool} with input:`, event.input);
      break;
    case "toolResult":
      console.log(`Tool result:`, event.result);
      break;
    case "progress":
      console.log(`Progress: ${event.summary}`);
      break;
    case "error":
      console.error(`Error: ${event.message}`);
      break;
  }
}
```

## Multi-turn Example

```typescript
import { unstable_v2_createSession } from "@anthropic-ai/claude-agent-sdk";

async function main() {
  const session = await unstable_v2_createSession({
    workingDirectory: "/path/to/project",
  });

  try {
    // First turn: understand the codebase
    const analysis = await session.send("Analyze the project structure");
    console.log(analysis.text);

    // Second turn: make changes based on understanding
    const changes = await session.send("Add input validation to the API routes");
    console.log(changes.text);

    // Third turn: verify the changes
    const verification = await session.send("Run the tests and fix any failures");
    console.log(verification.text);
  } finally {
    await session.cleanup();
  }
}
```

## Session Resume Example

```typescript
import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
} from "@anthropic-ai/claude-agent-sdk";

// Create and save session ID
const session = await unstable_v2_createSession({
  workingDirectory: "/path/to/project",
});
const sessionId = session.id;
await session.send("Start implementing the new feature");

// Later, resume the session
const resumed = await unstable_v2_resumeSession(sessionId, {
  workingDirectory: "/path/to/project",
});
await resumed.send("Continue where we left off");
await resumed.cleanup();
```

## Cleanup Patterns

Always clean up sessions when done to free resources:

```typescript
// Using try/finally
const session = await unstable_v2_createSession(options);
try {
  await session.send("Do some work");
} finally {
  await session.cleanup();
}

// Using a helper function
async function withSession(options, fn) {
  const session = await unstable_v2_createSession(options);
  try {
    return await fn(session);
  } finally {
    await session.cleanup();
  }
}

await withSession({ workingDirectory: "." }, async (session) => {
  await session.send("Do some work");
});
```

## Migration from V1

The V2 API does not replace the V1 `query()` function. Both APIs will coexist:

- Use V1 `query()` for simple one-shot queries
- Use V2 sessions for multi-turn conversations and complex workflows
- V2 APIs will be stabilized (prefix removed) in a future release
