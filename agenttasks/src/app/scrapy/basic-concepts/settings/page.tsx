"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";
import { TabGroup } from "@/components/TabGroup";

export default function SettingsPage() {
  return (
    <ScrapyPage
      breadcrumb="Settings"
      title="Settings"
      subtitle="Configure Scrapy behavior globally, per-spider, or from the command line. Settings control concurrency, politeness, and custom behavior."
      prev={{ label: "Link Extractors", href: "/scrapy/basic-concepts/link-extractors" }}
      next={{ label: "Exceptions", href: "/scrapy/basic-concepts/exceptions" }}
    >
      <Collapsible title="Settings Precedence" defaultOpen>
        <p className="text-sm text-[#b0aea5] mb-3">
          Settings are resolved in this order (highest priority first): command line <Code>-s</Code>,
          per-spider <Code>custom_settings</Code>, project <Code>settings.py</Code>, defaults.
        </p>
        <TabGroup tabs={[
          { label: "settings.py", content: (
            <CodeBlock language="python" title="Project-level settings">
{`# settings.py
BOT_NAME = "researchers"
ROBOTSTXT_OBEY = True
CONCURRENT_REQUESTS = 8
DOWNLOAD_DELAY = 1.0
USER_AGENT = "ResearchersBot/1.0"`}
            </CodeBlock>
          )},
          { label: "Per-Spider", content: (
            <CodeBlock language="python" title="Spider-level overrides">
{`class LlmsFullSpider(scrapy.Spider):
    name = "llms_full"
    custom_settings = {
        "CONCURRENT_REQUESTS": 4,
        "DOWNLOAD_DELAY": 2.0,
        "DEPTH_LIMIT": 3,
    }`}
            </CodeBlock>
          )},
          { label: "Command Line", content: (
            <CodeBlock language="bash" title="Runtime overrides">
{`# Override any setting with -s
scrapy crawl llms_full \\
  -s CONCURRENT_REQUESTS=2 \\
  -s DOWNLOAD_DELAY=3.0 \\
  -s LOG_LEVEL=DEBUG`}
            </CodeBlock>
          )},
        ]} />
      </Collapsible>

      <Collapsible title="Key Built-in Settings" accent="#6a9bcc">
        <p className="text-sm text-[#b0aea5] mb-3">
          These are the settings you will adjust most often when tuning crawl behavior.
        </p>
        <CodeBlock language="python" title="Common settings">
{`# Concurrency — max parallel requests
CONCURRENT_REQUESTS = 16           # global
CONCURRENT_REQUESTS_PER_DOMAIN = 8 # per domain

# Politeness — delay between requests
DOWNLOAD_DELAY = 0.5               # seconds

# Respect robots.txt
ROBOTSTXT_OBEY = True

# Identity
USER_AGENT = "MyBot/1.0 (+https://example.com/bot)"

# Timeouts
DOWNLOAD_TIMEOUT = 30              # seconds`}
        </CodeBlock>
      </Collapsible>

      <Callout type="warning">
        Always set <Code>ROBOTSTXT_OBEY = True</Code> in production. Ignoring robots.txt can get
        your IP blocked and violates crawling etiquette.
      </Callout>

      <Collapsible title="Our Custom Settings" accent="#d97757">
        <p className="text-sm text-[#b0aea5] mb-3">
          We define project-specific settings that our custom pipelines and middleware consume.
        </p>
        <CodeBlock language="python" title="Custom project settings">
{`# Quality gate — items scoring below this are dropped
QUALITY_THRESHOLD = 40

# Delta crawling — skip pages unchanged since last run
DELTAFETCH_ENABLED = True
DELTAFETCH_DIR = ".deltafetch"

# Content limits
MAX_CONTENT_LENGTH = 5_000_000     # 5MB
HEAD_CHECK_ENABLED = True`}
        </CodeBlock>
      </Collapsible>

      <Collapsible title="Accessing Settings in Code" accent="#788c5d">
        <p className="text-sm text-[#b0aea5] mb-3">
          Read settings from the spider via <Code>self.settings</Code> or from a pipeline
          via <Code>spider.settings</Code>.
        </p>
        <CodeBlock language="python" title="Reading settings">
{`# In a spider
threshold = self.settings.getint("QUALITY_THRESHOLD", 40)
enabled = self.settings.getbool("DELTAFETCH_ENABLED", False)

# In a pipeline
def process_item(self, item, spider):
    max_len = spider.settings.getint("MAX_CONTENT_LENGTH", 5_000_000)
    if len(item.get("content", "")) > max_len:
        raise DropItem("Content too large")`}
        </CodeBlock>
      </Collapsible>

      <Callout type="note">
        Use typed getters like <Code>getint()</Code>, <Code>getbool()</Code>, and <Code>getfloat()</Code> instead
        of raw <Code>get()</Code> to avoid type-coercion bugs.
      </Callout>
    </ScrapyPage>
  );
}
