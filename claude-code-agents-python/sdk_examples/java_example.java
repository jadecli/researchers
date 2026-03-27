/**
 * Java SDK example: create message, tool use, and streaming
 * with the Anthropic API.
 *
 * Dependency: com.anthropic:anthropic-java:0.1.0
 */
package com.example.anthropic;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.*;
import java.util.List;
import java.util.Map;

public class JavaExample {

    public static void main(String[] args) {
        System.out.println("=== Create Message ===");
        createMessageExample();

        System.out.println("\n=== Tool Use ===");
        toolUseExample();

        System.out.println("\n=== Streaming ===");
        streamingExample();
    }

    /**
     * Basic message creation using the Anthropic Java SDK.
     */
    static void createMessageExample() {
        AnthropicClient client = AnthropicOkHttpClient.builder()
                .apiKey(System.getenv("ANTHROPIC_API_KEY"))
                .build();

        MessageCreateParams params = MessageCreateParams.builder()
                .model("claude-sonnet-4-20250514")
                .maxTokens(1024)
                .addUserMessage("Explain quantum computing in one paragraph.")
                .build();

        Message message = client.messages().create(params);

        for (ContentBlock block : message.content()) {
            if (block.type().equals("text")) {
                System.out.println("Response: " + block.text());
            }
        }
        System.out.printf("Usage: %d in, %d out%n",
                message.usage().inputTokens(),
                message.usage().outputTokens());
    }

    /**
     * Tool use (function calling) example.
     */
    static void toolUseExample() {
        AnthropicClient client = AnthropicOkHttpClient.builder()
                .apiKey(System.getenv("ANTHROPIC_API_KEY"))
                .build();

        Tool weatherTool = Tool.builder()
                .name("get_weather")
                .description("Get the current weather for a given location.")
                .inputSchema(Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "location", Map.of(
                                        "type", "string",
                                        "description", "City and state, e.g. San Francisco, CA"
                                ),
                                "unit", Map.of(
                                        "type", "string",
                                        "enum", List.of("celsius", "fahrenheit"),
                                        "description", "Temperature unit"
                                )
                        ),
                        "required", List.of("location")
                ))
                .build();

        MessageCreateParams params = MessageCreateParams.builder()
                .model("claude-sonnet-4-20250514")
                .maxTokens(1024)
                .addTool(weatherTool)
                .addUserMessage("What's the weather in San Francisco?")
                .build();

        Message message = client.messages().create(params);

        for (ContentBlock block : message.content()) {
            if (block.type().equals("tool_use")) {
                System.out.println("Tool call: " + block.name());
                System.out.println("Input: " + block.input());
            }
        }
    }

    /**
     * Streaming response example.
     */
    static void streamingExample() {
        AnthropicClient client = AnthropicOkHttpClient.builder()
                .apiKey(System.getenv("ANTHROPIC_API_KEY"))
                .build();

        MessageCreateParams params = MessageCreateParams.builder()
                .model("claude-sonnet-4-20250514")
                .maxTokens(1024)
                .addUserMessage("Write a haiku about programming.")
                .build();

        // Use streaming endpoint
        client.messages().createStreaming(params).forEach(event -> {
            if (event.type().equals("content_block_delta")) {
                if (event.delta() != null && event.delta().type().equals("text_delta")) {
                    System.out.print(event.delta().text());
                }
            }
        });
        System.out.println();
    }
}
