"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { Collapsible } from "@/components/Collapsible";
import { Code } from "@/components/Code";

export default function SelectorsPage() {
  return (
    <ScrapyPage
      breadcrumb="Selectors"
      title="Selectors"
      subtitle="Scrapy selectors wrap CSS and XPath queries with a unified API. Use them to extract text, attributes, and nested elements from HTML responses."
      prev={{ label: "Spiders", href: "/scrapy/basic-concepts/spiders" }}
      next={{ label: "Items", href: "/scrapy/basic-concepts/items" }}
    >
      <div className="space-y-6">
        <div className="text-sm text-[#b0aea5] space-y-3">
          <p>
            Every <Code>response</Code> object exposes <Code>.css()</Code> and{" "}
            <Code>.xpath()</Code> methods that return <Code>SelectorList</Code> objects.
            Call <Code>.get()</Code> for the first match or <Code>.getall()</Code> for all.
          </p>
        </div>

        <Collapsible title="CSS Selectors" defaultOpen>
          <p className="text-sm text-[#b0aea5] mb-3">
            CSS selectors use the familiar web syntax. Scrapy adds the{" "}
            <Code>::text</Code> and <Code>::attr(name)</Code> pseudo-elements.
          </p>
          <CodeBlock language="python" title="CSS examples">
{`# Get page title text
response.css("h1::text").get()

# All paragraph texts
response.css("article p::text").getall()

# Href attribute from links
response.css("a.nav-link::attr(href)").getall()

# Nested: select inside a selection
for card in response.css("div.card"):
    title = card.css("h3::text").get()
    link = card.css("a::attr(href)").get()`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="XPath Selectors">
          <p className="text-sm text-[#b0aea5] mb-3">
            XPath is more powerful than CSS for navigating parent axes, sibling
            relationships, and conditional matching.
          </p>
          <CodeBlock language="python" title="XPath examples">
{`# Text of the first h1
response.xpath("//h1/text()").get()

# Links containing "docs" in href
response.xpath('//a[contains(@href, "docs")]/@href').getall()

# Text from a sibling element
response.xpath('//dt[text()="Version"]/following-sibling::dd/text()').get()`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="CSS vs XPath Comparison">
          <CodeBlock language="python" title="side by side">
{`# Same result, different syntax:

# CSS
response.css("div.content > p::text").getall()
# XPath
response.xpath("//div[@class='content']/p/text()").getall()

# CSS — attribute
response.css("img::attr(src)").get()
# XPath — attribute
response.xpath("//img/@src").get()`}
          </CodeBlock>
        </Collapsible>

        <Callout type="tip">
          In AgentTasks, we prefer CSS selectors for readability but fall back to
          XPath when we need parent traversal or conditional attribute matching.
        </Callout>

        <div className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl p-4">
          <p className="text-xs text-[#6b6961]">
            Test selectors interactively with <Code>scrapy shell</Code> before
            committing them to spider code.
          </p>
        </div>
      </div>
    </ScrapyPage>
  );
}
