// devops-review/src/xml-generator.ts — Generates PR review XML from GitHub data
//
// Takes GitHub PR metadata + diff and produces the structured XML input
// that the DevOps agent/skill ingests for typed validation.
//
// Both surfaces call this: Code via CLI, Cowork via skill sub-agent.

import type {
  PRMetadata,
  DiffSummary,
  FileChange,
  TeamDecision,
  TypedCheck,
  PRNumber,
  PRReviewContext,
  CheckCategory,
  Severity,
} from './types.js';
import { toPRNumber, toCheckId, toDecisionId } from './types.js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Parse team decisions from XML ───────────────────────────
export function loadTeamDecisions(
  path?: string,
): ReadonlyArray<TeamDecision> {
  const xmlPath =
    path ?? resolve(__dirname, '..', 'rules', 'team-decisions.xml');
  const xml = readFileSync(xmlPath, 'utf-8');

  const decisions: TeamDecision[] = [];
  const decisionRegex =
    /<decision\s+id="([^"]+)"\s+category="([^"]+)">\s*<rule>([\s\S]*?)<\/rule>\s*<rationale>([\s\S]*?)<\/rationale>\s*<source>([\s\S]*?)<\/source>\s*<\/decision>/g;

  let match: RegExpExecArray | null;
  while ((match = decisionRegex.exec(xml)) !== null) {
    decisions.push({
      id: toDecisionId(match[1]!),
      category: match[2]! as CheckCategory,
      rule: match[3]!.trim(),
      rationale: match[4]!.trim(),
      source: match[5]!.trim(),
    });
  }

  return decisions;
}

// ── Infer checks from diff ──────────────────────────────────
export function inferChecksFromDiff(
  files: ReadonlyArray<FileChange>,
  decisions: ReadonlyArray<TeamDecision>,
): ReadonlyArray<TypedCheck> {
  const checks: TypedCheck[] = [];

  const hasTS = files.some(
    (f) => f.path.endsWith('.ts') || f.path.endsWith('.tsx'),
  );
  const hasPy = files.some((f) => f.path.endsWith('.py'));
  const hasSQL = files.some((f) => f.path.endsWith('.sql'));
  const hasTests = files.some(
    (f) =>
      f.path.includes('test') ||
      f.path.includes('spec') ||
      f.path.includes('__tests__'),
  );
  const hasMigrations = files.some((f) => f.path.includes('migration'));
  const hasPackageJson = files.some((f) => f.path.includes('package.json'));
  const hasAgentDef = files.some((f) => f.path.includes('.claude/agents/'));
  const hasMCP = files.some(
    (f) => f.path.includes('mcp') || f.path.includes('server.ts'),
  );

  // Check: branded types if new TS types introduced
  if (hasTS) {
    checks.push({
      id: toCheckId('CHK-BRANDED'),
      name: 'Branded type usage',
      category: 'branded-types',
      severity: 'warning',
      description:
        'New ID types must use Brand<K, T> pattern per TD-001',
      result: 'pending',
    });

    checks.push({
      id: toCheckId('CHK-RESULT'),
      name: 'Result<T,E> pattern',
      category: 'result-pattern',
      severity: 'warning',
      description:
        'Fallible operations must return Result<T,E> not throw per TD-002',
      result: 'pending',
    });

    checks.push({
      id: toCheckId('CHK-STRICT'),
      name: 'TypeScript strict mode',
      category: 'type-safety',
      severity: 'blocker',
      description:
        'No any types. Readonly everywhere. Must compile clean per TD-004',
      result: 'pending',
    });
  }

  if (hasPy) {
    checks.push({
      id: toCheckId('CHK-PY-NAMING'),
      name: 'Python naming conventions',
      category: 'naming-conventions',
      severity: 'warning',
      description:
        'snake_case for functions/variables, PascalCase for classes per TD-008',
      result: 'pending',
    });
  }

  if (hasSQL || hasMigrations) {
    checks.push({
      id: toCheckId('CHK-KIMBALL'),
      name: 'Kimball layer compliance',
      category: 'kimball-compliance',
      severity: 'blocker',
      description:
        'Schema must respect Runtime/Reporting/Semantic separation per TD-003',
      result: 'pending',
    });
  }

  // Always check: test coverage
  checks.push({
    id: toCheckId('CHK-TESTS'),
    name: 'Test coverage',
    category: 'test-coverage',
    severity: hasTests ? 'info' : 'warning',
    description: hasTests
      ? 'Tests present — verify they pass and cover new code per TD-006'
      : 'No test files detected in diff — new code should include tests per TD-006',
    result: hasTests ? 'pending' : 'pending',
  });

  // Always check: security
  checks.push({
    id: toCheckId('CHK-SECURITY'),
    name: 'Security review',
    category: 'security',
    severity: 'blocker',
    description:
      'No hardcoded credentials, PII, or unsafe patterns per TD-007',
    result: 'pending',
  });

  // Dependency hygiene if package.json changed
  if (hasPackageJson) {
    checks.push({
      id: toCheckId('CHK-DEPS'),
      name: 'Dependency hygiene',
      category: 'dependency-hygiene',
      severity: 'warning',
      description:
        'New dependencies must be justified. No floating versions per TD-011',
      result: 'pending',
    });
  }

  // Agent definition format if .claude/agents/ changed
  if (hasAgentDef) {
    checks.push({
      id: toCheckId('CHK-AGENT-FMT'),
      name: 'Agent definition format',
      category: 'architectural-consistency',
      severity: 'warning',
      description:
        'Agent definitions must use YAML frontmatter with name, description, tools, model per TD-010',
      result: 'pending',
    });
  }

  // MCP server pattern
  if (hasMCP) {
    checks.push({
      id: toCheckId('CHK-MCP'),
      name: 'MCP server pattern',
      category: 'architectural-consistency',
      severity: 'warning',
      description:
        'MCP servers must use @modelcontextprotocol/sdk with Zod schemas per TD-009',
      result: 'pending',
    });
  }

  // JSONL logging
  checks.push({
    id: toCheckId('CHK-JSONL'),
    name: 'JSONL logging',
    category: 'architectural-consistency',
    severity: 'info',
    description:
      'New dispatch/crawl/agent events should log to JSONL per TD-005',
    result: 'pending',
  });

  return checks;
}

// ── Detect affected sub-repos ───────────────────────────────
export function detectAffectedRepos(
  files: ReadonlyArray<FileChange>,
): ReadonlyArray<string> {
  const repos = new Set<string>();
  for (const f of files) {
    const parts = f.path.split('/');
    if (parts.length > 1) {
      const first = parts[0]!;
      if (
        first.startsWith('claude-') ||
        first === 'agenttasks' ||
        first === 'devops-review' ||
        first === '.jade'
      ) {
        repos.add(first);
      }
    }
  }
  return [...repos];
}

// ── Generate XML ────────────────────────────────────────────
export function generatePRReviewXML(
  metadata: PRMetadata,
  diffSummary: DiffSummary,
  checks: ReadonlyArray<TypedCheck>,
  decisions: ReadonlyArray<TeamDecision>,
  context?: PRReviewContext,
): string {
  const escapeXml = (s: string): string =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<pr-review xmlns="https://jadecli.com/devops/pr-review/v1" version="1.0">
  <metadata>
    <pr-number>${metadata.number}</pr-number>
    <title>${escapeXml(metadata.title)}</title>
    <author>${escapeXml(metadata.author)}</author>
    <branch>${escapeXml(metadata.branch)}</branch>
    <base>${escapeXml(metadata.base)}</base>
    <created-at>${metadata.createdAt}</created-at>
    <updated-at>${metadata.updatedAt}</updated-at>`;

  if (metadata.labels.length > 0) {
    xml += `\n    <labels>`;
    for (const label of metadata.labels) {
      xml += `\n      <label>${escapeXml(label)}</label>`;
    }
    xml += `\n    </labels>`;
  }

  xml += `
  </metadata>
  <diff-summary>
    <files-changed>${diffSummary.filesChanged}</files-changed>
    <additions>${diffSummary.additions}</additions>
    <deletions>${diffSummary.deletions}</deletions>`;

  if (diffSummary.affectedRepos.length > 0) {
    xml += `\n    <affected-repos>`;
    for (const repo of diffSummary.affectedRepos) {
      xml += `\n      <repo>${escapeXml(repo)}</repo>`;
    }
    xml += `\n    </affected-repos>`;
  }

  xml += `\n    <file-list>`;
  for (const file of diffSummary.files) {
    xml += `\n      <file status="${file.status}" additions="${file.additions}" deletions="${file.deletions}">${escapeXml(file.path)}</file>`;
  }
  xml += `\n    </file-list>
  </diff-summary>
  <checks>`;

  for (const check of checks) {
    xml += `\n    <check id="${check.id}">
      <name>${escapeXml(check.name)}</name>
      <category>${check.category}</category>
      <severity>${check.severity}</severity>
      <description>${escapeXml(check.description)}</description>
      <result>${check.result}</result>`;
    if (check.evidence) {
      xml += `\n      <evidence>${escapeXml(check.evidence)}</evidence>`;
    }
    if (check.suggestion) {
      xml += `\n      <suggestion>${escapeXml(check.suggestion)}</suggestion>`;
    }
    xml += `\n    </check>`;
  }

  xml += `\n  </checks>
  <team-decisions>`;

  // Include only decisions relevant to the inferred checks
  const relevantCategories = new Set(checks.map((c) => c.category));
  for (const decision of decisions) {
    if (relevantCategories.has(decision.category)) {
      xml += `\n    <decision id="${decision.id}" category="${decision.category}">
      <rule>${escapeXml(decision.rule)}</rule>
      <rationale>${escapeXml(decision.rationale)}</rationale>
      <source>${escapeXml(decision.source)}</source>
    </decision>`;
    }
  }

  xml += `\n  </team-decisions>`;

  if (context) {
    xml += `\n  <context>`;
    if (context.architectureExcerpt) {
      xml += `\n    <architecture-excerpt>${escapeXml(context.architectureExcerpt)}</architecture-excerpt>`;
    }
    if (context.relatedPRs && context.relatedPRs.length > 0) {
      xml += `\n    <related-prs>`;
      for (const pr of context.relatedPRs) {
        xml += `\n      <pr number="${pr.number}" relationship="${escapeXml(pr.relationship)}">${escapeXml(pr.title)}</pr>`;
      }
      xml += `\n    </related-prs>`;
    }
    if (context.todos) {
      xml += `\n    <todos>${escapeXml(context.todos)}</todos>`;
    }
    xml += `\n  </context>`;
  }

  xml += `\n</pr-review>`;
  return xml;
}
