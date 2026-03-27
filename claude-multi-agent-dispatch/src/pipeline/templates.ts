import { Ok, Err, type Result } from '../types/index.js';

// ─── PromptTemplate ─────────────────────────────────────────────────────────
export interface PromptTemplate {
  readonly name: string;
  readonly template: string;
  readonly placeholders: readonly string[];
  readonly validators?: Readonly<Record<string, (val: string) => boolean>>;
}

// ─── renderTemplate ─────────────────────────────────────────────────────────
export function renderTemplate(
  template: PromptTemplate,
  values: Record<string, string>,
): Result<string, Error> {
  // Check all placeholders are provided
  const missing = template.placeholders.filter(
    (p) => !(p in values) || values[p] === undefined,
  );
  if (missing.length > 0) {
    return Err(
      new Error(`Missing placeholders: ${missing.join(', ')}`),
    );
  }

  // Run validators
  if (template.validators) {
    for (const [key, validator] of Object.entries(template.validators)) {
      const val = values[key];
      if (val !== undefined && !validator(val)) {
        return Err(
          new Error(`Validation failed for placeholder '${key}': "${val}"`),
        );
      }
    }
  }

  // Substitute placeholders
  let rendered = template.template;
  for (const placeholder of template.placeholders) {
    const value = values[placeholder]!;
    rendered = rendered.replaceAll(`{{${placeholder}}}`, value);
  }

  // Check for any remaining unresolved placeholders
  const unresolvedMatch = rendered.match(/\{\{(\w+)\}\}/);
  if (unresolvedMatch) {
    return Err(
      new Error(`Unresolved placeholder: {{${unresolvedMatch[1]}}}`),
    );
  }

  return Ok(rendered);
}

// ─── Built-in stage templates ───────────────────────────────────────────────
export const STAGE_TEMPLATES: Record<string, PromptTemplate> = {
  analyze_task: {
    name: 'analyze_task',
    template: `You are analyzing a task for a multi-agent dispatch system.

Task: {{task}}

Analyze this task and produce:
1. A breakdown of requirements
2. Complexity assessment (low/medium/high)
3. Required capabilities (code, research, analysis, creative, safety)
4. Potential risks and dependencies

Respond with a structured analysis.`,
    placeholders: ['task'],
    validators: {
      task: (val: string) => val.length > 0 && val.length < 10000,
    },
  },

  generate_approaches: {
    name: 'generate_approaches',
    template: `Based on the following task analysis, generate candidate approaches.

Analysis:
{{analysis}}

Requirements:
{{requirements}}

For each approach, provide:
- Description of the approach
- Estimated cost (in tokens/USD)
- Confidence level (0-1)
- Tradeoffs (pros and cons)

Generate at least 2 and at most 5 candidate approaches.`,
    placeholders: ['analysis', 'requirements'],
    validators: {
      analysis: (val: string) => val.length > 0,
      requirements: (val: string) => val.length > 0,
    },
  },

  execute_plan: {
    name: 'execute_plan',
    template: `Execute the following plan for the selected approach.

Selected Approach:
{{approach}}

Execution Plan:
{{plan}}

Context:
{{context}}

Execute each step of the plan. For each step:
1. Perform the required action
2. Capture the output
3. Verify the step succeeded before proceeding
4. Accumulate context for subsequent steps`,
    placeholders: ['approach', 'plan', 'context'],
  },

  evaluate_output: {
    name: 'evaluate_output',
    template: `Evaluate the following outputs against the original task specification.

Task Specification:
{{taskSpec}}

Outputs:
{{outputs}}

Score each output on these quality dimensions:
- Completeness (0-1): Are all requirements met?
- Structure (0-1): Is the output well-organized?
- Accuracy (0-1): Is the output correct and factual?
- Coherence (0-1): Is the output consistent and logical?
- Safety (0-1): Does the output avoid harmful content?

Provide an overall quality score and specific feedback.`,
    placeholders: ['taskSpec', 'outputs'],
  },

  generate_refinement: {
    name: 'generate_refinement',
    template: `Based on the quality evaluation, generate refinement suggestions.

Evaluation:
{{evaluation}}

Current Scores:
{{scores}}

Quality Threshold: {{threshold}}

For each dimension below the threshold:
1. Identify the specific weakness
2. Suggest a concrete improvement
3. Estimate the expected score improvement

Produce a context delta describing what should change.`,
    placeholders: ['evaluation', 'scores', 'threshold'],
    validators: {
      threshold: (val: string) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0 && num <= 1;
      },
    },
  },
};

// ─── YAML loader stub ───────────────────────────────────────────────────────
export function loadTemplatesFromYaml(_yamlPath: string): PromptTemplate[] {
  // Stub: returns built-in templates instead of parsing YAML
  return Object.values(STAGE_TEMPLATES);
}
