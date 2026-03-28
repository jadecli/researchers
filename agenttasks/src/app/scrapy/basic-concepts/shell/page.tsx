"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { Collapsible } from "@/components/Collapsible";
import { Code } from "@/components/Code";

export default function ShellPage() {
  return (
    <ScrapyPage
      breadcrumb="Shell"
      title="Scrapy Shell"
      subtitle="The Scrapy shell is an interactive console for testing extraction logic against live pages without running a full crawl."
      prev={{ label: "Item Loaders", href: "/scrapy/basic-concepts/item-loaders" }}
      next={{ label: "Item Pipeline", href: "/scrapy/basic-concepts/item-pipeline" }}
    >
      <div className="space-y-6">
        <div className="text-sm text-[#b0aea5] space-y-3">
          <p>
            Launch the shell with a URL to get a pre-loaded <Code>response</Code> object.
            From there, test CSS and XPath selectors, inspect headers, and explore
            the page structure before writing spider code.
          </p>
        </div>

        <Collapsible title="Starting the Shell" defaultOpen>
          <CodeBlock language="bash" title="launch">
{`scrapy shell "https://docs.scrapy.org/en/latest/"

# Or fetch a new URL inside the shell:
# fetch("https://docs.scrapy.org/en/latest/intro/tutorial.html")`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Exploring the Response" defaultOpen>
          <CodeBlock language="python" title="shell session">
{`# Available objects: request, response, settings, spider

>>> response.url
'https://docs.scrapy.org/en/latest/'

>>> response.status
200

>>> response.headers.get("Content-Type")
b'text/html; charset=utf-8'

>>> len(response.text)
45832`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Testing Selectors">
          <CodeBlock language="python" title="selector testing">
{`>>> response.css("title::text").get()
'Scrapy 2.14 documentation'

>>> response.css("nav a::attr(href)").getall()[:3]
['/en/latest/intro/', '/en/latest/topics/', '/en/latest/api/']

>>> response.xpath('//h1/text()').get()
'Scrapy 2.14 documentation'

>>> # Test the AgentTasks selector pattern
>>> for link in response.css("a.reference"):
...     print(link.css("::text").get(), link.attrib["href"])`}
          </CodeBlock>
        </Collapsible>

        <Callout type="tip">
          Use the shell to prototype your <Code>parse</Code> method interactively.
          Once selectors work correctly, copy them directly into your spider class.
          This saves significant debugging time during development.
        </Callout>

        <Collapsible title="Using fetch() and view()">
          <p className="text-sm text-[#b0aea5] mb-3">
            Navigate to different pages within the same session using{" "}
            <Code>fetch()</Code>. Use <Code>view(response)</Code> to open the
            current response in your browser.
          </p>
          <CodeBlock language="python" title="navigation">
{`>>> fetch("https://docs.scrapy.org/en/latest/topics/spiders.html")
>>> response.css("h1::text").get()
'Spiders'

>>> view(response)  # Opens in browser for visual inspection`}
          </CodeBlock>
        </Collapsible>

        <Callout type="note">
          The shell uses IPython when available, giving you tab completion and
          syntax highlighting. Install it with <Code>pip install ipython</Code>.
        </Callout>

        <div className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl p-4">
          <p className="text-xs text-[#6b6961]">
            In AgentTasks, we use the shell to validate quality-score selectors
            before deploying new spiders to production crawls.
          </p>
        </div>
      </div>
    </ScrapyPage>
  );
}
