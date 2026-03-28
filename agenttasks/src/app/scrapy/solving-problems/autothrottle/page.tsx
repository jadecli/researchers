"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function AutoThrottlePage() {
  return (
    <ScrapyPage
      breadcrumb="AutoThrottle"
      title="AutoThrottle"
      subtitle="Scrapy's AutoThrottle extension automatically adjusts download delays based on server response times to crawl politely and efficiently."
      prev={{ label: "Deploying", href: "/scrapy/solving-problems/deploying" }}
      next={{ label: "Benchmarking", href: "/scrapy/solving-problems/benchmarking" }}
    >
      <div className="space-y-6">
        <Collapsible title="Enabling AutoThrottle" defaultOpen>
          <p className="text-sm text-[#b0aea5] mb-3">
            Enable AutoThrottle in settings. It adjusts delays between{" "}
            <Code>DOWNLOAD_DELAY</Code> and <Code>AUTOTHROTTLE_MAX_DELAY</Code>{" "}
            based on latency.
          </p>
          <CodeBlock language="python" title="settings.py">
{`AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 1
AUTOTHROTTLE_MAX_DELAY = 10
AUTOTHROTTLE_TARGET_CONCURRENCY = 2.0

# Debug mode shows throttle adjustments in logs
AUTOTHROTTLE_DEBUG = True`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="How It Works">
          <p className="text-sm text-[#b0aea5] mb-3">
            AutoThrottle measures server response latency and adjusts the download
            delay to maintain <Code>AUTOTHROTTLE_TARGET_CONCURRENCY</Code> parallel
            requests per domain.
          </p>
          <CodeBlock language="python" title="algorithm">
{`# Simplified throttle logic:
# latency = time to receive response headers
# target = AUTOTHROTTLE_TARGET_CONCURRENCY
# delay = latency / target
#
# If server responds in 0.5s with target=2.0:
#   delay = 0.5 / 2.0 = 0.25s between requests`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Tuning for Doc Sites">
          <p className="text-sm text-[#b0aea5] mb-3">
            Documentation sites are typically low-traffic. Use higher concurrency
            with a reasonable max delay.
          </p>
          <CodeBlock language="python" title="doc site tuning">
{`# Aggressive but polite for doc sites
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 0.5
AUTOTHROTTLE_MAX_DELAY = 5
AUTOTHROTTLE_TARGET_CONCURRENCY = 4.0
DOWNLOAD_DELAY = 0.25  # minimum delay floor`}
          </CodeBlock>
        </Collapsible>

        <Callout type="tip">
          AgentTasks enables AutoThrottle on all production crawls. It prevents
          getting blocked while maximizing throughput automatically.
        </Callout>
      </div>
    </ScrapyPage>
  );
}
