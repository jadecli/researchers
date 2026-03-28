// src/codegen/template-engine.ts — Template rendering for multi-language project scaffolds
import type { SupportedLanguage } from '../models/language.js';
import { assertNever } from '../types.js';

// ── Template Output ─────────────────────────────────────────────
export interface TemplateFile {
  readonly path: string;
  readonly content: string;
}

// ── Template Engine ─────────────────────────────────────────────
export class TemplateEngine {
  render(
    language: SupportedLanguage,
    projectName: string,
    scaffoldType: string,
  ): readonly TemplateFile[] {
    switch (language) {
      case 'python':
        return this.renderPython(projectName, scaffoldType);
      case 'typescript':
        return this.renderTypeScript(projectName, scaffoldType);
      case 'go':
        return this.renderGo(projectName, scaffoldType);
      case 'rust':
        return this.renderRust(projectName, scaffoldType);
      case 'java':
        return this.renderJava(projectName, scaffoldType);
      case 'kotlin':
        return this.renderKotlin(projectName, scaffoldType);
      case 'swift':
        return this.renderSwift(projectName, scaffoldType);
      case 'csharp':
        return this.renderCSharp(projectName, scaffoldType);
      case 'php':
        return this.renderPhp(projectName, scaffoldType);
      case 'ruby':
        return this.renderRuby(projectName, scaffoldType);
      case 'elixir':
        return this.renderElixir(projectName, scaffoldType);
      case 'scala':
        return this.renderScala(projectName, scaffoldType);
      default:
        return assertNever(language);
    }
  }

  private renderPython(name: string, _scaffold: string): readonly TemplateFile[] {
    return [
      {
        path: 'pyproject.toml',
        content: `[project]\nname = "${name}"\nversion = "0.1.0"\nrequires-python = ">=3.11"\ndependencies = ["anthropic"]\n`,
      },
      {
        path: `${name}/__init__.py`,
        content: `"""${name} — Generated with claude-code-agents."""\n`,
      },
      {
        path: `${name}/main.py`,
        content: `import anthropic\n\nclient = anthropic.Anthropic()\n\ndef main() -> None:\n    print("Hello from ${name}")\n\nif __name__ == "__main__":\n    main()\n`,
      },
    ];
  }

  private renderTypeScript(name: string, _scaffold: string): readonly TemplateFile[] {
    return [
      {
        path: 'package.json',
        content: JSON.stringify(
          {
            name,
            version: '0.1.0',
            type: 'module',
            scripts: { build: 'tsc', test: 'vitest run' },
            dependencies: { '@anthropic-ai/sdk': '^0.52.0' },
            devDependencies: { typescript: '^5.7.0', vitest: '^2.1.0' },
          },
          null,
          2,
        ),
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2022',
              module: 'NodeNext',
              moduleResolution: 'NodeNext',
              strict: true,
              noUncheckedIndexedAccess: true,
              outDir: 'dist',
            },
          },
          null,
          2,
        ),
      },
      {
        path: 'src/index.ts',
        content: `import Anthropic from '@anthropic-ai/sdk';\n\nconst client = new Anthropic();\n\nconsole.log('Hello from ${name}');\n`,
      },
    ];
  }

  private renderGo(name: string, _scaffold: string): readonly TemplateFile[] {
    return [
      {
        path: 'go.mod',
        content: `module ${name}\n\ngo 1.22\n\nrequire github.com/anthropics/anthropic-sdk-go v0.2.0\n`,
      },
      {
        path: 'main.go',
        content: `package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello from ${name}")\n}\n`,
      },
    ];
  }

  private renderRust(name: string, _scaffold: string): readonly TemplateFile[] {
    return [
      {
        path: 'Cargo.toml',
        content: `[package]\nname = "${name}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n`,
      },
      {
        path: 'src/main.rs',
        content: `fn main() {\n    println!("Hello from ${name}");\n}\n`,
      },
    ];
  }

  private renderJava(name: string, _scaffold: string): readonly TemplateFile[] {
    return [
      {
        path: 'build.gradle',
        content: `plugins { id 'java' }\ngroup = '${name}'\nversion = '0.1.0'\nrepositories { mavenCentral() }\n`,
      },
      {
        path: `src/main/java/Main.java`,
        content: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from ${name}");\n    }\n}\n`,
      },
    ];
  }

  private renderKotlin(name: string, _scaffold: string): readonly TemplateFile[] {
    return [
      {
        path: 'build.gradle.kts',
        content: `plugins { kotlin("jvm") version "2.0.0" }\ngroup = "${name}"\nversion = "0.1.0"\n`,
      },
      {
        path: 'src/main/kotlin/Main.kt',
        content: `fun main() {\n    println("Hello from ${name}")\n}\n`,
      },
    ];
  }

  private renderSwift(name: string, _scaffold: string): readonly TemplateFile[] {
    return [
      {
        path: 'Package.swift',
        content: `// swift-tools-version: 5.10\nimport PackageDescription\nlet package = Package(name: "${name}", targets: [.executableTarget(name: "${name}")])\n`,
      },
      {
        path: `Sources/${name}/main.swift`,
        content: `print("Hello from ${name}")\n`,
      },
    ];
  }

  private renderCSharp(name: string, _scaffold: string): readonly TemplateFile[] {
    return [
      {
        path: `${name}.csproj`,
        content: `<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <OutputType>Exe</OutputType>\n    <TargetFramework>net8.0</TargetFramework>\n  </PropertyGroup>\n</Project>\n`,
      },
      {
        path: 'Program.cs',
        content: `Console.WriteLine("Hello from ${name}");\n`,
      },
    ];
  }

  private renderPhp(name: string, _scaffold: string): readonly TemplateFile[] {
    return [
      {
        path: 'composer.json',
        content: JSON.stringify({ name, autoload: { 'psr-4': { '': 'src/' } } }, null, 2),
      },
      {
        path: 'src/index.php',
        content: `<?php\necho "Hello from ${name}\\n";\n`,
      },
    ];
  }

  private renderRuby(name: string, _scaffold: string): readonly TemplateFile[] {
    return [
      {
        path: 'Gemfile',
        content: `source "https://rubygems.org"\ngem "anthropic-rb"\n`,
      },
      {
        path: `lib/${name}.rb`,
        content: `puts "Hello from ${name}"\n`,
      },
    ];
  }

  private renderElixir(name: string, _scaffold: string): readonly TemplateFile[] {
    return [
      {
        path: 'mix.exs',
        content: `defmodule ${name[0]!.toUpperCase()}${name.slice(1)}.MixProject do\n  use Mix.Project\n  def project, do: [app: :${name}, version: "0.1.0"]\nend\n`,
      },
      {
        path: `lib/${name}.ex`,
        content: `defmodule ${name[0]!.toUpperCase()}${name.slice(1)} do\n  def hello, do: IO.puts("Hello from ${name}")\nend\n`,
      },
    ];
  }

  private renderScala(name: string, _scaffold: string): readonly TemplateFile[] {
    return [
      {
        path: 'build.sbt',
        content: `name := "${name}"\nversion := "0.1.0"\nscalaVersion := "3.4.0"\n`,
      },
      {
        path: 'src/main/scala/Main.scala',
        content: `@main def run(): Unit = println("Hello from ${name}")\n`,
      },
    ];
  }
}
