// src/cli.ts — Commander CLI entry point for claude-code-agents-typescript
import { Command } from 'commander';
import { createCrawlPlan } from './models/crawl-target.js';
import { CrawlCampaign } from './orchestrator/campaign.js';
import { MultiLangScaffold } from './codegen/multi-lang-scaffold.js';
import { CoworkTaskRouter } from './cowork/task-router.js';
import { PluginRecommender } from './cowork/plugin-recommender.js';
import { createPluginSpec, createSkillSpec, createAgentSpec } from './models/plugin-spec.js';
import { generatePlugin } from './plugin_gen/scaffold.js';
import * as fs from 'node:fs';

const program = new Command();

program
  .name('claude-code-agents')
  .description(
    'Orchestrate crawl campaigns, generate plugins, and produce multi-lang code',
  )
  .option('-v, --verbose', 'Enable verbose logging');

// ── Campaign Command ────────────────────────────────────────────
program
  .command('campaign')
  .description('Run an iterative crawl campaign against a target URL')
  .requiredOption('-t, --target <url>', 'URL to crawl')
  .option('-s, --spider <name>', 'Spider name', 'generic')
  .option('-m, --max-pages <n>', 'Max pages per target', '50')
  .option('-i, --iterations <n>', 'Max improvement iterations', '3')
  .option('-b, --budget <usd>', 'Budget in USD', '5.0')
  .option('--threshold <n>', 'Quality threshold', '0.8')
  .option('-o, --output <file>', 'Output file for results JSON')
  .action((opts) => {
    console.log(`Starting campaign against ${opts.target}`);
    console.log(
      `  Spider: ${opts.spider}, Max pages: ${opts.maxPages}, Iterations: ${opts.iterations}`,
    );
    console.log(
      `  Budget: $${parseFloat(opts.budget).toFixed(2)}, Quality threshold: ${opts.threshold}`,
    );

    const plan = createCrawlPlan({
      targets: [
        {
          url: opts.target,
          spiderName: opts.spider,
          maxPages: parseInt(opts.maxPages, 10),
        },
      ],
      totalBudgetUsd: parseFloat(opts.budget),
      maxIterations: parseInt(opts.iterations, 10),
      qualityThreshold: parseFloat(opts.threshold),
    });

    const campaign = new CrawlCampaign(plan);
    const result = campaign.run();

    if (result.ok) {
      console.log(`\nCampaign complete: ${result.value.length} results`);
      for (const r of result.value) {
        console.log(
          `  [${r.pageType}] ${r.url} (quality: ${(r.quality.overall as number).toFixed(3)})`,
        );
      }
      if (opts.output) {
        const data = result.value.map((r) => ({
          url: r.url,
          page_type: r.pageType,
          quality: r.quality,
          title: r.title,
          content_length: r.content.length,
        }));
        fs.writeFileSync(opts.output, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`Results written to ${opts.output}`);
      }
    } else {
      console.error(`Campaign failed: ${result.error.message}`);
      process.exit(1);
    }
  });

// ── Generate Plugin Command ─────────────────────────────────────
program
  .command('generate-plugin')
  .description('Generate a Claude Code plugin from a specification')
  .requiredOption('-n, --name <name>', 'Plugin name')
  .option('-d, --domain <domain>', 'Target domain', 'engineering')
  .option('--description <desc>', 'Plugin description', '')
  .option('-o, --output-dir <dir>', 'Output directory', './generated_plugins')
  .action((opts) => {
    console.log(`Generating plugin '${opts.name}' for domain '${opts.domain}'`);

    const spec = createPluginSpec({
      name: opts.name,
      description: opts.description || `Plugin for ${opts.domain} domain tasks`,
      skills: [
        createSkillSpec({
          name: `${opts.domain}-default`,
          description: `Default ${opts.domain} skill`,
        }),
      ],
      agents: [
        createAgentSpec({
          name: `${opts.domain}-assistant`,
          description: `${opts.domain} domain assistant`,
        }),
      ],
    });

    const pluginDir = generatePlugin(spec, opts.outputDir);
    console.log(`Plugin generated at: ${pluginDir}`);
    console.log(`  Skills: ${spec.skills.length}, Agents: ${spec.agents.length}`);
  });

// ── Codegen Command ─────────────────────────────────────────────
program
  .command('codegen')
  .description('Generate a multi-language project scaffold')
  .requiredOption('-t, --task <desc>', 'Task description')
  .option('-n, --project-name <name>', 'Project name', 'project')
  .option('-e, --environment <env>', 'Target environment', 'cli')
  .option('-l, --language <lang...>', 'Preferred language(s)')
  .option('-o, --output-dir <dir>', 'Output directory', './generated_code')
  .action((opts) => {
    console.log(`Generating code for: ${opts.task}`);

    const scaffold = new MultiLangScaffold();
    const result = scaffold.create({
      task: opts.task,
      outputDir: opts.outputDir,
      projectName: opts.projectName,
      environment: opts.environment,
      preferredLanguages: opts.language,
    });

    const written = scaffold.writeToDisk(opts.outputDir, result);
    console.log(`\nGenerated ${written.length} files:`);
    for (const p of written) {
      console.log(`  ${p}`);
    }
  });

// ── Cowork Task Command ─────────────────────────────────────────
program
  .command('cowork-task')
  .description(
    'Route a task to knowledge-work-plugins domains and get recommendations',
  )
  .requiredOption('-t, --task <desc>', 'Task description')
  .option('-k, --top-k <n>', 'Number of domain matches', '3')
  .option('--no-recommend', 'Skip plugin recommendations')
  .action((opts) => {
    console.log(`Analyzing task: ${opts.task}\n`);

    const router = new CoworkTaskRouter();
    const results = router.routeMulti(opts.task, parseInt(opts.topK, 10));

    console.log('Domain Matches:');
    for (let i = 0; i < results.length; i++) {
      const r = results[i]!;
      console.log(
        `  ${i + 1}. ${r.domain} (confidence: ${(r.confidence as number).toFixed(3)})`,
      );
      if (r.matchedKeywords.length > 0) {
        console.log(`     Keywords: ${r.matchedKeywords.join(', ')}`);
      }
      if (r.suggestedPlugins.length > 0) {
        console.log(`     Plugins: ${r.suggestedPlugins.join(', ')}`);
      }
    }

    if (opts.recommend !== false) {
      console.log('\nPlugin Recommendations:');
      const recommender = new PluginRecommender(router);
      const recResult = recommender.recommend(opts.task);
      for (let i = 0; i < recResult.recommendations.length; i++) {
        const rec = recResult.recommendations[i]!;
        console.log(
          `  ${i + 1}. ${rec.pluginName} [${rec.domain}] (relevance: ${(rec.relevanceScore as number).toFixed(3)})`,
        );
        console.log(`     ${rec.reason}`);
      }
    }
  });

program.parse();
