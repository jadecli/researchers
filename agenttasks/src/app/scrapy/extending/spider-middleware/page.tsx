"use client";
import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function SpiderMiddlewarePage() {
  return (
    <ScrapyPage
      breadcrumb="Spider MW"
      title="Spider Middleware"
      subtitle="Spider middleware processes the output from spiders (items and new requests) and the input going to spiders (responses). It sits between the Engine and the Spider."
      prev={{ label: "Downloader MW", href: "/scrapy/extending/downloader-middleware" }}
      next={{ label: "Extensions", href: "/scrapy/extending/extensions" }}
    >
      <Collapsible title="Hook Methods" defaultOpen>
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          Spider middleware has three primary hooks: <Code>process_spider_input</Code> for
          incoming responses, <Code>process_spider_output</Code> for yielded items and
          requests, and <Code>process_start_requests</Code> for the initial request batch.
        </p>
        <CodeBlock language="python" title="Spider middleware hooks">
{`class MySpiderMiddleware:
    def process_spider_input(self, response, spider):
        """Called with the response before the spider processes it."""
        return None  # success, continue

    def process_spider_output(self, response, result, spider):
        """Called with the items/requests yielded by the spider."""
        for item_or_request in result:
            yield item_or_request

    def process_start_requests(self, start_requests, spider):
        """Called with the spider's initial requests."""
        for request in start_requests:
            yield request`}
        </CodeBlock>
      </Collapsible>

      <Callout type="note">
        Unlike downloader middleware, spider middleware processes the <em>output</em> of
        the spider callback. Use it to filter items, enrich metadata, or inject
        additional follow-up requests after the spider has parsed a page.
      </Callout>

      <Collapsible title="Depth and URL Filtering">
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          In AgentTasks, our spider middleware enforces crawl depth limits and filters
          out URLs that fall outside documentation paths. This keeps crawls focused on
          high-value content.
        </p>
        <CodeBlock language="python" title="agenttasks/middlewares.py">
{`class DocPathFilterMiddleware:
    def process_spider_output(self, response, result, spider):
        for item_or_request in result:
            if hasattr(item_or_request, "url"):
                if "/docs/" in item_or_request.url:
                    yield item_or_request
                else:
                    spider.logger.debug(
                        f"Filtered: {item_or_request.url}"
                    )
            else:
                yield item_or_request  # pass items through`}
        </CodeBlock>
      </Collapsible>

      <Callout type="tip">
        Use <Code>process_start_requests</Code> to add priority or metadata to initial
        requests. In AgentTasks, we tag start requests with <Code>{"meta={'source': 'seed'}"}</Code> to
        track which pages came from the seed list vs. discovered links.
      </Callout>
    </ScrapyPage>
  );
}
