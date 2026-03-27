---
description: Use the Anthropic Claude API with examples in 7 programming languages.
tools:
  - Bash
  - Read
  - Write
model: claude-sonnet-4-20250514
references:
  - sdk_examples/python_example.py
  - sdk_examples/typescript_example.ts
  - sdk_examples/go_example.go
  - sdk_examples/java_example.java
  - sdk_examples/csharp_example.cs
  - sdk_examples/ruby_example.rb
  - sdk_examples/php_example.php
---

# claude-api

Use the Anthropic Claude API with examples in 7 programming languages.

## Usage

Use this skill when you need to integrate the Anthropic Claude API into a project. SDK examples are provided for:

- **Python**: Using the `anthropic` package with native streaming support.
- **TypeScript**: Using `@anthropic-ai/sdk` with async/await patterns.
- **Go**: Using `github.com/anthropics/anthropic-sdk-go` with context support.
- **Java**: Using `com.anthropic:anthropic-java` with builder patterns.
- **C#**: Using REST API with HttpClient and System.Text.Json.
- **Ruby**: Using Net::HTTP with SSE streaming.
- **PHP**: Using cURL with streaming callback.

## API Patterns Demonstrated

### 1. Create Message
Basic message creation with a single user prompt. Shows model selection, max tokens, and response parsing.

### 2. Tool Use (Function Calling)
Define tools with JSON schemas, send a message that triggers tool use, parse the tool call, provide a tool result, and get the final response.

### 3. Streaming
Stream responses token-by-token using SSE (Server-Sent Events). Shows event parsing and incremental text collection.

## Environment Setup

All examples require:
```bash
export ANTHROPIC_API_KEY="your-api-key-here"
```

## Running Examples

```bash
# Python
python sdk_examples/python_example.py

# TypeScript
npx ts-node sdk_examples/typescript_example.ts

# Go
go run sdk_examples/go_example.go

# Java
javac -cp anthropic-java.jar sdk_examples/java_example.java

# C#
dotnet run sdk_examples/csharp_example.cs

# Ruby
ruby sdk_examples/ruby_example.rb

# PHP
php sdk_examples/php_example.php
```

## Instructions

1. Choose the language that matches your project.
2. Review the example file for that language in `sdk_examples/`.
3. Copy and adapt the relevant patterns (message creation, tool use, streaming).
4. Ensure your ANTHROPIC_API_KEY environment variable is set.
5. Install the language-specific SDK package as noted in the example file.
