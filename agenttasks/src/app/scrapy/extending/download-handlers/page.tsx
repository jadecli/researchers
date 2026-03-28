"use client";
import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function DownloadHandlersPage() {
  return (
    <ScrapyPage
      breadcrumb="Download Handlers"
      title="Download Handlers"
      subtitle="Download handlers implement the actual protocol-level fetching for different URI schemes. Scrapy includes handlers for HTTP, HTTPS, FTP, and file:// protocols."
      prev={{ label: "Item Exporters", href: "/scrapy/extending/item-exporters" }}
      next={{ label: "Components", href: "/scrapy/extending/components" }}
    >
      <Collapsible title="Built-in Handlers" defaultOpen>
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          Each URI scheme maps to a handler class. The HTTP/HTTPS handlers use Twisted&apos;s
          HTTP client under the hood. You can override or add handlers via the{" "}
          <Code>DOWNLOAD_HANDLERS</Code> setting.
        </p>
        <CodeBlock language="python" title="Default download handlers">
{`DOWNLOAD_HANDLERS = {
    "http": "scrapy.core.downloader.handlers.http.HTTPDownloadHandler",
    "https": "scrapy.core.downloader.handlers.http.HTTPDownloadHandler",
    "ftp": "scrapy.core.downloader.handlers.ftp.FTPDownloadHandler",
    "file": "scrapy.core.downloader.handlers.file.FileDownloadHandler",
}`}
        </CodeBlock>
      </Collapsible>

      <Callout type="note">
        Scrapy 2.14 supports <Code>HTTPDownloadHandler</Code> backed by both Twisted
        and asyncio. Set <Code>DOWNLOAD_HANDLERS</Code> to swap in the asyncio-based
        handler for better compatibility with modern Python libraries.
      </Callout>

      <Collapsible title="Custom Handler for llms.txt">
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          AgentTasks uses a custom download handler for <Code>llms.txt</Code> endpoints
          that stream large text files. Instead of buffering the entire response, it
          reads chunks and yields partial content for incremental processing.
        </p>
        <CodeBlock language="python" title="agenttasks/handlers.py">
{`from scrapy.core.downloader.handlers.http import HTTPDownloadHandler
from twisted.internet import defer

class LlmsTxtHandler(HTTPDownloadHandler):
    """Stream large llms.txt files in chunks."""

    @defer.inlineCallbacks
    def download_request(self, request, spider):
        response = yield super().download_request(request, spider)
        if request.url.endswith("/llms.txt"):
            spider.logger.info(
                f"llms.txt: {len(response.body)} bytes"
            )
            response.meta["streamed"] = True
        defer.returnValue(response)`}
        </CodeBlock>
      </Collapsible>

      <Callout type="tip">
        Register custom handlers with a scheme prefix. For example,
        use <Code>{"'llms': 'agenttasks.handlers.LlmsTxtHandler'"}</Code> to handle{" "}
        <Code>llms://</Code> URLs, keeping the standard HTTP handler untouched.
      </Callout>
    </ScrapyPage>
  );
}
