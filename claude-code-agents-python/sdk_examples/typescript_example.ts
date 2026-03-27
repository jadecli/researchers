/**
 * TypeScript SDK example: create message, tool use, and streaming
 * with the Anthropic API.
 *
 * Install: npm install @anthropic-ai/sdk
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

/** Basic message creation. */
async function createMessageExample(): Promise<string> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      { role: "user", content: "Explain quantum computing in one paragraph." },
    ],
  });

  if (message.content[0].type === "text") {
    const text = message.content[0].text;
    console.log(`Response: ${text}`);
    console.log(
      `Usage: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`
    );
    return text;
  }
  return "";
}

/** Tool use (function calling) example. */
async function toolUseExample(): Promise<Record<string, unknown>> {
  const tools: Anthropic.Messages.Tool[] = [
    {
      name: "get_weather",
      description: "Get the current weather for a given location.",
      input_schema: {
        type: "object" as const,
        properties: {
          location: {
            type: "string",
            description: "City and state, e.g. San Francisco, CA",
          },
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "Temperature unit",
          },
        },
        required: ["location"],
      },
    },
  ];

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    tools,
    messages: [
      { role: "user", content: "What's the weather in San Francisco?" },
    ],
  });

  for (const block of message.content) {
    if (block.type === "tool_use") {
      console.log(`Tool call: ${block.name}`);
      console.log(`Input: ${JSON.stringify(block.input)}`);

      // Continue conversation with tool result
      const result = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        tools,
        messages: [
          { role: "user", content: "What's the weather in San Francisco?" },
          { role: "assistant", content: message.content },
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: block.id,
                content:
                  '{"temperature": 62, "unit": "fahrenheit", "condition": "foggy"}',
              },
            ],
          },
        ],
      });
      return { tool_name: block.name, tool_input: block.input };
    }
  }
  return {};
}

/** Streaming response example. */
async function streamingExample(): Promise<string> {
  let collected = "";

  const stream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      { role: "user", content: "Write a haiku about programming." },
    ],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      process.stdout.write(event.delta.text);
      collected += event.delta.text;
    }
  }
  console.log();
  return collected;
}

async function main(): Promise<void> {
  console.log("=== Create Message ===");
  await createMessageExample();
  console.log("\n=== Tool Use ===");
  await toolUseExample();
  console.log("\n=== Streaming ===");
  await streamingExample();
}

main().catch(console.error);
