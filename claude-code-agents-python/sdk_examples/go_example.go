// Go SDK example: create message, tool use, and streaming
// with the Anthropic API.
//
// Install: go get github.com/anthropics/anthropic-sdk-go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

func main() {
	fmt.Println("=== Create Message ===")
	createMessageExample()

	fmt.Println("\n=== Tool Use ===")
	toolUseExample()

	fmt.Println("\n=== Streaming ===")
	streamingExample()
}

// createMessageExample demonstrates basic message creation.
func createMessageExample() {
	client := anthropic.NewClient(option.WithAPIKey(os.Getenv("ANTHROPIC_API_KEY")))

	message, err := client.Messages.New(context.Background(), anthropic.MessageNewParams{
		Model:     anthropic.ModelClaudeSonnet4_20250514,
		MaxTokens: 1024,
		Messages: []anthropic.MessageParam{
			{
				Role: "user",
				Content: []anthropic.ContentBlockParamUnion{
					textBlock("Explain quantum computing in one paragraph."),
				},
			},
		},
	})
	if err != nil {
		log.Printf("Error creating message: %v", err)
		return
	}

	if len(message.Content) > 0 {
		fmt.Printf("Response: %s\n", message.Content[0].Text)
		fmt.Printf("Usage: %d in, %d out\n",
			message.Usage.InputTokens, message.Usage.OutputTokens)
	}
}

// toolUseExample demonstrates function calling with tools.
func toolUseExample() {
	client := anthropic.NewClient(option.WithAPIKey(os.Getenv("ANTHROPIC_API_KEY")))

	weatherSchema := map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"location": map[string]interface{}{
				"type":        "string",
				"description": "City and state, e.g. San Francisco, CA",
			},
			"unit": map[string]interface{}{
				"type":        "string",
				"enum":        []string{"celsius", "fahrenheit"},
				"description": "Temperature unit",
			},
		},
		"required": []string{"location"},
	}
	schemaBytes, _ := json.Marshal(weatherSchema)

	message, err := client.Messages.New(context.Background(), anthropic.MessageNewParams{
		Model:     anthropic.ModelClaudeSonnet4_20250514,
		MaxTokens: 1024,
		Tools: []anthropic.ToolUnionParam{
			{
				Name:        "get_weather",
				Description: "Get the current weather for a given location.",
				InputSchema: json.RawMessage(schemaBytes),
			},
		},
		Messages: []anthropic.MessageParam{
			{
				Role: "user",
				Content: []anthropic.ContentBlockParamUnion{
					textBlock("What's the weather in San Francisco?"),
				},
			},
		},
	})
	if err != nil {
		log.Printf("Error with tool use: %v", err)
		return
	}

	for _, block := range message.Content {
		if block.Type == "tool_use" {
			fmt.Printf("Tool call: %s\n", block.Name)
			inputJSON, _ := json.Marshal(block.Input)
			fmt.Printf("Input: %s\n", string(inputJSON))
		}
	}
}

// streamingExample demonstrates streaming responses.
func streamingExample() {
	client := anthropic.NewClient(option.WithAPIKey(os.Getenv("ANTHROPIC_API_KEY")))

	stream, err := client.Messages.NewStreaming(context.Background(), anthropic.MessageNewParams{
		Model:     anthropic.ModelClaudeSonnet4_20250514,
		MaxTokens: 1024,
		Messages: []anthropic.MessageParam{
			{
				Role: "user",
				Content: []anthropic.ContentBlockParamUnion{
					textBlock("Write a haiku about programming."),
				},
			},
		},
	})
	if err != nil {
		log.Printf("Error streaming: %v", err)
		return
	}
	defer stream.Close()

	for stream.Next() {
		event := stream.Current()
		if delta, ok := event.Delta.(anthropic.TextDelta); ok {
			fmt.Print(delta.Text)
		}
	}
	fmt.Println()

	if err := stream.Err(); err != nil {
		log.Printf("Stream error: %v", err)
	}
}

func textBlock(text string) anthropic.ContentBlockParamUnion {
	return anthropic.ContentBlockParamUnion{
		Type: "text",
		Text: text,
	}
}
