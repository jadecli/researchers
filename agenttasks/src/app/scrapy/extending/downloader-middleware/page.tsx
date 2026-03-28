"use client";
import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function DownloaderMiddlewarePage() {
  return (
    <ScrapyPage
      breadcrumb="Downloader MW"
      title="Downloader Middleware"
      subtitle="Downloader middleware sits between the Engine and the Downloader, intercepting every request before it is sent and every response before it reaches the spider."
      prev={{ label: "Add-ons", href: "/scrapy/extending/addons" }}
      next={{ label: "Spider MW", href: "/scrapy/extending/spider-middleware" }}
    >
      <Collapsible title="Three Hook Methods" defaultOpen>
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          Every downloader middleware can implement <Code>process_request</Code>,{" "}
          <Code>process_response</Code>, and <Code>process_exception</Code>. Scrapy
          calls them in priority order for each request/response cycle.
        </p>
        <CodeBlock language="python" title="Hook signatures">
{`class MyDownloaderMiddleware:
    def process_request(self, request, spider):
        """Called before the request is sent."""
        return None  # continue processing

    def process_response(self, request, response, spider):
        """Called after the response is received."""
        return response

    def process_exception(self, request, exception, spider):
        """Called when the download raises an exception."""
        return None  # let other middleware handle it`}
        </CodeBlock>
      </Collapsible>

      <Callout type="note">
        Returning a <Code>Response</Code> from <Code>process_request</Code> short-circuits
        the download entirely. This is how DeltaFetch skips pages we have already crawled.
      </Callout>

      <Collapsible title="AgentTasks DeltaFetch Middleware">
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          Our <Code>DeltaFetchMiddleware</Code> checks a Postgres fingerprint table before
          every request. If the page content hash has not changed since the last crawl, we
          skip it and save bandwidth.
        </p>
        <CodeBlock language="python" title="agenttasks/middlewares.py">
{`class DeltaFetchMiddleware:
    @classmethod
    def from_crawler(cls, crawler):
        return cls(crawler.settings.get("DATABASE_URL"))

    def process_request(self, request, spider):
        fingerprint = request_fingerprint(request)
        if self.db.has_unchanged(fingerprint):
            spider.logger.debug(f"DeltaFetch skip: {request.url}")
            raise IgnoreRequest()
        return None

    def process_response(self, request, response, spider):
        fingerprint = request_fingerprint(request)
        self.db.store(fingerprint, hash(response.body))
        return response`}
        </CodeBlock>
      </Collapsible>

      <Callout type="tip">
        Set middleware priority carefully. DeltaFetch runs at priority 100 (early) to
        skip requests before rate limiting at 200 even evaluates them.
      </Callout>
    </ScrapyPage>
  );
}
