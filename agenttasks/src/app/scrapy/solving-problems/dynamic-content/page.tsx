"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function DynamicContentPage() {
  return (
    <ScrapyPage
      breadcrumb="Dynamic Content"
      title="Dynamic Content"
      subtitle="Strategies for scraping JavaScript-rendered pages using Splash, Playwright, and pre-rendering techniques."
      prev={{ label: "Dev Tools", href: "/scrapy/solving-problems/dev-tools" }}
      next={{ label: "Memory Leaks", href: "/scrapy/solving-problems/memory-leaks" }}
    >
      <div className="space-y-6">
        <Collapsible title="Detecting JS-Rendered Content" defaultOpen>
          <p className="text-sm text-[#b0aea5] mb-3">
            If <Code>scrapy shell</Code> returns empty selectors but the browser
            shows content, the page is JavaScript-rendered. Check the page source
            vs. the rendered DOM.
          </p>
          <CodeBlock language="bash" title="detection">
{`scrapy shell "https://spa-docs.example.com"
>>> response.css("article").getall()
[]  # Empty = JS-rendered content`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Scrapy + Playwright">
          <p className="text-sm text-[#b0aea5] mb-3">
            Use <Code>scrapy-playwright</Code> to render pages with a real browser.
            Mark requests with <Code>playwright=True</Code> in meta.
          </p>
          <CodeBlock language="python" title="playwright spider">
{`import scrapy

class JSDocsSpider(scrapy.Spider):
    name = "js_docs"

    def start_requests(self):
        yield scrapy.Request(
            "https://spa-docs.example.com",
            meta={"playwright": True,
                  "playwright_page_methods": [
                      {"method": "wait_for_selector",
                       "args": ["article"]},
                  ]},
        )

    def parse(self, response):
        yield {"title": response.css("h1::text").get()}`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="API-First Approach">
          <p className="text-sm text-[#b0aea5] mb-3">
            Often the fastest solution: find the underlying API that feeds the SPA
            and call it directly. No browser rendering needed.
          </p>
          <CodeBlock language="python" title="api approach">
{`# Many SPAs fetch from /api/ endpoints
def start_requests(self):
    yield scrapy.Request(
        "https://spa-docs.example.com/api/pages",
        callback=self.parse_api,
    )`}
          </CodeBlock>
        </Collapsible>

        <Callout type="note">
          AgentTasks prefers the API-first approach. We only use Playwright for
          sites with no discoverable API endpoints.
        </Callout>
      </div>
    </ScrapyPage>
  );
}
