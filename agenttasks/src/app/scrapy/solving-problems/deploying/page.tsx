"use client";

import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Collapsible } from "@/components/Collapsible";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";

export default function DeployingPage() {
  return (
    <ScrapyPage
      breadcrumb="Deploying"
      title="Deploying Spiders"
      subtitle="Deploy Scrapy spiders with Scrapyd, Docker, or CI pipelines. AgentTasks uses GitHub Actions for automated crawl deployment."
      prev={{ label: "Files & Images", href: "/scrapy/solving-problems/files-images" }}
      next={{ label: "AutoThrottle", href: "/scrapy/solving-problems/autothrottle" }}
    >
      <div className="space-y-6">
        <Collapsible title="Scrapyd Deployment" defaultOpen>
          <p className="text-sm text-[#b0aea5] mb-3">
            <Code>scrapyd</Code> is a daemon for deploying and running spiders
            remotely. Use <Code>scrapyd-deploy</Code> to push your project.
          </p>
          <CodeBlock language="bash" title="scrapyd">
{`# Install and start scrapyd
pip install scrapyd scrapyd-client
scrapyd

# Deploy from project root
scrapyd-deploy default -p agenttasks_crawler

# Schedule a crawl
curl http://localhost:6800/schedule.json \\
  -d project=agenttasks_crawler -d spider=docs`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="Docker Deployment">
          <p className="text-sm text-[#b0aea5] mb-3">
            Containerize your Scrapy project for reproducible deployments across
            environments.
          </p>
          <CodeBlock language="dockerfile" title="Dockerfile">
{`FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["scrapy", "crawl", "docs", "-o", "/output/results.jsonl"]`}
          </CodeBlock>
        </Collapsible>

        <Collapsible title="GitHub Actions">
          <p className="text-sm text-[#b0aea5] mb-3">
            AgentTasks triggers crawls via GitHub Actions on a schedule, storing
            results in Postgres for downstream processing.
          </p>
          <CodeBlock language="yaml" title=".github/workflows/crawl.yml">
{`name: Scheduled Crawl
on:
  schedule:
    - cron: "0 6 * * 1"  # Every Monday at 6 AM
jobs:
  crawl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements.txt
      - run: scrapy crawl docs -s LOG_LEVEL=INFO`}
          </CodeBlock>
        </Collapsible>

        <Callout type="note">
          For production, prefer Docker or GitHub Actions over Scrapyd. Scrapyd
          lacks built-in auth and is best suited for development environments.
        </Callout>
      </div>
    </ScrapyPage>
  );
}
