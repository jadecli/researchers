"use client";
import { ScrapyPage } from "@/components/ScrapyPage";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { Code } from "@/components/Code";
import { TabGroup } from "@/components/TabGroup";
import { Collapsible } from "@/components/Collapsible";

export default function InstallationPage() {
  return (
    <ScrapyPage
      breadcrumb="Installation"
      title="Installation Guide"
      subtitle="Set up Scrapy and its dependencies for documentation crawling. We recommend uv for modern Python packaging, but pip works too."
      prev={{ label: "At a Glance", href: "/scrapy/first-steps/at-a-glance" }}
      next={{ label: "Tutorial", href: "/scrapy/first-steps/tutorial" }}
    >
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[#faf9f5]">Prerequisites</h2>
        <p className="text-sm text-[#b0aea5] leading-relaxed">
          Scrapy 2.14 requires <Code>Python 3.9+</Code>, but we target <Code>3.12+</Code> for
          performance improvements in the async runtime. Verify your Python version first.
        </p>
      </div>

      <CodeBlock language="bash" title="Check Python version">
{`python3 --version
# Python 3.12.4 (or higher)

# If you need to install Python 3.12:
# macOS: brew install python@3.12
# Ubuntu: sudo apt install python3.12`}
      </CodeBlock>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[#faf9f5]">Install Scrapy</h2>
        <p className="text-sm text-[#b0aea5] leading-relaxed">
          Choose your preferred package manager. Both approaches install
          identical packages — the difference is in dependency resolution speed
          and PEP 668 compliance.
        </p>
      </div>

      <TabGroup
        tabs={[
          {
            label: "uv (recommended)",
            content: (
              <div className="space-y-4">
                <CodeBlock language="bash" title="Install with uv">
{`# Install uv if you haven't already
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create a virtual environment and install
uv venv .venv
source .venv/bin/activate
uv pip install scrapy==2.14.0`}
                </CodeBlock>
                <Callout type="tip">
                  We use <Code>uv</Code> across all AgentTasks Python projects. It resolves
                  dependencies 10-100x faster than pip and respects PEP 668 externally-managed
                  environments out of the box — no more <Code>--break-system-packages</Code> flags.
                </Callout>
              </div>
            ),
          },
          {
            label: "pip",
            content: (
              <div className="space-y-4">
                <CodeBlock language="bash" title="Install with pip">
{`# Create a virtual environment first
python3 -m venv .venv
source .venv/bin/activate

# Install Scrapy
pip install scrapy==2.14.0`}
                </CodeBlock>
                <Callout type="note">
                  Always use a virtual environment. On modern Linux distros (Debian 12+,
                  Ubuntu 23.04+), installing packages globally with pip is blocked by PEP 668.
                </Callout>
              </div>
            ),
          },
        ]}
      />

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[#faf9f5]">Project Dependencies</h2>
        <p className="text-sm text-[#b0aea5] leading-relaxed">
          Our crawlers use several additional packages beyond Scrapy itself.
          Here is the full requirements file from the <Code>claude-code</Code> directory.
        </p>
      </div>

      <CodeBlock language="text" title="requirements.txt">
{`scrapy==2.14.0
scrapy-playwright==0.0.41
twisted[tls]==24.7.0
psycopg2-binary==2.9.9
python-dotenv==1.0.1
w3lib==2.2.1
itemloaders==1.3.2`}
      </CodeBlock>

      <Collapsible title="Platform-specific Notes">
        <div className="space-y-3 text-sm text-[#b0aea5] leading-relaxed">
          <p>
            <strong className="text-[#faf9f5]">macOS:</strong> You may need to install
            OpenSSL via Homebrew (<Code>brew install openssl</Code>) for TLS support
            in Twisted.
          </p>
          <p>
            <strong className="text-[#faf9f5]">Linux:</strong> Install system dependencies
            with <Code>sudo apt install python3-dev libxml2-dev libxslt1-dev libffi-dev</Code> for
            lxml and cryptography compilation.
          </p>
          <p>
            <strong className="text-[#faf9f5]">Windows:</strong> We recommend WSL2 for
            running Scrapy. Native Windows support exists but Twisted async performance
            is reduced without the epoll/kqueue reactor.
          </p>
        </div>
      </Collapsible>

      <CodeBlock language="bash" title="Verify installation">
{`# Confirm Scrapy is installed and accessible
scrapy version
# Scrapy 2.14.0

# Check that Twisted is available
python3 -c "import twisted; print(twisted.__version__)"
# 24.7.0`}
      </CodeBlock>

      <Callout type="warning">
        If you see <Code>ImportError: No module named _cffi_backend</Code>, install
        the <Code>cffi</Code> package separately: <Code>uv pip install cffi</Code>. This
        is a known issue on some macOS ARM64 systems.
      </Callout>
    </ScrapyPage>
  );
}
