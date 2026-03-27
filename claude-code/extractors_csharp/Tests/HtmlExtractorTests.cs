using Xunit;
using Researchers.Extractors;

namespace Researchers.Extractors.Tests;

public class HtmlExtractorTests
{
    private readonly HtmlExtractor _extractor = new();

    [Fact]
    public async Task ExtractBasicPage()
    {
        var html = @"
            <html>
            <head><title>Test Page</title></head>
            <body>
                <main>
                    <h1>Main Heading</h1>
                    <p>This is a paragraph with enough content to be detected as the main content area of the page.</p>
                    <h2>Sub Heading</h2>
                    <p>Another paragraph with additional text for the extraction system to process correctly.</p>
                </main>
            </body>
            </html>";

        var result = await _extractor.ExtractAsync(html);

        Assert.Equal("Test Page", result.Title);
        Assert.Contains("Main Heading", result.Content);
        Assert.Contains("Sub Heading", result.Content);
    }

    [Fact]
    public async Task ExtractCodeBlocks()
    {
        var html = @"
            <html><body><main>
                <h1>Code Example</h1>
                <p>Sufficient padding content so the main area detection works for this test case.</p>
                <pre><code class=""language-python"">def hello():
    print(""hello"")</code></pre>
                <p>More content to pad the main area.</p>
            </main></body></html>";

        var result = await _extractor.ExtractAsync(html);

        Assert.NotEmpty(result.CodeBlocks);
        Assert.Equal("python", result.CodeBlocks[0].Language);
        Assert.Contains("def hello()", result.CodeBlocks[0].Content);
    }

    [Fact]
    public async Task ExtractRemovesNavigation()
    {
        var html = @"
            <html><body>
                <nav><a href=""/"">Home</a></nav>
                <main>
                    <h1>Content Title</h1>
                    <p>Main content text that should be extracted without navigation interference.</p>
                </main>
                <footer><p>Footer text</p></footer>
            </body></html>";

        var result = await _extractor.ExtractAsync(html);

        Assert.DoesNotContain("Home", result.Content);
        Assert.DoesNotContain("Footer text", result.Content);
        Assert.Contains("Content Title", result.Content);
    }

    [Fact]
    public async Task ExtractLinks()
    {
        var html = @"
            <html><body><main>
                <h1>Links Page</h1>
                <p>Content with links for testing the link extraction functionality properly.</p>
                <a href=""/docs/guide"">Guide</a>
                <a href=""https://external.com"">External</a>
                <p>More padding text.</p>
            </main></body></html>";

        var result = await _extractor.ExtractAsync(html);

        Assert.NotEmpty(result.Links);
        Assert.Contains(result.Links, l => l.Href == "/docs/guide" && l.IsInternal);
        Assert.Contains(result.Links, l => l.Href == "https://external.com" && !l.IsInternal);
    }

    [Fact]
    public async Task ExtractHeadings()
    {
        var html = @"
            <html><body><main>
                <h1>Title</h1>
                <p>Some text content for main area detection to work in this test.</p>
                <h2>Section</h2>
                <p>Section content.</p>
                <h3>Subsection</h3>
                <p>Subsection content.</p>
            </main></body></html>";

        var result = await _extractor.ExtractAsync(html);

        Assert.Equal(3, result.Headings.Count);
        Assert.Equal(1, result.Headings[0].Level);
        Assert.Equal("Title", result.Headings[0].Text);
        Assert.Equal(2, result.Headings[1].Level);
        Assert.Equal(3, result.Headings[2].Level);
    }

    [Fact]
    public void QualityScorerBasic()
    {
        var score = QualityScorer.Score("");
        Assert.Equal(0.0, score);

        var goodContent = @"# Title

This is well-structured content with multiple sections.

## Section One

A paragraph of text that explains concepts clearly.

```python
def example():
    pass
```

## Section Two

- Item one
- Item two
- Item three

[Link text](https://example.com)";

        var goodScore = QualityScorer.Score(goodContent);
        Assert.True(goodScore > 0.3, $"Expected decent score, got {goodScore}");
    }
}
