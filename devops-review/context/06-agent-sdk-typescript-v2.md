# Agent SDK Reference — TypeScript V2 (Preview)

> Source: https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview
> Fetched: 2026-03-28

> **Warning**: The V2 interface is an unstable preview. APIs may change before becoming stable.

The V2 Claude Agent TypeScript SDK removes async generators and yield coordination. Each turn is a separate `send()`/`stream()` cycle. Three core concepts:

- `createSession()` / `resumeSession()`: Start or continue a conversation
- `session.send()`: Send a message
- `session.stream()`: Get the response

## Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
```

## Quick Start

### One-shot prompt

```typescript
import { unstable_v2_prompt } from "@anthropic-ai/claude-agent-sdk";

const result = await unstable_v2_prompt("What is 2 + 2?", {
  model: "claude-opus-4-6"
});
if (result.subtype === "success") {
  console.log(result.result);
}
```

### Basic session

```typescript
import { unstable_v2_createSession } from "@anthropic-ai/claude-agent-sdk";

await using session = unstable_v2_createSession({
  model: "claude-opus-4-6"
});

await session.send("Hello!");
for await (const msg of session.stream()) {
  if (msg.type === "assistant") {
    const text = msg.message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
    console.log(text);
  }
}
```

### Multi-turn conversation

```typescript
// Turn 1
await session.send("What is 5 + 3?");
for await (const msg of session.stream()) { /* process */ }

// Turn 2 — Claude remembers context
await session.send("Multiply that by 2");
for await (const msg of session.stream()) { /* process */ }
```

### Session resume

```typescript
import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
} from "@anthropic-ai/claude-agent-sdk";

const session = unstable_v2_createSession({ model: "claude-opus-4-6" });
await session.send("Remember this number: 42");
let sessionId: string | undefined;
for await (const msg of session.stream()) {
  sessionId = msg.session_id;
}
session.close();

// Later: resume
await using resumedSession = unstable_v2_resumeSession(sessionId!, {
  model: "claude-opus-4-6"
});
await resumedSession.send("What number did I ask you to remember?");
```

### Cleanup

**Automatic (TypeScript 5.2+):**
```typescript
await using session = unstable_v2_createSession({ model: "claude-opus-4-6" });
// Session closes automatically when block exits
```

**Manual:**
```typescript
const session = unstable_v2_createSession({ model: "claude-opus-4-6" });
// ... use the session ...
session.close();
```

## API Reference

### `unstable_v2_createSession(options)` → `SDKSession`
### `unstable_v2_resumeSession(sessionId, options)` → `SDKSession`
### `unstable_v2_prompt(prompt, options)` → `Promise<SDKResultMessage>`

### SDKSession interface

```typescript
interface SDKSession {
  readonly sessionId: string;
  send(message: string | SDKUserMessage): Promise<void>;
  stream(): AsyncGenerator<SDKMessage, void>;
  close(): void;
}
```

## Feature Availability

V1-only features (not yet in V2):
- Session forking (`forkSession` option)
- Some advanced streaming input patterns
