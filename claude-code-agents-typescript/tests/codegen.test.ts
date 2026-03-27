// tests/codegen.test.ts — Language routing, template rendering, scaffold generation tests
import { describe, it, expect } from 'vitest';
import { LanguageRouter } from '../src/codegen/language-router.js';
import { TemplateEngine } from '../src/codegen/template-engine.js';
import { MultiLangScaffold } from '../src/codegen/multi-lang-scaffold.js';
import { SUPPORTED_LANGUAGES } from '../src/models/language.js';

// ── Language Router ─────────────────────────────────────────────
describe('LanguageRouter', () => {
  const router = new LanguageRouter();

  it('routes to Python for default CLI environment', () => {
    const result = router.route('Create a widget');
    expect(result.primaryLanguage).toBe('python');
  });

  it('routes to TypeScript for web environment', () => {
    const result = router.route('Create a widget', 'web');
    expect(result.primaryLanguage).toBe('typescript');
  });

  it('routes Django to Python', () => {
    const result = router.route('Build a Django REST API');
    expect(result.primaryLanguage).toBe('python');
  });

  it('routes React to TypeScript', () => {
    const result = router.route('Build a React app');
    expect(result.primaryLanguage).toBe('typescript');
  });

  it('routes Gin to Go', () => {
    const result = router.route('Build a Gin API server');
    expect(result.primaryLanguage).toBe('go');
  });

  it('routes Actix to Rust', () => {
    const result = router.route('Build an Actix web service');
    expect(result.primaryLanguage).toBe('rust');
  });

  it('routes Spring to Java', () => {
    const result = router.route('Build a Spring Boot application');
    expect(result.primaryLanguage).toBe('java');
  });

  it('routes Rails to Ruby', () => {
    const result = router.route('Build a Rails application');
    expect(result.primaryLanguage).toBe('ruby');
  });

  it('respects preferred languages', () => {
    const result = router.route('Build a tool', 'cli', ['rust']);
    expect(result.primaryLanguage).toBe('rust');
  });

  it('includes secondary languages', () => {
    const result = router.route('Build a tool', 'cli', [
      'typescript',
      'python',
      'go',
    ]);
    expect(result.secondaryLanguages).toContain('python');
    expect(result.secondaryLanguages).toContain('go');
  });

  it('detects web-api scaffold type', () => {
    const result = router.route('Build a REST API server');
    expect(result.scaffoldType).toBe('web-api');
  });

  it('detects CLI scaffold type', () => {
    const result = router.route('Build a command line tool');
    expect(result.scaffoldType).toBe('cli');
  });

  it('detects serverless scaffold type', () => {
    const result = router.route('Deploy a lambda serverless handler', 'serverless');
    expect(result.scaffoldType).toBe('serverless');
  });

  it('uses web environment default', () => {
    const result = router.route('Build something', 'web');
    expect(result.primaryLanguage).toBe('typescript');
  });

  it('uses data environment default', () => {
    const result = router.route('Analyze data', 'data');
    expect(result.primaryLanguage).toBe('python');
  });
});

// ── Template Engine ─────────────────────────────────────────────
describe('TemplateEngine', () => {
  const engine = new TemplateEngine();

  it('renders templates for all 12 languages', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const files = engine.render(lang, 'test-project', 'cli');
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        expect(file.path).toBeTruthy();
        expect(file.content).toBeTruthy();
      }
    }
  });

  it('renders Python with pyproject.toml', () => {
    const files = engine.render('python', 'myapp', 'cli');
    expect(files.some((f) => f.path.includes('pyproject.toml'))).toBe(true);
  });

  it('renders TypeScript with package.json', () => {
    const files = engine.render('typescript', 'myapp', 'cli');
    expect(files.some((f) => f.path.includes('package.json'))).toBe(true);
  });

  it('renders Go with go.mod', () => {
    const files = engine.render('go', 'myapp', 'cli');
    expect(files.some((f) => f.path.includes('go.mod'))).toBe(true);
  });

  it('renders Rust with Cargo.toml', () => {
    const files = engine.render('rust', 'myapp', 'cli');
    expect(files.some((f) => f.path.includes('Cargo.toml'))).toBe(true);
  });

  it('renders Java with build.gradle', () => {
    const files = engine.render('java', 'myapp', 'cli');
    expect(files.some((f) => f.path.includes('build.gradle'))).toBe(true);
  });

  it('includes project name in output', () => {
    const files = engine.render('typescript', 'my-project', 'cli');
    const pkgJson = files.find((f) => f.path === 'package.json');
    expect(pkgJson!.content).toContain('my-project');
  });
});

// ── MultiLangScaffold ───────────────────────────────────────────
describe('MultiLangScaffold', () => {
  const scaffold = new MultiLangScaffold();

  it('creates scaffold with primary language', () => {
    const result = scaffold.create({
      task: 'Build a CLI tool',
      outputDir: '/tmp/test',
      projectName: 'test-cli',
    });
    expect(result.primaryLanguage).toBeTruthy();
    expect(result.files.length).toBeGreaterThan(0);
  });

  it('includes .project.json metadata', () => {
    const result = scaffold.create({
      task: 'Build a tool',
      outputDir: '/tmp/test',
      projectName: 'test-project',
    });
    const meta = result.files.find((f) => f.path === '.project.json');
    expect(meta).toBeTruthy();
    const parsed = JSON.parse(meta!.content);
    expect(parsed.projectName).toBe('test-project');
  });

  it('includes secondary language files in subdirectory', () => {
    const result = scaffold.create({
      task: 'Build a tool',
      outputDir: '/tmp/test',
      projectName: 'multi',
      preferredLanguages: ['typescript', 'python'],
    });
    expect(result.secondaryLanguages).toContain('python');
    const pythonFile = result.files.find((f) => f.path.startsWith('python/'));
    expect(pythonFile).toBeTruthy();
  });
});
