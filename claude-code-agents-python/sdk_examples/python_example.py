"""Python SDK example: create message, tool use, and streaming with the Anthropic API."""

from __future__ import annotations

import anthropic


def create_message_example() -> str:
    """Basic message creation using the Anthropic Python SDK."""
    client = anthropic.Anthropic()

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[
            {"role": "user", "content": "Explain quantum computing in one paragraph."}
        ],
    )

    text = message.content[0].text
    print(f"Response: {text}")
    print(f"Usage: {message.usage.input_tokens} in, {message.usage.output_tokens} out")
    return text


def tool_use_example() -> dict:
    """Tool use (function calling) with the Anthropic Python SDK."""
    client = anthropic.Anthropic()

    tools = [
        {
            "name": "get_weather",
            "description": "Get the current weather for a given location.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City and state, e.g. San Francisco, CA",
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "Temperature unit",
                    },
                },
                "required": ["location"],
            },
        }
    ]

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        tools=tools,
        messages=[
            {"role": "user", "content": "What's the weather in San Francisco?"}
        ],
    )

    # Process tool use blocks
    for block in message.content:
        if block.type == "tool_use":
            print(f"Tool call: {block.name}")
            print(f"Input: {block.input}")

            # Simulate tool result and continue the conversation
            result = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                tools=tools,
                messages=[
                    {"role": "user", "content": "What's the weather in San Francisco?"},
                    {"role": "assistant", "content": message.content},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": '{"temperature": 62, "unit": "fahrenheit", "condition": "foggy"}',
                            }
                        ],
                    },
                ],
            )
            return {"tool_name": block.name, "tool_input": block.input}

    return {}


def streaming_example() -> str:
    """Streaming response using the Anthropic Python SDK."""
    client = anthropic.Anthropic()

    collected_text = ""
    with client.messages.stream(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[
            {"role": "user", "content": "Write a haiku about programming."}
        ],
    ) as stream:
        for text in stream.text_stream:
            print(text, end="", flush=True)
            collected_text += text

    print()
    return collected_text


if __name__ == "__main__":
    print("=== Create Message ===")
    create_message_example()
    print("\n=== Tool Use ===")
    tool_use_example()
    print("\n=== Streaming ===")
    streaming_example()
