"""Template engine for rendering project scaffolds using Jinja2."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from jinja2 import Environment, BaseLoader, TemplateNotFound

from ..models.language import LanguageConfig, SupportedLanguage

logger = logging.getLogger(__name__)


class TemplateEngine:
    """Renders project templates for different languages and scaffold types.

    Uses Jinja2 with inline templates for each language/framework combination.
    Templates generate build files, entry points, and boilerplate code.

    Usage:
        engine = TemplateEngine()
        files = engine.render("python", "cli", {"project_name": "my-tool"})
    """

    def __init__(self) -> None:
        """Initialize the template engine with Jinja2 environment."""
        self._env = Environment(
            loader=BaseLoader(),
            trim_blocks=True,
            lstrip_blocks=True,
            keep_trailing_newline=True,
        )

    def render(
        self,
        language: str | SupportedLanguage,
        scaffold_type: str,
        context: dict[str, Any],
    ) -> dict[str, str]:
        """Render all files for a project scaffold.

        Args:
            language: Target language.
            scaffold_type: Type of scaffold (cli, library, web-api, etc.).
            context: Template context variables (project_name, etc.).

        Returns:
            Dict mapping relative file paths to rendered content.
        """
        if isinstance(language, str):
            language = SupportedLanguage(language.lower())

        config = LanguageConfig.for_language(language)
        full_context = {
            "language": language.value,
            "config": config,
            "scaffold_type": scaffold_type,
            **context,
        }

        templates = self._get_templates(language, scaffold_type)
        rendered: dict[str, str] = {}

        for file_path, template_str in templates.items():
            try:
                template = self._env.from_string(template_str)
                rendered[file_path] = template.render(**full_context)
            except Exception as e:
                logger.error("Failed to render %s: %s", file_path, e)
                raise

        return rendered

    def render_to_disk(
        self,
        language: str | SupportedLanguage,
        scaffold_type: str,
        context: dict[str, Any],
        output_dir: str | Path,
    ) -> list[Path]:
        """Render templates and write to disk.

        Args:
            language: Target language.
            scaffold_type: Type of scaffold.
            context: Template context.
            output_dir: Directory to write files to.

        Returns:
            List of paths to written files.
        """
        output_dir = Path(output_dir)
        rendered = self.render(language, scaffold_type, context)
        written: list[Path] = []

        for rel_path, content in rendered.items():
            full_path = output_dir / rel_path
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content, encoding="utf-8")
            written.append(full_path)

        return written

    def _get_templates(
        self, language: SupportedLanguage, scaffold_type: str
    ) -> dict[str, str]:
        """Get template strings for a language + scaffold type combination."""
        template_map = {
            SupportedLanguage.PYTHON: self._python_templates,
            SupportedLanguage.TYPESCRIPT: self._typescript_templates,
            SupportedLanguage.GO: self._go_templates,
            SupportedLanguage.RUST: self._rust_templates,
            SupportedLanguage.JAVA: self._java_templates,
            SupportedLanguage.KOTLIN: self._kotlin_templates,
            SupportedLanguage.SWIFT: self._swift_templates,
            SupportedLanguage.CSHARP: self._csharp_templates,
            SupportedLanguage.PHP: self._php_templates,
            SupportedLanguage.RUBY: self._ruby_templates,
            SupportedLanguage.ELIXIR: self._elixir_templates,
            SupportedLanguage.SCALA: self._scala_templates,
        }
        factory = template_map.get(language, self._python_templates)
        return factory(scaffold_type)

    def _python_templates(self, scaffold_type: str) -> dict[str, str]:
        """Python project templates."""
        project = "{{ project_name }}"
        templates: dict[str, str] = {
            "pyproject.toml": f"""[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "{project}"
version = "0.1.0"
description = "{{{{ description | default('A Python project') }}}}"
requires-python = ">=3.11"
dependencies = [
    "anthropic>=0.40",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "ruff>=0.4"]
""",
            "src/__init__.py": '"""{{ project_name }} package."""\n',
            "src/main.py": """\"\"\"Main entry point for {{ project_name }}.\"\"\"

import anthropic


def main() -> None:
    \"\"\"Run the application.\"\"\"
    client = anthropic.Anthropic()
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": "Hello from {{ project_name }}!"}],
    )
    print(message.content[0].text)


if __name__ == "__main__":
    main()
""",
            "tests/__init__.py": "",
            "tests/test_main.py": """\"\"\"Tests for {{ project_name }}.\"\"\"


def test_placeholder() -> None:
    \"\"\"Placeholder test.\"\"\"
    assert True
""",
        }
        return templates

    def _typescript_templates(self, scaffold_type: str) -> dict[str, str]:
        return {
            "package.json": """{
  "name": "{{ project_name }}",
  "version": "0.1.0",
  "description": "{{ description | default('A TypeScript project') }}",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30"
  },
  "devDependencies": {
    "typescript": "^5.5",
    "vitest": "^2.0"
  }
}
""",
            "tsconfig.json": """{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}
""",
            "src/index.ts": """import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

async function main(): Promise<void> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Hello from {{ project_name }}!" }],
  });
  if (message.content[0].type === "text") {
    console.log(message.content[0].text);
  }
}

main().catch(console.error);
""",
        }

    def _go_templates(self, scaffold_type: str) -> dict[str, str]:
        return {
            "go.mod": """module {{ project_name }}

go 1.22

require github.com/anthropics/anthropic-sdk-go v0.2.0
""",
            "main.go": """package main

import (
\t"context"
\t"fmt"
\t"log"

\t"github.com/anthropics/anthropic-sdk-go"
\t"github.com/anthropics/anthropic-sdk-go/option"
)

func main() {
\tclient := anthropic.NewClient(option.WithAPIKey(""))
\tmessage, err := client.Messages.New(context.Background(), anthropic.MessageNewParams{
\t\tModel:     anthropic.ModelClaudeSonnet4_20250514,
\t\tMaxTokens: 1024,
\t\tMessages: []anthropic.MessageParam{
\t\t\t{Role: "user", Content: []anthropic.ContentBlockParamUnion{
\t\t\t\tanthropicTextBlock("Hello from {{ project_name }}!"),
\t\t\t}},
\t\t},
\t})
\tif err != nil {
\t\tlog.Fatal(err)
\t}
\tfmt.Println(message.Content[0].Text)
}

func anthropicTextBlock(text string) anthropic.ContentBlockParamUnion {
\treturn anthropic.ContentBlockParamUnion{
\t\tType: "text",
\t\tText: text,
\t}
}
""",
        }

    def _rust_templates(self, scaffold_type: str) -> dict[str, str]:
        return {
            "Cargo.toml": """[package]
name = "{{ project_name }}"
version = "0.1.0"
edition = "2021"

[dependencies]
anthropic = "0.1"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
""",
            "src/main.rs": """use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let api_key = env::var("ANTHROPIC_API_KEY")
        .expect("ANTHROPIC_API_KEY environment variable must be set");

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&serde_json::json!({
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": "Hello from {{ project_name }}!"}]
        }))
        .send()
        .await?;

    let body: serde_json::Value = response.json().await?;
    if let Some(text) = body["content"][0]["text"].as_str() {
        println!("{text}");
    }
    Ok(())
}
""",
        }

    def _java_templates(self, scaffold_type: str) -> dict[str, str]:
        return {
            "build.gradle.kts": """plugins {
    java
    application
}

group = "com.example"
version = "0.1.0"

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("com.anthropic:anthropic-java:0.1.0")
}

application {
    mainClass.set("com.example.Main")
}
""",
            "src/main/java/com/example/Main.java": """package com.example;

import com.anthropic.client.AnthropicClient;

public class Main {
    public static void main(String[] args) {
        System.out.println("{{ project_name }} - Anthropic Java SDK example");
        // Initialize client and create messages using the Anthropic Java SDK
    }
}
""",
        }

    def _kotlin_templates(self, scaffold_type: str) -> dict[str, str]:
        return {
            "build.gradle.kts": """plugins {
    kotlin("jvm") version "2.0.0"
    application
}

group = "com.example"
version = "0.1.0"

repositories {
    mavenCentral()
}

dependencies {
    implementation("com.anthropic:anthropic-java:0.1.0")
}

application {
    mainClass.set("com.example.MainKt")
}
""",
            "src/main/kotlin/com/example/Main.kt": """package com.example

fun main() {
    println("{{ project_name }} - Anthropic Kotlin SDK example")
    // Initialize client and create messages using the Anthropic Java SDK from Kotlin
}
""",
        }

    def _swift_templates(self, scaffold_type: str) -> dict[str, str]:
        return {
            "Package.swift": """// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "{{ project_name }}",
    platforms: [.macOS(.v14)],
    dependencies: [],
    targets: [
        .executableTarget(name: "{{ project_name }}", dependencies: []),
    ]
)
""",
            "Sources/main.swift": """import Foundation

print("{{ project_name }} - Anthropic Swift example")

// Use URLSession to call the Anthropic API
let url = URL(string: "https://api.anthropic.com/v1/messages")!
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.addValue("application/json", forHTTPHeaderField: "content-type")
request.addValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
""",
        }

    def _csharp_templates(self, scaffold_type: str) -> dict[str, str]:
        return {
            f"{{{{ project_name }}}}.csproj": """<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Anthropic.SDK" Version="0.1.0" />
  </ItemGroup>
</Project>
""",
            "Program.cs": """using System;

namespace {{ project_name }};

class Program
{
    static async Task Main(string[] args)
    {
        Console.WriteLine("{{ project_name }} - Anthropic C# SDK example");
        // Initialize Anthropic client and create messages
    }
}
""",
        }

    def _php_templates(self, scaffold_type: str) -> dict[str, str]:
        return {
            "composer.json": """{
    "name": "example/{{ project_name }}",
    "description": "{{ description | default('A PHP project') }}",
    "require": {
        "php": ">=8.2"
    },
    "autoload": {
        "psr-4": {
            "App\\\\": "src/"
        }
    }
}
""",
            "src/main.php": """<?php

declare(strict_types=1);

namespace App;

echo "{{ project_name }} - Anthropic PHP example\\n";

// Use cURL or Guzzle to call the Anthropic API
$apiKey = getenv('ANTHROPIC_API_KEY');
""",
        }

    def _ruby_templates(self, scaffold_type: str) -> dict[str, str]:
        return {
            "Gemfile": """source "https://rubygems.org"

gem "anthropic-rb", "~> 0.1"
""",
            "lib/main.rb": """# frozen_string_literal: true

require "anthropic"

puts "{{ project_name }} - Anthropic Ruby SDK example"

# client = Anthropic::Client.new
# message = client.messages.create(
#   model: "claude-sonnet-4-20250514",
#   max_tokens: 1024,
#   messages: [{ role: "user", content: "Hello from {{ project_name }}!" }]
# )
# puts message.content.first.text
""",
        }

    def _elixir_templates(self, scaffold_type: str) -> dict[str, str]:
        return {
            "mix.exs": """defmodule {{ project_name | replace('-', '') | capitalize }}.MixProject do
  use Mix.Project

  def project do
    [
      app: :{{ project_name | replace('-', '_') }},
      version: "0.1.0",
      elixir: "~> 1.16",
      deps: deps()
    ]
  end

  defp deps do
    []
  end
end
""",
            "lib/main.ex": """defmodule {{ project_name | replace('-', '') | capitalize }} do
  @moduledoc \"\"\"
  {{ project_name }} - Anthropic Elixir example.
  \"\"\"

  def hello do
    IO.puts("Hello from {{ project_name }}!")
  end
end
""",
        }

    def _scala_templates(self, scaffold_type: str) -> dict[str, str]:
        return {
            "build.sbt": """name := "{{ project_name }}"
version := "0.1.0"
scalaVersion := "3.4.2"

libraryDependencies ++= Seq(
  "com.anthropic" % "anthropic-java" % "0.1.0",
  "org.scalatest" %% "scalatest" % "3.2.18" % Test,
)
""",
            "src/main/scala/Main.scala": """@main def run(): Unit =
  println("{{ project_name }} - Anthropic Scala example")
  // Use the Anthropic Java SDK from Scala
""",
        }
