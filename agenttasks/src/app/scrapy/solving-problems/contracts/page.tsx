"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function ContractsPage() {
  return (
    <ScrapyPage
      breadcrumb="Contracts"
      title="Spiders Contracts"
      subtitle="Scrapy contracts let you test spider callbacks using docstring annotations. Define expected URLs, return counts, and required fields inline."
      prev={{ label: "Debugging", href: "/scrapy/solving-problems/debugging-spiders" }}
      next={{ label: "Common Practices", href: "/scrapy/solving-problems/common-practices" }}
    >
      <div className="space-y-6">
        <Collapsible title="Contract Annotations" defaultOpen>
          <p className="text-sm text-[#b0aea5] mb-3">
            Add <Code>@url</Code>, <Code>@returns</Code>, and <Code>@scrapes</Code>{" "}
            annotations to callback docstrings. Run them with <Code>scrapy check</Code>.
          </p>
          <CodeBlock language="python" title="contracts">
{`class DocsSpider(scrapy.Spider):
    name = "docs"

    def parse(self, response):
        """Parse documentation page.

        @url https://docs.example.com/
        @returns items 1
        @scrapes title url word_count
        """
        yield {
            "title": response.css("h1::text").get(),
            "url": response.url,
            "word_count": len(response.text.split()),
        }`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Running Contracts">
          <p className="text-sm text-[#b0aea5] mb-3">
            The <Code>scrapy check</Code> command validates all contracts across
            your spiders. It fetches the <Code>@url</Code> and verifies the output.
          </p>
          <CodeBlock language="bash" title="check">
{`scrapy check
# docs ... ok
# api_spider ... ok
# 2 contracts passed`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Custom Contracts">
          <p className="text-sm text-[#b0aea5] mb-3">
            Extend <Code>scrapy.contracts.Contract</Code> to create project-specific
            validations like quality score thresholds.
          </p>
          <CodeBlock language="python" title="custom contract">
{`from scrapy.contracts import Contract
from scrapy.exceptions import ContractFail

class MinWordsContract(Contract):
    name = "min_words"

    def post_process(self, output):
        for item in output:
            if item.get("word_count", 0) < 50:
                raise ContractFail("Page too thin")`}
          </CodeBlock>
        </Collapsible>

        <Callout type="note">
          AgentTasks runs <Code>scrapy check</Code> in CI to catch selector
          regressions before merging spider changes.
        </Callout>
      </div>
    </ScrapyPage>
  );
}
