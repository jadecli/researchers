"""DSPy signatures for the research pipeline stages."""

from __future__ import annotations

import dspy


class PageClassifier(dspy.Signature):
    """Classify a crawled web page into one of the known page types.

    Given the URL, title, and a content snippet, determine the most appropriate
    page type classification and provide a confidence score.
    """

    url: str = dspy.InputField(desc="The URL of the crawled page")
    title: str = dspy.InputField(desc="The page title")
    content_snippet: str = dspy.InputField(desc="First 2000 characters of page content")
    html_snippet: str = dspy.InputField(desc="First 1000 characters of raw HTML")

    page_type: str = dspy.OutputField(
        desc="One of: doc, research, news, api, legal, product, plugin_spec, sdk_ref"
    )
    confidence: float = dspy.OutputField(desc="Confidence score between 0.0 and 1.0")
    reasoning: str = dspy.OutputField(desc="Brief explanation of the classification")


class QualityScorer(dspy.Signature):
    """Score the quality of extracted content from a web page.

    Evaluate completeness (was all relevant content captured?), structure
    (is the output well-organized?), and link quality (are links resolved and valid?).
    """

    url: str = dspy.InputField(desc="Source URL")
    extracted_content: str = dspy.InputField(desc="The extracted text content")
    structured_data: str = dspy.InputField(desc="JSON string of structured data extracted")
    selectors_used: str = dspy.InputField(desc="Comma-separated list of selectors used")
    link_count: int = dspy.InputField(desc="Number of links extracted")

    completeness: float = dspy.OutputField(desc="Completeness score 0.0-1.0")
    structure: float = dspy.OutputField(desc="Structure quality score 0.0-1.0")
    links: float = dspy.OutputField(desc="Link quality score 0.0-1.0")
    issues: str = dspy.OutputField(desc="Semicolon-separated list of quality issues found")


class SelectorProposer(dspy.Signature):
    """Propose improved CSS/XPath selectors for better extraction.

    Given the current selectors that are failing or producing low-quality output,
    examine the HTML structure and propose replacements.
    """

    spider_name: str = dspy.InputField(desc="Name of the spider")
    current_selectors: str = dspy.InputField(desc="Current selectors, one per line")
    failing_selectors: str = dspy.InputField(desc="Selectors known to be failing")
    html_sample: str = dspy.InputField(desc="Sample HTML from a target page")
    page_type: str = dspy.InputField(desc="The page type classification")

    proposed_selectors: str = dspy.OutputField(
        desc="New selectors, one per line, format: old -> new"
    )
    rationale: str = dspy.OutputField(desc="Why these selectors are better")
    expected_improvement: float = dspy.OutputField(
        desc="Expected quality improvement 0.0-1.0"
    )


class PluginDesigner(dspy.Signature):
    """Design a Claude Code plugin based on crawled knowledge.

    Given extraction results from a crawl campaign, design a plugin with
    appropriate skills, agents, and connectors.
    """

    domain: str = dspy.InputField(desc="Target domain (e.g., engineering, data, legal)")
    crawled_summaries: str = dspy.InputField(
        desc="Semicolon-separated summaries of crawled content"
    )
    discovered_page_types: str = dspy.InputField(
        desc="Comma-separated page types found during crawl"
    )
    existing_plugins: str = dspy.InputField(
        desc="Names of existing plugins to avoid duplication"
    )

    plugin_name: str = dspy.OutputField(desc="Suggested plugin name")
    plugin_description: str = dspy.OutputField(desc="One-paragraph plugin description")
    skills_json: str = dspy.OutputField(
        desc="JSON array of skill objects with name and description"
    )
    agents_json: str = dspy.OutputField(
        desc="JSON array of agent objects with name, description, and tools"
    )
    connectors_json: str = dspy.OutputField(
        desc="JSON array of connector objects with name, type, and config"
    )


class CodegenRouter(dspy.Signature):
    """Determine which programming languages and frameworks to use for code generation.

    Based on the task description and target environment, select the appropriate
    language(s) and scaffolding approach.
    """

    task_description: str = dspy.InputField(desc="What the generated code should do")
    target_environment: str = dspy.InputField(
        desc="Target environment (e.g., web, cli, serverless, library)"
    )
    preferred_languages: str = dspy.InputField(
        desc="Comma-separated preferred languages, or 'auto' for automatic selection"
    )
    constraints: str = dspy.InputField(
        desc="Any constraints on technology choices"
    )

    primary_language: str = dspy.OutputField(
        desc="Primary language to use (must be one of the 12 supported languages)"
    )
    secondary_languages: str = dspy.OutputField(
        desc="Comma-separated secondary languages if multi-lang project, or 'none'"
    )
    framework: str = dspy.OutputField(desc="Recommended framework or 'none'")
    scaffold_type: str = dspy.OutputField(
        desc="One of: library, cli, web-api, serverless, full-stack, sdk-wrapper"
    )
    rationale: str = dspy.OutputField(desc="Why this combination was chosen")
