"use client";
import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";
import { TabGroup } from "@/components/TabGroup";
import { Collapsible } from "@/components/Collapsible";

export default function ExamplesPage() {
  return (
    <ScrapyPage
      breadcrumb="Examples"
      title="Examples"
      subtitle="Real spiders from the AgentTasks crawling pipeline. Each targets a different documentation domain with specialized extraction logic and quality scoring."
      prev={{ label: "Tutorial", href: "/scrapy/first-steps/tutorial" }}
      next={{ label: "Command Line", href: "/scrapy/basic-concepts/command-line" }}
    >
      <Callout type="note">
        These examples are simplified versions of our production spiders. The full
        implementations include error handling, retry logic, and integration
        with our Postgres pipeline.
      </Callout>

      <TabGroup
        tabs={[
          {
            label: "docs_spider",
            content: (
              <div className="space-y-4">
                <p className="text-sm text-[#b0aea5] leading-relaxed">
                  The general-purpose documentation crawler. It follows links within a
                  documentation site and extracts structured content with word counts
                  and section headings.
                </p>
                <CodeBlock language="python" title="spiders/docs_spider.py">
{`import scrapy
from items import DocPage


class DocsSpider(scrapy.Spider):
    name = "docs_spider"
    allowed_domains = ["docs.example.com"]
    start_urls = ["https://docs.example.com/"]

    custom_settings = {
        "CONCURRENT_REQUESTS": 8,
        "DOWNLOAD_DELAY": 0.5,
        "DEPTH_LIMIT": 5,
    }

    def parse(self, response):
        item = DocPage()
        item["url"] = response.url
        item["title"] = response.css("h1::text").get("")
        item["sections"] = response.css("h2::text").getall()
        item["content"] = " ".join(
            response.css("article ::text").getall()
        )
        item["word_count"] = len(item["content"].split())
        yield item

        for link in response.css("nav a::attr(href)").getall():
            yield response.follow(link, self.parse)`}
                </CodeBlock>
              </div>
            ),
          },
          {
            label: "platform_spider",
            content: (
              <div className="space-y-4">
                <p className="text-sm text-[#b0aea5] leading-relaxed">
                  Targets platform API references with structured endpoint extraction.
                  Parses HTTP methods, paths, parameters, and response schemas.
                </p>
                <CodeBlock language="python" title="spiders/platform_spider.py">
{`import scrapy
import json


class PlatformSpider(scrapy.Spider):
    name = "platform_spider"
    start_urls = ["https://api.example.com/docs/"]

    custom_settings = {
        "CONCURRENT_REQUESTS": 4,
        "DOWNLOAD_DELAY": 1.0,
    }

    def parse(self, response):
        for endpoint in response.css(".endpoint-card"):
            yield {
                "url": response.url,
                "method": endpoint.css(
                    ".method::text"
                ).get("GET"),
                "path": endpoint.css(
                    ".path::text"
                ).get(""),
                "description": endpoint.css(
                    ".desc::text"
                ).get(""),
                "parameters": endpoint.css(
                    ".param::text"
                ).getall(),
            }

        next_page = response.css(
            "a.next-page::attr(href)"
        ).get()
        if next_page:
            yield response.follow(next_page, self.parse)`}
                </CodeBlock>
              </div>
            ),
          },
          {
            label: "llms_full_spider",
            content: (
              <div className="space-y-4">
                <p className="text-sm text-[#b0aea5] leading-relaxed">
                  Full crawl of LLM provider documentation. Uses broader link following
                  and extracts code examples alongside prose content.
                </p>
                <CodeBlock language="python" title="spiders/llms_full_spider.py">
{`import scrapy
from scrapy.linkextractors import LinkExtractor


class LlmsFullSpider(scrapy.Spider):
    name = "llms_full_spider"
    start_urls = [
        "https://docs.provider-a.com/",
        "https://docs.provider-b.com/",
    ]

    link_extractor = LinkExtractor(
        allow=[r"/docs/", r"/guide/", r"/api/"],
        deny=[r"/blog/", r"/changelog/"],
    )

    custom_settings = {
        "CONCURRENT_REQUESTS": 16,
        "DOWNLOAD_DELAY": 0.25,
        "DEPTH_LIMIT": 8,
        "CLOSESPIDER_PAGECOUNT": 600,
    }

    def parse(self, response):
        code_blocks = response.css("pre code::text").getall()
        yield {
            "url": response.url,
            "title": response.css("h1::text").get(""),
            "content": " ".join(
                response.css("main ::text").getall()
            ),
            "code_examples": code_blocks,
            "code_count": len(code_blocks),
            "word_count": len(
                " ".join(
                    response.css("main ::text").getall()
                ).split()
            ),
        }

        for link in self.link_extractor.extract_links(
            response
        ):
            yield scrapy.Request(link.url, self.parse)`}
                </CodeBlock>
              </div>
            ),
          },
          {
            label: "anthropic_spider",
            content: (
              <div className="space-y-4">
                <p className="text-sm text-[#b0aea5] leading-relaxed">
                  Dedicated Anthropic documentation crawler. Extracts model references,
                  API examples, and pricing tables with specialized selectors.
                </p>
                <CodeBlock language="python" title="spiders/anthropic_spider.py">
{`import scrapy


class AnthropicSpider(scrapy.Spider):
    name = "anthropic_spider"
    allowed_domains = ["docs.anthropic.com"]
    start_urls = [
        "https://docs.anthropic.com/en/docs"
    ]

    custom_settings = {
        "CONCURRENT_REQUESTS": 4,
        "DOWNLOAD_DELAY": 1.5,
        "ROBOTSTXT_OBEY": True,
        "USER_AGENT": (
            "AgentTasks/1.0 "
            "(+https://agenttasks.dev)"
        ),
    }

    def parse(self, response):
        yield {
            "url": response.url,
            "title": response.css(
                "h1::text"
            ).get(""),
            "content": " ".join(
                response.css(
                    "[data-content] ::text"
                ).getall()
            ),
            "has_code": bool(
                response.css("pre code")
            ),
            "section": response.url.split("/")[-1],
        }

        for href in response.css(
            "nav a::attr(href)"
        ).getall():
            if href.startswith("/en/docs"):
                yield response.follow(
                    href, self.parse
                )`}
                </CodeBlock>
              </div>
            ),
          },
        ]}
      />

      <Collapsible title="Common Patterns Across Spiders">
        <div className="space-y-3 text-sm text-[#b0aea5] leading-relaxed">
          <p>
            All of our spiders share a few conventions:
          </p>
          <ul className="space-y-2 list-none">
            <li className="flex items-start gap-2">
              <span className="text-[#d97757] shrink-0 mt-0.5">--</span>
              <Code>custom_settings</Code> per spider for tuning concurrency and delays
              based on the target site&apos;s capacity.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#d97757] shrink-0 mt-0.5">--</span>
              Word count extraction for downstream quality scoring — pages
              under 50 words are flagged as low-value.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#d97757] shrink-0 mt-0.5">--</span>
              Scoped link following via <Code>allowed_domains</Code> or URL prefix
              checks to prevent crawl drift.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#d97757] shrink-0 mt-0.5">--</span>
              Respectful crawling with <Code>ROBOTSTXT_OBEY = True</Code> and
              per-domain download delays.
            </li>
          </ul>
        </div>
      </Collapsible>

      <Callout type="tip">
        Run any spider with <Code>scrapy crawl spider_name -s CLOSESPIDER_PAGECOUNT=5</Code> to
        test with a small number of pages before doing a full crawl.
      </Callout>
    </ScrapyPage>
  );
}
