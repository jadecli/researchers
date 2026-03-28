"use client";
import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function AddonsPage() {
  return (
    <ScrapyPage
      breadcrumb="Add-ons"
      title="Add-ons"
      subtitle="Scrapy's add-on system lets third-party packages hook into the framework lifecycle. Add-ons can register middleware, pipelines, and extensions in a single self-contained package."
      prev={{ label: "Architecture", href: "/scrapy/extending/architecture" }}
      next={{ label: "Downloader MW", href: "/scrapy/extending/downloader-middleware" }}
    >
      <Collapsible title="Add-on Discovery" defaultOpen>
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          Scrapy discovers add-ons via the <Code>ADDONS</Code> setting. Each add-on
          is a class that implements an <Code>update_settings</Code> method, letting it
          configure itself without manual wiring.
        </p>
        <CodeBlock language="python" title="settings.py">
{`ADDONS = {
    "scrapy_deltafetch.DeltaFetchAddon": 100,
    "agenttasks.addons.QualityAddon": 200,
}`}
        </CodeBlock>
      </Collapsible>

      <Callout type="note">
        Add-ons are loaded before middleware and pipelines. This means an add-on
        can dynamically inject or remove middleware entries based on environment
        variables or crawler state.
      </Callout>

      <Collapsible title="Writing a Custom Add-on">
        <p className="text-sm text-[#b0aea5] leading-relaxed mb-3">
          In AgentTasks, our <Code>QualityAddon</Code> registers the quality scoring
          pipeline and the crawl tracker extension in one place, keeping configuration
          centralized.
        </p>
        <CodeBlock language="python" title="agenttasks/addons.py">
{`class QualityAddon:
    """Add-on that wires quality scoring into the crawl."""

    @classmethod
    def update_settings(cls, settings):
        settings["ITEM_PIPELINES"][
            "agenttasks.pipelines.QualityScorePipeline"
        ] = 100
        settings["EXTENSIONS"][
            "agenttasks.extensions.CrawlQualityTracker"
        ] = 500`}
        </CodeBlock>
      </Collapsible>

      <Callout type="tip">
        Use add-ons instead of manually editing <Code>DOWNLOADER_MIDDLEWARES</Code> and{" "}
        <Code>ITEM_PIPELINES</Code> when packaging reusable crawl features. The add-on
        pattern ensures all related settings travel together.
      </Callout>
    </ScrapyPage>
  );
}
