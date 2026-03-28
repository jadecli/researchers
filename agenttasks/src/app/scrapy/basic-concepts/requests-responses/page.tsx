"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";
import { TabGroup } from "@/components/TabGroup";

export default function RequestsResponsesPage() {
  return (
    <ScrapyPage
      breadcrumb="Requests & Responses"
      title="Requests and Responses"
      subtitle="Understand how Scrapy models HTTP communication. Requests carry intent; Responses carry data."
      prev={{ label: "Feed Exports", href: "/scrapy/basic-concepts/feed-exports" }}
      next={{ label: "Link Extractors", href: "/scrapy/basic-concepts/link-extractors" }}
    >
      <Collapsible title="Request Object" defaultOpen>
        <p className="text-sm text-[#b0aea5] mb-3">
          A <Code>scrapy.Request</Code> wraps a URL, callback, HTTP method, headers, and arbitrary metadata.
        </p>
        <CodeBlock language="python" title="Creating requests">
{`import scrapy

# Basic GET request
yield scrapy.Request(
    url="https://docs.example.com/page",
    callback=self.parse_page,
    headers={"Accept": "text/html"},
    meta={"depth": 1, "source": "sitemap"},
)`}
        </CodeBlock>
      </Collapsible>

      <Collapsible title="Response Object" accent="#6a9bcc">
        <p className="text-sm text-[#b0aea5] mb-3">
          The <Code>Response</Code> carries status, headers, body, and the originating request.
          Use <Code>response.css()</Code> or <Code>response.xpath()</Code> to extract data.
        </p>
        <CodeBlock language="python" title="Working with responses">
{`def parse_page(self, response):
    # Status and URL
    self.logger.info(f"{response.status} {response.url}")

    # Extract with selectors
    title = response.css("h1::text").get()
    links = response.css("a::attr(href)").getall()

    # Access meta from the request
    depth = response.meta.get("depth", 0)

    yield {"url": response.url, "title": title, "depth": depth}`}
        </CodeBlock>
      </Collapsible>

      <TabGroup tabs={[
        { label: "Callbacks", content: (
          <div className="space-y-3">
            <p className="text-sm text-[#b0aea5]">
              Every request specifies a callback. The callback receives the response and yields items
              or further requests.
            </p>
            <CodeBlock language="python">
{`def start_requests(self):
    yield scrapy.Request(url, callback=self.parse_index)

def parse_index(self, response):
    for link in response.css("a::attr(href)").getall():
        yield response.follow(link, callback=self.parse_detail)`}
            </CodeBlock>
          </div>
        )},
        { label: "Meta", content: (
          <div className="space-y-3">
            <p className="text-sm text-[#b0aea5]">
              Use <Code>meta</Code> to pass data between callbacks. It survives redirects and retries.
            </p>
            <CodeBlock language="python">
{`yield scrapy.Request(
    url, callback=self.parse_detail,
    meta={"category": "api-reference", "priority": "high"},
)

def parse_detail(self, response):
    category = response.meta["category"]  # "api-reference"`}
            </CodeBlock>
          </div>
        )},
        { label: "Headers", content: (
          <div className="space-y-3">
            <p className="text-sm text-[#b0aea5]">
              Set custom headers per request. Useful for APIs or content negotiation.
            </p>
            <CodeBlock language="python">
{`yield scrapy.Request(
    url,
    headers={
        "Accept": "application/json",
        "Authorization": f"Bearer {self.api_key}",
    },
)`}
            </CodeBlock>
          </div>
        )},
      ]} />

      <Collapsible title="HEAD Requests for Size Checking" accent="#d97757">
        <p className="text-sm text-[#b0aea5] mb-3">
          Our <Code>llms_full_spider</Code> sends HEAD requests first to check <Code>Content-Length</Code> before
          downloading large files. This avoids wasting bandwidth on oversized pages.
        </p>
        <CodeBlock language="python" title="HEAD-then-GET pattern">
{`def start_requests(self):
    yield scrapy.Request(
        url=self.target_url,
        method="HEAD",
        callback=self.check_size,
    )

def check_size(self, response):
    size = int(response.headers.get("Content-Length", 0))
    if size > self.max_size:
        self.logger.warning(f"Skipping {response.url}: {size} bytes")
        return
    yield scrapy.Request(response.url, callback=self.parse_page)`}
        </CodeBlock>
      </Collapsible>

      <Callout type="warning">
        Avoid storing large objects in <Code>meta</Code> — it is kept in memory for the lifetime of
        the request/response cycle and can cause high memory usage during broad crawls.
      </Callout>
    </ScrapyPage>
  );
}
