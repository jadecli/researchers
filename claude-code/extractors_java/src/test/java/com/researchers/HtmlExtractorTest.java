package com.researchers;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class HtmlExtractorTest {

    private HtmlExtractor extractor;

    @BeforeEach
    void setUp() {
        extractor = new HtmlExtractor();
    }

    @Test
    void extractBasicPage() {
        String html = """
                <html>
                <head><title>Test Page</title></head>
                <body>
                    <main>
                        <h1>Main Heading</h1>
                        <p>This is a paragraph with enough content to be detected as the main content area of the page for extraction.</p>
                        <h2>Sub Heading</h2>
                        <p>Another paragraph with additional text content for the extraction system to process and convert to markdown.</p>
                    </main>
                </body>
                </html>
                """;

        Map<String, Object> result = extractor.extract(html);

        assertEquals("Test Page", result.get("title"));
        String content = (String) result.get("content");
        assertTrue(content.contains("Main Heading"));
        assertTrue(content.contains("Sub Heading"));
    }

    @Test
    void extractCodeBlocks() {
        String html = """
                <html><body><main>
                    <h1>Code Example</h1>
                    <p>Sufficient padding content so the main area detection works for this test case properly.</p>
                    <pre><code class="language-python">def hello():
                        print("hello")</code></pre>
                    <p>More content after the code block to ensure proper extraction of all elements.</p>
                </main></body></html>
                """;

        Map<String, Object> result = extractor.extract(html);

        @SuppressWarnings("unchecked")
        List<Map<String, String>> codeBlocks = (List<Map<String, String>>) result.get("codeBlocks");
        assertFalse(codeBlocks.isEmpty());
        assertEquals("python", codeBlocks.get(0).get("language"));
        assertTrue(codeBlocks.get(0).get("content").contains("def hello()"));
    }

    @Test
    void extractLinks() {
        String html = """
                <html><body><main>
                    <h1>Links Page</h1>
                    <p>Content with enough text to be detected as the main content area for this test.</p>
                    <a href="/docs/guide">Internal Guide</a>
                    <a href="https://external.com/page">External Page</a>
                    <p>More padding content for the main area detection to work correctly in testing.</p>
                </main></body></html>
                """;

        Map<String, Object> result = extractor.extract(html);

        @SuppressWarnings("unchecked")
        List<Map<String, String>> links = (List<Map<String, String>>) result.get("links");
        assertFalse(links.isEmpty());

        boolean hasInternal = links.stream()
                .anyMatch(l -> l.get("href").equals("/docs/guide"));
        assertTrue(hasInternal, "Should find internal link");
    }

    @Test
    void extractRemovesNavigation() {
        String html = """
                <html><body>
                    <nav><a href="/">Home</a></nav>
                    <main>
                        <h1>Content</h1>
                        <p>The actual content that should be extracted without navigation elements being included.</p>
                    </main>
                    <footer><p>Footer content that should be removed</p></footer>
                </body></html>
                """;

        Map<String, Object> result = extractor.extract(html);
        String content = (String) result.get("content");

        assertFalse(content.contains("Home"), "Navigation should be removed");
        assertFalse(content.contains("Footer content"), "Footer should be removed");
        assertTrue(content.contains("Content"));
    }

    @Test
    void extractHeadings() {
        String html = """
                <html><body><main>
                    <h1>Title</h1>
                    <p>Some text padding for main content detection to work in this test scenario.</p>
                    <h2>Section One</h2>
                    <p>Content for section one with enough text for the detection system.</p>
                    <h3>Sub Section</h3>
                    <p>Content for sub section.</p>
                </main></body></html>
                """;

        Map<String, Object> result = extractor.extract(html);

        @SuppressWarnings("unchecked")
        List<Map<String, String>> headings = (List<Map<String, String>>) result.get("headings");
        assertEquals(3, headings.size());
        assertEquals("1", headings.get(0).get("level"));
        assertEquals("Title", headings.get(0).get("text"));
        assertEquals("2", headings.get(1).get("level"));
        assertEquals("3", headings.get(2).get("level"));
    }

    @Test
    void extractEmptyHtml() {
        Map<String, Object> result = extractor.extract("");
        assertNotNull(result);
        assertEquals("", result.get("title"));
    }
}
