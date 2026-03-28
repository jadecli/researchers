"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function FilesImagesPage() {
  return (
    <ScrapyPage
      breadcrumb="Files & Images"
      title="Files and Images"
      subtitle="Scrapy's FilesPipeline and ImagesPipeline handle downloading, deduplication, and storage of binary assets alongside crawled content."
      prev={{ label: "Memory Leaks", href: "/scrapy/solving-problems/memory-leaks" }}
      next={{ label: "Deploying", href: "/scrapy/solving-problems/deploying" }}
    >
      <div className="space-y-6">
        <Collapsible title="FilesPipeline" defaultOpen>
          <p className="text-sm text-[#b0aea5] mb-3">
            Enable <Code>FilesPipeline</Code> to download files referenced in
            your items. Set <Code>file_urls</Code> on each item.
          </p>
          <CodeBlock language="python" title="settings.py">
{`ITEM_PIPELINES = {
    "scrapy.pipelines.files.FilesPipeline": 1,
}
FILES_STORE = "downloads/files"

# In spider
def parse(self, response):
    yield {
        "title": response.css("h1::text").get(),
        "file_urls": response.css("a.download::attr(href)").getall(),
    }`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="ImagesPipeline">
          <p className="text-sm text-[#b0aea5] mb-3">
            The <Code>ImagesPipeline</Code> extends FilesPipeline with thumbnail
            generation and image validation.
          </p>
          <CodeBlock language="python" title="images config">
{`ITEM_PIPELINES = {
    "scrapy.pipelines.images.ImagesPipeline": 1,
}
IMAGES_STORE = "downloads/images"
IMAGES_THUMBS = {
    "small": (50, 50),
    "big": (270, 270),
}`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Custom Storage Backend">
          <p className="text-sm text-[#b0aea5] mb-3">
            Override the storage backend to upload files to S3, GCS, or any
            custom destination.
          </p>
          <CodeBlock language="python" title="S3 storage">
{`# Store files directly in S3
FILES_STORE = "s3://my-bucket/scrapy-files/"
AWS_ACCESS_KEY_ID = "your-key"
AWS_SECRET_ACCESS_KEY = "your-secret"`}
          </CodeBlock>
        </Collapsible>

        <Callout type="tip">
          AgentTasks downloads documentation PDFs and diagrams alongside HTML
          content, storing them in S3 with content-hash deduplication.
        </Callout>
      </div>
    </ScrapyPage>
  );
}
