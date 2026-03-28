"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function SpidersPage() {
  return (
    <ScrapyPage
      breadcrumb="Spiders"
      title="Spiders"
      subtitle="Spiders are classes that define how to scrape a site — where to start, how to follow links, and how to extract structured data from pages."
      prev={{ label: "Command Line", href: "/scrapy/basic-concepts/command-line" }}
      next={{ label: "Selectors", href: "/scrapy/basic-concepts/selectors" }}
    >
      <div className="space-y-6">
        <div className="text-sm text-[#b0aea5] space-y-3">
          <p>
            Every spider subclasses <Code>scrapy.Spider</Code> and must define a{" "}
            <Code>name</Code>, a list of <Code>start_urls</Code>, and a{" "}
            <Code>parse</Code> method that receives each response.
          </p>
          <p>
            The <Code>parse</Code> callback yields either extracted data (as dicts or Items)
            or new <Code>Request</Code> objects to follow links.
          </p>
        </div>

        <CodeBlock language="python" title="minimal spider">
{`import scrapy

class DocsSpider(scrapy.Spider):
    name = "docs_spider"
    start_urls = ["https://docs.example.com/"]

    def parse(self, response):
        for link in response.css("a.doc-link::attr(href)").getall():
            yield response.follow(link, callback=self.parse_page)

    def parse_page(self, response):
        yield {
            "url": response.url,
            "title": response.css("h1::text").get(),
            "content": response.css("article").get(),
        }`}
        </CodeBlock>

        <Callout type="tip">
          Use <Code>response.follow</Code> instead of building absolute URLs manually.
          Scrapy resolves relative URLs and deduplicates requests automatically.
        </Callout>

        <h2 className="text-lg font-semibold text-[#faf9f5]">AgentTasks Base Spider Pattern</h2>
        <p className="text-sm text-[#b0aea5]">
          In AgentTasks, every spider extends a shared base that adds quality scoring,
          markdown conversion, and metadata extraction hooks.
        </p>

        <CodeBlock language="python" title="base_spider.py pattern">
{`class BaseDocSpider(scrapy.Spider):
    custom_settings = {
        "CLOSESPIDER_PAGECOUNT": 500,
        "DEPTH_LIMIT": 4,
    }

    def parse_page(self, response):
        content_md = self.to_markdown(response)
        quality = self.score_quality(content_md)
        yield {
            "url": response.url,
            "title": response.css("title::text").get(""),
            "content_markdown": content_md,
            "quality_score": quality,
            "metadata": {"depth": response.meta["depth"]},
        }`}
        </CodeBlock>

        <Callout type="note">
          Spider callbacks are Python generators. Use <Code>yield</Code> for both
          data items and follow-up requests in the same method.
        </Callout>

        <div className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl p-4">
          <p className="text-xs text-[#6b6961]">
            Scrapy also provides <Code>CrawlSpider</Code> with rule-based link extraction
            and <Code>SitemapSpider</Code> for sitemap-driven crawls.
          </p>
        </div>
      </div>
    </ScrapyPage>
  );
}
