import { describe, it, expect } from "vitest";
import { parseHtml } from "../src/html-parser.js";

describe("parseHtml", () => {
  it("extracts title from h1", () => {
    const html = `
      <html>
        <head><title>Test Page</title></head>
        <body>
          <main>
            <h1>Main Title</h1>
            <p>This is a paragraph with enough content to be considered valid main content for the extraction system.</p>
            <p>Another paragraph to add more content to the page for testing purposes and validation.</p>
          </main>
        </body>
      </html>
    `;
    const result = parseHtml(html, "https://example.com/test");
    expect(result.title).toBe("Test Page");
    expect(result.url).toBe("https://example.com/test");
  });

  it("extracts code blocks with language", () => {
    const html = `
      <html>
        <body>
          <main>
            <h1>Code Examples</h1>
            <p>Here is a code example with enough surrounding text to be detected as main content area.</p>
            <pre><code class="language-python">def hello():
    print("Hello, world!")
    return True</code></pre>
            <p>More text after the code block to ensure we have enough content for detection.</p>
          </main>
        </body>
      </html>
    `;
    const result = parseHtml(html, "https://example.com/code");
    expect(result.codeBlocks.length).toBeGreaterThan(0);
    expect(result.codeBlocks[0].language).toBe("python");
    expect(result.codeBlocks[0].content).toContain("def hello()");
  });

  it("extracts links", () => {
    const html = `
      <html>
        <body>
          <main>
            <h1>Links Page</h1>
            <p>Some text content that is long enough for the main content detection system to identify this as the main area.</p>
            <a href="/docs/guide">Guide</a>
            <a href="https://other.com/page">External</a>
            <p>Additional content for padding the main content area so detection works properly.</p>
          </main>
        </body>
      </html>
    `;
    const result = parseHtml(html, "https://example.com/links");
    expect(result.links.length).toBe(2);

    const internalLink = result.links.find((l) => l.href === "/docs/guide");
    expect(internalLink).toBeDefined();
    expect(internalLink!.isInternal).toBe(true);

    const externalLink = result.links.find((l) => l.href.includes("other.com"));
    expect(externalLink).toBeDefined();
    expect(externalLink!.isInternal).toBe(false);
  });

  it("extracts metadata from meta tags", () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="OG Title" />
          <meta name="description" content="Page description here" />
          <meta name="author" content="Test Author" />
          <meta name="keywords" content="test, example, html" />
          <link rel="canonical" href="https://example.com/canonical" />
        </head>
        <body>
          <main>
            <h1>Content Page</h1>
            <p>Sufficient content for the main content detector to work correctly with this test page.</p>
          </main>
        </body>
      </html>
    `;
    const result = parseHtml(html, "https://example.com/meta");
    expect(result.metadata.title).toBe("OG Title");
    expect(result.metadata.description).toBe("Page description here");
    expect(result.metadata.author).toBe("Test Author");
    expect(result.metadata.tags).toContain("test");
    expect(result.metadata.canonicalUrl).toBe("https://example.com/canonical");
  });

  it("removes navigation and non-content elements", () => {
    const html = `
      <html>
        <body>
          <nav><a href="/">Home</a><a href="/about">About</a></nav>
          <header><h1>Site Header</h1></header>
          <main>
            <h1>Article Title</h1>
            <p>The actual main content of this article should be extracted properly without navigation elements interfering.</p>
            <p>More content paragraphs to fill out the page content for proper extraction testing.</p>
          </main>
          <footer><p>Copyright 2024</p></footer>
        </body>
      </html>
    `;
    const result = parseHtml(html, "https://example.com/clean");
    expect(result.content).not.toContain("Site Header");
    expect(result.content).toContain("Article Title");
    expect(result.content).not.toContain("Copyright");
  });

  it("handles empty html gracefully", () => {
    const result = parseHtml("", "https://example.com/empty");
    expect(result.url).toBe("https://example.com/empty");
    expect(result.title).toBe("");
    expect(result.codeBlocks).toEqual([]);
    expect(result.links).toEqual([]);
  });

  it("extracts multiple code blocks", () => {
    const html = `
      <html>
        <body>
          <main>
            <h1>Multi Code</h1>
            <p>First example demonstrates a JavaScript function with modern syntax for web development.</p>
            <pre><code class="language-javascript">const x = 42;
console.log(x);</code></pre>
            <p>Second example shows a shell command for running the development server.</p>
            <pre><code class="language-shell">npm install
npm run dev</code></pre>
          </main>
        </body>
      </html>
    `;
    const result = parseHtml(html, "https://example.com/multi");
    expect(result.codeBlocks.length).toBeGreaterThanOrEqual(2);
  });
});
