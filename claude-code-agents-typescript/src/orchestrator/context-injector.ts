// src/orchestrator/context-injector.ts — Context injection for HeadlessRunner prompts
import type { CrawlTarget } from '../models/crawl-target.js';
import type { ImprovementChain } from './improvement-chain.js';

export function injectContext(
  iteration: number,
  chain?: ImprovementChain,
  target?: CrawlTarget,
): string {
  const sections: string[] = [];

  sections.push(`## Iteration Context (iteration ${iteration})`);

  if (chain && chain.iterationCount > 0) {
    const cumulative = chain.getCumulativeDelta();
    if (cumulative) {
      sections.push(
        [
          '### Quality Trajectory',
          `- Starting quality: ${(cumulative.qualityBefore as number).toFixed(3)}`,
          `- Current quality: ${(cumulative.qualityAfter as number).toFixed(3)}`,
          `- Total improvement: ${chain.totalImprovement >= 0 ? '+' : ''}${chain.totalImprovement.toFixed(3)}`,
          `- Iterations completed: ${chain.iterationCount}`,
        ].join('\n'),
      );

      if (cumulative.newPatterns.length > 0) {
        const patternsStr = cumulative.newPatterns
          .slice(0, 10)
          .map((p) => `  - \`${p}\``)
          .join('\n');
        sections.push(`### Discovered Patterns\n${patternsStr}`);
      }

      if (cumulative.failingSelectors.length > 0) {
        const failingStr = cumulative.failingSelectors
          .slice(0, 10)
          .map((s) => `  - \`${s}\``)
          .join('\n');
        sections.push(
          `### Failing Selectors (avoid these)\n${failingStr}`,
        );
      }

      if (cumulative.discoveredPageTypes.length > 0) {
        sections.push(
          `### Discovered Page Types\n${cumulative.discoveredPageTypes.join(', ')}`,
        );
      }

      if (cumulative.steerDirection) {
        sections.push(
          `### Steering Direction\n${cumulative.steerDirection}`,
        );
      }
    }

    const history = chain.getHistory();
    if (history.length >= 2) {
      const recent = history[history.length - 1]!;
      const improvement =
        (recent.qualityAfter as number) - (recent.qualityBefore as number);
      sections.push(
        [
          '### Last Iteration Summary',
          `- Quality change: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(3)}`,
          `- New patterns found: ${recent.newPatterns.length}`,
          `- Selectors failing: ${recent.failingSelectors.length}`,
        ].join('\n'),
      );
    }
  } else {
    sections.push(
      'This is the initial crawl iteration. Focus on broad extraction and discovery.',
    );
  }

  if (target) {
    const targetLines = [
      '### Current Target',
      `- URL: ${target.url}`,
      `- Spider: ${target.spiderName}`,
      `- Max pages: ${target.maxPages}`,
      `- Priority: ${target.priority}`,
    ];
    if (target.pageTypeHint) {
      targetLines.push(`- Expected page type: ${target.pageTypeHint}`);
    }
    sections.push(targetLines.join('\n'));
  }

  return sections.join('\n\n');
}
