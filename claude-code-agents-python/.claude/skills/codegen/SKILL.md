---
description: Generate multi-language project scaffolds with Anthropic SDK integration.
tools:
  - Bash
  - Read
  - Write
  - Glob
model: claude-sonnet-4-20250514
references:
  - src/codegen/language_router.py
  - src/codegen/template_engine.py
  - src/codegen/multi_lang_scaffold.py
  - src/models/language.py
scripts:
  - python -m src.cli codegen
---

# codegen

Generate multi-language project scaffolds with Anthropic SDK integration.

## Usage

Use this skill to create project scaffolds in any of the 12 supported languages:

- Python, TypeScript, Go, Rust, Java, Kotlin, Swift, C#, PHP, Ruby, Elixir, Scala

Each scaffold includes:
- Build tool configuration (pyproject.toml, package.json, go.mod, Cargo.toml, etc.)
- Entry point with Anthropic SDK usage example
- Test setup
- Language-specific formatting and linting configuration

## Parameters

- **task**: Description of what the generated code should do (required).
- **project-name**: Name for the project (default: project).
- **environment**: Target environment: web, cli, serverless, library, mobile, data, systems, scripting.
- **language**: Preferred language(s). Can be specified multiple times.
- **output-dir**: Output directory (default: ./generated_code).

## Language Selection

The router selects languages based on:
1. Explicit language preferences (if provided).
2. Keyword hints in the task description (e.g., "django" -> Python, "react" -> TypeScript).
3. Environment defaults (e.g., web -> TypeScript, cli -> Python).

## Example

```bash
# Auto-detect language from task
python -m src.cli codegen --task "Build a REST API with authentication"

# Specify language
python -m src.cli codegen \
  --task "Create a CLI tool for data processing" \
  --language python \
  --project-name data-tool \
  --environment cli

# Multi-language project
python -m src.cli codegen \
  --task "Full-stack web app" \
  --language typescript \
  --language python \
  --environment web
```

## Instructions

1. Describe the task clearly, including framework preferences if any.
2. Specify the target environment to get appropriate defaults.
3. Override language selection only when automatic routing is insufficient.
4. Review the generated scaffold and customize as needed.
5. Install dependencies using the appropriate build tool command.
