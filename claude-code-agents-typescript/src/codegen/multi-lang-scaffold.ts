// src/codegen/multi-lang-scaffold.ts — Combines routing + template rendering for scaffolds
import * as fs from 'node:fs';
import * as path from 'node:path';
import { LanguageRouter } from './language-router.js';
import { TemplateEngine, type TemplateFile } from './template-engine.js';

// ── Scaffold Result ─────────────────────────────────────────────
export interface ScaffoldResult {
  readonly files: readonly TemplateFile[];
  readonly primaryLanguage: string;
  readonly secondaryLanguages: readonly string[];
  readonly scaffoldType: string;
  readonly rationale: string;
}

// ── Multi-Language Scaffold ─────────────────────────────────────
export class MultiLangScaffold {
  private readonly router: LanguageRouter;
  private readonly engine: TemplateEngine;

  constructor(router?: LanguageRouter, engine?: TemplateEngine) {
    this.router = router ?? new LanguageRouter();
    this.engine = engine ?? new TemplateEngine();
  }

  create(input: {
    readonly task: string;
    readonly outputDir: string;
    readonly projectName: string;
    readonly environment?: string;
    readonly preferredLanguages?: readonly string[];
  }): ScaffoldResult {
    const route = this.router.route(
      input.task,
      input.environment ?? 'cli',
      input.preferredLanguages,
    );

    const primaryFiles = this.engine.render(
      route.primaryLanguage,
      input.projectName,
      route.scaffoldType,
    );

    const allFiles: TemplateFile[] = [...primaryFiles];

    for (const secondary of route.secondaryLanguages) {
      const secondaryFiles = this.engine.render(
        secondary,
        input.projectName,
        route.scaffoldType,
      );
      allFiles.push(
        ...secondaryFiles.map((f) => ({
          path: `${secondary}/${f.path}`,
          content: f.content,
        })),
      );
    }

    // Write .project.json metadata
    allFiles.push({
      path: '.project.json',
      content: JSON.stringify(
        {
          projectName: input.projectName,
          scaffoldType: route.scaffoldType,
          primaryLanguage: route.primaryLanguage,
          secondaryLanguages: route.secondaryLanguages,
          rationale: route.rationale,
        },
        null,
        2,
      ),
    });

    return {
      files: allFiles,
      primaryLanguage: route.primaryLanguage,
      secondaryLanguages: route.secondaryLanguages,
      scaffoldType: route.scaffoldType,
      rationale: route.rationale,
    };
  }

  writeToDisk(outputDir: string, result: ScaffoldResult): readonly string[] {
    const written: string[] = [];
    for (const file of result.files) {
      const fullPath = path.join(outputDir, file.path);
      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, file.content, 'utf-8');
      written.push(fullPath);
    }
    return written;
  }
}
