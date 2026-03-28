"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function DevToolsPage() {
  return (
    <ScrapyPage
      breadcrumb="Dev Tools"
      title="Developer Tools"
      subtitle="Use browser developer tools to find CSS selectors, inspect network requests, and reverse-engineer API calls for your spiders."
      prev={{ label: "Broad Crawls", href: "/scrapy/solving-problems/broad-crawls" }}
      next={{ label: "Dynamic Content", href: "/scrapy/solving-problems/dynamic-content" }}
    >
      <div className="space-y-6">
        <Collapsible title="Finding Selectors" defaultOpen>
          <p className="text-sm text-[#b0aea5] mb-3">
            Right-click any element and choose Inspect. Use the Elements panel to
            craft <Code>css</Code> and <Code>xpath</Code> selectors, then test
            them in <Code>scrapy shell</Code>.
          </p>
          <CodeBlock language="python" title="selector workflow">
{`# 1. Find selector in DevTools: div.content > h1
# 2. Test in shell
scrapy shell "https://docs.example.com"
>>> response.css("div.content > h1::text").get()
'Getting Started'`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Network Tab for API Calls">
          <p className="text-sm text-[#b0aea5] mb-3">
            Many doc sites load content via XHR. Use the Network tab to find JSON
            endpoints, then call them directly in your spider.
          </p>
          <CodeBlock language="python" title="API spider">
{`def start_requests(self):
    # Found via Network tab: XHR to /api/docs/search
    yield scrapy.Request(
        "https://docs.example.com/api/docs/search?q=*",
        headers={"Accept": "application/json"},
        callback=self.parse_api,
    )

def parse_api(self, response):
    data = response.json()
    for doc in data["results"]:
        yield {"title": doc["title"], "url": doc["url"]}`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Copy as cURL">
          <p className="text-sm text-[#b0aea5] mb-3">
            Right-click a request in the Network tab and select Copy as cURL.
            Convert the headers and cookies into your spider request.
          </p>
          <CodeBlock language="bash" title="curl to scrapy">
{`# From DevTools: Copy as cURL
curl 'https://api.example.com/docs' \\
  -H 'Authorization: Bearer token123'

# Convert to Scrapy Request
# scrapy.Request(url, headers={"Authorization": "Bearer token123"})`}
          </CodeBlock>
        </Collapsible>

        <Callout type="tip">
          AgentTasks spiders are built selector-first: we always validate in
          DevTools and <Code>scrapy shell</Code> before writing callback code.
        </Callout>
      </div>
    </ScrapyPage>
  );
}
