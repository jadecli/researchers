"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";
import { TabGroup } from "@/components/TabGroup";

export default function LinkExtractorsPage() {
  return (
    <ScrapyPage
      breadcrumb="Link Extractors"
      title="Link Extractors"
      subtitle="Automatically discover and filter links from crawled pages. Link extractors power CrawlSpider rules and custom link discovery."
      prev={{ label: "Requests & Responses", href: "/scrapy/basic-concepts/requests-responses" }}
      next={{ label: "Settings", href: "/scrapy/basic-concepts/settings" }}
    >
      <Collapsible title="LinkExtractor Basics" defaultOpen>
        <p className="text-sm text-[#b0aea5] mb-3">
          <Code>LinkExtractor</Code> from <Code>scrapy.linkextractors</Code> finds links in a response
          and returns <Code>Link</Code> objects with <Code>url</Code>, <Code>text</Code>, and <Code>fragment</Code>.
        </p>
        <CodeBlock language="python" title="Basic usage">
{`from scrapy.linkextractors import LinkExtractor

# Extract all links
extractor = LinkExtractor()
links = extractor.extract_links(response)

for link in links:
    print(link.url, link.text)`}
        </CodeBlock>
      </Collapsible>

      <TabGroup tabs={[
        { label: "Allow / Deny", content: (
          <div className="space-y-3">
            <p className="text-sm text-[#b0aea5]">
              Filter links by URL pattern. <Code>allow</Code> is a whitelist regex;
              <Code>deny</Code> is a blacklist. Both accept strings or lists.
            </p>
            <CodeBlock language="python">
{`# Only follow documentation links
extractor = LinkExtractor(
    allow=[r"/docs/", r"/api/"],
    deny=[r"/blog/", r"/changelog/", r"\\.pdf$"],
)`}
            </CodeBlock>
          </div>
        )},
        { label: "restrict_css", content: (
          <div className="space-y-3">
            <p className="text-sm text-[#b0aea5]">
              Limit extraction to links within specific CSS-selected regions of the page.
            </p>
            <CodeBlock language="python">
{`# Only extract links from the sidebar nav
extractor = LinkExtractor(
    restrict_css="nav.sidebar a",
)`}
            </CodeBlock>
          </div>
        )},
        { label: "restrict_xpaths", content: (
          <div className="space-y-3">
            <p className="text-sm text-[#b0aea5]">
              Same concept as <Code>restrict_css</Code> but using XPath expressions.
            </p>
            <CodeBlock language="python">
{`# Only extract links inside the main content area
extractor = LinkExtractor(
    restrict_xpaths='//div[@class="content"]//a',
)`}
            </CodeBlock>
          </div>
        )},
      ]} />

      <Collapsible title="With CrawlSpider Rules" accent="#6a9bcc">
        <p className="text-sm text-[#b0aea5] mb-3">
          <Code>CrawlSpider</Code> uses <Code>Rule</Code> objects that pair a <Code>LinkExtractor</Code> with
          a callback and follow behavior.
        </p>
        <CodeBlock language="python" title="CrawlSpider example">
{`from scrapy.spiders import CrawlSpider, Rule
from scrapy.linkextractors import LinkExtractor

class DocsCrawler(CrawlSpider):
    name = "docs_crawler"
    start_urls = ["https://docs.example.com"]
    rules = (
        Rule(LinkExtractor(allow=r"/docs/"), callback="parse_doc", follow=True),
        Rule(LinkExtractor(allow=r"/api/"), callback="parse_api"),
    )`}
        </CodeBlock>
      </Collapsible>

      <Collapsible title="Our Sitemap Link Discovery" accent="#788c5d">
        <p className="text-sm text-[#b0aea5] mb-3">
          Instead of crawling links, we extract documentation URLs directly from XML sitemaps.
          This gives us a complete URL list upfront without recursive crawling.
        </p>
        <CodeBlock language="python" title="Sitemap-based extraction">
{`from scrapy.spiders import SitemapSpider

class DocsSitemapSpider(SitemapSpider):
    name = "docs_sitemap"
    sitemap_urls = ["https://docs.example.com/sitemap.xml"]
    sitemap_rules = [
        (r"/docs/", "parse_doc"),
        (r"/api/", "parse_api"),
    ]`}
        </CodeBlock>
      </Collapsible>

      <Callout type="tip">
        Prefer sitemap-based discovery when available. It avoids the overhead of recursive link
        following and guarantees coverage of all indexed pages.
      </Callout>
    </ScrapyPage>
  );
}
